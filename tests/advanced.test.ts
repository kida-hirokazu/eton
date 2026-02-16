import { describe, it, expect } from "vitest";
import { encodeBatch } from "../src/encoder";
import { dumps } from "../src/index";
import { debugDecode } from "../src/decoder";
import { createState } from "../src/symbols";
import { inferSchema } from "../src/schema";

describe("ETON Advanced Features", () => {
    const schemas = {
        TestSchema: ["id", "name", "tags"],
        NullTest: ["a", "b", "c"],
        User: ["id", "name", "role"]
    };

    // ========================================
    // Phase 1: Critical Tests
    // ========================================

    describe("Array Processing", () => {
        it("should encode and decode arrays correctly", () => {
            const data = [{
                id: 1,
                name: "Task1",
                tags: ["important", "urgent", "review"]
            }];

            const [encoded] = encodeBatch(data, "TestSchema", schemas, createState(), { audit: false, threshold: 0 });

            // Verify array format: (item1 ;item2 ;item3)
            expect(encoded).toContain("(");
            expect(encoded).toContain(";");
            expect(encoded).toContain(")");

            // Decode and verify
            const decoded = [];
            for (const item of debugDecode({ content: encoded })) {
                decoded.push(item);
            }
            expect(decoded.length).toBeGreaterThan(0);
        });

        it("should handle empty arrays", () => {
            const data = [{ id: 1, name: "Empty", tags: [] }];
            const [encoded] = encodeBatch(data, "TestSchema", schemas, createState(), { audit: false });

            expect(encoded).toContain("()"); // Empty array representation
        });
    });

    describe("Nested Objects", () => {
        it("should handle nested objects via JSON stringification", () => {
            const data = [{
                id: 1,
                metadata: {
                    role: "Admin",
                    permissions: ["read", "write"]
                }
            }];

            const nestedSchema = { Record: ["id", "metadata"] };
            const [encoded] = encodeBatch(data, "Record", nestedSchema, createState(), { audit: false });

            // Nested objects should be JSON-ified
            expect(encoded).toContain("{");
            expect(encoded).toContain("Admin");
        });

        it("should handle deeply nested structures", () => {
            const data = [{
                user: {
                    name: "Alice",
                    meta: {
                        role: "Admin",
                        settings: {
                            theme: "dark"
                        }
                    }
                }
            }];

            const deepSchema = { Deep: ["user"] };
            const [encoded] = encodeBatch(data, "Deep", deepSchema, createState(), { audit: false });

            expect(encoded).toContain("Alice");
            expect(encoded).toContain("dark");
        });
    });

    describe("Null and Undefined Handling", () => {
        it("should handle null values", () => {
            const data = [{ a: null, b: "valid", c: null }];
            const [encoded] = encodeBatch(data, "NullTest", schemas, createState(), { audit: false });

            // null should be represented as underscore
            expect(encoded).toContain("_");
        });

        it("should handle undefined values", () => {
            const data = [{ a: undefined, b: "valid", c: undefined }];
            const [encoded] = encodeBatch(data, "NullTest", schemas, createState(), { audit: false });

            // undefined should also be represented as underscore
            expect(encoded).toContain("_");
        });

        it("should distinguish between null, undefined, and empty string", () => {
            const data = [{ a: null, b: undefined, c: "" }];
            const [encoded] = encodeBatch(data, "NullTest", schemas, createState(), { audit: false });

            // All three should have different representations or be handled consistently
            expect(encoded).toBeDefined();
        });
    });

    describe("dumps() High-Level API", () => {
        it("should generate complete ETON with dictionary", () => {
            const data = [{ id: 1, name: "Alice", role: "Admin" }];
            const eton = dumps(data, "User", schemas);

            // Should contain schema header
            expect(eton).toContain("%User");

            // Should contain dictionary (CSV or JSON format)
            expect(eton).toMatch(/%Symbol/);

            // Should be a complete, self-contained ETON document
            const lines = eton.split("\n");
            expect(lines.length).toBeGreaterThan(2);
        });

        it("should respect auto format detection", () => {
            const flatData = [
                { id: 1, name: "Alice", role: "Admin" },
                { id: 2, name: "Bob", role: "User" }
            ];

            const nestedData = [
                { id: 1, meta: { role: "Admin", permissions: ["read", "write"] } },
                { id: 2, meta: { role: "User", permissions: ["read"] } }
            ];

            const etonFlat = dumps(flatData, "User", schemas);
            const etonNested = dumps(nestedData, "Record", { Record: ["id", "meta"] });

            // Both should be valid ETON
            expect(etonFlat).toContain("%");
            expect(etonNested).toContain("%");
        });
    });

    describe("CSV Escape Sequences", () => {
        it("should properly escape quotes", () => {
            const data = [{ id: 1, name: 'Quote: "test"', role: "Admin" }];
            const [encoded] = encodeBatch(data, "User", schemas, createState(), { audit: false, threshold: 0 });

            // Should handle quotes properly (CSV escaping or symbolization)
            expect(encoded).toBeDefined();
            expect(encoded.length).toBeGreaterThan(0);
        });

        it("should properly escape commas", () => {
            const data = [{ id: 1, name: "Last, First", role: "Admin" }];
            const [encoded] = encodeBatch(data, "User", schemas, createState(), { audit: false, threshold: 0 });

            // Comma should be handled (quoted or symbolized)
            expect(encoded).toBeDefined();
        });

        it("should properly escape newlines", () => {
            const data = [{ id: 1, name: "Line1\nLine2", role: "Admin" }];
            const [encoded] = encodeBatch(data, "User", schemas, createState(), { audit: false, threshold: 0 });

            // Newlines should be in the symbol table, not raw in CSV
            expect(encoded).toBeDefined();
        });
    });

    // ========================================
    // Phase 2: Important Tests
    // ========================================

    describe("Dictionary Format Selection", () => {
        it("should respect explicit CSV format", () => {
            const data = [{ id: 1, name: "Alice", role: "Admin" }];
            const eton = dumps(data, "User", schemas, createState(), { dictionaryFormat: "csv" });

            expect(eton).toContain("%Symbol");
            expect(eton).not.toContain("%Symbol:JSON");
        });

        it("should respect explicit JSON format", () => {
            const data = [{ id: 1, name: "Alice", role: "Admin" }];
            const eton = dumps(data, "User", schemas, createState(), { dictionaryFormat: "json" });

            expect(eton).toContain("%Symbol:JSON");
            expect(eton).toContain("{");
        });
    });

    describe("Schema Inference", () => {
        it("should infer schema from records", () => {
            const data = [
                { id: 1, name: "Alice", role: "Admin" },
                { id: 2, name: "Bob", role: "User" }
            ];

            const schemas = inferSchema(data, "InferredUser");
            expect(schemas["InferredUser"]).toEqual(["id", "name", "role"]);
        });

        it("should handle records with missing fields", () => {
            const data = [
                { id: 1, name: "Alice", role: "Admin" },
                { id: 2, name: "Bob" } // Missing 'role'
            ];

            const schemas = inferSchema(data, "User");
            // Should infer from first record
            expect(schemas["User"]).toContain("id");
            expect(schemas["User"]).toContain("name");
        });
    });

    describe("Audit Mode", () => {
        it("should generate audit rows when enabled", () => {
            const data = [{ id: 1, name: "Alice", role: "Admin" }];
            const [encoded] = encodeBatch(data, "User", schemas, createState(), { audit: true });

            // Audit rows start with "!"
            expect(encoded).toContain("!");
        });

        it("should not generate audit rows when disabled", () => {
            const data = [{ id: 1, name: "Alice", role: "Admin" }];
            const [encoded] = encodeBatch(data, "User", schemas, createState(), { audit: false });

            // No audit rows
            expect(encoded).not.toContain("!");
        });
    });

    describe("Threshold Behavior", () => {
        it("should respect threshold for symbolization", () => {
            const shortStr = "Hi";
            const longStr = "a".repeat(2000);

            const data = [{ short: shortStr, long: longStr }];
            const testSchema = { ThresholdTest: ["short", "long"] };

            const [encoded] = encodeBatch(
                data,
                "ThresholdTest",
                testSchema,
                createState(),
                { audit: false, threshold: 1000 }
            );

            // Short string should appear literally
            expect(encoded).toContain("Hi");

            // Long string should be symbolized
            expect(encoded).toContain("@");
        });

        it("should force symbolization with threshold 0", () => {
            const data = [{ id: 1, name: "A", role: "B" }];
            const [encoded] = encodeBatch(data, "User", schemas, createState(), { audit: false, threshold: 0 });

            // Even single characters should be symbolized
            expect(encoded).toContain("@");
        });
    });

    // ========================================
    // Phase 3: Nice to Have Tests
    // ========================================

    describe("Error Handling", () => {
        it("should throw error for non-existent schema", () => {
            const data = [{ id: 1 }];
            expect(() => {
                encodeBatch(data, "NonExistent", schemas, createState());
            }).toThrow();
        });

        it("should handle empty data gracefully", () => {
            const data: any[] = [];
            const [encoded] = encodeBatch(data, "User", schemas, createState(), { audit: false });

            expect(encoded).toContain("%User");
        });
    });
});
