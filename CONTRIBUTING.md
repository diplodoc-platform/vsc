# Contributing

**english** | [русский](https://github.com/diplodoc-platform/vsc/blob/master/CONTRIBUTING.ru.md)

---

## Prerequisites

- Node.js 22+
- npm >= 11.5
- VS Code 1.110+
- Git

## Setup

```bash
git clone https://github.com/diplodoc-platform/vsc.git
cd vsc
npm install
npm run compile
```

Verify everything works:

```bash
npm run typecheck
npm test
npm run lint
```

## Running the extension locally

1. Open the project in VS Code
2. Press `F5` — this launches a new VS Code window (Extension Development Host) with the extension loaded
3. Open any Markdown or YAML file in the dev host to test

For faster iteration:

```bash
npm run watch:ext       # rebuilds extension host on change
npm run watch:webview   # rebuilds webviews on change
```

Run both in separate terminals. After a rebuild, press `Ctrl+Shift+P` → `Developer: Reload Window` in the dev host.

To test from a packaged `.vsix`:

```bash
npm run vsce
code --install-extension diplodoc-vsc-extension-*.vsix --force
```

## Project structure

```
src/
├── index.ts                          # activate() — entry point
├── commands.ts                       # Command handlers
├── utils.ts                          # Shared utilities
├── modules/
│   ├── shared/base-editor.ts         # Abstract base class for visual editors
│   ├── md-editor/editor.ts           # WYSIWYG Markdown editor (extends BaseEditor)
│   ├── toc-editor/editor.ts          # TOC editor (extends BaseEditor)
│   ├── main/sidebar.ts               # Sidebar file browser
│   ├── color/                        # YAML color picker provider
│   └── validation/                   # YAML schema validation + Markdown linting
│       ├── index.ts                  # Orchestrator: events, cache, debounce
│       ├── parser.ts                 # Extract frontmatter + page-constructor blocks
│       ├── markdown.ts               # @diplodoc/yfmlint integration
│       ├── utils.ts                  # Error → vscode.Diagnostic conversion
│       └── providers/
│           ├── yaml-service.ts       # yaml-language-server singleton
│           ├── diagnostic.ts         # Schema validation diagnostics
│           ├── completion.ts         # YAML autocompletion
│           ├── hover.ts              # YAML hover documentation
│           └── position.ts           # Editor ↔ block coordinate mapping
├── ui/                               # React webview source (runs in browser)
│   ├── md-editor/                    # Markdown editor UI
│   ├── toc-editor/                   # TOC editor UI
│   └── sidebar/                      # Sidebar UI
├── extensions/                       # Custom markdown-it plugins
│   ├── yfm-include/                  # {% include %}
│   └── yfm-frontmatter/             # --- frontmatter ---
├── i18n/                             # Localization (en, ru)
schemas/
├── *.json                            # Generated JSON Schema files (committed)
├── overlays/*.yaml                   # VS Code-specific schema extensions
scripts/
└── merge-schemas.js                  # CLI schema → JSON Schema pipeline
syntaxes/
└── markdown-page-constructor.json    # TextMate grammar for ::: page-constructor
tests/mocks/                          # Manual test files
```

## Architecture overview

The extension runs in two environments:

### Extension Host (Node.js)

Entry: `src/index.ts` → `build/index.js`

Built with esbuild as a single CJS bundle (~8 MB). Only `vscode` is external — everything else (including `yaml-language-server`) is inlined. Three esbuild plugins handle bundling issues:

- **yamlServerFixes** — redirects `vscode-json-languageservice/lib/umd/` → `lib/esm/`; stubs `prettier` and `request-light` (unused by us)
- **nodeShims** — stubs `fs`/`path`/`process` for webview bundles; provides browser polyfills for `punycode`/`url`
- **pageConstructorFixes** — fixes `@gravity-ui/markdown-editor/pm/*` subpath resolution and webpack-style `~` imports

### Webviews (Browser)

Three separate IIFE bundles: `md-editor`, `toc-editor`, `sidebar`. React 18 + @gravity-ui/uikit. Assets embedded as data URLs.

Communication between extension host and webviews is via `postMessage()` — see the protocol tables in AGENTS.md.

### Editor class hierarchy

Visual editors share a base class:

```
BaseEditor (abstract)          — src/modules/shared/base-editor.ts
├── MdEditor                   — src/modules/md-editor/editor.ts
│   Adds: WYSIWYG mode, whitespace preservation,
│   page-constructor wrap/unwrap, pending sync, save
└── TocEditor                  — src/modules/toc-editor/editor.ts
    Identity transforms, change-only messages
```

To add a new visual editor: extend `BaseEditor`, implement abstract methods (`_panelId`, `_panelTitle`, `_buildSubdir`, `_canSync`, `_onWebviewMessage`, `_transformForWebview`, `_transformFromWebview`).

## Working with schemas

JSON schemas are generated from `@diplodoc/cli` YAML schemas, with VS Code-specific overlays merged on top.

### Updating schemas

```bash
npm run merge-schemas
```

This reads from `../packages/cli/schemas/`, applies overlays from `schemas/overlays/`, and writes to `schemas/*.json`. If the CLI schemas are elsewhere, the script prompts for the path.

### Adding a new schema type

1. Ensure the CLI schema exists at `../packages/cli/schemas/<name>.yaml`
2. Create an overlay at `schemas/overlays/<name>.yaml` (minimum: `title` and `additionalProperties: false`)
3. Add entry to `SCHEMAS` in `scripts/merge-schemas.js`
4. Run `npm run merge-schemas`
5. In `yaml-service.ts`: import the schema, add entry to `SCHEMA_ENTRIES`
6. In `validation/index.ts`: add entry to `YAML_FILE_SCHEMAS`
7. Optionally add the filename to `contributes.languages` in `package.json`

### Modifying hover/completion content

Edit `schemas/overlays/<name>.yaml` and run `npm run merge-schemas`. Overlays support:

- `markdownDescription` — rich hover content
- `defaultSnippets` — autocompletion snippets
- `additionalProperties: false` — strict property checking

Important: when a definition uses `oneOf`/`anyOf` with `$ref`, all referenced properties must also be listed in the parent `properties` if `additionalProperties: false` is set.

## Validation system

The validation system has two independent paths:

- **YAML validation** — `yaml-language-server` with in-process singleton, virtual documents, block-relative coordinates
- **Markdown linting** — `@diplodoc/yfmlint` with all Diplodoc transform plugins

Key design choices documented in AGENTS.md: singleton with all schemas pre-registered (no race conditions), virtual document version incrementing (no stale diagnostics), lazy block parsing (hover/completion work before first validation).

### Adding a new directive error handler

Add an entry to `DIRECTIVE_HANDLERS` in `src/modules/validation/utils.ts`:

```typescript
{message: /^My block must be closed/, open: /{%\s*myblock\b[^%]*%}/, close: /{%\s*endmyblock\s*%}/}
```

## Testing

```bash
npm test                # Run all tests (vitest)
npm run test:coverage   # With coverage report
```

### Test patterns

- **Mock vscode API**: centralized in `src/test-setup.ts` — provides MockPosition, MockRange, MockDiagnostic, MockColor, MockHover, MockCompletionItem, etc.
- **Mock documents**: factory functions (`mockDocument(text)`) that create minimal `vscode.TextDocument` with `lineCount` and `lineAt()`
- **Mock yaml-language-server**: `vi.mock('yaml-language-server')` with controlled return values
- **Mock modules**: `vi.mock('./module')` for isolating providers from yaml-service, position utils, etc.
- **Real filesystem**: `findConfig()` tests use real `/tmp` directories

Tests live next to the code they test (`*.spec.ts`). Manual test files for integration testing are in `tests/mocks/`.

### What to test

- **New validation features**: test the diagnostic conversion, range calculation, and error formatting
- **New schema types**: test via `getDiagnostics()` with real content + schema type
- **New editor features**: mock the webview message protocol
- **New UI components**: test with mock `window` and `MessageEvent`

## Debugging

- **Output channel**: `logger()` from `src/modules/utils.ts` writes to VS Code Output → "Diplodoc"
- **Extension Host log**: shows activation errors and unhandled exceptions
- **Webview DevTools**: in the dev host, `Ctrl+Shift+P` → `Developer: Open Webview Developer Tools`
- **Standalone yaml-language-server tests**: `node -e "..."` scripts can call validation/hover/completion directly without VS Code

## Code style

Managed by `@diplodoc/lint` (wraps ESLint + Prettier + Stylelint):

```bash
npm run lint            # Check
npm run lint:fix        # Auto-fix
```

Key rules:

- TypeScript strict mode
- Import order: `import type` first, then external packages, then local (separated by blank lines)
- No `any` without `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- Public members before protected, protected before private (`@typescript-eslint/member-ordering`)
- All comments and commit messages in English

## Commit guidelines

[Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>
```

| Type       | When                                    |
| ---------- | --------------------------------------- |
| `feat`     | New user-facing feature                 |
| `fix`      | Bug fix                                 |
| `perf`     | Performance improvement                 |
| `refactor` | Code restructuring (no behavior change) |
| `docs`     | Documentation only                      |
| `chore`    | Build, CI, dependencies                 |

Subject: imperative mood, lowercase, no period. Scope is optional (e.g., `validation`, `editor`, `schemas`).

Releases are managed automatically by [release-please](https://github.com/googleapis/release-please).

## Pull request process

1. Branch from `master`: `git checkout -b feat/my-feature`
2. Make changes, ensure all checks pass:
   ```bash
   npm run typecheck
   npm test
   npm run lint
   ```
3. Push and create a PR against `master`
4. Fill in the PR description — what changed and why
5. Address review feedback

### PR checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes (zero warnings)
- [ ] New code has tests
- [ ] AGENTS.md updated if architecture changed

## CLA

By contributing, you agree to the [Yandex CLA](https://yandex.ru/legal/cla/?lang=en). Add this to your first PR:

> I hereby agree to the terms of the CLA available at: https://yandex.ru/legal/cla/?lang=en
