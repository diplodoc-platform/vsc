# Diplodoc VSCode Extension

VSCode extension for the [Diplodoc](https://diplodoc.com) documentation platform. Provides JSON Schema-based YAML validation, autocompletion, hover documentation, Markdown linting, and visual editors for `.md`, `toc.yaml`, and page-constructor `.yaml` files.

## Instructions for AI Agents

> **This section is mandatory for all AI agents (Claude, Copilot, Cursor, Cody, etc.).**

### Do Not Access node_modules

**NEVER** read, search, browse, or access `node_modules/` without explicit user permission. This applies to all tools: file reads, grep, glob, find, ls, bash, etc. Use online documentation or `package.json` to learn about dependencies.

### Keep This File Up to Date

After completing a task, if you discovered new knowledge about the project's architecture, structure, patterns, bugs, or design decisions that is **not already documented here** — **you must update this file**. This includes:

- New modules, files, or components you created or discovered
- New bugs or known issues
- Changes to architecture or data flow
- New commands, protocols, or APIs
- Changes to the build system, testing, or CI/CD

Do not duplicate — check that the section is not already described. Update existing sections if information has changed. Place new content in the appropriate existing section, or create a new section if needed.

### Language

This document is written in English. Keep all additions in English for consistency.

---

## Quick Reference

```bash
npm install                  # Install dependencies
npm run compile              # Build extension host + all webviews
npm run compile:ext          # Build extension host only (faster for dev)
npm run compile:webview      # Build webviews only
npm run watch:ext            # Watch mode — extension host
npm run watch:webview        # Watch mode — webviews
npm run typecheck            # TypeScript type-check (no emit)
npm run vsce                 # Package into .vsix (uses --no-dependencies)
```

Install locally: `code --install-extension diplodoc-vsc-extension-0.0.1.vsix --force`

## Project Structure

```
src/
├── index.ts                                    # activate() / deactivate() — registers all modules
├── utils.ts                                    # insertElement(), isBlocksYaml(), wrap/unwrapPageConstructor()
├── modules/
│   ├── types.ts                                # Content, PluginMessage, ValidationMessage, YfmLintError
│   ├── utils.ts                                # logger(), isYfmFile() — Output channel "Diplodoc"
│   ├── validation/                             # *** Core: YAML schema validation + Markdown linting ***
│   │   ├── index.ts                            # Orchestrator: events, cache, provider registration
│   │   ├── parser.ts                           # Extract frontmatter + ::: page-constructor blocks from .md
│   │   ├── page-constructor.ts                 # Thin wrapper: getDiagnostics(content, schemaType)
│   │   ├── markdown.ts                         # @diplodoc/yfmlint integration for .md linting
│   │   ├── utils.ts                            # yfmlint/plugin errors → vscode.Diagnostic; findYfmConfig()
│   │   └── providers/
│   │       ├── yaml-service.ts                 # yaml-language-server singleton, ALL schemas registered
│   │       ├── diagnostic.ts                   # ls.doValidation() → vscode.Diagnostic[]
│   │       ├── completion.ts                   # ls.doComplete() → vscode.CompletionItem[]
│   │       ├── hover.ts                        # ls.doHover() → vscode.Hover (with Source: fix)
│   │       └── position.ts                     # Editor ↔ block-relative position mapping
│   ├── links/                                  # Link navigation, validation, md-link parsing
│   │   ├── index.ts                            # LinkProvider + diagnostics + activate()
│   │   ├── constants.ts                        # LINK_FIELDS set, FIELD_RE regex
│   │   ├── utils.ts                            # isExternalUrl(), parseLinkFromLine()
│   │   ├── diagnostics.ts                      # validateLinks() — unreachable file detection
│   │   ├── md-links.ts                         # findMarkdownReferences() + computeNewMdHref()
│   │   ├── file-completion.ts                  # FilePathCompletionProvider — YAML path suggestions
│   │   └── anchor-completion.ts                # AnchorCompletionProvider + parseAnchors() + findAnchorLine()
│   ├── orphan/                                 # Orphan file detection (FileDecorationProvider)
│   │   ├── index.ts                            # activate() — watchers + provider registration
│   │   ├── collector.ts                        # collectReferencedFiles() + collectBlocksYamlFiles()
│   │   ├── decorator.ts                        # OrphanDecorationProvider — marks unreferenced .md/.yaml
│   │   ├── on-delete.ts                        # handleFileDeleted() — remove from toc / replace md links / add redirect
│   │   ├── on-rename.ts                        # handleFileRenamed() — rename in toc + update md links / add redirect
│   │   ├── code-actions.ts                     # OrphanCodeActionProvider — Code Actions: open / add to nearest or root toc
│   │   └── constants.ts                        # HREF_RE, INCLUDE_PATH_RE, MD_INCLUDE_RE
│   ├── liquid/                                  # Liquid syntax support: presets, highlighting, hover, completion, links
│   │   ├── index.ts                            # activate() — registers all providers + goToPreset command
│   │   ├── constants.ts                        # VARIABLE_RE, PREFIX_RE, LIQUID_KEYWORDS, LIQUID_BLOCK_OPENERS
│   │   ├── types.ts                            # Variable, LiquidTag interfaces
│   │   ├── resolver.ts                         # findPresetsFiles(), parsePresetsFile(), resolveVariables()
│   │   ├── hover.ts                            # LiquidHoverProvider — hover for {{var}} and vars inside {% %}
│   │   ├── definition.ts                       # LiquidDefinitionProvider — Ctrl+Click / F12 to presets.yaml
│   │   ├── completion.ts                       # LiquidCompletionProvider — suggests variables inside {{ }}
│   │   ├── link.ts                             # LiquidLinkProvider — underlines vars as links in {{ }} and {% %}
│   │   ├── highlight.ts                        # LiquidHighlightProvider — highlights paired {% if/else/endif %} tags
│   │   └── utils.ts                            # formatEntries(), getLiquidTagKeyword(), findVariableInTag()
│   ├── presets/                                 # (Legacy, replaced by liquid/) Preset variable support
│   ├── main/sidebar.ts                         # Sidebar WebviewViewProvider
│   ├── md-editor/editor.ts                     # Markdown visual editor (WebviewPanel)
│   └── toc-editor/editor.ts                    # TOC visual editor (WebviewPanel)
├── ui/                                         # React webview source (browser bundles)
│   ├── md-editor/                              # Markdown editor UI (React + @gravity-ui/markdown-editor)
│   ├── toc-editor/                             # TOC editor UI (React + @gravity-ui/uikit)
│   └── sidebar/                                # Sidebar UI (React)
schemas/                                        # Generated JSON Schema Draft-07 files
├── *.json                                      # Output schemas (committed, used at build time)
└── overlays/*.yaml                             # VSCode-specific additions merged onto CLI schemas
syntaxes/
├── markdown-page-constructor.json              # TextMate grammar: YAML highlighting in ::: page-constructor
└── markdown-liquid.json                        # TextMate grammar: Liquid syntax highlighting in Markdown
tests/mocks/                                    # Test files for manual testing
```

## Architecture

Two runtime environments, both built by `esbuild.js`:

### Extension Host (Node.js, CJS)

Entry: `src/index.ts` → `build/index.js` (~8 MB bundled)

- **Only external**: `vscode` (provided by VS Code runtime)
- **Everything else inlined** including `yaml-language-server` and all its transitive deps
- esbuild plugin `yamlServerFixes` handles three bundling issues:
  - Redirects `vscode-json-languageservice/lib/umd/` → `lib/esm/` (UMD factory wrappers use parameter-passed `require()` that esbuild can't statically resolve)
  - Stubs `prettier` (used only for `doFormat()` which we never call)
  - Stubs `request-light` (used only for fetching remote schemas; we provide schemas inline)
- `mainFields: ['module', 'main']` — prefer ESM over UMD for all packages

### Webviews (Browser, IIFE)

Three separate bundles: `md-editor`, `toc-editor`, `sidebar`.

- React 18 + @gravity-ui/uikit
- Node APIs shimmed via `nodeShims` plugin (fs/path/process → empty, punycode/url → browser polyfills)
- Assets (images, fonts) embedded as data URLs
- SCSS with CSS modules support

#### Markdown Editor Extensions (WYSIWYG)

The editor (`useEditor` hook) configures the following extensions:

- `md: {html: true}` — enables built-in `Html` extension (inline HTML like `<span>`, `<br>` is preserved without escaping)
- `YfmHtmlBlock` (`@diplodoc/html-extension`) — `::: html ... :::` directive blocks rendered in sandboxed iframes
- `YfmPageConstructorExtension` — `::: page-constructor ... :::` blocks
- `YfmInclude` (custom, `src/extensions/yfm-include/`) — `{% include []() %}` blocks without escaping
- `YfmFrontmatter` (custom, `src/extensions/yfm-frontmatter/`) — `---` YAML frontmatter blocks without escaping
- `YfmDirective` (custom, `src/extensions/yfm-directive/`) — generic passthrough for any `:::` directive block not handled by other extensions (e.g. `::: no-translate`, `::: custom-block`). Preserves content without escaping. Directive name stored in `token.info` / `node.attrs.directiveName`. Also registers `yfmLiquidTagBlockRule` for `{% %}` Liquid tags (see Liquid Syntax Support section).
- `Math`, `Mermaid` — LaTeX and diagram support

Toolbar includes `wYfmHtmlBlockItemData` and `wYfmPageConstructorItemData` in the command menu.

#### YAML Page-Constructor Editor

YAML files containing a top-level `blocks:` key (page-constructor files) can be edited in the same Markdown WYSIWYG editor used for `.md` files. The flow:

1. **Detection**: `isBlocksYaml(document)` in `src/utils.ts` checks `languageId === 'yaml'` and tests for `/^\s*blocks\s*:/m` in the document text.

2. **Context variable**: `diplodoc.hasBlocksYaml` is set via `vscode.commands.executeCommand('setContext', ...)` whenever the active editor changes (`updateYamlContext()` in `src/index.ts`). This enables the editor title bar button and command enablement.

3. **Wrap/unwrap**: When sending YAML content to the Markdown editor webview, the YAML body is wrapped in `::: page-constructor\n...\n:::` via `wrapPageConstructor()`. When receiving edits back from the webview, `unwrapPageConstructor()` strips the directive wrapper before writing back to the YAML file.

4. **Sidebar integration**: `_getMarkdownFiles()` in `sidebar.ts` scans `**/*.md`, `**/{toc.yaml,toc-*.yaml}`, and `**/*.yaml` (excluding `node_modules`). TOC files are included directly; other YAML files are checked for `blocks:` key and included as blocks-YAML. Clicking a file opens it in the appropriate editor: `.md` and blocks-YAML in Markdown editor, TOC files (matched via `isToc()`) in TOC editor.

5. **package.json contributions**: The `diplodoc.openMdEditor` command has `enablement` and `when` conditions that include `diplodoc.hasBlocksYaml` alongside `resourceLangId == markdown`.

## Validation System — Detailed

### Data Flow

```
Document event (open/change/save)
    ↓
validate(document)
    ├── isYaml? → validateYaml()
    │   ├── resolveYamlSchema(doc) — match filename → SchemaType
    │   ├── Create Content block (type=schemaType, startLine=0, full file)
    │   ├── Cache in blocksCache
    │   └── getDiagnostics(block, schemaType) → collection.set()
    │
    └── isMarkdown? → validateMd()
        ├── parser.parseContent() → { pcContent[], fmContent }
        │   ├── extractFrontmatter() — regex /^---\n([\s\S]*?)\n---/
        │   └── extractPcBlocks() — find ::: page-constructor ... :::
        ├── Cache ALL blocks in blocksCache
        ├── For each PC block → getDiagnostics(block, 'pc')
        ├── For fmContent → getDiagnostics(block, 'fm')
        └── validateMarkdown(doc) — @diplodoc/yfmlint + plugins
```

### yaml-language-server Integration

`yaml-service.ts` creates a **singleton** `LanguageService` instance with **all 9 schemas registered at once**:

```
diplodoc://pc.yaml      → page-constructor-schema.json
diplodoc://fm.yaml      → frontmatter-schema.json
diplodoc://leading.yaml → leading-schema.json
diplodoc://toc.yaml     → toc-schema.json
diplodoc://yfm.yaml     → yfm-schema.json
diplodoc://yfmlint.yaml → yfmlint-schema.json
diplodoc://presets.yaml  → presets-schema.json
diplodoc://redirects.yaml→ redirects-schema.json
diplodoc://theme.yaml   → theme-schema.json
```

Each schema is matched to a virtual document URI via `fileMatch`. The service is configured once at creation — **no per-request reconfiguration** (this was a previous race condition: concurrent async validations would overwrite each other's schema config on the shared singleton).

### Virtual Documents

`createVirtualDocument(content, schemaType)` creates a `TextDocument` with:

- URI: `diplodoc://<schemaType>.yaml` (matches the fileMatch)
- Version: auto-incrementing counter (yaml-language-server caches by URI+version; without incrementing, edits produce stale results)

### Block Cache & Lazy Parsing

`blocksCache: Map<URI, Content[]>` stores parsed blocks per document.

- **Populated by**: `validate()` (on open/change/save with 400ms debounce)
- **Invalidated by**: `onDidChangeTextDocument` (clears cache before debounced revalidation)
- **Lazy fallback**: `getBlocksForDocument()` parses on-the-fly if cache is empty (so hover/completion work even before first validation completes)

### YAML File Type Detection

`resolveYamlSchema(document)` matches `path.basename(fileName)`:

| Filename                         | SchemaType             |
| -------------------------------- | ---------------------- |
| `toc.yaml`                       | `toc`                  |
| `.yfm`                           | `yfm`                  |
| `.yfmlint`                       | `yfmlint`              |
| `presets.yaml`                   | `presets`              |
| `redirects.yaml`                 | `redirects`            |
| `theme.yaml`                     | `theme`                |
| `index.yaml` (with `blocks` key) | `leading`              |
| Any YAML (with `blocks` key)     | `pc`                   |
| Everything else                  | `null` (no validation) |

### Diagnostic Severity

`diagnostic.ts` maps yaml-language-server diagnostics:

- **Error (red)**: "Incorrect type. Expected ..." and "Missing property ..."
- **Warning (yellow)**: "Property X is not allowed" and other schema warnings
- Uses regex matching on diagnostic messages to override yaml-language-server's default (all warnings)

### Hover Source Fix

`hover.ts` post-processes yaml-language-server hover markdown. The raw output contains `Source: [](diplodoc://toc-schema)` — an empty markdown link. The `fixSourceLink()` function replaces it with `Source: Diplodoc (toc.yaml)` using `SCHEMA_NAMES`.

### Markdown Linting

`markdown.ts` runs `@diplodoc/yfmlint` with all Diplodoc transform plugins.

#### Two error channels

Errors arrive via **two independent channels** — do not confuse them:

| Channel             | Source                                                                   | Has `lineNumber`? | Handled by                                  |
| ------------------- | ------------------------------------------------------------------------ | ----------------- | ------------------------------------------- |
| **Lint errors**     | yfmlint rules (YFM001–YFM018)                                            | Yes               | `toLintDiagnostic()` → `getLintRange()`     |
| **Plugin messages** | Transform plugins via `log.error/warn/info` callbacks in `pluginOptions` | **No**            | `toPluginDiagnostic()` → `getPluginRange()` |

`getPluginRange()` must figure out the range from the message text alone. It uses `DIRECTIVE_HANDLERS` table (regex → document search) and specific handlers for links/assets/includes.

#### yfmlint configuration

`@diplodoc/yfmlint` has `default: false` in its built-in config, meaning rules won't run unless enabled. The extension builds the lint config via `buildLintConfig()` (`validation/utils.ts`, called from `markdown.ts`) in the following merge order (lowest to highest priority):

1. **Extension defaults**: `{ default: true, MD013: false, MD018: false, MD026: false, MD034: false, MD051: false }` — all rules enabled, a few noisy ones disabled
2. **Project-derived**: `MD033: !allowHtml` (from `.yfm`), `MD041: !isFileIncluded`
3. **VS Code `diplodoc.lintRules` setting**: an object in the same format as `.yfmlint`, spread on top of the defaults
4. **User's `.yfmlint` overrides**: processed by `processYfmlintConfig()` — **highest priority**, spread last, can override everything above (including `MD033`/`MD041` and `diplodoc.lintRules`)

Both `diplodoc.lintRules` and `.yfmlint` entries spread on top of extension defaults, so the user **can** re-enable `MD013` or set `default: false`. `.yfmlint` wins over `diplodoc.lintRules` on any conflicting key. `diplodoc.lintRules` is read in `validation/index.ts` and passed through `validateMd()` → `validateMarkdown()` → `buildLintConfig()`.

##### `.yfmlint` config format

The `.yfmlint` file supports the same format as in `@diplodoc/cli`:

```yaml
default: false # disable all rules, then allowlist
MD013: true # boolean: enable at default level (warn)
YFM003: error # string: set severity (error/warn/info/disabled)
YFM001: # object: severity + rule-specific params
  level: error
  maximum: 80
log-levels: # convenience shorthand for severity overrides
  MD001: disabled
  MD041: disabled
```

##### `log-levels` handling

`processYfmlintConfig()` flattens the `log-levels` map into per-rule entries before passing to `yfmlint()`. Inline rule config takes precedence over `log-levels` for the same rule. Unlike the CLI (which uses `normalizeConfig()` to merge `log-levels`), we flatten manually to avoid a double-normalization bug where `yfmlint()` internally re-normalizes and loses severity from pre-normalized `log-levels`.

#### Config resolution

`findConfig(startDir, configName)` in `validation/utils.ts` walks up from `startDir` to filesystem root looking for the named config file (`.yfm` or `.yfmlint`). Returns parsed YAML as `Record<string, unknown>` or `null`.

Used by `validateMarkdown()` to load:

- `.yfm` — determines `allowHtml` and other project-level settings
- `.yfmlint` — lint rule overrides

Both config files live at the documentation project root (never nested deeper).

Available rules (yfmlint 1.7.0, no YFM012–YFM017, no YFM019):

| Rule   | Alias                              | Default level |
| ------ | ---------------------------------- | ------------- |
| YFM001 | inline-code-length                 | warn          |
| YFM002 | no-header-found-for-link           | warn          |
| YFM003 | unreachable-link                   | error         |
| YFM004 | table-not-closed                   | error         |
| YFM005 | block-not-closed                   | warn          |
| YFM006 | term-definition-duplicated         | warn          |
| YFM007 | term-used-without-definition       | warn          |
| YFM008 | term-inside-definition-not-allowed | warn          |
| YFM009 | no-term-definition-in-content      | error         |
| YFM010 | unreachable-autotitle-anchor       | warn          |
| YFM011 | max-svg-size                       | warn          |
| YFM018 | term-definition-from-include       | info          |
| YFM020 | invalid-yfm-directive              | warn          |

Local yfmlint source: `../packages/yfmlint`.

#### Transform plugin messages (all known)

These come via `pluginOptions.log` callbacks — **not** via the global `@diplodoc/transform/lib/log.js` singleton (that one is NOT captured).

| Plugin                                            | Message pattern                                     | Level |
| ------------------------------------------------- | --------------------------------------------------- | ----- |
| notes                                             | `Incorrect syntax for notes[, file {path}]`         | warn  |
| notes (via utils.js `nestedCloseTokenIdxFactory`) | `Note must be closed[ in {path}]`                   | error |
| cut (old version, via utils.js)                   | `Cut must be closed[ in {path}]`                    | error |
| changelog/collect                                 | `Changelog block must be closed[ in {path}]`        | error |
| changelog                                         | `Changelog close tag in not found: {path}`          | error |
| changelog                                         | `Changelog error: {message} in {path}`              | error |
| changelog/collect                                 | `Parsed changelogs less than expected[ in {path}]`  | error |
| links                                             | `Link is unreachable: {href} in {path}`             | error |
| links                                             | `Title not found: {href} in {path}`                 | warn  |
| links                                             | `Empty link in {path}`                              | error |
| images                                            | `Asset not found: {src} in {path}`                  | error |
| images                                            | `SVG {path} from {from} not found`                  | error |
| includes                                          | `No such file or has no access to {path} in {path}` | error |
| includes                                          | `Circular includes: {path} ▶ {path} ▶ ...`          | error |
| includes                                          | `Skip error: {e} in {path}`                         | error |
| anchors                                           | `Header without title[ in {path}]`                  | warn  |

Messages from `@diplodoc/transform/lib/liquid/` (conditions, cycles, substitutions) go through the **global** `log_1.log` and are **NOT captured** by our `pluginOptions.log`:

- `Condition block must be closed`, `If/For block must be opened before close`, `For block must be closed`
- `Incorrect syntax in if condition`, `Variable {name} not found`

**Important**: `@diplodoc/tabs-extension` and `@diplodoc/cut-extension` (current versions) do **not** emit any `log.error/warn` messages. Only the legacy `cut` plugin (via `nestedCloseTokenIdxFactory` in `@diplodoc/transform/lib/plugins/utils.js`) does.

#### Adding new directive error handling

Add one entry to `DIRECTIVE_HANDLERS` in `validation/utils.ts`:

- With `close` → uses `findDirectiveRange()` to find unmatched open tag
- Without `close` → uses `findRegexRange()` to find first match
- `open` regex should capture the full directive (`/{%\s*note\b[^%]*%}/`) for precise highlighting

## Schema System

### Key Transformations

**`convertSelectToOneOf()`**: The CLI schemas use ajv's non-standard `select`/`selectCases` for discriminated unions (e.g., different properties per page-constructor block type). yaml-language-server only supports standard JSON Schema. The conversion produces `allOf` + `if/then`:

```json
// Before (ajv):
{ "select": {"$data": "0/type"}, "selectCases": {"header-block": {...}, ...} }

// After (JSON Schema Draft-07):
{ "allOf": [
    {"if": {"properties": {"type": {"const": "header-block"}}}, "then": {...}},
    ...
]}
```

**`inferTypeLabel()`**: Generates human-readable type labels for hover:

- `$ref: "#/definitions/TocItem"` → `TocItem`
- `type: "string"` → `string`
- `type: "object", properties: {a, b, c}` → `{a, b, c}`
- `type: "object", properties: {a,b,c,d,e}` → `{a, b, c, ...}`
- `type: "object"` (no properties) → skipped (no label generated)
- `enum: ["a", "b"]` → `'a' | 'b'`
- `type: "array", items: {$ref: "...TocItem"}` → `TocItem[]`
- `oneOf: [{type: "string"}, {$ref: "...Foo"}]` → `string | Foo`

**`fixObjectTypeLabels()`**: Post-merge pass that replaces generic `**\`object\`\*\*`in overlay-provided`markdownDescription` with the type inferred from the actual schema structure.

### Overlays

`schemas/overlays/*.yaml` — merged on top of CLI schemas via `deepMerge()`. They add:

- `title` — schema display name (used in hover "Source:" line)
- `markdownDescription` — rich hover content for properties
- `defaultSnippets` — autocompletion snippets
- `additionalProperties: false` — strict property checking
- Extra `properties` (e.g., adding `href`/`include` to TocItem for compatibility with `additionalProperties: false` + `oneOf`)

**Important**: When a definition uses `oneOf`/`anyOf` with `$ref` to add properties (like TocItem → TocItemWithLink), those properties must also be listed in the parent's `properties` if `additionalProperties: false` is set. JSON Schema evaluates `additionalProperties` against the local `properties`/`patternProperties` only, not against sub-schemas in `oneOf`.

## package.json Contributions

- **activationEvents**: `onLanguage:markdown`, `onLanguage:yaml`
- **languages**: `.yfm`/`.yfmlint` as YAML; `toc.yaml`/`presets.yaml`/`redirects.yaml`/`theme.yaml` filenames as YAML
- **grammars**: Injects YAML syntax highlighting into `::: page-constructor` blocks in Markdown; injects Liquid syntax highlighting (`{{ }}`, `{% %}`) into Markdown
- **commands**: `diplodoc.openMdEditor` (works for both Markdown and blocks-YAML), `diplodoc.openTocEditor`, `diplodoc.insertTable`, `diplodoc.insertNote`, `diplodoc.insertCut`, `diplodoc.insertTab`, `diplodoc.insertCodeBlock`, `diplodoc.insertInclude`, `diplodoc.insertQuote`, `diplodoc.insertMermaid`, `diplodoc.insertFrontmatter`, `diplodoc.insertPageConstructor`, `diplodoc.insertHtmlBlock`, `diplodoc.insertVideo`
- **keybindings**: `Alt+T` (table), `Alt+R` (note), `Alt+C` (cut), `Alt+A` (tabs), `Alt+O` (code block), `Alt+Z` (include), `Alt+Q` (quote), `Alt+M` (mermaid), `Alt+F` (frontmatter), `Alt+P` (page-constructor), `Alt+H` (HTML block), `Alt+V` (video)
- **views**: Sidebar webview in activity bar

No `yamlValidation` contribution — the extension handles all YAML validation internally (no dependency on Red Hat YAML extension).

## Link Navigation (Ctrl+Click)

`src/modules/links/` provides `DocumentLinkProvider` for all YAML files. Ctrl+Click (Cmd+Click on Mac) on a path or URL opens the target file or URL.

### How it works

1. `LinkProvider.provideDocumentLinks()` iterates lines of any YAML document
2. `FIELD_RE` regex extracts YAML key-value pairs (handles unquoted, single-quoted, double-quoted values, and list items `- key: value`)
3. Field name is checked against `LINK_FIELDS` set — only known path/URL fields produce links
4. External URLs (`https://...`) → `vscode.Uri.parse()` (opens in browser)
5. Relative paths → `vscode.Uri.joinPath(documentDir, value)` (opens file in editor)

### Supported fields

Fields from all Diplodoc YAML schemas:

| Category                         | Fields                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| toc / leading / page-constructor | `href`, `url`, `path`, `input`, `base`                                                                                             |
| redirects                        | `from`, `to`                                                                                                                       |
| .yfm config                      | `output`, `config`, `theme`, `api`, `form`, `glossary`, `feedbackUrl`, `endpoint`, `github-url-prefix`, `host`, `pdfFileUrl`       |
| images / media                   | `src`, `src-dark`, `src-mobile`, `src-mobile-dark`, `src-preview`, `icon`, `avatar`                                                |
| resources / meta                 | `canonical`, `favicon-src`, `logo-src`, `logo-dark-src`, `logo-link-preview`, `vcsPath`, `sourcePath`, `script`, `style`, `schema` |

### Unreachable link diagnostics

`src/modules/links/diagnostics.ts` validates that local file paths actually exist on disk. For each relative path found in a YAML document, it calls `vscode.workspace.fs.stat()`. Missing files produce an error diagnostic: `Link is unreachable: <path>` (source: `Diplodoc`). External URLs are skipped. Validation runs on open, save, and change (400ms debounce).

**Navigation section exception**: Links inside the `navigation:` block in `toc.yaml` are skipped entirely. Navigation items (`leftItems`/`rightItems`) contain URLs (not file paths) that are resolved from the documentation root, not the file location, and may point outside the doc root. The `getNavigationLines()` helper detects the navigation block via indentation tracking and returns the set of line numbers to skip. When `navigation` is a scalar value (`navigation: false` or `navigation: ./nav.yaml`), no lines are skipped.

### Missing anchor diagnostics

`diagnostics.ts` also validates that anchors (`#fragment`) in markdown links point to existing headings or inline anchors in the target file. For each link with a `#fragment`:

1. If the target file does not exist — skipped (file-missing is reported separately)
2. Target file is read and `findAnchorLine(content, anchor)` from `anchor-completion.ts` checks for explicit `{#id}`, slugified heading anchors, and inline `{#id}` anchors
3. If the anchor is not found — **Warning** diagnostic: `Anchor not found: #<anchor>` (source: `Diplodoc`), underlines the `#anchor` portion of the link

Supported in both YAML (block scalar markdown links) and standalone markdown files. For markdown files, same-file `#anchor` links are validated against the current document buffer. Fenced code blocks are skipped. Validation runs on open, save, and change (400ms debounce) via `validateMarkdownFileAnchors()`.

### Adding a new link field

Add the field name to `LINK_FIELDS` in `src/modules/links/constants.ts`. No other changes needed — both link navigation and diagnostics will pick it up automatically.

### Markdown anchor navigation

`LinkProvider` now also registers for `{language: 'markdown'}`. When a markdown link or `{% include %}` contains a fragment (`file.md#anchor`), it creates an `AnchorDocumentLink` (internal subclass with `fileUri` and `fragment` properties) with `target` left `undefined`. VS Code calls `resolveDocumentLink` before the user follows the link. The resolver:

1. Reads the target file
2. Calls `findAnchorLine(content, fragment)` from `anchor-completion.ts`
3. Sets `target = fileUri.with({fragment: 'Lnn'})` (1-based line number) if found, or `fileUri` as fallback

**`findAnchorLine(content, anchorId)`** in `src/modules/links/anchor-completion.ts`:

- Explicit heading anchor: `## Title {#id}` — matched by `id`
- Auto-slug heading anchor: `## My Section` — matched by slug `my-section`
- Inline anchor: `{#id}` in a paragraph — matched by `id`

### Anchor completion

`AnchorCompletionProvider` in `src/modules/links/anchor-completion.ts` is registered for `{language: 'markdown'}` with trigger character `#`.

**`getAnchorContext(lineText, character)`** matches text up to cursor:

- Include: `{%\s*include\s*\[[^\]]*\]\(path#prefix$`
- Link: `\[[^\]]*\]\(path#prefix$`

**`parseAnchors(content, mode)`**:

- `'sections-only'` (includes): heading anchors only
- `'all'` (links): heading anchors + inline `{#id}` anchors

For headings with `{#id}`, the anchor ID is the explicit id — not the slug of the full text including `{#id}` (which is what VS Code's built-in incorrectly produces for YFM, e.g. `installation-install` instead of `install`).

Completion items use `sortText = '0_<id>'` to appear above VS Code's built-in heading suggestions. `detail` shows the clean heading text.

## Extension Settings

Declared in `package.json` under `contributes.configuration.properties`, read via the `getVscConfig()` helper (`src/modules/utils.ts`).

| Setting                  | Type    | Used by                                                         | Notes                                                                                                    |
| ------------------------ | ------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `diplodoc.editorMode`    | string  | `md-editor/editor.ts`                                           | `wysiwyg`/`markup`, sent to webview on creation and config change.                                       |
| `diplodoc.isOnlyYfm`     | boolean | `validation/index.ts` (`validateMd`)                            | When `true`, only Markdown files inside a YFM project are validated (`isYfmFile`).                       |
| `diplodoc.excludedDirs`  | array   | `utils.ts` (`getExcludeDirs`)                                   | Extra dirs excluded from validation/scanning, on top of `node_modules`, `_build`, `.yfm` output.         |
| `diplodoc.excludedFiles` | array   | `validation/index.ts`, `orphan/decorator.ts`, `orphan/index.ts` | Files (exact name / basename / regex) inside a YFM project that are neither validated nor orphan-marked. |
| `diplodoc.lintRules`     | object  | `validation/index.ts` → `buildLintConfig`                       | Lint rules in `.yfmlint` format; merged below `.yfmlint` (see Markdown Linting merge order).             |

## Orphan File Detection

`src/modules/orphan/` marks `.md` and blocks-yaml files not connected to any `toc.yaml` or `toc-*.yaml` with a `?` badge in the Explorer (via `FileDecorationProvider`).

### How it works

1. `collectReferencedFiles()` scans all `toc.yaml` and `toc-*.yaml` files (e.g., `toc-common.yaml`, `toc-api.yaml`) for `href` and `include.path` values
2. For each referenced `.md` file, it recursively extracts `{% include [...](path) %}` paths
3. `collectBlocksYamlFiles()` finds all `.yaml` files with a `blocks:` key (page-constructor files)
4. Result: `Set<string>` of all referenced file paths (toc + includes chain), `Set<string>` of blocks-yaml files
5. `OrphanDecorationProvider` marks any `.md` or blocks-yaml file NOT in the referenced set with badge `?` and yellow color
6. Files in `includes/` directories or directories starting with `_` are automatically excluded (`isAutoIncluded`)
7. Files matching `diplodoc.excludedFiles` are excluded from orphan marking too (`isFileExcluded` in `decorator.ts` / `index.ts`) — they are neither validated nor flagged as orphans
8. Refresh triggers: `toc.yaml` change/create/delete, `.md` create/delete/change, `.yaml` create/delete/change

### On-delete behavior

When a `.md` or blocks-yaml file is deleted and was referenced in any TOC file (`toc.yaml` or `toc-*.yaml`) or linked from other markdown files:

1. `handleFileDeleted()` detects toc references via `findTocReferences()` and markdown references via `findMarkdownReferences()` (from `links/md-links.ts`)
2. `tocLabel()` computes the display name: if all refs come from one TOC file, uses its basename (e.g. `toc-common.yaml`); otherwise shows `TOC files`
3. Shows `QuickPick` with context-aware options using the dynamic label:
   - If toc refs exist: "Remove from <toc-name>"
   - If both toc + md refs: "Remove from <toc-name> + replace links in markdown"
   - If only md refs: "Replace links in markdown files"
   - If toc refs exist: "Remove from <toc-name> + add redirect"
   - Always: "Do nothing"
4. "Remove from toc" — deletes the `href:` line (and preceding `name:` line) from the specific TOC file
5. "Replace links in markdown" — prompts for replacement URL via `InputBox`, replaces all `[text](deleted.md)` hrefs with the provided URL across the workspace
6. "Add redirect" — prompts for target path via `InputBox`, appends entry to `redirects.yaml`

### On-rename behavior

When a `.md` or blocks-yaml file is renamed and was referenced in any TOC file or linked from other markdown files:

1. `handleFileRenamed()` detects toc references via `findTocReferences()` and markdown references via `findMarkdownReferences()`
2. Shows `QuickPick` with context-aware options using the dynamic `tocLabel()`:
   - "Rename in <toc-name>" / "Rename in markdown files" / "Rename in <toc-name> and markdown files" (depending on what refs exist)
   - If toc refs exist: "Rename in <toc-name> + add redirect"
   - Always: "Do nothing"
3. Updates href values in the specific TOC file to the new relative path
4. Updates markdown link hrefs across the workspace, computing the correct relative path from each referencing file to the new location via `computeNewMdHref()`
5. All markdown replacements are batched into a single `WorkspaceEdit` for atomic undo

### Markdown link parsing (links/md-links.ts)

`findMarkdownReferences(targetUri)` scans all `.md` files in the workspace and returns references matching the target:

- Parses standard markdown links: `[text](path.md)`, `[text](path.md#anchor)`
- Parses image references: `![alt](image.png)`
- Parses include directives: `{% include [text](path.md) %}`
- Skips external URLs, anchor-only links, and links inside fenced code blocks
- Returns structured `MdReference` objects with file URI, href, filePath, fragment, hrefStart, and lineIndex for precise `WorkspaceEdit` replacements

### Performance

- Initial scan on activation (parses toc.yaml files only — fast)
- Incremental: FileSystemWatcher triggers refresh on toc/md/yaml file events
- `.md` content changes use debounced refresh (500ms)
- `provideFileDecoration` is O(1) Set lookup, called only for visible files

### Code Actions

`src/modules/orphan/code-actions.ts` implements `OrphanCodeActionProvider` (registered for `{language: 'markdown'}`). When an orphan diagnostic is present on line 0, a lightbulb appears offering:

- **Open [toc-name]** — opens the nearest or root `toc*.yaml` without changes
- **Add to [toc-name]** — inserts `- name: ''\n  href: <relative-path>` after the last `href:` in the toc, then reveals the new line

Two toc targets appear when they differ (nearest ≠ root). When nearest equals root, only one pair of actions is shown.

**`findNearestToc(fsPath)`** — walks up from the file's directory to the yfm root, returning the first directory that contains a `toc*.yaml` (prefers `toc.yaml` over `toc-*.yaml`).

**`findRootToc(fsPath)`** — returns the `toc*.yaml` at the yfm root directory.

**`buildInsertEdit(tocUri, content, orphanPath, tocPath)`** — locates the last `href:` line, inserts the new entry after it preserving the file's indentation style.

**`resolveCodeAction`** (async) — reads the toc content lazily when the user opens the lightbulb, avoiding file I/O in `provideCodeActions`.

The orphan diagnostic range was fixed from `(0,0,0,0)` to `(0,0,0,Number.MAX_SAFE_INTEGER)` — the full first line is now underlined (the previous zero-length range produced no squiggly, only a Problems panel entry).

The constructor accepts injectable `(_findNearestToc, _findRootToc, _isYfmFile)` with real implementations as defaults — this enables unit testing without module mocking.

## Liquid Syntax Support

`src/modules/liquid/` (replaces the legacy `src/modules/presets/`) provides comprehensive support for Diplodoc's Liquid syntax: preset variable hover/completion/navigation, syntax highlighting, and paired tag highlighting.

### How it works

1. `resolver.ts` walks from the document directory up to the YFM root (`.yfm`), collecting all `presets.yaml` files (closest first = highest priority)
2. Each `presets.yaml` is parsed with `js-yaml`. Variables are collected across all preset groups (`default`, `external`, etc.)
3. Five providers are registered:

| Provider                   | API                                 | Trigger                                    | Behavior                                                                                                             |
| -------------------------- | ----------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `LiquidHoverProvider`      | `registerHoverProvider`             | Mouse hover on `{{var}}` or var in `{% %}` | Shows markdown table of values per preset                                                                            |
| `LiquidDefinitionProvider` | `registerDefinitionProvider`        | Ctrl+Click / F12 on `{{var}}`              | Navigates to the variable definition line in the closest `presets.yaml`                                              |
| `LiquidLinkProvider`       | `registerDocumentLinkProvider`      | Always (document links)                    | Underlines vars as clickable links in `{{ }}` and `{% %}` tags                                                       |
| `LiquidCompletionProvider` | `registerCompletionItemProvider`    | Type `{` inside `{{ }}`                    | Suggests available variable names with default values as detail                                                      |
| `LiquidHighlightProvider`  | `registerDocumentHighlightProvider` | Cursor on a `{% %}` control tag            | Highlights all paired tags (`{% if %}` / `{% elsif %}` / `{% else %}` / `{% endif %}`, `{% for %}` / `{% endfor %}`) |

### Highlight provider

`LiquidHighlightProvider` (registered only for `{language: 'markdown'}`) highlights paired Liquid control tags:

- Collects all `{% %}` tags with control keywords (`if`, `elsif`, `else`, `endif`, `for`, `endfor`)
- Uses a depth-based algorithm to find matching opener/closer groups, handling nested blocks correctly
- When cursor is on any tag in a group, all tags in that group are highlighted with `DocumentHighlightKind.Read`
- Returns `null` for unpaired tags or non-control keywords

### TextMate grammar

`syntaxes/markdown-liquid.json` injects Liquid syntax highlighting into Markdown files:

- `not_var{{ variable }}` — `not_var` as keyword, `{{ }}` delimiters, variable name
- `{{ variable }}` — output tag with variable highlighting
- `{% keyword expression %}` — control tags with keywords (`if`, `elsif`, `else`, `endif`, `for`, `endfor`, `in`, `and`, `or`, `not`, `not_var`, `contains`), string literals, numbers, boolean constants, comparison operators, and variables

### WYSIWYG editor support

`yfm-directive/plugin.ts` adds a `yfmLiquidTagBlockRule` markdown-it block rule that preserves Liquid tags in the WYSIWYG editor:

- Control tags (`{% if %}`, `{% else %}`, `{% endif %}`, etc.) become individual `yfm_liquid_tag` tokens (one per line) so inner content renders normally as Markdown
- Tags with known block semantics (`{% note %}`, `{% cut %}`, `{% list %}`) are skipped — handled by their own extensions
- Unknown paired tags (e.g. `{% custom %}` / `{% endcustom %}`) are grouped into a single token
- `{% include %}` is explicitly excluded (handled by `YfmInclude` extension)

### Preset hierarchy

Multiple `presets.yaml` files can exist at different directory levels. Closer files (to the document) have higher priority. The `default` preset is always applied first, then named presets override it.

### Key functions in `resolver.ts`

- `findPresetsFiles(fsPath)` — returns all `presets.yaml` paths from document dir to YFM root (closest first)
- `resolveVariables(fsPath)` — returns `Map<varName, VariableEntry[]>` with preset name, value, file path, and line number
- `getVariable(lineText, character)` — detects `{{variable}}` at cursor position
- `findVariableLine(content, preset, varName)` — finds the line number of a variable definition within a preset block

### Key functions in `utils.ts`

- `getLiquidTagKeyword(lineText, charPos)` — returns the control keyword and tag boundaries if cursor is inside a `{% %}` tag
- `findVariableInTag(lineText, charPos)` — finds a non-keyword variable name at cursor position inside a `{% %}` tag
- `getVariableFromOutput(lineText, charPos)` — finds a variable at cursor position inside a `{{ }}` output tag
- `formatEntries(entries, root)` — formats variable entries as a Markdown table for hover display

## Color Provider

`src/modules/color/` provides color pickers for both YAML and Markdown, plus warning
diagnostics for values that look like a color but don't parse as one. Registered in
`activate()` for `{language: 'yaml'}` and `{language: 'markdown'}`.

`parseColor()` uses the `colord` library. **Important:** `colord` rejects CSS keyword
colors (`red`, `orange`, …) unless the `names` plugin is loaded, so `utils.ts` calls
`extend([namesPlugin])` once at module load. Without it, named colors would be treated
as invalid (and flagged). Supported forms: hex (3/4/6/8), `rgb()/rgba()`, `hsl()/hsla()`,
CSS keyword names.

### YAML color picker — `YamlColorProvider`

1. `provideDocumentColors()` scans every line of YAML files
2. `KEY_VALUE_RE` (`/^(\s*)([\w-]+)\s*:\s*/`) matches YAML key-value lines
3. `extractValueSpan()` extracts the value portion (handles both quoted and unquoted values, strips inline comments)
4. If `parseColor()` succeeds, a `ColorInformation` is returned → VS Code shows the swatch
5. Presentations: Hex (`'#rrggbb'`/`'#rrggbbaa'`) and RGB (`'rgb(...)'`/`'rgba(...)'`), always quoted (preserves original quote style; defaults to `'`)

### Markdown color picker — `MarkdownColorProvider`

Handles colorify markup `{colorName}(text)` — the same syntax as `@diplodoc/color-extension`.

1. `findMarkdownColors()` scans lines with `MD_COLOR_RE` (`/\{([^{}]+)\}\(/g`) — the `}(`
   suffix is what distinguishes colorify from `{#anchor}` / `{.class}` (markdown-it-attrs),
   which are therefore never matched
2. Fenced code blocks (`FENCE_RE`) are skipped so code samples aren't touched
3. The swatch range is the color-name token (between `{` and `}`); valid colors get a `ColorInformation`
4. Presentations are **bare** (no quotes) — picking a color rewrites `{red}(…)` → `{#ff0000}(…)`

### Invalid-color diagnostics

A single `DiagnosticCollection('diplodoc-color')` (created lazily in `activate`, so importing
the module has no side effects) publishes `DiagnosticSeverity.Warning` (yellow wavy underline,
also shown in Problems) for values that don't parse as a color:

- **Markdown**: any `{colorName}(…)` where `parseColor` fails (e.g. `{qwerty}(…)`)
- **YAML**: values gated by `isColorLike(raw, quoted)` so plain strings aren't flagged — a value
  counts as color-intended when it starts with `#`, matches `COLOR_FUNCTION_RE`
  (`rgb()/hsl()/hwb()/lab()/lch()/oklab()/oklch()/color()`), or is a **quoted** bare hex string
  matching `BARE_HEX_RE` (lengths 3/4/6/8, e.g. `'dddd'`). So `link-hover: 'dddd'` is flagged,
  while `unknownColor: '#ff0000'` (valid value) and `title: Hello` (not color-like) are not.

Diagnostic message is English: `Unknown color "<raw>". Expected a CSS color (e.g. red, #f00, rgb(0, 0, 255)).`
Refreshed on `onDidOpenTextDocument` / `onDidChangeTextDocument`, cleared on `onDidCloseTextDocument`.

Constants live in `constants.ts`: `KEY_VALUE_RE`, `MD_COLOR_RE`, `FENCE_RE`, `COLOR_FUNCTION_RE`, `BARE_HEX_RE`.

### WYSIWYG rendering of colorify (related, separate)

Rendering `{color}(text)` **inside the WYSIWYG editor** is not part of this module — it's
configured in `src/ui/hooks/useEditor.ts`. The `yfm` preset lacks the Color extension (only
`full` has it), so it's added explicitly with `builder.use(Color)`, and `overrideMarkSpec`
replaces the mark's `toDOM` to emit an inline `style="color: …"` instead of the palette class
`yfm-colorify--<name>`. This lets any CSS color render without shipping palette CSS.

## Editor Modules

### Shared patterns

`MdEditor` and `TocEditor` follow the same lifecycle pattern:

1. `show()` → reveal existing panel or create new one → sync active editor
2. `showFile(uri, column)` → open document → create/reveal panel → sync
3. `syncFromEditor(editor)` → read text → postMessage to webview
4. `_applyToDocument(text)` → WorkspaceEdit → replace full document range
5. `_createPanel()` → WebviewPanel with CSP, icon, event handlers
6. `_setupWebview()` → set HTML, register message handler

### MdEditor specifics

- **Whitespace preservation**: `_extractWhitespace()` strips leading/trailing whitespace before sending to webview, restores on write-back. This prevents WYSIWYG normalization from eating blank lines at file boundaries.
- **Page-constructor wrapping**: YAML files with `blocks:` key are wrapped in `::: page-constructor ... :::` for the WYSIWYG editor, unwrapped on save.
- **Pending sync**: New panels get a `_pendingSync` that fires on `ready` message from webview (avoids race condition where postMessage arrives before webview scripts load).
- **Mode configuration**: `diplodoc.editorMode` setting (`wysiwyg`/`markup`) is sent to webview on creation and on config change.
- **Save handling**: Webview can send `save` command (Ctrl+S in editor) → applies text + saves document.

### TocEditor specifics

- Simpler: no whitespace extraction, no page-constructor wrapping, no pending sync
- No `ready` handshake — sends content immediately after panel creation (potential message loss on first open if webview not ready)
- No mode toggle — always in markup mode

### Webview HTML

`getBaseHtml()` in `src/ui/html.ts` generates the shell HTML for all three webviews with:

- Content Security Policy: `default-src 'none'`, scoped `style-src`, `script-src`, `img-src` (data:, https:, blob:), `font-src` (data:), `worker-src` (blob:)
- Root div with `id` matching the webview name
- Single script + single stylesheet

## Webview Communication Protocol

All webviews communicate with the extension host via `postMessage()`.

### Extension → Webview messages

| Command      | Fields             | Used by   | Description                           |
| ------------ | ------------------ | --------- | ------------------------------------- |
| `setContent` | `text`, `fileName` | all       | Replace editor content                |
| `setFiles`   | `files`            | sidebar   | Update file list                      |
| `setMode`    | `mode`             | md-editor | Switch wysiwyg/markup mode            |
| `action`     | `action`           | md-editor | Trigger editor action (insert blocks) |

### Webview → Extension messages

| Command        | Fields  | Used by     | Description               |
| -------------- | ------- | ----------- | ------------------------- |
| `ready`        | —       | md-editor   | Webview scripts loaded    |
| `change`       | `text`  | all editors | Content changed by user   |
| `save`         | `text?` | md-editor   | Save requested (Ctrl+S)   |
| `requestFiles` | —       | sidebar     | Request file list refresh |
| `openFile`     | `file`  | sidebar     | Open file in editor       |
| `initProject`  | —       | sidebar     | Run `yfm init`            |

## I18n System

`src/i18n/` provides a minimal i18n framework for webview UIs.

- **Languages**: English (`en.json`), Russian (`ru.json`)
- **Detection**: `document.documentElement.lang` (set from `vscode.env.language` in `getBaseHtml()`)
- **Fallback**: English if lang not found
- **Key format**: dot-separated path (`sidebar.welcome`, `editor.error`)
- **Type safety**: `I18nKey` type is recursively flattened from the English messages structure — typos in keys cause type errors
- **Scope**: only used in webview UIs (sidebar buttons/labels, error boundary text); extension host uses VS Code's built-in NLS

## Theme Integration

`useVscodeTheme()` hook (`src/ui/useVscodeTheme.ts`) detects VS Code's color theme:

- Reads `data-vscode-theme-kind` attribute from `document.body`
- `vscode-dark` and `vscode-high-contrast` → `'dark'`; everything else → `'light'`
- Watches for attribute changes via `MutationObserver` (updates when user switches theme)
- Used by all webviews to set Gravity UI theme (`<ThemeProvider theme={theme}>`)

## Known Issues

1. **`commands.ts:23`**: `editor.document.fileName === 'toc.yaml'` — `fileName` returns full path, never matches. TOC editor guard broken. Should use `.endsWith()`.
2. **`index.ts:99`**: Same bug — `onDidChangeActiveTextEditor` sync for TOC editor never fires.
3. **`ui/shortcuts/commands.ts`**: All WYSIWYG shortcuts use `(editor as any).actions?.X?.run()` — fragile, breaks silently if @gravity-ui API changes.

## Common Tasks

### Debugging

- `logger()` from `src/modules/utils.ts` writes to VS Code Output channel "Diplodoc"
- Extension Host log shows activation errors
- `node -e "..."` scripts can test yaml-language-server validation/hover/completion directly without VS Code

### Testing

```bash
npm test                     # Run vitest
```

Manual test files in `tests/mocks/`: `toc.yaml`, `pc.yaml`, `presets.yaml`, `redirects.yaml`, `.yfmlint`, `theme.yaml`, `features.md`, `notes.md`, `index.md`, `pc.md`.

## Key Design Decisions

1. **yaml-language-server as in-process library** (not separate LSP process): avoids IPC overhead, schema loading latency. Trade-off: esbuild plugin needed to handle UMD→ESM redirects, stub unused deps.

2. **All schemas registered at once** on singleton creation: prevents race condition where concurrent `validate()` calls reconfigure the service for different schema types.

3. **Virtual documents with incrementing version**: yaml-language-server caches validation results by URI+version. Fixed version=1 caused stale diagnostics after edits.

4. **Lazy block parsing in `getBlocksForDocument()`**: hover/completion work even before first debounced validation completes.

5. **Block-relative coordinates**: each YAML block (frontmatter, page-constructor) is validated as a standalone document. `position.ts` utilities translate between editor coordinates and block-local LSP coordinates using `startLine` offset.

6. **`allOf`+`if/then` instead of ajv's `select/selectCases`**: standard JSON Schema pattern for discriminated unions. yaml-language-server doesn't support ajv extensions.

7. **Diagnostic severity override**: yaml-language-server returns all schema violations as warnings. We promote type mismatches and missing required properties to errors for better UX.

8. **No dependency on Red Hat YAML extension**: the extension is fully self-contained. No `yamlValidation` contribution in package.json.
