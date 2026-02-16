import { describe, it, expect } from "vitest";
import { parseLine, debugDecode } from "../src/decoder";
import { debugLoads } from "../src/index";

describe("ETON Decoder", () => {
    describe("parseLine", () => {
        it("should parse schema lines", () => {
            const line = "%UserSchema";
            const result = parseLine(line);

            expect(result.type).toBe("schema");
            if (result.type === "schema") {
                expect(result.value).toBe("UserSchema");
            }
        });

        it("should parse data lines", () => {
            const line = "1,Alice,Admin";
            const result = parseLine(line);

            expect(result.type).toBe("data");
            if (result.type === "data") {
                expect(result.row).toEqual(["1", "Alice", "Admin"]);
            }
        });

        it("should parse audit lines", () => {
            const line = "!RawData,WithComma,true";
            const result = parseLine(line);

            expect(result.type).toBe("audit");
            if (result.type === "audit") {
                expect(result.row).toEqual(["RawData", "WithComma", "true"]);
            }
        });

        it("should parse empty lines", () => {
            const line = "";
            const result = parseLine(line);

            expect(result.type).toBe("empty");
        });

        it("should handle whitespace-only lines as empty", () => {
            const line = "   \t  ";
            const result = parseLine(line);

            expect(result.type).toBe("empty");
        });

        it("should parse data lines with special characters", () => {
            const line = '"Quote ""inside""","Comma,here",Normal';
            const result = parseLine(line);

            expect(result.type).toBe("data");
            if (result.type === "data") {
                expect(result.row.length).toBeGreaterThan(0);
            }
        });
    });

    describe("debugDecode", () => {
        it("should decode ETON with schema and data", () => {
            const eton = `%User
1,Alice,Admin
2,Bob,User`;

            const decoded = [];
            for (const item of debugDecode({ content: eton })) {
                decoded.push(item);
            }

            expect(decoded.length).toBe(3);
            expect(decoded[0].type).toBe("schema");
            expect(decoded[1].type).toBe("data");
            expect(decoded[2].type).toBe("data");
        });

        it("should decode ETON with audit rows", () => {
            const eton = `%User
Alice,Admin
!RawAlice,RawAdmin`;

            const decoded = [];
            for (const item of debugDecode({ content: eton })) {
                decoded.push(item);
            }

            const auditRow = decoded.find(d => d.type === "audit");
            expect(auditRow).toBeDefined();
            expect(auditRow?.type).toBe("audit");
        });

        it("should handle multiple schemas", () => {
            const eton = `%User
1,Alice
%Log
10:00,Start`;

            const decoded = [];
            for (const item of debugDecode({ content: eton })) {
                decoded.push(item);
            }

            const schemas = decoded.filter(d => d.type === "schema");
            expect(schemas.length).toBe(2);

            // info is the schema name directly (string), not an object
            expect(schemas[0].info).toBe("User");
            expect(schemas[1].info).toBe("Log");
        });

        it("should skip empty lines", () => {
            const eton = `%User
1,Alice

2,Bob
`;

            const decoded = [];
            for (const item of debugDecode({ content: eton })) {
                decoded.push(item);
            }

            // Should have: 1 schema + 2 data (empty lines ignored)
            expect(decoded.length).toBe(3);
            expect(decoded.every(d => d.type !== "empty")).toBe(true);
        });

        it("should handle ETON with only schema", () => {
            const eton = "%User";

            const decoded = [];
            for (const item of debugDecode({ content: eton })) {
                decoded.push(item);
            }

            expect(decoded.length).toBe(1);
            expect(decoded[0].type).toBe("schema");
        });
    });

    describe("debugLoads (high-level API)", () => {
        it("should decode complete ETON document", () => {
            const eton = `%TestSchema
@1,@2,T
@3,@4,F`;

            const result = debugLoads(eton);

            expect(result.length).toBe(3);
            expect(result[0].type).toBe("schema");
        });

        it("should handle ETON with symbols and audit", () => {
            const eton = `%User
@1,@2
!Alice,Admin`;

            const result = debugLoads(eton);

            const hasAudit = result.some(r => r.type === "audit");
            expect(hasAudit).toBe(true);
        });
    });
});
