import type * as vscode from 'vscode';

import {describe, expect, it} from 'vitest';

import {YamlColorProvider} from './index';

function mockDocument(text: string): vscode.TextDocument {
    const lines = text.split('\n');

    return {
        lineCount: lines.length,
        lineAt: (line: number) => ({text: lines[line] ?? ''}),
        getText: (range?: vscode.Range) => {
            if (!range) {
                return text;
            }
            const line = lines[range.start.line] ?? '';

            return line.substring(range.start.character, range.end.character);
        },
    } as unknown as vscode.TextDocument;
}

function approx(actual: number, expected: number, tolerance = 0.01): boolean {
    return Math.abs(actual - expected) < tolerance;
}

describe('YamlColorProvider', () => {
    const provider = new YamlColorProvider();

    describe('provideDocumentColors', () => {
        it('returns color information for YAML with hex colors', () => {
            const doc = mockDocument("color: '#ff0000'");
            const colors = provider.provideDocumentColors(doc);

            expect(colors).toHaveLength(1);
            expect(approx(colors[0].color.red, 1)).toBe(true);
            expect(approx(colors[0].color.green, 0)).toBe(true);
            expect(approx(colors[0].color.blue, 0)).toBe(true);
        });

        it('returns multiple color informations', () => {
            const doc = mockDocument(["primary: '#ff0000'", "secondary: '#00ff00'"].join('\n'));
            const colors = provider.provideDocumentColors(doc);

            expect(colors).toHaveLength(2);
            expect(approx(colors[0].color.red, 1)).toBe(true);
            expect(approx(colors[1].color.green, 1)).toBe(true);
        });

        it('returns empty array for document without colors', () => {
            const doc = mockDocument('title: Hello\ndescription: World');
            const colors = provider.provideDocumentColors(doc);

            expect(colors).toHaveLength(0);
        });

        it('returns empty array for empty document', () => {
            const doc = mockDocument('');
            const colors = provider.provideDocumentColors(doc);

            expect(colors).toHaveLength(0);
        });
    });

    describe('provideColorPresentations', () => {
        it('returns hex and rgb presentations', () => {
            const color = {red: 1, green: 0, blue: 0, alpha: 1} as vscode.Color;
            const doc = mockDocument("color: '#ff0000'");
            const range = {
                start: {line: 0, character: 7},
                end: {line: 0, character: 16},
            } as vscode.Range;

            const presentations = provider.provideColorPresentations(color, {
                document: doc,
                range,
            });

            expect(presentations).toHaveLength(2);
            expect(presentations[0].label).toBe("'#ff0000'");
            expect(presentations[1].label).toBe("'rgb(255, 0, 0)'");
        });

        it('preserves double-quote style', () => {
            const color = {red: 0, green: 0, blue: 1, alpha: 1} as vscode.Color;
            const doc = mockDocument('color: "#0000ff"');
            const range = {
                start: {line: 0, character: 7},
                end: {line: 0, character: 16},
            } as vscode.Range;

            const presentations = provider.provideColorPresentations(color, {
                document: doc,
                range,
            });

            expect(presentations[0].label).toBe('"#0000ff"');
            expect(presentations[1].label).toBe('"rgb(0, 0, 255)"');
        });

        it('uses single quotes for unquoted values', () => {
            const color = {red: 1, green: 1, blue: 1, alpha: 1} as vscode.Color;
            const doc = mockDocument('color: #ffffff');
            const range = {
                start: {line: 0, character: 7},
                end: {line: 0, character: 14},
            } as vscode.Range;

            const presentations = provider.provideColorPresentations(color, {
                document: doc,
                range,
            });

            expect(presentations[0].label).toBe("'#ffffff'");
            expect(presentations[1].label).toBe("'rgb(255, 255, 255)'");
        });
    });
});
