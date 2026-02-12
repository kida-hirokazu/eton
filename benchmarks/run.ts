import * as fs from "node:fs";
import * as path from "node:path";
import { encode, serializeDictionary, serializeDictionaryJson, type SchemaMap } from "../src/index";
import { encode as gptEncode } from "gpt-tokenizer";

const DATA_DIR = path.resolve(__dirname, "../../data/toon_datasets");
const CO2_PER_1K_TOKENS = 0.001719; // kgCO2e

function inferSchema(records: any[]): string[] {
    if (records.length === 0) return [];
    const first = records[0];
    return Object.keys(first);
}

async function runBenchmarks() {
    if (!fs.existsSync(DATA_DIR)) {
        console.error(`Data directory not found: ${DATA_DIR}`);
        return;
    }

    const files = [
        "accuracy_tabular.json",
        "accuracy_nested.json",
        "accuracy_analytics.json",
        "accuracy_event-logs.json",
        "accuracy_github.json",
        "efficiency_nested.json",
        "efficiency_tabular.json",
        "efficiency_event-logs.json"
    ];

    console.log("| Dataset | JSON | Pure ETON (CRR) | Hybrid ETON (CRR) | Pure EES | Hybrid EES |");
    console.log("|---|---|---|---|---|---|");

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, "utf-8");
        let json = JSON.parse(content);

        // Extract records
        let records: any[] = [];
        let schemaId = "Root";
        if (Array.isArray(json)) {
            records = json;
        } else {
            const arrayKey = Object.keys(json).find(k => Array.isArray(json[k]));
            if (arrayKey) {
                records = json[arrayKey];
                schemaId = arrayKey;
            } else {
                records = [json];
            }
        }

        const jsonStr = JSON.stringify(records); // Baseline: compact JSON of records
        const jsonTokens = gptEncode(jsonStr).length;

        const schemas: SchemaMap = {};
        schemas[schemaId] = inferSchema(records);

        // 1. Pure ETON
        let pureReduction = "0%";
        let pureEES = 0;
        try {
            const [encodedData, state] = encode(records, schemaId, schemas, undefined, { audit: false });
            // Use Pure dictionary
            const dictStr = serializeDictionary(state);
            const etonStr = encodedData + "\n" + dictStr;
            const etonTokens = gptEncode(etonStr).length;
            pureReduction = ((1 - etonTokens / jsonTokens) * 100).toFixed(2) + "%";

            const co2 = (etonTokens / 1000) * CO2_PER_1K_TOKENS;
            const co2Json = (jsonTokens / 1000) * CO2_PER_1K_TOKENS;
            pureEES = 1 - (co2 / co2Json);
        } catch (e) { }

        // 2. Hybrid ETON (JSON Dict)
        let hybridReduction = "0%";
        let hybridEES = 0;
        try {
            const [encodedData, state] = encode(records, schemaId, schemas, undefined, { audit: false });
            // Use JSON dictionary
            const dictStr = serializeDictionaryJson(state);
            const etonStr = encodedData + "\n" + dictStr;
            const etonTokens = gptEncode(etonStr).length;
            hybridReduction = ((1 - etonTokens / jsonTokens) * 100).toFixed(2) + "%";

            const co2 = (etonTokens / 1000) * CO2_PER_1K_TOKENS;
            const co2Json = (jsonTokens / 1000) * CO2_PER_1K_TOKENS;
            hybridEES = 1 - (co2 / co2Json);
        } catch (e) { }

        console.log(`| ${file} | ${jsonTokens.toLocaleString()} | ${pureReduction} | ${hybridReduction} | ${pureEES.toFixed(2)} | ${hybridEES.toFixed(2)} |`);
    }
}

runBenchmarks();
