import { encodeBatch, createState, serializeDictionary, inferSchema } from "../src/index";
import { encode as gptEncode } from "gpt-tokenizer";

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

const data = generateData(5); // Small sample
const schemas = inferSchema(data);

// 3. ETON (Dictionary + Symbolized Data)
let state = createState();
// Using "Root" as schema ID to match inferred schema
const [encoded, newState] = encodeBatch(data, "Root", schemas, state, { audit: false });
const dictStr = serializeDictionary(newState);
const etonStr = `%Schema:Root\n${schemas["Root"].join(",")}\n%Symbol\n${dictStr}\n%Data\n${encoded}`;

console.log("=== ETON Output (Sample) ===");
console.log(etonStr);
console.log("============================");

// Check if symbols are used
if (etonStr.includes("Senior Systems Administrator")) {
    console.log("FAIL: Raw string found in output!");
} else {
    console.log("SUCCESS: Strings are symbolized.");
}
