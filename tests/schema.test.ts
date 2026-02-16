import { describe, it, expect } from "vitest";
import {
    validateSchema,
    normalizeSchema,
    inferSchema,
    type SchemaMap,
} from "../src/schema";

describe("ETON Schema", () => {
    describe("validateSchema", () => {
        it("should validate correct schema", () => {
            const schema: SchemaMap = {
                User: ["id", "name", "email"],
                Post: ["title", "content"]
            };

            expect(validateSchema(schema)).toBe(true);
        });

        it("should throw error for non-array fields", () => {
            const invalid = {
                User: "not_an_array"
            } as any;

            expect(() => validateSchema(invalid)).toThrow("fields must be a list");
        });

        it("should throw error for non-string field", () => {
            const invalid = {
                User: ["name", 123, "email"]
            } as any;

            expect(() => validateSchema(invalid)).toThrow("non-string field");
        });

        it("should handle empty schema", () => {
            const schema: SchemaMap = {};

            expect(validateSchema(schema)).toBe(true);
        });

        it("should handle empty fields array", () => {
            const schema: SchemaMap = {
                Empty: []
            };

            expect(validateSchema(schema)).toBe(true);
        });
    });

    describe("normalizeSchema", () => {
        it("should normalize valid schema object", () => {
            const input = {
                User: ["id", "name"]
            };

            const result = normalizeSchema(input);

            expect(result).toEqual(input);
            expect(result.User).toEqual(["id", "name"]);
        });

        it("should throw error for null input", () => {
            expect(() => normalizeSchema(null)).toThrow("Invalid schema input");
        });

        it("should throw error for undefined input", () => {
            expect(() => normalizeSchema(undefined)).toThrow("Invalid schema input");
        });

        it("should throw error for non-object input", () => {
            expect(() => normalizeSchema("string")).toThrow("Invalid schema input");
            expect(() => normalizeSchema(123)).toThrow("Invalid schema input");
        });

        it("should handle complex nested structure", () => {
            const input = {
                User: ["id", "profile"],
                Profile: ["name", "bio"]
            };

            const result = normalizeSchema(input);

            expect(result).toEqual(input);
        });
    });

    describe("inferSchema", () => {
        it("should infer schema from simple records", () => {
            const records = [
                { id: 1, name: "Alice" },
                { id: 2, name: "Bob" }
            ];

            const schema = inferSchema(records, "User");

            expect(schema.User).toEqual(["id", "name"]);
        });

        it("should handle empty records", () => {
            const records: Record<string, unknown>[] = [];

            const schema = inferSchema(records, "Empty");

            expect(schema).toEqual({});
        });

        it("should infer from first record only", () => {
            const records = [
                { id: 1, name: "Alice" },
                { id: 2, name: "Bob", extra: "field" } // extra field ignored
            ];

            const schema = inferSchema(records, "User");

            expect(schema.User).toEqual(["id", "name"]);
            expect(schema.User).not.toContain("extra");
        });

        it("should handle records with arrays of objects", () => {
            const records = [
                {
                    id: 1,
                    tags: [
                        { name: "js", count: 5 },
                        { name: "ts", count: 3 }
                    ]
                }
            ];

            const schema = inferSchema(records, "Post");

            expect(schema.Post).toContain("id");
            expect(schema.Post).toContain("tags");
            expect(schema.tags).toEqual(["name", "count"]);
        });

        it("should handle nested object arrays", () => {
            const records = [
                {
                    user: "Alice",
                    posts: [
                        { title: "Post 1", likes: 10 },
                        { title: "Post 2", likes: 5 }
                    ]
                }
            ];

            const schema = inferSchema(records, "User");

            expect(schema.User).toEqual(["user", "posts"]);
            expect(schema.posts).toEqual(["title", "likes"]);
        });

        it("should handle arrays of primitives (no sub-schema)", () => {
            const records = [
                {
                    id: 1,
                    tags: ["tag1", "tag2", "tag3"]
                }
            ];

            const schema = inferSchema(records, "Item");

            expect(schema.Item).toEqual(["id", "tags"]);
            expect(schema.tags).toBeUndefined(); // No sub-schema for string arrays
        });

        it("should handle empty arrays", () => {
            const records = [
                {
                    id: 1,
                    items: []
                }
            ];

            const schema = inferSchema(records, "Container");

            expect(schema.Container).toEqual(["id", "items"]);
        });

        it("should handle null values", () => {
            const records = [
                {
                    id: 1,
                    optional: null
                }
            ];

            const schema = inferSchema(records, "User");

            expect(schema.User).toEqual(["id", "optional"]);
        });

        it("should handle mixed types in array (first object wins)", () => {
            const records = [
                {
                    data: [
                        { type: "obj", value: 1 },
                        "string", // ignored
                        123 // ignored
                    ]
                }
            ];

            const schema = inferSchema(records, "Mixed");

            expect(schema.Mixed).toContain("data");
            expect(schema.data).toEqual(["type", "value"]);
        });

        it("should use custom rootId", () => {
            const records = [
                { x: 1, y: 2 }
            ];

            const schema = inferSchema(records, "Point");

            expect(schema.Point).toEqual(["x", "y"]);
        });

        it("should handle deeply nested structures", () => {
            const records = [
                {
                    level1: [
                        {
                            level2: [
                                { value: 1 },
                                { value: 2 }
                            ]
                        }
                    ]
                }
            ];

            const schema = inferSchema(records, "Deep");

            expect(schema.Deep).toContain("level1");
            expect(schema.level1).toContain("level2");
            expect(schema.level2).toEqual(["value"]);
        });
    });
});
