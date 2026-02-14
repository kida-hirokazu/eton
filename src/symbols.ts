/**
 * ETON Symbols — State definitions and operations (Functional)
 *
 * Manages symbol table state as immutable objects, using the State Threading pattern.
 */

export interface SymbolState {
    readonly stringMap: Map<string, string>;
    readonly reverseMap: Map<string, string>;
    readonly nextId: number;
}

/**
 * Creates an initial state.
 *
 * @param initialMap Optional existing string map to reuse.
 */
export function createState(initialMap?: Map<string, string> | Record<string, string>): SymbolState {
    let sMap: Map<string, string>;

    if (initialMap instanceof Map) {
        sMap = new Map(initialMap);
    } else if (initialMap) {
        sMap = new Map(Object.entries(initialMap));
    } else {
        sMap = new Map();
    }

    const rMap = new Map<string, string>();
    for (const [k, v] of sMap.entries()) {
        rMap.set(v, k);
    }

    // nextId = current size + 1
    const nextId = sMap.size + 1;

    return {
        stringMap: sMap,
        reverseMap: rMap,
        nextId,
    };
}

/**
 * Result tuple for state-threading functions.
 */
export type StateResult<T> = [T, SymbolState];

/**
 * mutable optimization wrapper (internal use only)
 */
export class MutableSymbolTable {
    public sMap: Map<string, string>;
    public rMap: Map<string, string>;
    public nextId: number;

    constructor(state: SymbolState) {
        this.sMap = new Map(state.stringMap);
        this.rMap = new Map(state.reverseMap);
        this.nextId = state.nextId;
    }

    getSymbol(value: unknown, threshold = 1000): string {
        if (value === null || value === undefined) return "_";
        if (typeof value === "boolean") return value ? "T" : "F";

        // Number optimization
        if (typeof value === "number") {
            if (Math.abs(value) < threshold) {
                return String(value);
            }
        }

        const s = String(value);
        if (this.sMap.has(s)) {
            return this.sMap.get(s)!;
        }

        // Only symbolize if string is long enough or repeated? 
        // Actually, if it's already in the map, we use it. 
        // If not, we only add it if it's long enough.
        if (s.length < threshold) {
            return s;
        }

        // Create new symbol
        const symbol = `@${this.nextId}`;
        this.sMap.set(s, symbol);
        this.rMap.set(symbol, s);
        this.nextId++;
        return symbol;
    }

    toState(): SymbolState {
        return {
            stringMap: this.sMap,
            reverseMap: this.rMap,
            nextId: this.nextId,
        };
    }
}

/**
 * Get symbol from value. Returns new state if updated.
 */
export function getSymbol(
    value: unknown,
    state: SymbolState,
    threshold = 1000
): StateResult<string> {
    if (value === null || value === undefined) return ["_", state];
    if (typeof value === "boolean") return [value ? "T" : "F", state];

    if (typeof value === "number" && Math.abs(value) < threshold) {
        return [String(value), state];
    }

    const s = String(value);
    if (state.stringMap.has(s)) {
        return [state.stringMap.get(s)!, state];
    }

    if (s.length < threshold) {
        return [s, state];
    }

    // Create new state (Immutable update)
    const symbol = `@${state.nextId}`;

    // Clone maps
    const newSMap = new Map(state.stringMap);
    const newRMap = new Map(state.reverseMap);

    newSMap.set(s, symbol);
    newRMap.set(symbol, s);

    const newState: SymbolState = {
        stringMap: newSMap,
        reverseMap: newRMap,
        nextId: state.nextId + 1,
    };

    return [symbol, newState];
}

/**
 * Resolve symbol to raw string value.
 */
export function resolveSymbol(symbol: string, state: SymbolState): string | number | boolean | null {
    if (symbol === "_") return null;
    if (symbol === "T") return true;
    if (symbol === "F") return false;

    const raw = state.reverseMap.get(symbol) ?? symbol;

    // Try parsing number
    // Simple check: if it looks like a number, parse it?
    // Python logic:
    // if "." in raw or "e" in raw.lower(): float
    // else: int

    // Checking if completely numeric
    if (!isNaN(Number(raw)) && raw.trim() !== "") {
        return Number(raw);
    }

    return raw;
}
/**
 * Serializes the symbol table to ETON string (Pure ETON).
 * Dictionary format:
 * %Symbol
 * <original>, <symbol>
 */
export function serializeDictionary(state: SymbolState): string {
    const lines: string[] = ["%Symbol"];
    // Sort by key for deterministic output
    const keys = Array.from(state.stringMap.keys()).sort();
    for (const key of keys) {
        const symbol = state.stringMap.get(key)!;
        // Escape the key for CSV safety
        const escapedKey = key.includes(",") || key.includes('"') || key.includes("\n")
            ? `"${key.replace(/"/g, '""')}"`
            : key;
        lines.push(`${escapedKey},${symbol}`);
    }
    return lines.join("\n");
}

/**
 * Serializes the symbol table to JSON string (Hybrid Mode).
 * Dictionary format:
 * %Symbol:JSON
 * {"key": "@1", ...}
 */
export function serializeDictionaryJson(state: SymbolState): string {
    const dictObj: Record<string, string> = {};
    const keys = Array.from(state.stringMap.keys()).sort();
    for (const key of keys) {
        dictObj[key] = state.stringMap.get(key)!;
    }
    return `%Symbol:JSON\n${JSON.stringify(dictObj)}`;
}

/**
 * Parses ETON dictionary string (Pure ETON or JSON) back to SymbolState.
 */
export function parseDictionary(content: string): SymbolState {
    const sMap = new Map<string, string>();
    const lines = content.trim().split("\n");

    // Check for JSON format
    if (lines[0]?.trim() === "%Symbol:JSON") {
        try {
            // Join all subsequent lines (in case of pretty print, though we compact)
            const jsonStr = lines.slice(1).join("\n");
            const dictObj = JSON.parse(jsonStr);
            for (const [key, symbol] of Object.entries(dictObj)) {
                if (typeof symbol === 'string') {
                    sMap.set(key, symbol);
                }
            }
            return createState(sMap);
        } catch (e) {
            console.error("Failed to parse JSON dictionary:", e);
            return createState();
        }
    }

    // Fallback to Pure ETON CSV parsing
    let isSymbolBlock = false;
    for (const line of lines) {
        if (line.startsWith("%Symbol")) {
            isSymbolBlock = true;
            continue;
        }
        if (!isSymbolBlock) continue;

        const match = line.match(/^(.*),(@\d+)$/);
        if (match) {
            let key = match[1];
            const symbol = match[2];

            if (key.startsWith('"') && key.endsWith('"')) {
                key = key.slice(1, -1).replace(/""/g, '"');
            }
            sMap.set(key, symbol);
        }
    }

    return createState(sMap);
}
