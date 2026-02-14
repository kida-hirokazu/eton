import * as fs from "node:fs";
import * as path from "node:path";
import { encode, createState } from "../src/index";
import { encode as toonEncode } from "../../toon/packages/toon/dist/index.mjs";

const DATA_DIR = path.resolve(__dirname, "../data/toon_datasets");

function inspect(filename: string, label: string) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${filename} (not found)`);
        return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    let json = JSON.parse(content);
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

    // Take a small sample to see the format overhead
    const sample = records.slice(0, 3);

    console.log(`\n=== Analyzing ${label} (${filename}) ===`);

    // 1. JSON (Minified)
    const jsonStr = JSON.stringify(sample);
    console.log(`\n[JSON (Minified)] Length: ${jsonStr.length}`);
    console.log(jsonStr);

    // 2. TOON
    try {
        const toonStr = toonEncode(sample);
        console.log(`\n[TOON] Length: ${toonStr.length}`);
        console.log(toonStr);
    } catch (e) {
        console.log("[TOON] Error:", e);
    }

    // 3. ETON
    try {
        const schemas: any = {};
        // Simple schema inference
        if (sample.length > 0) schemas[schemaId] = Object.keys(sample[0]);

        const state = createState();
        const [encoded, newState] = encode(sample, schemaId, schemas, state, { audit: false });

        // Construct full ETON string for fair visualization
        // (Just header + encoded part, ignoring full dictionary for this small sample dump)
        const etonStr = `%Schema:${schemaId}\n${schemas[schemaId]?.join(",")}\n%Data\n${encoded}`;

        console.log(`\n[ETON (Body)] Length: ${etonStr.length}`);
        console.log(etonStr);
    } catch (e) {
        console.log("[ETON] Error:", e);
    }
}

inspect("accuracy_tabular.json", "Case 1: ETON loses (Tabular)");
inspect("accuracy_nested.json", "Case 2: ETON wins (Nested)");
