import { describe, it, expect } from "vitest";
import {
    createState,
    getSymbol,
    resolveSymbol,
    serializeDictionary,
    serializeDictionaryJson,
    parseDictionary,
    type SymbolState,
} from "../src/symbols";

describe("ETON Symbols", () => {
    describe("createState", () => {
        it("should create empty state", () => {
            const state = createState();

            expect(state.stringMap.size).toBe(0);
            expect(state.reverseMap.size).toBe(0);
            expect(state.nextId).toBe(1);
        });

        it("should create state from Map", () => {
            const initialMap = new Map([
                ["hello", "@1"],
                ["world", "@2"]
            ]);

            const state = createState(initialMap);

            expect(state.stringMap.size).toBe(2);
            expect(state.stringMap.get("hello")).toBe("@1");
            expect(state.reverseMap.get("@1")).toBe("hello");
            expect(state.nextId).toBe(3);
        });

        it("should create state from Record", () => {
            const initialMap = {
                "foo": "@1",
                "bar": "@2"
            };

            const state = createState(initialMap);

            expect(state.stringMap.size).toBe(2);
            expect(state.stringMap.get("foo")).toBe("@1");
            expect(state.reverseMap.get("@2")).toBe("bar");
        });
    });

    describe("getSymbol", () => {
        it("should create new symbol for new string", () => {
            const state = createState();
            const [symbol, newState] = getSymbol("test", state, 0);

            expect(symbol).toBe("@1");
            expect(newState.stringMap.get("test")).toBe("@1");
            expect(newState.nextId).toBe(2);
        });

        it("should reuse existing symbol", () => {
            let state = createState();
            const [symbol1, state1] = getSymbol("test", state, 0);
            const [symbol2, state2] = getSymbol("test", state1, 0);

            expect(symbol1).toBe(symbol2);
            expect(symbol1).toBe("@1");
            expect(state2.nextId).toBe(2); // nextId shouldn't increment
        });

        it("should respect threshold", () => {
            const state = createState();
            const [symbol, newState] = getSymbol("hi", state, 10);

            // "hi" is 2 chars, threshold is 10, so no symbolization
            expect(symbol).toBe("hi");
            expect(newState.stringMap.size).toBe(0);
        });

        it("should symbolize when >= threshold", () => {
            const state = createState();
            const [symbol, newState] = getSymbol("hello", state, 5);

            // "hello" is 5 chars, threshold is 5, so symbolize
            expect(symbol).toBe("@1");
            expect(newState.stringMap.get("hello")).toBe("@1");
        });

        it("should handle empty string", () => {
            const state = createState();
            const [symbol, newState] = getSymbol("", state, 0);

            expect(symbol).toBe("@1");
        });
    });

    describe("resolveSymbol", () => {
        it("should resolve symbol to original value", () => {
            let state = createState();
            const [symbol, newState] = getSymbol("LONG_VALUE", state, 0);

            const resolved = resolveSymbol(symbol, newState);
            expect(resolved).toBe("LONG_VALUE");
        });

        it("should return non-symbol values as-is", () => {
            const state = createState();

            expect(resolveSymbol("literal", state)).toBe("literal");
            // resolveSymbol returns number for numeric strings
            expect(resolveSymbol("123", state)).toBe(123);
        });

        it("should return symbol if not found in map", () => {
            const state = createState();

            expect(resolveSymbol("@999", state)).toBe("@999");
        });
    });

    describe("serializeDictionary", () => {
        it("should serialize state to CSV format", () => {
            let state = createState();
            [, state] = getSymbol("Alice", state, 0);
            [, state] = getSymbol("Bob", state, 0);

            const serialized = serializeDictionary(state);

            expect(serialized).toContain("Alice");
            expect(serialized).toContain("Bob");
            expect(serialized).toContain("@1");
            expect(serialized).toContain("@2");
        });

        it("should handle empty state", () => {
            const state = createState();

            const csv = serializeDictionary(state);

            // Empty state still outputs %Symbol header
            expect(csv).toBe("%Symbol");
        });
    });

    describe("serializeDictionaryJson", () => {
        it("should serialize state to JSON format", () => {
            let state = createState();
            [, state] = getSymbol("test", state, 0);

            const serialized = serializeDictionaryJson(state);

            expect(serialized).toContain("{");
            expect(serialized).toContain("}");
            expect(serialized).toContain("test");
            expect(serialized).toContain("@1");
        });

        it("should handle empty state", () => {
            const state = createState();

            const json = serializeDictionaryJson(state);

            // Empty state includes %Symbol:JSON header
            expect(json).toContain("%Symbol:JSON");
            expect(json).toContain("{}");
        });
    });

    describe("parseDictionary", () => {
        it("should parse CSV dictionary", () => {
            const dictStr = `%Symbol
Alice,@1
Bob,@2`;

            const state = parseDictionary(dictStr);

            expect(state.stringMap.get("Alice")).toBe("@1");
            expect(state.stringMap.get("Bob")).toBe("@2");
            expect(state.reverseMap.get("@1")).toBe("Alice");
        });

        it("should parse JSON dictionary", () => {
            const dictStr = `%Symbol:JSON
{"Alice":"@1","Bob":"@2"}`;

            const state = parseDictionary(dictStr);

            expect(state.stringMap.get("Alice")).toBe("@1");
            expect(state.stringMap.get("Bob")).toBe("@2");
        });

        it("should handle empty CSV dictionary", () => {
            const dictStr = "%Symbol\n";

            const state = parseDictionary(dictStr);

            expect(state.stringMap.size).toBe(0);
        });

        it("should handle empty JSON dictionary", () => {
            const dictStr = "%Symbol:JSON\n{}";

            const state = parseDictionary(dictStr);

            expect(state.stringMap.size).toBe(0);
        });

        it("should handle special characters in CSV", () => {
            const dictStr = `%Symbol
"Hello, World",@1`;

            const state = parseDictionary(dictStr);

            expect(state.stringMap.get("Hello, World")).toBe("@1");
        });
    });

    describe("Symbol State Threading", () => {
        it("should thread state through multiple operations", () => {
            let state = createState();

            const [sym1, state1] = getSymbol("first", state, 0);
            const [sym2, state2] = getSymbol("second", state1, 0);
            const [sym3, state3] = getSymbol("third", state2, 0);

            expect(sym1).toBe("@1");
            expect(sym2).toBe("@2");
            expect(sym3).toBe("@3");
            expect(state3.stringMap.size).toBe(3);
        });

        it("should maintain immutability", () => {
            const state = createState();
            const [, newState] = getSymbol("test", state, 0);

            // Original state should be unchanged
            expect(state.stringMap.size).toBe(0);
            // New state should have the symbol
            expect(newState.stringMap.size).toBe(1);
        });
    });
});
