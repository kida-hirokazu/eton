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
    if (!schemaInput || typeof schemaInput !== "object") {
        throw new Error("Invalid schema input: must be an object/dict.");
    }
    return schemaInput as SchemaMap;
}
