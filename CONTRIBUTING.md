# Contributing to ETON (Alpha)

Thank you for your interest in contributing to ETON!
We are currently in the **Alpha** stage of development. While we welcome feedback and contributions, please be aware that the specification and API may change at any time.

## Getting Started

1.  **Fork & Clone**: Fork this repository and clone it to your local machine.
2.  **Install Dependencies**: We use `pnpm` for package management.
    ```bash
    pnpm install
    ```

## Development Workflow

### Coding Standards
We use **[Biome](https://biomejs.dev/)** for linting and formatting. Please ensure your code passes checks before submitting a PR.

```bash
# Check for lint errors
pnpm lint

# Fix lint errors automatically
pnpm lint:fix

# Format code
pnpm format
```

### Running Tests
We use **[Vitest](https://vitest.dev/)** for testing. All new features or bug fixes must include tests.

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

## Pull Request Guidelines

1.  **One feature per PR**: Keep your changes focused.
2.  **Add Tests**: Ensure new logic is covered by tests.
3.  **Update Documentation**: If you change the behavior, update `README.md` or `docs/`.
4.  **Descriptive Title & Description**: Explain *why* the change is necessary.

## Bug Reports

Please use GitHub Issues to report bugs. Include:
- Version of ETON used
- Reproduction steps (code snippet or repository)
- Expected vs. Actual behavior

---

Thank you for helping us build the future of LLM communication!
