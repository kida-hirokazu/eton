import { describe, it, expect } from "vitest";
import { tomlToEton } from "../src/bridge/toml";

describe("TOML Bridge Advanced", () => {
    describe("Complex TOML Structures", () => {
        it("should handle nested tables", () => {
            const tomlStr = `
[database]
server = "192.168.1.1"
port = 5432

[database.connection]
max = 100
timeout = 30
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["database"]).toBeDefined();
            expect(eton).toContain("192.168.1.1");
            expect(eton).toContain("5432");
        });

        it("should handle inline tables", () => {
            const tomlStr = `
[[points]]
name = "A"
coords = { x = 1, y = 2 }
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["points"]).toBeDefined();
            expect(eton).toContain("A");
        });

        it("should handle arrays of tables", () => {
            const tomlStr = `
[[fruits]]
name = "apple"
color = "red"

[[fruits]]
name = "banana"
color = "yellow"

[[fruits]]
name = "grape"
color = "purple"
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["fruits"]).toBeDefined();
            expect(schemas["fruits"]).toContain("name");
            expect(schemas["fruits"]).toContain("color");

            // Should contain all fruit names
            expect(eton).toContain("apple");
            expect(eton).toContain("banana");
            expect(eton).toContain("grape");
        });

        it("should handle dates and times", () => {
            const tomlStr = `
[[events]]
name = "Birthday"
date = 1979-05-27
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["events"]).toBeDefined();
            expect(eton).toContain("Birthday");
        });

        it("should handle boolean arrays", () => {
            const tomlStr = `
[[config]]
name = "test"
flags = [true, false, true]
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["config"]).toBeDefined();
            expect(eton).toContain("test");
        });

        it("should handle empty tables", () => {
            const tomlStr = `
[empty_section]
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            // Should handle gracefully even if empty
            expect(eton).toBeDefined();
        });

        it("should handle multiline strings", () => {
            const tomlStr = `
[[docs]]
title = "Example"
content = """
Line 1
Line 2
Line 3
"""
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["docs"]).toBeDefined();
            expect(eton).toContain("Example");
        });

        it("should handle dotted keys", () => {
            const tomlStr = `
[server]
ip.address = "127.0.0.1"
port.number = 8080
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["server"]).toBeDefined();
            expect(eton).toContain("127.0.0.1");
        });

        it("should handle special characters in strings", () => {
            const tomlStr = `
[[messages]]
text = "Hello, World!"
sender = "alice@example.com"
`;

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["messages"]).toBeDefined();
            expect(eton).toContain("Hello");
            expect(eton).toContain("alice");
        });

        it("should handle large TOML files", () => {
            const tables = [];
            for (let i = 0; i < 50; i++) {
                tables.push(`
[[records]]
id = ${i}
value = "record_${i}"
`);
            }
            const tomlStr = tables.join('\n');

            const { eton, schemas } = tomlToEton(tomlStr);

            expect(schemas["records"]).toBeDefined();
            expect(eton).toContain("record_0");
            expect(eton).toContain("record_49");
        });
    });

    describe("TOML Error Cases", () => {
        it("should throw error for invalid TOML syntax", () => {
            const invalidToml = `
[section
missing_bracket = true
`;

            expect(() => {
                tomlToEton(invalidToml);
            }).toThrow();
        });

        it("should handle empty TOML string", () => {
            const emptyToml = "";

            const { eton, schemas } = tomlToEton(emptyToml);

            // Should return empty or minimal result
            expect(schemas).toBeDefined();
        });
    });
});
