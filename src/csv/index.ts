/**
 * ETON CSV Utilities
 *
 * Wraps csv-stringify and csv-parse to ensure consistent behavior
 * (RFC 4180 compliance) for ETON's line-based usage.
 */

import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";

/**
 * Encode a single row of values into a CSV string.
 *
 * @param row Array of string values (symbols or raw strings).
 * @returns A CSV formatted string (without trailing newline).
 */
export function encodeRow(row: string[]): string {
    // csv-stringify adds a newline by default. We might want to remove it
    // if ETON handles newlines externally, but usually ETON consists of lines.
    // However, for a single row helper, returning the string *without* trailing newline
    // is often safer for flexible composition.

    const output = stringify([row], {
        record_delimiter: "unix", // \n
        quoted_string: true,      // Quote strings if needed (default behavior is good, but let's be implicit)
        // "quoted_match": ... could be used to force quotes for specific patterns
    });

    // Remove trailing newline
    return output.replace(/\n$/, "");
}

/**
 * Decode a single line of CSV text into an array of strings.
 *
 * @param line A single line of CSV text.
 * @returns Array of strings.
 */
export function decodeRow(line: string): string[] {
    // Parse single line
    const records = parse(line, {
        relax_quotes: true, // Be tolerant
        relax_column_count: true,
    });

    if (records.length === 0) return [];
    return records[0] as string[];
}
