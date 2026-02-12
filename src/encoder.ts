/**
 * ETON Encoder (Functional)
 */

import { encodeRow } from "./csv/index";
import {
    type SymbolState,
    type StateResult,
    MutableSymbolTable,
} from "./symbols";
import { type SchemaMap } from "./schema";

export interface EncodeOptions {
    audit?: boolean;
    threshold?: number;
}

/**
 * Encode a nested object to JSON string (internal helper).
 * csv-stringify handles quoting, so we just need to produce the JSON string.
 */
function encodeObject(val: unknown): string {
    return JSON.stringify(val); // TODO: compact separators if needed?
}

/**
 * Encode a batch of records.
 *
 * @param records List of records (objects).
 * @param schemaId The schema name to use.
 * @param schemas The schema definition map.
 * @param state Current symbol state.
 * @param options Encoding options.
 * @returns [Encoded ETON string, New SymbolState]
 */
export function encodeBatch(
    records: Record<string, unknown>[],
    schemaId: string,
    schemas: SchemaMap,
    state: SymbolState,
    options: EncodeOptions = {}
): StateResult<string> {
    const { audit = true, threshold = 1000 } = options;
    const fields = schemas[schemaId];
    if (!fields) {
        throw new Error(`Schema ID '${schemaId}' not found.`);
    }

    // Use MutableSymbolTable for batch performance
    const mutableTable = new MutableSymbolTable(state);
    const lines: string[] = [];

    // Header: %SchemaName
    lines.push(`%${schemaId}`);

    for (const rec of records) {
        const rawCells: string[] = [];

        // Data Row
        for (const f of fields) {
            const val = rec[f];
            let cell = "";

            if (val === null || val === undefined) {
                cell = "_";
            } else if (typeof val === "boolean") {
                cell = val ? "T" : "F";
            } else if (Array.isArray(val)) {
                // List encoding: (A ;B ;C)
                const encodedItems = val.map((it) => mutableTable.getSymbol(it, threshold));
                cell = `(${encodedItems.join(" ;")})`;
            } else if (typeof val === "object") {
                // Nested object -> JSON
                cell = encodeObject(val);
            } else {
                // String or Number -> Symbol
                cell = mutableTable.getSymbol(val, threshold);
            }
            rawCells.push(cell);
        }

        // Encode to CSV line
        lines.push(encodeRow(rawCells));

        // Audit Row (if enabled)
        if (audit) {
            const auditCells: string[] = [];
            for (const f of fields) {
                const val = rec[f];
                // Simplified audit repr: just ensure it's a string.
                // ETON specs say: `!` prefix, then standard CSV of raw values.
                let sVal = "";
                if (val === null || val === undefined) sVal = "";
                else if (typeof val === "object") sVal = JSON.stringify(val);
                else sVal = String(val);

                auditCells.push(sVal);
            }
            // Audit line starts with "!", but it's part of the CSV structure?
            // No, ETON audit line is `!val1,val2,...`
            // So we prefix the first cell? Or just join?
            // Actually standard CSV encoding with "!" prefix is safer if we treat it as a special row?
            // ETON Py implementation: "!" + encode_row(values)
            // But wait, if we use csv encoder, `!` is just a prefix string?
            // No, strictly: `!csv_line`.
            lines.push("!" + encodeRow(auditCells));
        }
    }

    return [lines.join("\n"), mutableTable.toState()];
}
