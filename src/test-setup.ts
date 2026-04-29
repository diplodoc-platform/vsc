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

vi.mock('vscode', () => ({
    Range: MockRange,
    Position: MockPosition,
    Color: MockColor,
    Diagnostic: MockDiagnostic,
    MarkdownString: MockMarkdownString,
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
    },
    Uri: {
        parse: (s: string) => ({toString: () => s}),
        file: (s: string) => ({toString: () => s, fsPath: s}),
    },
}));
