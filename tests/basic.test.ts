import { describe, it, expect } from "vitest";
import { encodeBatch } from "../src/encoder";
import { debugDecode } from "../src/decoder";
import { createState } from "../src/symbols";

describe("ETON Basic Round Trip", () => {
    const schemas = {
        TestSchema: ["id", "name", "isActive"]
    };

    it("should encode and roughly validate structure", () => {
        const data = [
            { id: 1, name: "Alice", isActive: true },
            { id: 2, name: "Bob", isActive: false },
        ];

        const state = createState();
        // Use option audit:false and threshold:0 to trigger symbolization for all
        const [encoded, newState] = encodeBatch(data, "TestSchema", schemas, state, { audit: false, threshold: 0 });

        console.log("Encoded ETON:\n", encoded);

        // Check header
        expect(encoded).toContain("%TestSchema");

        // Check symbols
        // 1 -> "1" (below threshold)
        // "Alice" -> "@1"
        // true -> "T"
        // "Bob" -> "@2"
        expect(encoded).toContain('@1,@2,T');
        expect(encoded).toContain('@3,@4,F');

        // Decode (Debug)
        const decodedItems = [];
        for (const item of debugDecode({ content: encoded })) {
            decodedItems.push(item);
        }

        expect(decodedItems.length).toBe(3); // 1 schema + 2 data lines

        const row1 = decodedItems[1];
        expect(row1.type).toBe("data");
        // @ts-ignore
        expect(row1.info.row).toEqual(["@1", "@2", "T"]);
    });

    it("should handle mixed types and special chars", () => {
        const data = [{ val: "Hello, World" }];
        const schema = { CharTest: ["val"] };
        const [encoded] = encodeBatch(data, "CharTest", schema, createState(), { audit: false, threshold: 0 });

        // Expect symbol (unquoted if no special chars)
        expect(encoded).toContain('@1');

        // Verify symbol map would contain the raw value
        // (In this test we just check the string output structure)
    });
});
