import {vi} from 'vitest';

class MockPosition {
    line: number;
    character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
    }
}

class MockRange {
    start: MockPosition;
    end: MockPosition;

    constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
        this.start = new MockPosition(startLine, startChar);
        this.end = new MockPosition(endLine, endChar);
    }
}

class MockDiagnostic {
    source?: string;
    code?: string | number;
    range: MockRange;
    message: string;
    severity?: number;

    constructor(range: MockRange, message: string, severity?: number) {
        this.range = range;
        this.message = message;
        this.severity = severity;
    }
}

class MockColor {
    red: number;
    green: number;
    blue: number;
    alpha: number;

    constructor(red: number, green: number, blue: number, alpha: number) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
    }
}

class MockMarkdownString {
    value: string;

    constructor(value = '') {
        this.value = value;
    }
}

class MockColorInformation {
    range: MockRange;
    color: MockColor;

    constructor(range: MockRange, color: MockColor) {
        this.range = range;
        this.color = color;
    }
}

class MockColorPresentation {
    label: string;

    constructor(label: string) {
        this.label = label;
    }
}

class MockHover {
    contents: MockMarkdownString;

    constructor(contents: MockMarkdownString) {
        this.contents = contents;
    }
}

class MockCompletionItem {
    label: string;
    kind?: number;
    detail?: string;
    documentation?: MockMarkdownString;
    insertText?: string | MockSnippetString;
    range?: MockRange;

    constructor(label: string, kind?: number) {
        this.label = label;
        this.kind = kind;
    }
}

class MockSnippetString {
    value: string;

    constructor(value = '') {
        this.value = value;
    }
}

vi.mock('vscode', () => ({
    Range: MockRange,
    Position: MockPosition,
    Color: MockColor,
    Diagnostic: MockDiagnostic,
    MarkdownString: MockMarkdownString,
    ColorInformation: MockColorInformation,
    ColorPresentation: MockColorPresentation,
    Hover: MockHover,
    CompletionItem: MockCompletionItem,
    SnippetString: MockSnippetString,
    CompletionItemKind: {
        Text: 0,
        Method: 1,
        Function: 2,
        Constructor: 3,
        Field: 4,
        Variable: 5,
        Class: 6,
        Interface: 7,
        Module: 8,
        Property: 9,
        Unit: 10,
        Value: 11,
        Enum: 12,
        Keyword: 13,
        Snippet: 14,
        Color: 15,
        File: 16,
        Reference: 17,
        Folder: 18,
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
    },
    DocumentLink: class {
        range: MockRange;
        target: unknown;
        constructor(range: MockRange, target: unknown) {
            this.range = range;
            this.target = target;
        }
    },
    Uri: {
        parse: (s: string) => ({toString: () => s, scheme: 'https'}),
        file: (s: string) => ({toString: () => s, fsPath: s}),
        joinPath: (base: {toString: () => string}, ...segments: string[]) => {
            const basePath = base.toString().replace(/\/$/, '');
            const joined = segments.reduce((acc, seg) => {
                if (seg === '..') {
                    return acc.replace(/\/[^/]+$/, '');
                }

                return acc + '/' + seg;
            }, basePath);

            return {toString: () => joined, fsPath: joined};
        },
    },
    FileDecoration: class {
        badge?: string;
        tooltip?: string;
        color?: unknown;
        constructor(badge?: string, tooltip?: string, color?: unknown) {
            this.badge = badge;
            this.tooltip = tooltip;
            this.color = color;
        }
    },
    ThemeColor: class {
        id: string;
        constructor(id: string) {
            this.id = id;
        }
    },
    EventEmitter: class {
        private listeners: Array<(...args: unknown[]) => void> = [];
        event = (listener: (...args: unknown[]) => void) => {
            this.listeners.push(listener);
            return {dispose: () => {}};
        };
        fire(data: unknown) {
            this.listeners.forEach((l) => l(data));
        }
    },
    WorkspaceEdit: class {
        private edits: Array<{uri: unknown; edit: unknown}> = [];
        delete(uri: unknown, range: unknown) {
            this.edits.push({uri, edit: {type: 'delete', range}});
        }
        insert(uri: unknown, position: unknown, text: string) {
            this.edits.push({uri, edit: {type: 'insert', position, text}});
        }
    },
    window: {
        createOutputChannel: vi.fn().mockReturnValue({
            appendLine: vi.fn(),
        }),
        showQuickPick: vi.fn().mockResolvedValue(null),
        showInputBox: vi.fn().mockResolvedValue(null),
        showTextDocument: vi.fn().mockResolvedValue(undefined),
    },
    workspace: {
        fs: {
            stat: vi.fn().mockResolvedValue({}),
            readFile: vi.fn().mockResolvedValue(new Uint8Array()),
            writeFile: vi.fn().mockResolvedValue(undefined),
        },
        findFiles: vi.fn().mockResolvedValue([]),
        applyEdit: vi.fn().mockResolvedValue(true),
    },
}));
