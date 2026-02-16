import { describe, it, expect } from "vitest";
import { tomlToEton } from "../src/bridge/toml";
import { tomlToEton as publicTomlToEton } from "../src/index";
import { debugLoads } from "../src/index";

describe("TOML Bridge", () => {
    it("should convert simple TOML array table to ETON", () => {
        const tomlStr = `
[[products]]
name = "Hammer"
sku = 738594937

[[products]]
name = "Nail"
sku = 284758393
`;

        const { eton, schemas } = tomlToEton(tomlStr);

        // Check ETON structure
        expect(eton).toContain("%products");
        expect(eton).toContain('Hammer');
        expect(eton).toContain('Nail');

        // Check Schemas
        expect(schemas["products"]).toBeDefined();
        expect(schemas["products"]).toContain("name");
        expect(schemas["products"]).toContain("sku");

        // Decode check
        const decoded = debugLoads(eton);
        // 1 schema header + 2 data rows = 3 lines
        expect(decoded.length).toBe(3);

        const row1 = decoded[1];
        expect(row1.type).toBe("data");
        expect(row1.info.schema).toBe("products");
    });

    it("should handle mixed tables", () => {
        const tomlStr = `
[server]
ip = "192.168.1.1"
port = 8080

[[users]]
name = "Alice"
id = 1
`;

        const { eton } = tomlToEton(tomlStr);

        expect(eton).toContain("%server");
        expect(eton).toContain("%users");

        // Check order/presence
        expect(eton).toContain('192.168.1.1');
        expect(eton).toContain('Alice');
    });

    it("should work via public API export", () => {
        const tomlStr = `
[[users]]
id = 1
name = "Alice"
role = "Admin"

[[users]]
id = 2
name = "Bob"
role = "User"
`;

        const { eton, schemas, state } = publicTomlToEton(tomlStr);

        // Verify basic structure
        expect(eton).toContain("%users");
        expect(schemas["users"]).toEqual(["id", "name", "role"]);

        // Verify state is returned (even if empty due to threshold)
        expect(state).toBeDefined();
        expect(state.stringMap).toBeDefined();

        // Verify data presence
        expect(eton).toContain("Alice");
        expect(eton).toContain("Bob");

        // Verify decode works
        const decoded = debugLoads(eton);
        expect(decoded.length).toBeGreaterThan(0);
    });

    it("should handle TOML with various data types", () => {
        const tomlStr = `
[[config]]
environment = "production"
debug = false
max_connections = 100
timeout = 30.5
`;

        const { eton, schemas } = publicTomlToEton(tomlStr);

        expect(schemas["config"]).toEqual([
            "environment",
            "debug",
            "max_connections",
            "timeout"
        ]);

        // Verify all values are encoded
        expect(eton).toContain("production");
        expect(eton).toContain("F"); // false -> F
        expect(eton).toContain("100");
        expect(eton).toContain("30.5");
    });
});
