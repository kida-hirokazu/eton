# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.2] - 2026-02-15

### Fixed
- **Documentation**: Corrected and improved installation instructions in README (Node.js 22+ requirement, development setup guide).

## [0.1.1] - 2026-02-15

### Added
- **Auto-Detect Dictionary Format**: Introduced `detectRecommendedFormat` and high-level `dumps` API for automatic optimal format selection.
- **Dictionary Reuse Benchmark**: New benchmark scenario for stateful sessions (`pnpm benchmark:reuse`).
- **Research Proposal Orientation**: Reframed documentation to position ETON as an "Intelligence Protocol" for LLM communication.
- **Qualitative Analysis**: Integrated LLM interpretability test results into the benchmark report.
- **Documentation**: Added `docs/Feature_Auto_Detection.md`.

### Changed
- Promoted `dumps` as the primary entrance API in README.
- Cleaned up Mermaid charts in `docs/Benchmark_Report.md` for better rendering and clarity.
- Updated package author to `kida-hirokazu`.

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
