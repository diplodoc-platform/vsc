# Diplodoc VSCode Extension

VSCode extension for the [Diplodoc](https://diplodoc.com) documentation platform. Provides JSON Schema-based YAML validation, autocompletion, hover documentation, Markdown linting, and visual editors for `.md`, `toc.yaml`, and page-constructor `.yaml` files.

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
npm run merge-schemas        # Regenerate JSON schemas from @diplodoc/cli sources
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
│   ├── links/                                  # Ctrl+Click link navigation in YAML files
│   │   ├── index.ts                            # LinkProvider + diagnostics + activate()
│   │   ├── constants.ts                        # LINK_FIELDS set, FIELD_RE regex
│   │   ├── utils.ts                            # isExternalUrl(), parseLinkFromLine()
│   │   └── diagnostics.ts                      # validateLinks() — unreachable file detection
│   ├── orphan/                                 # Orphan file detection (FileDecorationProvider)
│   │   ├── index.ts                            # activate() — watchers + provider registration
│   │   ├── collector.ts                        # collectReferencedFiles() + collectBlocksYamlFiles()
│   │   ├── decorator.ts                        # OrphanDecorationProvider — marks unreferenced .md/.yaml
│   │   ├── on-delete.ts                        # handleFileDeleted() — remove from toc / add redirect
│   │   └── constants.ts                        # HREF_RE, INCLUDE_PATH_RE, MD_INCLUDE_RE
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
scripts/
└── merge-schemas.js                            # CLI schema → JSON Schema pipeline
syntaxes/
└── markdown-page-constructor.json              # TextMate grammar: YAML highlighting in ::: page-constructor
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
- `YfmDirective` (custom, `src/extensions/yfm-directive/`) — generic passthrough for any `:::` directive block not handled by other extensions (e.g. `::: no-translate`, `::: custom-block`). Preserves content without escaping. Directive name stored in `token.info` / `node.attrs.directiveName`.
- `Math`, `Mermaid` — LaTeX and diagram support

Toolbar includes `wYfmHtmlBlockItemData` and `wYfmPageConstructorItemData` in the command menu.

#### YAML Page-Constructor Editor

YAML files containing a top-level `blocks:` key (page-constructor files) can be edited in the same Markdown WYSIWYG editor used for `.md` files. The flow:

1. **Detection**: `isBlocksYaml(document)` in `src/utils.ts` checks `languageId === 'yaml'` and tests for `/^\s*blocks\s*:/m` in the document text.

2. **Context variable**: `diplodoc.hasBlocksYaml` is set via `vscode.commands.executeCommand('setContext', ...)` whenever the active editor changes (`updateYamlContext()` in `src/index.ts`). This enables the editor title bar button and command enablement.

3. **Wrap/unwrap**: When sending YAML content to the Markdown editor webview, the YAML body is wrapped in `::: page-constructor\n...\n:::` via `wrapPageConstructor()`. When receiving edits back from the webview, `unwrapPageConstructor()` strips the directive wrapper before writing back to the YAML file.

4. **Sidebar integration**: `_getMarkdownFiles()` in `sidebar.ts` scans `**/*.yaml` (excluding `node_modules`), opens each document, and includes URIs where `isBlocksYaml()` returns true. A `yamlWatcher` refreshes the file list on YAML create/delete. Clicking a blocks-YAML file opens it in the Markdown editor via `_mdEditor.showFile()`.

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

`@diplodoc/yfmlint` has `default: false` in its built-in config, meaning rules won't run unless enabled. The extension builds the lint config via `buildLintConfig()` (`markdown.ts`) in the following merge order:

1. **Extension defaults**: `{ default: true, MD013: false }` — all rules enabled, line length disabled
2. **User's `.yfmlint` overrides**: processed by `processYfmlintConfig()` — the user can change `default`, enable/disable any rule, set severity levels
3. **Forced overrides**: `MD033: !allowHtml` — always controlled by `.yfm`, cannot be overridden by `.yfmlint` (matches CLI behavior)

User config entries spread on top of extension defaults, so the user **can** re-enable `MD013` or set `default: false` in `.yfmlint`.

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

### Files

| Schema                         | Target Files                    | Validated By  |
| ------------------------------ | ------------------------------- | ------------- |
| `page-constructor-schema.json` | YAML with `blocks` key          | Our extension |
| `frontmatter-schema.json`      | Markdown frontmatter `---..---` | Our extension |
| `leading-schema.json`          | `index.yaml` with `blocks`      | Our extension |
| `toc-schema.json`              | `toc.yaml`                      | Our extension |
| `yfm-schema.json`              | `.yfm`                          | Our extension |
| `yfmlint-schema.json`          | `.yfmlint`                      | Our extension |
| `presets-schema.json`          | `presets.yaml`                  | Our extension |
| `redirects-schema.json`        | `redirects.yaml`                | Our extension |
| `theme-schema.json`            | `theme.yaml`                    | Our extension |

### Generation Pipeline (`scripts/merge-schemas.js`)

Source: `@diplodoc/cli` YAML schemas at `../packages/cli/schemas/`.

```
CLI YAML schema
  → stripCliKeys()         Remove 'translate', 'optionName'
  → convertSelectToOneOf() Convert ajv select/selectCases → JSON Schema allOf+if/then
  → addMarkdownDescriptions()  Auto-generate markdownDescription from description+type
  → deepMerge(overlay)     Merge VSCode-specific overlay
  → fixObjectTypeLabels()  Replace **`object`** with inferred concrete type
  → write JSON
```

Run: `npm run merge-schemas` (auto-detects CLI schemas at `../packages/cli/schemas`, prompts for path if missing).

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
- **grammars**: Injects YAML syntax highlighting into `::: page-constructor` blocks in Markdown
- **commands**: `diplodoc.openMdEditor` (works for both Markdown and blocks-YAML), `diplodoc.openTocEditor`, `diplodoc.insertTable`, `diplodoc.insertNote`, `diplodoc.insertPageConstructor`, `diplodoc.insertHtmlBlock`
- **keybindings**: `Alt+T` (table), `Alt+R` (note), `Alt+P` (page-constructor), `Alt+H` (HTML block)
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

### Adding a new link field

Add the field name to `LINK_FIELDS` in `src/modules/links/constants.ts`. No other changes needed — both link navigation and diagnostics will pick it up automatically.

## Orphan File Detection

`src/modules/orphan/` marks `.md` and blocks-yaml files not connected to any `toc.yaml` with a `?` badge in the Explorer (via `FileDecorationProvider`).

### How it works

1. `collectReferencedFiles()` scans all `toc.yaml` files for `href` and `include.path` values
2. For each referenced `.md` file, it recursively extracts `{% include [...](path) %}` paths
3. `collectBlocksYamlFiles()` finds all `.yaml` files with a `blocks:` key (page-constructor files)
4. Result: `Set<string>` of all referenced file paths (toc + includes chain), `Set<string>` of blocks-yaml files
5. `OrphanDecorationProvider` marks any `.md` or blocks-yaml file NOT in the referenced set with badge `?` and yellow color
6. Files in `includes/` directories or directories starting with `_` are automatically excluded (`isAutoIncluded`)
7. Refresh triggers: `toc.yaml` change/create/delete, `.md` create/delete/change, `.yaml` create/delete/change

### On-delete behavior

When a `.md` or blocks-yaml file is deleted and was referenced in `toc.yaml`:

1. `handleFileDeleted()` detects toc references via `findTocReferences()`
2. Shows `QuickPick` with options: "Remove from toc.yaml" / "Remove + add redirect" / "Do nothing"
3. "Remove from toc" — deletes the `href:` line (and preceding `name:` line) from toc.yaml
4. "Add redirect" — prompts for target path via `InputBox`, appends entry to `redirects.yaml`

### Performance

- Initial scan on activation (parses toc.yaml files only — fast)
- Incremental: FileSystemWatcher triggers refresh on toc/md/yaml file events
- `.md` content changes use debounced refresh (500ms)
- `provideFileDecoration` is O(1) Set lookup, called only for visible files

## Color Provider

`src/modules/color/` provides a YAML color picker (color swatches in the gutter).

### How it works

1. `YamlColorProvider.provideDocumentColors()` scans every line of YAML files
2. `KEY_VALUE_RE` (`/^(\s*)([\w-]+)\s*:\s*/`) matches YAML key-value lines
3. `extractValueSpan()` extracts the value portion (handles both quoted and unquoted values, strips inline comments)
4. `parseColor()` uses `colord` library to validate and parse — supports hex, rgb(), rgba(), hsl(), named colors
5. If valid, a `ColorInformation` is returned → VS Code shows the color swatch

### Color presentations

When the user picks a color from the VS Code color picker, two representations are offered:

- Hex (`'#rrggbb'` or `'#rrggbbaa'`)
- RGB (`'rgb(r, g, b)'` or `'rgba(r, g, b, a)'`)

Both are always quoted (preserves original quote style; defaults to `'` if unquoted).

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

### Adding a new schema type

1. Ensure the CLI schema YAML exists at `../packages/cli/schemas/<name>.yaml`
2. Create overlay at `schemas/overlays/<name>.yaml` (at minimum: `title` and `additionalProperties: false`)
3. Add entry to `SCHEMAS` array in `scripts/merge-schemas.js`
4. Run `npm run merge-schemas`
5. In `yaml-service.ts`: add import, add entry to `SCHEMA_ENTRIES`
6. In `validation/index.ts`: add entry to `YAML_FILE_SCHEMAS` array
7. Optionally add filename to `package.json` `contributes.languages[0].filenames`

### Modifying schema validation

Edit `schemas/overlays/<name>.yaml` and run `npm run merge-schemas`. Overlays are deep-merged — you can override any nested property. Use `additionalProperties: false` for strict checking.

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
