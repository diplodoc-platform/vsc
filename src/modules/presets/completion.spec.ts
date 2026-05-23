import type * as vscode from 'vscode';
import type {VariableEntry} from './resolver';

import {beforeEach, describe, expect, it, vi} from 'vitest';

import {resolveVariables} from './resolver';
import {PresetsCompletionProvider} from './completion';

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

vi.mock('../utils', () => ({
    findYfmRoot: vi.fn().mockReturnValue('/project'),
}));

vi.mock('./resolver', () => ({
    resolveVariables: vi.fn(),
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
        map.set(name, [{preset: 'default', value, filePath: '/project/presets.yaml', line: 0}]);
    }

    return map;
}

describe('PresetsCompletionProvider', () => {
    const provider = new PresetsCompletionProvider();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when not inside {{ }}', () => {
        vi.mocked(resolveVariables).mockReturnValue(new Map());

        const doc = mockDocument('Hello world');
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 5,
        } as vscode.Position);

        expect(result).toBeNull();
    });

    it('returns null when no presets available', () => {
        vi.mocked(resolveVariables).mockReturnValue(new Map());

        const doc = mockDocument('{{');
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 2,
        } as vscode.Position);

        expect(result).toBeNull();
    });

    it('returns all variables when typing after {{', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello', user: 'Alice'}));

        const doc = mockDocument('{{');
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 2,
        } as vscode.Position);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(2);

        const labels = (result as vscode.CompletionItem[]).map((i) => i.label);
        expect(labels).toContain('text');
        expect(labels).toContain('user');
    });

    it('filters variables by partial input', () => {
        vi.mocked(resolveVariables).mockReturnValue(
            makeVariables({text: 'Hello', title: 'Title', user: 'Alice'}),
        );

        const doc = mockDocument('{{te');
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 4,
        } as vscode.Position) as vscode.CompletionItem[];

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('text');
    });

    it('appends }} when suffix not present', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello'}));

        const doc = mockDocument('{{');
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 2,
        } as vscode.Position) as vscode.CompletionItem[];

        expect(result[0].insertText).toBe('text}}');
    });

    it('does not append }} when suffix already present', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello'}));

        const doc = mockDocument('{{}}');
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 2,
        } as vscode.Position) as vscode.CompletionItem[];

        expect(result[0].insertText).toBe('text');
    });

    it('shows default preset value as detail', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello'}));

        const doc = mockDocument('{{');
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 2,
        } as vscode.Position) as vscode.CompletionItem[];

        expect(result[0].detail).toBe('Hello');
    });

    it('works with spaces inside braces', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({text: 'Hello'}));

        const doc = mockDocument('{{ ');
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 3,
        } as vscode.Position);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(1);
    });

    it('works in yaml context', () => {
        vi.mocked(resolveVariables).mockReturnValue(makeVariables({presets_text: 'Presets'}));

        const doc = mockDocument("name: '{{");
        const result = provider.provideCompletionItems(doc, {
            line: 0,
            character: 10,
        } as vscode.Position) as vscode.CompletionItem[];

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('presets_text');
    });
});
