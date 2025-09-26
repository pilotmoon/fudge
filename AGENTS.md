# Repository Guidelines

## Project Structure & Module Organization
`index.ts` publishes the public surface by re-exporting utilities from `src/`. Core modules live in `src/` (e.g. `icon.ts` for PopClip icon helpers, `snippet.ts` for snippet parsing, `validate.ts` for static config checks) alongside shared data like `mapping.json`. Keep runtime assets in `src/`, use relative module references (e.g. `./src/foo.js`), and colocate types with the functions that rely on them.

## Build, Test, and Development Commands
- `bun install` — install dependencies (run after changing `package.json`).
- `bun run check` — executes `tsc --noEmit` for strict typing.
- `bun run build` — runs the type check and emits `index.js` for Node consumers.
- `bun run watch` — incremental rebuilds during local development.
Use Bun 1.1+; when invoking other CLIs, prefer `bunx <tool>` so the project scripts stay consistent.

## Coding Style & Naming Conventions
Biome (`biome.json`) enforces formatting, linting, and organized imports; run it via `bunx biome check .` before committing. Code is TypeScript (ES2022 modules) with 2-space indentation and double-quoted strings. Exported functions use camelCase (e.g. `standardizeConfig`), while types and enums are PascalCase. Co-locate JSON data with the modules that read it and prefer explicit interfaces for cross-file contracts.

## Testing Guidelines
There is no dedicated test runner yet; rely on `bun run check` to keep types sound and add targeted ad-hoc scripts (see `testIcon.ts`) while developing. When adding automated tests, follow the pattern `*.spec.ts` inside a `tests/` or `src/__tests__/` folder and wire them into a `bun test` script so CI can invoke them later. Document manual validation steps in pull requests until automated coverage is in place.

## Commit & Pull Request Guidelines
Commits follow short, imperative messages (e.g. `fix subtle error string propagation`). Group related changes and keep build artifacts out of commits unless releasing. Pull requests should link to any related PopClip issues, explain the behavior change, and include before/after examples or screenshots for user-facing tweaks. Highlight validation steps (commands run, configs loaded) so reviewers can reproduce your checks quickly.

## Security & Configuration Tips
Config loaders (`loader.ts`, `validate.ts`) parse untrusted YAML and PLIST; always validate with `validateStaticConfig` before serializing data. Keep secrets and API tokens out of the repo—use local `.env` files ignored by Git. When introducing new external dependencies, prefer audited, ESM-compatible packages and add them explicitly under `dependencies` or `peerDependencies` as appropriate.
