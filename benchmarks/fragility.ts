import * as fs from "node:fs";
import * as path from "node:path";
import { encode, serializeDictionary, debugLoads, type SchemaMap } from "../src/index";

const DATA_DIR = path.resolve(__dirname, "../../data/toon_datasets");
const ITERATIONS = 1000;
const TARGET_FILE = "accuracy_tabular.json"; // Representative dataset

function inferSchema(records: any[]): string[] {
    if (records.length === 0) return [];
    const first = records[0];
    return Object.keys(first);
}

async function runFragilityTest() {
    console.log(`Running Fragility Test on ${TARGET_FILE} (${ITERATIONS} iterations)...`);

    // 1. Prepare Base ETON Data
    const filePath = path.join(DATA_DIR, TARGET_FILE);
    if (!fs.existsSync(filePath)) {
        console.error("Dataset not found.");
        return;
    }
    const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    let records: any[] = [];
    if (Array.isArray(json)) {
        records = json;
    } else {
        const arrayKey = Object.keys(json).find(k => Array.isArray(json[k]));
        if (arrayKey) {
            records = json[arrayKey];
        } else {
            records = [json];
        }
    }

    const schemaId = "Root";
    const schemas: SchemaMap = { [schemaId]: inferSchema(records) };

    const [encodedData, state] = encode(records, schemaId, schemas, undefined, { audit: false });
    const dictStr = serializeDictionary(state);
    const originalEton = encodedData + "\n" + dictStr;

    // Baseline info
    const totalChars = originalEton.length;
    const totalRecords = records.length;

    let crashes = 0;
    let totalRecoveredPercent = 0;

    // 2. Mutation Loop
    for (let i = 0; i < ITERATIONS; i++) {
        // Delete 1 random char
        const pos = Math.floor(Math.random() * totalChars);
        const mutatedEton = originalEton.slice(0, pos) + originalEton.slice(pos + 1);

        try {
            // Attempt to load
            const loaded = debugLoads(mutatedEton);

            // Check how many data rows recovered
            // loaded is array of {line, type, info}
            // Count 'data' type rows
            const dataRows = loaded.filter(row => row.type === "data").length;

            const recoveredRate = dataRows / totalRecords;
            totalRecoveredPercent += recoveredRate;

        } catch (e) {
            crashes++;
            // recovered 0 for this iteration
        }
    }

    // 3. Calculate Metrics
    const crashRate = (crashes / ITERATIONS) * 100;
    const recoveryRate = (totalRecoveredPercent / ITERATIONS) * 100;

    console.log(`| Dataset | Crash Rate (CR) | Recovery Rate (RR) |`);
    console.log(`|---|---|---|`);
    console.log(`| ${TARGET_FILE} | ${crashRate.toFixed(2)}% | ${recoveryRate.toFixed(2)}% |`);
}

runFragilityTest();
