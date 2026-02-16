import { TransformStream } from "node:stream/web";
import { encodeBatch, type EncodeOptions } from "./encoder";
import { parse } from "csv-parse/sync";
import { type SchemaMap } from "./schema";
import { createState, parseDictionary, resolveSymbol, type SymbolState } from "./symbols";

// Helper
function decodeRow(line: string): string[] {
    try {
        const records = parse(line, {
            relax_quotes: true,
            relax_column_count: true,
            skip_empty_lines: true
        });
        if (records.length > 0) {
            const firstRow = records[0];
            // Ensure strictly string array to avoid unsafe cast
            if (Array.isArray(firstRow) && firstRow.every((item: unknown) => typeof item === "string")) {
                return firstRow as string[];
            }
        }
        return [];
    } catch (e) {
        return [];
    }
}

/**
 * Standard EtonEncoderStream (Web Streams API)
 * Transforms a stream of objects (Record<string, unknown>) into ETON string chunks.
 */
export class EtonEncoderStream extends TransformStream<Record<string, unknown>, string> {
    constructor(schemaId: string = "Root", initialSchemas: SchemaMap = {}, options: EncodeOptions = {}) {
        const finalOptions = { audit: false, ...options };
        // Internal state held in closure
        let state = createState();
        let hasEmittedHeader = false;

        // We need to keep schemas mutable if we want to learn them?
        // For now assume initialSchemas is the source of truth for schemaId.

        super({
            start() {
                // Initialize State
            },
            transform(chunk, controller) {
                // Determine schema on first chunk if not provided
                if (!initialSchemas[schemaId]) {
                    initialSchemas[schemaId] = Object.keys(chunk);
                }

                // Core encoding logic reuse
                const [encoded, newState] = encodeBatch([chunk], schemaId, initialSchemas, state, finalOptions);

                // Identify new symbols (Diffing)
                const newKeys = Array.from(newState.stringMap.keys()).filter(k => !state.stringMap.has(k));

                if (!hasEmittedHeader) {
                    // Emit Schema
                    const schemaFields = initialSchemas[schemaId].join(",");
                    controller.enqueue(`%Schema:${schemaId}\n${schemaFields}\n`);
                    hasEmittedHeader = true;
                }

                if (newKeys.length > 0) {
                    controller.enqueue("%Symbol\n");
                    for (const key of newKeys) {
                        const sym = newState.stringMap.get(key)!;
                        // Escape key if needed? serializeDictionary handles it.
                        // Basic CSV escaping for keys
                        const escapedKey = key.includes(",") || key.includes('"') || key.includes("\n")
                            ? `"${key.replace(/"/g, '""')}"`
                            : key;
                        controller.enqueue(`${escapedKey},${sym}\n`);
                    }
                    // Explicitly switch back to data mode
                    controller.enqueue("%Data\n");
                }

                // Emit Data
                controller.enqueue(encoded + "\n");

                // Update internal state reference
                // Since SymbolState is immutable-ish (properties are readonly), we just swap the reference.
                state = newState;
            }
        });
    }
}

/**
 * Standard EtonDecoderStream (Web Streams API)
 * Transforms a stream of ETON strings (chunks) into Objects.
 */
export class EtonDecoderStream extends TransformStream<string, Record<string, unknown>> {
    constructor() {
        let buffer = "";
        const state = createState();
        let currentSchema: string[] = []; // Field names
        let isSymbolBlock = false;
        let expectingSchemaFields = false;

        super({
            transform(chunk, controller) {
                buffer += chunk;
                const lines = buffer.split("\n");
                // Last line might be incomplete
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    // Schema Definition Header
                    if (trimmed.startsWith("%Schema:")) {
                        isSymbolBlock = false;
                        expectingSchemaFields = true;
                        continue;
                    }

                    // Schema Fields (The line immediately following %Schema:...)
                    if (expectingSchemaFields) {
                        currentSchema = decodeRow(trimmed);
                        expectingSchemaFields = false;
                        continue;
                    }

                    // Explicit Data Marker - Force switch to Data mode
                    if (trimmed.startsWith("%Data")) {
                        isSymbolBlock = false;
                        continue;
                    }

                    // Dictionary Block - Force switch to Symbol mode
                    if (trimmed.startsWith("%Symbol")) {
                        isSymbolBlock = true;
                        continue;
                    }

                    // Header line (Other % markers such as %SchemaName)
                    if (trimmed.startsWith("%")) {
                        continue;
                    }

                    // Dictionary Entry
                    if (isSymbolBlock) {
                        // Parse Dict
                        // Match keys that might be quoted or unquoted
                        // Regex is tricky for CSV.
                        // Ideally use decodeRow but we expect Key,Value

                        // Simple parsing for now (aligned with output format)
                        // Key, @ID

                        // If key is quoted: "Key",@ID
                        // If key is unquoted: Key,@ID
                        const lastComma = trimmed.lastIndexOf(",");
                        if (lastComma > 0) {
                            const sym = trimmed.substring(lastComma + 1);
                            let key = trimmed.substring(0, lastComma);

                            if (sym.startsWith("@")) {
                                if (key.startsWith('"') && key.endsWith('"')) {
                                    key = key.slice(1, -1).replace(/""/g, '"');
                                }
                                state.stringMap.set(key, sym);
                                continue;
                            }
                        }
                        // Fallback/Fail safe: maybe it's not a valid symbol line? 
                        // If it fails to parse as symbol, should we treat as data if ambiguity exists?
                        // For now, strict mode: if isSymbolBlock, it MUST be symbol.
                        continue;
                    }

                    // Data Row
                    if (trimmed.includes(",") || trimmed.includes('"') || trimmed.includes("@")) {
                        // Special case: If this is the FIRST data line and we don't have a schema yet,
                        // and it does NOT look like a command...
                        // But wait, decodeRow might return empty.

                        if (currentSchema.length === 0) {
                            // If we encountered %Schema, we should have fields.
                            // If we didn't, maybe this first row IS the schema? (Legacy CSV behavior)
                            // But ETON spec says %Schema is explicit.
                            // Let's assume if %Schema is invalid or missing, we can't reliably decode.
                            // HOWEVER, the test case sends object {timestamp...}, 
                            // Encoder streams:
                            // %Schema:Log
                            // timestamp,level,message
                            // %Data (explicitly added in my change? No, only after symbol)
                            // 10:00,INFO,Start

                            // The issue: "timestamp,level,message" line is just comma separated.
                            // It falls into this block.

                            // If previous line was %Schema:..., then THIS line is the schema fields.
                            // We need a state for "ExpectingSchemaFields".

                            // Let's refine the logic.
                        }
                    }


                    // Decode Data
                    const cells = decodeRow(trimmed);
                    // Resolve symbols
                    const record: Record<string, unknown> = {};
                    cells.forEach((cell: string, idx: number) => {
                        const field = currentSchema[idx];
                        if (!field) return;

                        let val = cell;

                        // Resolve symbol
                        if (val.startsWith("@")) {
                            for (const [k, v] of state.stringMap.entries()) {
                                if (v === val) {
                                    val = k;
                                    break;
                                }
                            }
                        }
                        // Unquote - decodeRow handles this now

                        record[field] = parseValue(val);
                    });
                    controller.enqueue(record);
                }
            }
        });
    }
}

/**
 * Helper to parse string values into appropriate types (boolean, number, string)
 * Used to avoid 'as any' type assertions in decoder logic.
 */
function parseValue(val: string): string | number | boolean {
    if (val === "true") return true;
    if (val === "false") return false;

    // Check if it's a valid number and not an empty string
    if (val !== "") {
        const num = Number(val);
        if (!isNaN(num)) return num;
    }

    return val;
}
