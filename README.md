**english** | [русский](https://github.com/diplodoc-platform/vsc/blob/master/README.ru.md)

---

# Diplodoc Extension for VS Code

VS Code extension for the [Diplodoc](https://diplodoc.com) documentation platform. Provides a WYSIWYG Markdown editor, YAML validation, autocompletion, linting, and visual editors for `.md`, `toc.yaml`, and page-constructor `.yaml` files.

## Features

- **WYSIWYG Markdown Editor** — visual editing with toolbar for Diplodoc-specific blocks (notes, cuts, tabs, includes, page-constructor, HTML blocks, Mermaid diagrams)
- **TOC Editor** — dedicated visual editor for `toc.yaml` files
- **YAML Validation** — JSON Schema-based validation for `toc.yaml`, `.yfm`, `.yfmlint`, `presets.yaml`, `redirects.yaml`, `theme.yaml`, and page-constructor files
- **Markdown Linting** — real-time diagnostics via `@diplodoc/yfmlint` with full plugin support
- **Autocompletion & Hover** — YAML property completion with schema documentation
- **Link Navigation** — Ctrl+Click on file paths and URLs in YAML files to open them
- **Color Picker** — inline color preview and picker for YAML color values
- **Sidebar** — file browser with search, quick navigation, and project initialization
- **Syntax Highlighting** — YAML highlighting inside `::: page-constructor` blocks in Markdown

## Requirements

VS Code 1.110+

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=diplodoc.diplodoc-vsc-extension) or via command line:

```bash
code --install-extension diplodoc.diplodoc-vsc-extension
```

## Usage

The extension activates automatically when you open a Markdown or YAML file.

### WYSIWYG Editor

Open the visual Markdown editor:

- Click the Diplodoc icon in the editor title bar
- Or run `Open Diplodoc Markdown Editor` from the Command Palette

The editor supports two modes: **WYSIWYG** and **Markup**. Set the default mode in settings:

```json
{
  "diplodoc.editorMode": "wysiwyg"
}
```

### Keyboard Shortcuts

| Shortcut | Action                  |
| -------- | ----------------------- |
| `Alt+T`  | Insert Table            |
| `Alt+R`  | Insert Note             |
| `Alt+C`  | Insert Cut              |
| `Alt+A`  | Insert Tabs             |
| `Alt+O`  | Insert Code Block       |
| `Alt+Z`  | Insert Include          |
| `Alt+Q`  | Insert Quote            |
| `Alt+M`  | Insert Mermaid Diagram  |
| `Alt+X`  | Insert Checkbox         |
| `Alt+F`  | Insert Frontmatter      |
| `Alt+P`  | Insert Page Constructor |
| `Alt+H`  | Insert HTML Block       |

### Validation

The extension validates the following file types against Diplodoc JSON Schemas:

| File                 | Schema Type       |
| -------------------- | ----------------- |
| `toc.yaml`           | Table of Contents |
| `.yfm`               | Project config    |
| `.yfmlint`           | Lint config       |
| `presets.yaml`       | Presets           |
| `redirects.yaml`     | Redirects         |
| `theme.yaml`         | Theme             |
| `index.yaml`         | Leading page      |
| YAML with `blocks:`  | Page Constructor  |
| Markdown frontmatter | Frontmatter       |

Markdown files are linted with `@diplodoc/yfmlint`. Configure lint rules via `.yfmlint` at your project root:

```yaml
default: true
MD013: false
YFM003: error
log-levels:
  MD001: disabled
```

### Page Constructor

YAML files with a top-level `blocks:` key can be edited in the WYSIWYG editor. The extension automatically detects these files and enables the visual editor button.

### Sidebar

The Diplodoc sidebar in the activity bar shows all `.md`, `toc.yaml`, and page-constructor files in your workspace. Use it to:

- Browse and search project files
- Open files in the visual editor
- Initialize a new Diplodoc project (`yfm init`)

## Contributing

See [CONTRIBUTING.md](https://github.com/diplodoc-platform/vsc/blob/master/CONTRIBUTING.md) for development setup, architecture overview, testing, and contribution guidelines.

## License

MIT
