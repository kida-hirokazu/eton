import { EtonEncoderStream, EtonDecoderStream } from "../src/stream";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Mock data generator
async function* generateData() {
    yield { id: "u1", role: "admin", status: "active" };
    yield { id: "u2", role: "user", status: "active" };
    yield { id: "u3", role: "admin", status: "inactive" }; // Reuse 'admin', new 'inactive'
    yield { id: "u4", role: "guest", status: "active" }; // New 'guest'
}

async function runSmokeTest() {
    console.log("Starting Streaming Smoke Test...");

    const encoder = new EtonEncoderStream("UserSchema", {});
    const decoder = new EtonDecoderStream();

    const results: any[] = [];

    // Pipeline: Generator -> Encoder -> Decoder -> Collection
    // We simulate a transform chain

    // Web Streams in Node.js need some bridging if we use node:stream pipeline with async generators
    // But TransformStream matches standard Web API.
    // Let's iterate manually to simulate the flow clearly or use streamToIterator if available.

    const reader = encoder.readable.getReader();
    const writer = encoder.writable.getWriter();

    // Feed data
    (async () => {
        for await (const chunk of generateData()) {
            await writer.write(chunk);
        }
        await writer.close();
    })();

    // Read encoded chunks and feed to decoder
    const decWriter = decoder.writable.getWriter();

    // Pipe encoder output to decoder input
    (async () => {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            // console.log("Encoded Chunk:", JSON.stringify(value)); 
            await decWriter.write(value);
        }
        await decWriter.close();
    })();

    // Read decoded results
    const decReader = decoder.readable.getReader();
    while (true) {
        const { done, value } = await decReader.read();
        if (done) break;
        results.push(value);
    }

    console.log("Decoded Results:", JSON.stringify(results, null, 2));

    // Validation
    if (results.length !== 4) throw new Error("Count mismatch");
    if (results[0].role !== "admin") throw new Error("Data mismatch u1");
    if (results[3].role !== "guest") throw new Error("Data mismatch u4");

    console.log("✅ Streaming Smoke Test Passed!");
}

runSmokeTest().catch(e => {
    console.error("❌ Test Failed:", e);
    process.exit(1);
});
