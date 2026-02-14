# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0-alpha.1] - 2026-02-14

### Added
- Core ETON encoder and decoder implementation in TypeScript.
- Full streaming support via `EtonEncoderStream` with incremental dictionary support.
- Hybrid Dictionary support (JSON/CSV serialization).
- Automatic Schema Inference from data structures.
- Audit mechanism for data integrity verification.
- Comprehensive technical documentation and specifications.
- Multilingual support for README (Japanese and English).
- Comparative benchmarks against JSON and TOON.

### Security
- Removed all emojis from public documentation to ensure maximum compatibility and prevent encoding issues.

### Changed
- Standardized project structure and module organization.
- Switched to published `@toon-format/toon` for benchmark verification.
- Optimized performance for large datasets and long-session LLM communication.
