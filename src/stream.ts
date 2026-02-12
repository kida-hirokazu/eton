import { TransformStream } from "node:stream/web";
import { encodeBatch } from "./encoder";
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
        if (records.length > 0) return records[0] as string[];
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
    constructor(schemaId: string = "Root", initialSchemas: SchemaMap = {}) {
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
                const [encoded, newState] = encodeBatch([chunk], schemaId, initialSchemas, state, { audit: false });

                // Identify new symbols (Diffing)
                const newKeys = Array.from(newState.stringMap.keys()).filter(k => !state.stringMap.has(k));

                if (newKeys.length > 0) {
                    controller.enqueue("%Symbol\n");
                    for (const key of newKeys) {
                        const sym = newState.stringMap.get(key)!;
                        // Escape key if needed? serializeDictionary handles it.
                        const escapedKey = key.includes(",") || key.includes('"') || key.includes("\n")
                            ? `"${key.replace(/"/g, '""')}"`
                            : key;
                        controller.enqueue(`${escapedKey},${sym}\n`);
                    }
                    // Explicitly switch back to data mode
                    controller.enqueue("%Data\n");
                }

                // Emit Header only once
                if (!hasEmittedHeader) {
                    // Emit Schema
                    const schemaFields = initialSchemas[schemaId].join(",");
                    controller.enqueue(`%Schema:${schemaId}\n${schemaFields}\n`);
                    hasEmittedHeader = true;
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

        super({
            transform(chunk, controller) {
                buffer += chunk;
                const lines = buffer.split("\n");
                // Last line might be incomplete
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    // Schema Definition
                    if (trimmed.startsWith("%Schema:")) {
                        // Header line
                        isSymbolBlock = false;
                        continue;
                    }
                    if (trimmed.startsWith("%Schema")) {
                        // Default schema block start
                        isSymbolBlock = false;
                        continue;
                    }

                    // Explicit Data Marker
                    if (trimmed.startsWith("%Data")) {
                        isSymbolBlock = false;
                        continue;
                    }

                    // Dictionary Block
                    if (trimmed.startsWith("%Symbol")) {
                        isSymbolBlock = true;
                        continue;
                    }

                    // Dictionary Entry
                    if (isSymbolBlock) {
                        // Parse Dict
                        const match = trimmed.match(/^(.*),(@\d+)$/);
                        if (match) {
                            let key = match[1];
                            const sym = match[2];
                            if (key.startsWith('"') && key.endsWith('"')) {
                                key = key.slice(1, -1).replace(/""/g, '"');
                            }
                            state.stringMap.set(key, sym);
                        }
                        continue;
                    }

                    // Data Row
                    if (trimmed.includes(",") || trimmed.includes('"')) {
                        // Hack for now: If we don't have schema fields yet, this is it.
                        if (currentSchema.length === 0) {
                            currentSchema = decodeRow(trimmed);
                            continue;
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

                            // Number? Boolean?
                            if (val === "true") val = true as any;
                            else if (val === "false") val = false as any;
                            else if (!isNaN(Number(val)) && val !== "") val = Number(val) as any;

                            record[field] = val;
                        });
                        controller.enqueue(record);
                    }
                }
            }
        });
    }
}
