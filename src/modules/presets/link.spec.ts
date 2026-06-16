import type * as vscode from 'vscode';
import type {VariableEntry} from './resolver';

import {readFileSync} from 'fs';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {findVariableLine, resolveVariables} from './resolver';
import {PresetsLinkProvider} from './link';

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

vi.mock('../utils', () => ({
    findYfmRoot: vi.fn().mockReturnValue('/project'),
}));

vi.mock('./resolver', () => ({
    VARIABLE_RE: /\{\{\s*([\w.-]+)\s*\}\}/g,
    resolveVariables: vi.fn(),
    findPresetsFiles: vi.fn(),
    findVariableLine: vi.fn(),
}));

function mockDocument(text: string, fsPath = '/project/page.md'): vscode.TextDocument {
    const lines = text.split('\n');

    return {
        lineCount: lines.length,
        lineAt: (line: number) => ({text: lines[line] ?? ''}),
        getText: () => text,
        uri: {fsPath},
    } as unknown as vscode.TextDocument;
}

function makeVariables(vars: Record<string, string>): Map<string, VariableEntry[]> {
    const map = new Map<string, VariableEntry[]>();

    for (const [name, value] of Object.entries(vars)) {
        map.set(name, [{preset: 'default', value, filePath: '/project/presets.yaml', line: 1}]);
    }

    return map;
}

describe('PresetsLinkProvider', () => {
    const provider = new PresetsLinkProvider();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(readFileSync).mockReturnValue('default:\n  text: Hello');
        vi.mocked(findVariableLine).mockReturnValue(1);
    });

    it('returns empty array when no presets available', () => {
        vi.mocked(resolveVariables).mockReturnValue(new Map());

        const doc = mockDocument('{{text}}');
        const links = provider.provideDocumentLinks(doc);

        expect(links).toEqual([]);
    });

    it('creates link for existing variable', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello'}));

        const doc = mockDocument('{{text}}');
        const links = provider.provideDocumentLinks(doc);

        expect(links).toHaveLength(1);
        expect(links[0].range).toMatchObject({
            start: {line: 0, character: 0},
            end: {line: 0, character: 8},
        });
    });

    it('creates link for variable with dash in name', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({'presets-num': '42'}));

        const doc = mockDocument('{{presets-num}}');
        const links = provider.provideDocumentLinks(doc);

        expect(links).toHaveLength(1);
        expect(links[0].range).toMatchObject({
            start: {line: 0, character: 0},
            end: {line: 0, character: 15},
        });
    });

    it('does not create link for unknown variable', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello'}));

        const doc = mockDocument('{{unknown}}');
        const links = provider.provideDocumentLinks(doc);

        expect(links).toEqual([]);
    });

    it('creates links for multiple variables on same line', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({a: '1', b: '2'}));

        const doc = mockDocument('{{a}} and {{b}}');
        const links = provider.provideDocumentLinks(doc);

        expect(links).toHaveLength(2);
    });

    it('creates links across multiple lines', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello'}));

        const doc = mockDocument('line1\n{{text}}\nline3\n{{text}}');
        const links = provider.provideDocumentLinks(doc);

        expect(links).toHaveLength(2);
        expect(links[0].range.start.line).toBe(1);
        expect(links[1].range.start.line).toBe(3);
    });

    it('sets command URI as target', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello'}));

        const doc = mockDocument('{{text}}');
        const links = provider.provideDocumentLinks(doc);
        const target = links[0].target;

        expect(target).toBeDefined();
        expect(String(target)).toContain('command:diplodoc.goToPreset');
    });

    it('works in yaml context', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({presets_text: 'Presets'}));

        const doc = mockDocument("name: '{{presets_text}}'");
        const links = provider.provideDocumentLinks(doc);

        expect(links).toHaveLength(1);
        expect(links[0].range).toMatchObject({
            start: {line: 0, character: 7},
            end: {line: 0, character: 23},
        });
    });
});
