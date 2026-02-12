/**
 * ETON CLI (Simple Version)
 *
 * Usage:
 *   node dist/cli.js encode <schema_name> <input_json_file>
 *   node dist/cli.js decode <input_eton_file>
 */

import * as fs from "fs";
import * as path from "path";
import { dumps, debugLoads } from "./index";
import { createState } from "./symbols";

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.log("Usage: eton-cli <command> [args...]");
        console.log("Commands: encode, decode");
        process.exit(1);
    }

    if (command === "encode") {
        // node cli.js encode MySchema input.json schema.json [output.eton]
        const schemaId = args[1];
        const inputFile = args[2];
        const schemaFile = args[3];

        if (!schemaId || !inputFile || !schemaFile) {
            console.error("Usage: encode <schema_id> <input.json> <schema.json> [output.eton]");
            process.exit(1);
        }

        const inputData = JSON.parse(fs.readFileSync(inputFile, "utf8"));
        const schemaData = JSON.parse(fs.readFileSync(schemaFile, "utf8"));

        const state = createState();
        const output = dumps(inputData, schemaId, schemaData, state);

        console.log(output);
    } else if (command === "decode") {
        // node cli.js decode input.eton
        const inputFile = args[1];
        if (!inputFile) {
            console.error("Usage: decode <input.eton>");
            process.exit(1);
        }

        const content = fs.readFileSync(inputFile, "utf8");
        const result = debugLoads(content);
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
