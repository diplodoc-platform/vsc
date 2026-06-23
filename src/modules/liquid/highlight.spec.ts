import * as vscode from 'vscode';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {LiquidHighlightProvider} from './highlight';

vi.mock('vscode', () => {
    class Range {
        constructor(
            public startLine: number,
            public startChar: number,
            public endLine: number,
            public endChar: number,
        ) {}
    }

    class DocumentHighlight {
        constructor(
            public range: Range,
            public kind: number,
        ) {}
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

        const result = provider.provideDocumentHighlights(doc, makePosition(0, 4));

        expect(result).not.toBeNull();
        expect(result).toHaveLength(2);
        expect((result![0].range as unknown as {startLine: number}).startLine).toBe(0);
        expect((result![1].range as unknown as {startLine: number}).startLine).toBe(2);
    });

    it('highlights {% if %}, {% else %}, and {% endif %}', () => {
        const doc = makeDocument(["{% if x == 'a' %}", 'A', '{% else %}', 'B', '{% endif %}']);

        const result = provider.provideDocumentHighlights(doc, makePosition(0, 4));

        expect(result).toHaveLength(3);
        const lines = result!.map((h) => (h.range as unknown as {startLine: number}).startLine);

        expect(lines).toEqual([0, 2, 4]);
    });

    it('highlights {% if %}, {% elsif %}, {% else %}, {% endif %}', () => {
        const doc = makeDocument([
            "{% if x == 'a' %}",
            'A',
            "{% elsif x == 'b' %}",
            'B',
            '{% else %}',
            'C',
            '{% endif %}',
        ]);

        const result = provider.provideDocumentHighlights(doc, makePosition(6, 4));

        expect(result).toHaveLength(4);
    });

    it('highlights {% for %} and {% endfor %}', () => {
        const doc = makeDocument(['{% for item in items %}', '{{ item }}', '{% endfor %}']);

        const result = provider.provideDocumentHighlights(doc, makePosition(0, 4));

        expect(result).toHaveLength(2);
        const lines = result!.map((h) => (h.range as unknown as {startLine: number}).startLine);

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

        const outerResult = provider.provideDocumentHighlights(doc, makePosition(0, 4));

        expect(outerResult).toHaveLength(2);
        const lines = outerResult!.map(
            (h) => (h.range as unknown as {startLine: number}).startLine,
        );

        expect(lines).toEqual([0, 4]);
    });
});
