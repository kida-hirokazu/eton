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
        const records = toRecords(value);

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

/**
 * Helper to convert unknown TOML value to record array
 */
function toRecords(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
            return value as Record<string, unknown>[];
        }
        return [];
    }

    if (typeof value === "object" && value !== null) {
        return [value as Record<string, unknown>];
    }

    return [];
}
