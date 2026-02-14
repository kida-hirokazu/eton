import { describe, it, expect } from 'vitest';
import { EtonEncoderStream } from '../src/stream';
import { EtonDecoderStream } from '../src/stream';

import type { ReadableStreamDefaultReader } from 'node:stream/web';

// ヘルパー関数: 条件を満たすデータが揃うまでストリームを読み続ける
async function readUntil(
    reader: ReadableStreamDefaultReader<string>,
    predicate: (buffer: string) => boolean
): Promise<string> {
    let buffer = "";
    while (true) {
        const { value, done } = await reader.read();
        if (value) buffer += value;
        // データが終了したか、条件（期待する文字列が含まれている）を満たしたら返す
        if (done || predicate(buffer)) return buffer;
    }
}

describe('Incremental Dictionary Streaming', () => {
    it('should handle dynamic symbol updates based on new data', async () => {
        const encoder = new EtonEncoderStream("Log", { "Log": ["timestamp", "level", "message"] }, { threshold: 0 });
        const decoder = new EtonDecoderStream();

        // 修正: pipeTo と pipeThrough を併用せず、デコーダーへのパイプのみを行う
        const readable = encoder.readable.pipeThrough(decoder);
        const reader = readable.getReader();
        const inputWriter = encoder.writable.getWriter();

        // 1. Initial Data
        await inputWriter.write({ timestamp: "10:00", level: "INFO", message: "Start" });

        // デコーダーを通した結果はオブジェクト単位で出てくるため、単純な read() でOK
        let result = await reader.read();
        expect(result.value).toEqual({ timestamp: "10:00", level: "INFO", message: "Start" });

        // 2. New Data with NEW symbol
        await inputWriter.write({ timestamp: "10:01", level: "WARN", message: "Low memory" });

        result = await reader.read();
        expect(result.value).toEqual({ timestamp: "10:01", level: "WARN", message: "Low memory" });

        // 3. New Data with ANOTHER NEW symbol
        await inputWriter.write({ timestamp: "10:05", level: "ERROR", message: "Crash" });

        result = await reader.read();
        expect(result.value).toEqual({ timestamp: "10:05", level: "ERROR", message: "Crash" });

        // 4. Data reusing ALL symbols
        await inputWriter.write({ timestamp: "10:06", level: "INFO", message: "Crash" });

        result = await reader.read();
        expect(result.value).toEqual({ timestamp: "10:06", level: "INFO", message: "Crash" });

        await inputWriter.close();
    });

    it('should verify raw intermediate output format', async () => {
        const encoder = new EtonEncoderStream("User", { "User": ["name", "role"] }, { threshold: 0 });
        const writer = encoder.writable.getWriter();

        let intermediateBuffer = "";
        const readable = encoder.readable.pipeTo(new WritableStream({
            write(chunk) {
                intermediateBuffer += chunk;
            }
        }));

        // Push data 1
        await writer.write({ name: "Alice", role: "Admin" });

        // Wait a bit for async processing? Or just check if buffer grows.
        // For ETON, we can wait for the expected tokens.
        const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

        // Polling buffer (Simple retry logic)
        for (let i = 0; i < 10 && !(intermediateBuffer.includes("%Data") && intermediateBuffer.includes("@1,@2")); i++) {
            await wait(50);
        }

        expect(intermediateBuffer).toContain("%Schema:User");
        expect(intermediateBuffer).toContain("%Symbol");
        expect(intermediateBuffer).toContain("Alice,@1");
        expect(intermediateBuffer).toContain("Admin,@2");
        expect(intermediateBuffer).toContain("%Data");
        expect(intermediateBuffer).toContain("@1,@2");

        // Push data 2 (New Symbol "User")
        const bufferBeforeBob = intermediateBuffer.length;
        await writer.write({ name: "Bob", role: "User" });

        for (let i = 0; i < 10 && !intermediateBuffer.includes("@3,@4"); i++) {
            await wait(50);
        }

        const newChunk2 = intermediateBuffer.substring(bufferBeforeBob);
        expect(newChunk2).not.toContain("%Schema:User");
        expect(newChunk2).toContain("Bob,@3");
        expect(newChunk2).toContain("User,@4");
        expect(newChunk2).toContain("@3,@4");

        // Push data 3 (Reuse "Admin")
        const bufferBeforeCharlie = intermediateBuffer.length;
        await writer.write({ name: "Charlie", role: "Admin" });

        for (let i = 0; i < 10 && !intermediateBuffer.includes("@5,@2"); i++) {
            await wait(50);
        }

        const newChunk3 = intermediateBuffer.substring(bufferBeforeCharlie);
        expect(newChunk3).toContain("Charlie,@5");
        expect(newChunk3).toContain("@5,@2");

        await writer.close();
        await readable;
    });
});