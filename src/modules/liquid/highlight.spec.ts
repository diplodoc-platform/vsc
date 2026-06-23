import type * as vscode from 'vscode';

import {beforeEach, describe, expect, it, vi} from 'vitest';

import {LiquidHighlightProvider} from './highlight';

vi.mock('vscode', () => {
    class Range {
        startLine: number;
        startChar: number;
        endLine: number;
        endChar: number;

        constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
            this.startLine = startLine;
            this.startChar = startChar;
            this.endLine = endLine;
            this.endChar = endChar;
        }
    }

    class DocumentHighlight {
        range: Range;
        kind: number;

        constructor(range: Range, kind: number) {
            this.range = range;
            this.kind = kind;
        }
    }

    return {
        DocumentHighlight,
        DocumentHighlightKind: {Read: 1},
        Range,
    };
});

function makeDocument(lines: string[]): vscode.TextDocument {
    return {
        lineCount: lines.length,
        lineAt: (i: number) => ({text: lines[i]}),
        uri: {fsPath: '/test.md'},
        getText: () => lines.join('\n'),
        fileName: '/test.md',
    } as unknown as vscode.TextDocument;
}

function makePosition(line: number, char: number): vscode.Position {
    return {line, character: char} as vscode.Position;
}

function getHighlights(
    provider: LiquidHighlightProvider,
    document: vscode.TextDocument,
    position: vscode.Position,
): vscode.DocumentHighlight[] {
    const result = provider.provideDocumentHighlights(document, position);

    expect(result).not.toBeNull();

    return result as vscode.DocumentHighlight[];
}

function getStartLines(highlights: vscode.DocumentHighlight[]): number[] {
    return highlights.map((highlight) => {
        return (highlight.range as unknown as {startLine: number}).startLine;
    });
}

describe('LiquidHighlightProvider', () => {
    let provider: LiquidHighlightProvider;

    beforeEach(() => {
        provider = new LiquidHighlightProvider();
    });

    it('returns null when cursor is not on a liquid tag', () => {
        const doc = makeDocument(['Hello world']);
        const result = provider.provideDocumentHighlights(doc, makePosition(0, 0));

        expect(result).toBeNull();
    });

    it('highlights {% if %} and {% endif %} as a pair', () => {
        const doc = makeDocument(["{% if x == 'a' %}", 'Content', '{% endif %}']);

        const result = getHighlights(provider, doc, makePosition(0, 4));

        expect(result).toHaveLength(2);
        expect((result[0].range as unknown as {startLine: number}).startLine).toBe(0);
        expect((result[1].range as unknown as {startLine: number}).startLine).toBe(2);
    });

    it('highlights {% if %}, {% else %}, and {% endif %}', () => {
        const doc = makeDocument(["{% if x == 'a' %}", 'A', '{% else %}', 'B', '{% endif %}']);

        const result = getHighlights(provider, doc, makePosition(0, 4));
        const lines = getStartLines(result);

        expect(result).toHaveLength(3);
        expect(lines).toEqual([0, 2, 4]);
    });

    it('highlights {% if %}, {% elsif %}, {% else %}, and {% endif %}', () => {
        const doc = makeDocument([
            "{% if x == 'a' %}",
            'A',
            "{% elsif x == 'b' %}",
            'B',
            '{% else %}',
            'C',
            '{% endif %}',
        ]);

        const result = getHighlights(provider, doc, makePosition(6, 4));

        expect(result).toHaveLength(4);
    });

    it('highlights {% for %} and {% endfor %}', () => {
        const doc = makeDocument(['{% for item in items %}', '{{ item }}', '{% endfor %}']);

        const result = getHighlights(provider, doc, makePosition(0, 4));
        const lines = getStartLines(result);

        expect(result).toHaveLength(2);
        expect(lines).toEqual([0, 2]);
    });

    it('returns null for single unpaired tag', () => {
        const doc = makeDocument(['{% else %}']);
        const result = provider.provideDocumentHighlights(doc, makePosition(0, 4));

        expect(result).toBeNull();
    });

    it('handles nested {% if %} blocks correctly', () => {
        const doc = makeDocument([
            '{% if outer %}',
            '{% if inner %}',
            'Content',
            '{% endif %}',
            '{% endif %}',
        ]);

        const outerResult = getHighlights(provider, doc, makePosition(0, 4));
        const lines = getStartLines(outerResult);

        expect(outerResult).toHaveLength(2);
        expect(lines).toEqual([0, 4]);
    });
});
