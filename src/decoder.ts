/**
 * ETON Decoder (Debug & Validation)
 *
 * Primary purpose: Validate structure and debug content.
 * Not intended for high-performance production deserialization in the initial version.
 */

import { decodeRow } from "./csv/index";
import { type SchemaMap } from "./schema";

export interface DecodedRecord {
    schema: string;
    data: string[]; // Raw values (resolved symbols or literals)
}

/**
 * Parsed line types
 */
export type LineType =
    | { type: "schema"; value: string }
    | { type: "data"; row: string[] }
    | { type: "audit"; row: string[] }
    | { type: "empty" };

/**
 * Parse a single line to identify its type.
 */
export function parseLine(line: string): LineType {
    const trimmed = line.trim();
    if (!trimmed) return { type: "empty" };

    if (trimmed.startsWith("%")) {
        return { type: "schema", value: trimmed.substring(1).trim() };
    }

    if (trimmed.startsWith("!")) {
        // Audit line: "!val1,val2"
        // Remove "!" and parse as CSV
        // Note: If the first value starts with quote, it might look like '!"val..."'
        // ETON spec says audit line starts with `!`.
        // Encoder implementation: lines.push("!" + encodeRow(auditCells));
        // So distinct '!' then CSV content.
        const csvContent = trimmed.substring(1);
        const row = decodeRow(csvContent);
        return { type: "audit", row };
    }

    // Data line
    const row = decodeRow(trimmed);
    return { type: "data", row };
}

/**
 * Debug decode stream.
 * 
 * Iterates over lines and yields structural information.
 * Does NOT resolve symbols using a state (since dictionary is external).
 * This function helps validates the ETON file format integrity.
 */
export function* debugDecode(params: {
    content: string;
}): Generator<{ line: number; type: string; info: unknown }> {
    const lines = params.content.split(/\r?\n/);

    let currentSchema = "";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parsed = parseLine(line);

        if (parsed.type === "empty") continue;

        if (parsed.type === "schema") {
            currentSchema = parsed.value;
            yield { line: i + 1, type: "schema", info: currentSchema };
        } else if (parsed.type === "data") {
            yield {
                line: i + 1,
                type: "data",
                info: { schema: currentSchema, row: parsed.row }
            };
        } else if (parsed.type === "audit") {
            yield {
                line: i + 1,
                type: "audit",
                info: { row: parsed.row }
            };
        }
    }
}
