/**
 * ETON TOML Bridge
 *
 * One-way conversion from TOML to ETON.
 */

import { parse } from "@iarna/toml";
import { encodeBatch } from "../encoder";
import { createState, type SymbolState, type MutableSymbolTable } from "../symbols";
import { type SchemaMap } from "../schema";

/**
 * Result of TOML -> ETON conversion.
 */
export interface TomlToEtonResult {
    eton: string;
    schemas: SchemaMap;
    state: SymbolState;
}

/**
 * Convert TOML string to ETON.
 * 
 * Strategy:
 * - Each top-level [table] or [[array_table]] becomes an ETON schema.
 * - Field names are extracted from the first record.
 */
export function tomlToEton(tomlStr: string): TomlToEtonResult {
    const data = parse(tomlStr);
    const schemas: SchemaMap = {};
    const chunks: string[] = [];

    // Create shared state for the whole conversion session
    let state = createState();

    // Iterate strictly over keys to identify tables
    // Note: @iarna/toml parses into a plain JS object.
    // We need to infer schemas.

    for (const [key, value] of Object.entries(data)) {
        let records: Record<string, unknown>[] = [];

        if (Array.isArray(value)) {
            // [[array_table]]
            // Check if it's an array of objects
            if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
                records = value as Record<string, unknown>[];
            }
        } else if (typeof value === "object" && value !== null) {
            // [table] -> Single record
            // But acts as a list of 1 for ETON encoding
            records = [value as Record<string, unknown>];
        }

        // Skip if no records or not an object-based structure
        if (records.length === 0) continue;

        // Check consistency check?
        // For MVP, just assume schema from first record.
        const firstRec = records[0];
        const fields = Object.keys(firstRec);

        schemas[key] = fields;

        // Encode this batch
        // We update 'state' threaded through
        const [encodedChunk, newState] = encodeBatch(records, key, schemas, state, { audit: false });
        state = newState;

        chunks.push(encodedChunk);
    }

    return {
        eton: chunks.join("\n\n"), // Separate schema blocks
        schemas,
        state
    };
}
