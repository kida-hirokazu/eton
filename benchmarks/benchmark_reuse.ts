import * as fs from "node:fs";
import * as path from "node:path";
import { encode, serializeDictionaryJson, inferSchema } from "../src/index";
import { encode as gptEncode } from "gpt-tokenizer";

const DATA_DIR = path.resolve(__dirname, "../data/toon_datasets");
const TARGET_FILE = "efficiency_event-logs.json"; // High repetition data

async function runReuseBenchmark() {
    const filePath = path.join(DATA_DIR, TARGET_FILE);
    if (!fs.existsSync(filePath)) {
        console.error(`Data file not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const jsonFull = JSON.parse(content);

    // Extract records robustly
    let rawRecords: any[] = [];
    if (Array.isArray(jsonFull)) {
        rawRecords = jsonFull;
    } else {
        const arrayKey = Object.keys(jsonFull).find(k => Array.isArray(jsonFull[k]));
        if (arrayKey) {
            rawRecords = jsonFull[arrayKey];
        } else {
            rawRecords = [jsonFull];
        }
    }
    // Take first 100 records for clear comparison
    const records = rawRecords.slice(0, 100);

    // 1. JSON (Stateless)
    // Cost per message = JSON.stringify(record)
    const jsonOne = JSON.stringify(records[0]);
    const jsonTokens = gptEncode(jsonOne).length;

    // 2. ETON (Stateful)
    // Initial Cost = Dictionary Definition
    // Running Cost = Encoded Body
    const schemas = inferSchema(records, "Log");
    const [encodedBody, state] = encode(records, "Log", schemas, undefined, { audit: false });

    // Calculate per-record cost
    const bodyLines = encodedBody.split("\n").filter(l => !l.startsWith("%")); // Remove Schema Header for body cost
    const bodyTokensTotal = gptEncode(bodyLines.join("\n")).length;
    const bodyTokensAvg = Math.ceil(bodyTokensTotal / records.length);

    // Initial Dictionary Cost (Hybrid JSON for logs)
    const dictStr = serializeDictionaryJson(state);
    const dictTokens = gptEncode(dictStr).length;

    console.log("## Dictionary Reuse Benchmark (Per Message)");
    console.log(`- Dataset: ${TARGET_FILE} (Sample: 100 records)`);
    console.log(`- JSON (Stateless): ${jsonTokens} tokens/msg`);
    console.log(`- ETON Body (Stateful): ${bodyTokensAvg} tokens/msg`);
    console.log(`- ETON Dictionary (Initial): ${dictTokens} tokens`);
    console.log("");

    // Calculate Break-Even Point
    // JSON * N = Dict + ETON * N
    // N (JSON - ETON) = Dict
    // N = Dict / (JSON - ETON)
    const reductionPerMsg = jsonTokens - bodyTokensAvg;
    const breakEven = Math.ceil(dictTokens / reductionPerMsg);

    console.log(`- Reduction per Message: ${reductionPerMsg} tokens`);
    console.log(`- Break-Even Point: ${breakEven} messages`);

    console.log("\n### Scenario Data for Graph");
    const points = [1, 10, 50, 100, 500, 1000];
    console.log("| Messages | JSON Total | ETON Total (Reuse) | ETON Saving % |");
    console.log("|---|---|---|---|");
    for (const n of points) {
        const jsonTotal = jsonTokens * n;
        const etonTotal = dictTokens + (bodyTokensAvg * n);
        const saving = ((1 - etonTotal / jsonTotal) * 100).toFixed(1);
        console.log(`| ${n} | ${jsonTotal.toLocaleString()} | ${etonTotal.toLocaleString()} | ${saving}% |`);
    }
}

runReuseBenchmark();
