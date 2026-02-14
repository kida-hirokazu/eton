/**
 * ETON (Extended TOON Object Notation) - TypeScript Implementation
 *
 * A pure functional, schema-aware, CSV-based serialization format.
 */

export * from "./symbols";
export * from "./schema";
export * from "./encoder";
export * from "./decoder";
export * from "./csv"; // Exporting low-level utils might be useful

import { encodeBatch, detectRecommendedFormat, type EncodeOptions } from "./encoder";
import { debugDecode, type DecodedRecord } from "./decoder";
import { createState, type SymbolState, resolveSymbol, serializeDictionary, serializeDictionaryJson, parseDictionary } from "./symbols";
import { type SchemaMap, inferSchema } from "./schema";
import { EtonEncoderStream, EtonDecoderStream } from "./stream";

export { serializeDictionary, serializeDictionaryJson, parseDictionary, EtonEncoderStream, EtonDecoderStream, inferSchema, detectRecommendedFormat };

/**
 * High-level API: Dump records to ETON string.
 */
export function dumps(
    records: Record<string, unknown>[],
    schemaId: string,
    schemas: SchemaMap,
    state: SymbolState = createState(),
    options: EncodeOptions = {}
): string {
    const [encoded, newState] = encodeBatch(records, schemaId, schemas, state, options);

    // Determine dictionary format
    let format = options.dictionaryFormat || "auto";
    if (format === "auto") {
        format = detectRecommendedFormat(records);
    }

    const dictStr = format === "json"
        ? serializeDictionaryJson(newState)
        : serializeDictionary(newState);

    return encoded + "\n" + dictStr;
}

/**
 * High-level API: Dump records and return new state (State Threading).
 */
export function encode(
    records: Record<string, unknown>[],
    schemaId: string,
    schemas: SchemaMap,
    state: SymbolState = createState(),
    options: EncodeOptions = {}
): [string, SymbolState] {
    return encodeBatch(records, schemaId, schemas, state, options);
}

/**
 * High-level API: Decode (Debug/Inspection).
 * Note: This does NOT resolve symbols to original values fully if the dictionary is lost.
 * Providing a map/state would be needed for full hydration, which is outside the current scope
 * of the "Debug Only" decoder plan.
 */
export function debugLoads(content: string): any[] {
    const rows: any[] = [];
    for (const item of debugDecode({ content })) {
        rows.push(item);
    }
    return rows;
}
