import { encodeBatch, createState, serializeDictionary, inferSchema } from "../src/index";
import { encode as gptEncode } from "gpt-tokenizer";
import { encode as toonEncode } from "@toon-format/toon";

// Sample dataset (User records)
const generateData = (count: number) => {
    const roles = ["Senior Systems Administrator", "Lead Software Engineer", "Quality Assurance Analyst", "Product Relationship Manager"];
    const statuses = ["Currently Active and Operational", "Maintenance Mode (Scheduled)", "Pending Administrative Approval"];
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        // Using longer repetitive strings to demonstrate ETON's strength in dictionary compression
        role: roles[i % roles.length],
        status: statuses[i % statuses.length],
        verified: i % 2 === 0
    }));
};
const data = generateData(1000);
const schemas = inferSchema(data);

// 1. JSON Baseline
const jsonStr = JSON.stringify(data);
const jsonTokens = gptEncode(jsonStr).length;

// 2. TOON (Real Library)
// TOON usually encodes an object. For array of objects, likely it outputs a list or similar.
// Let's pass the whole array.
const toonStr = toonEncode(data);
const toonTokens = gptEncode(toonStr).length;

// 3. ETON (Dictionary + Symbolized Data)
let state = createState();
// inferSchema produces "Root" by default for the top level
const [encoded, newState] = encodeBatch(data, "Root", schemas, state, { audit: false });
const dictStr = serializeDictionary(newState);
const etonStr = `%Schema:Root\n${schemas["Root"].join(",")}\n%Symbol\n${dictStr}\n%Data\n${encoded}`;
const etonTokens = gptEncode(etonStr).length;

console.log(`--- Benchmark Results (100 records) ---`);
console.log(`JSON Tokens: ${jsonTokens}`);
console.log(`TOON Tokens: ${toonTokens}`);
console.log(`ETON Tokens: ${etonTokens}`);
console.log(`Reduction vs JSON: ${((1 - etonTokens / jsonTokens) * 100).toFixed(2)}%`);
