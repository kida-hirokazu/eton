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
        const encoder = new EtonEncoderStream("Log", { "Log": ["timestamp", "level", "message"] });
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
        const encoder = new EtonEncoderStream("User", { "User": ["name", "role"] });
        const reader = encoder.readable.getReader();
        const writer = encoder.writable.getWriter();

        // Push data 1
        await writer.write({ name: "Alice", role: "Admin" });

        // 修正: 複数回 enqueue されるため、必要なデータ("%Data")が含まれるまで読み込む
        // これによりタイムアウトやアサーションエラーを防ぐ
        let chunk1 = await readUntil(reader, (buf) => buf.includes("%Data") && buf.includes("@1,@2"));

        expect(chunk1).toContain("%Schema:User");
        expect(chunk1).toContain("%Symbol");
        expect(chunk1).toContain("Alice,@1");
        expect(chunk1).toContain("Admin,@2");
        expect(chunk1).toContain("%Data");
        expect(chunk1).toContain("@1,@2");

        // Push data 2 (New Symbol "User")
        await writer.write({ name: "Bob", role: "User" });

        // Read chunk 2 (前回読みすぎた分がない前提で、新規に読み込み開始)
        // ここでも、シンボル定義とデータ本体が別々に来る可能性があるため待機する
        let chunk2 = await readUntil(reader, (buf) => buf.includes("Bob,@3") && buf.includes("@3,@4"));

        expect(chunk2).not.toContain("%Schema:User"); // スキーマは再送されない
        expect(chunk2).toContain("%Symbol");
        expect(chunk2).toContain("Bob,@3");
        expect(chunk2).toContain("User,@4");
        expect(chunk2).toContain("%Data");
        expect(chunk2).toContain("@3,@4");

        // Push data 3 (Reuse "Admin")
        await writer.write({ name: "Charlie", role: "Admin" });

        // Read chunk 3
        let chunk3 = await readUntil(reader, (buf) => buf.includes("Charlie,@5"));

        expect(chunk3).toContain("Charlie,@5");
        expect(chunk3).not.toContain("Admin,@2"); // 定義済みシンボルは再送されない
        expect(chunk3).toContain("@5,@2");
    });
});