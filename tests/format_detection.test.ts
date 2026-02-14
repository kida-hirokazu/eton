import { describe, it, expect } from "vitest";
import { detectRecommendedFormat } from "../src/encoder";

describe("detectRecommendedFormat", () => {
    it("should recommend 'csv' for flat tabular data", () => {
        const data = [
            { id: 1, name: "Alice", role: "Admin" },
            { id: 2, name: "Bob", role: "User" },
            { id: 3, name: "Charlie", role: "User" }
        ];
        expect(detectRecommendedFormat(data)).toBe("csv");
    });

    it("should recommend 'json' for deeply nested data", () => {
        const data = [
            { id: 1, meta: { role: "Admin", permissions: ["read", "write"] } },
            { id: 2, meta: { role: "User", permissions: ["read"] } }
        ];
        expect(detectRecommendedFormat(data)).toBe("json");
    });

    it("should recommend 'csv' for empty data", () => {
        expect(detectRecommendedFormat([])).toBe("csv");
    });

    it("should recommend 'json' if more than 20% of fields are objects", () => {
        // 1 object field out of 2 fields = 50% > 20% -> json
        const data = [
            { id: 1, details: { age: 30 } }
        ];
        expect(detectRecommendedFormat(data)).toBe("json");
    });
});
