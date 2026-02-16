/**
 * ETON Schema and Type Validation
 */

export type FieldType = string;
export type SchemaFields = FieldType[];
export type SchemaMap = Record<string, SchemaFields>;

/**
 * Validatable schema types
 */
export const VALID_TYPES = new Set(["int", "float", "str", "bool", "list", "dict", "any"]);

/**
 * Validate schema structure.
 * Returns true if valid, throws error otherwise.
 */
export function validateSchema(schemas: SchemaMap): boolean {
    for (const [name, fields] of Object.entries(schemas)) {
        if (!Array.isArray(fields)) {
            throw new Error(`Schema '${name}' fields must be a list.`);
        }
        // Deep check
        for (const field of fields) {
            if (typeof field !== "string") {
                throw new Error(`Schema '${name}' contains non-string field definition.`);
            }
        }
    }
    return true;
}

/**
 * Normalize schema input.
 */
export function normalizeSchema(schemaInput: unknown): SchemaMap {
    if (!isSchemaMap(schemaInput)) {
        throw new Error("Invalid schema input: must be an object/dict where values are lists of strings.");
    }
    return schemaInput;
}

/**
 * Type guard for SchemaMap
 */
export function isSchemaMap(value: unknown): value is SchemaMap {
    if (typeof value !== "object" || value === null) return false;

    for (const fields of Object.values(value)) {
        if (!Array.isArray(fields)) return false;
        if (!fields.every(f => typeof f === "string")) return false;
    }

    return true;
}

/**
 * Recursively infer schema from a list of records.
 * This handles nested objects by creating sub-schemas, which significantly improves
 * compression by avoiding JSON stringification of nested structures.
 */
export function inferSchema(records: Record<string, unknown>[], rootId: string = "Root"): SchemaMap {
    const schemas: SchemaMap = {};
    deepInferSchema(records, schemas, rootId);
    return schemas;
}

function deepInferSchema(records: any[], schemaMap: Record<string, string[]>, rootId: string) {
    if (records.length === 0) return;

    // 1. Infer fields for the current level
    const first = records[0];
    if (typeof first !== "object" || first === null) return;

    const fields = Object.keys(first);
    schemaMap[rootId] = fields;

    // 2. Recurse into object fields
    for (const field of fields) {
        const value = first[field];
        if (Array.isArray(value)) {
            // Array of objects?
            if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
                deepInferSchema(value, schemaMap, field); // Use field name as schema ID
            }
        }
        /* 
        // Future: Support single nested object schema if ETON core supports it.
        // Currently ETON handles arrays of objects via relation schemas well.
        // Single objects are often treated as JSON strings unless we add specific handling in encoder.
        */
    }
}
