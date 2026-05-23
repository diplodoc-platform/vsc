import type * as vscode from 'vscode';
import type {VariableEntry} from './resolver';

import {beforeEach, describe, expect, it, vi} from 'vitest';

import {getVariableAtPosition, resolveVariables} from './resolver';
import {PresetsHoverProvider} from './hover';

vi.mock('./resolver', () => ({
    getVariableAtPosition: vi.fn(),
    resolveVariables: vi.fn(),
}));

vi.mock('../utils', () => ({
    findYfmRoot: vi.fn().mockReturnValue('/project'),
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

function getHoverValue(hover: vscode.Hover): string {
    return (hover.contents as unknown as vscode.MarkdownString).value;
}

describe('PresetsHoverProvider', () => {
    const provider = new PresetsHoverProvider();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when cursor is not on a variable', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue(null);

        const doc = mockDocument('Hello world');
        const result = provider.provideHover(doc, {line: 0, character: 3} as vscode.Position);

        expect(result).toBeNull();
    });

    it('returns null when variable not found in presets', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({name: 'unknown', start: 2, end: 15});
        vi.mocked(resolveVariables).mockReturnValue(new Map());

        const doc = mockDocument('{{unknown}}');
        const result = provider.provideHover(doc, {line: 0, character: 5} as vscode.Position);

        expect(result).toBeNull();
    });

    it('returns hover with single preset value', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({name: 'user', start: 0, end: 8});

        const entries: VariableEntry[] = [
            {preset: 'default', value: 'Alice', filePath: '/project/presets.yaml', line: 2},
        ];
        vi.mocked(resolveVariables).mockReturnValue(new Map([['user', entries]]));

        const doc = mockDocument('{{user}}');
        const result = provider.provideHover(doc, {line: 0, character: 4} as vscode.Position);

        expect(result).not.toBeNull();

        const value = getHoverValue(result as vscode.Hover);
        expect(value).toContain('**user**');
        expect(value).toContain('default');
        expect(value).toContain('`Alice`');
    });

    it('returns hover with multiple preset values', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({
            name: 'presets_text',
            start: 9,
            end: 25,
        });

        const entries: VariableEntry[] = [
            {
                preset: 'default',
                value: 'Presets',
                filePath: '/project/presets.yaml',
                line: 1,
            },
            {
                preset: 'external',
                value: 'Presets external',
                filePath: '/project/presets.yaml',
                line: 4,
            },
        ];
        vi.mocked(resolveVariables).mockReturnValue(new Map([['presets_text', entries]]));

        const doc = mockDocument("name: '{{presets_text}}'");
        const result = provider.provideHover(doc, {line: 0, character: 15} as vscode.Position);

        expect(result).not.toBeNull();

        const value = getHoverValue(result as vscode.Hover);
        expect(value).toContain('**presets_text**');
        expect(value).toContain('default');
        expect(value).toContain('`Presets`');
        expect(value).toContain('external');
        expect(value).toContain('`Presets external`');
    });

    it('shows file paths when variables come from multiple files', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({name: 'text', start: 0, end: 8});

        const entries: VariableEntry[] = [
            {preset: 'default', value: 'Near', filePath: '/project/pages/presets.yaml', line: 1},
            {preset: 'default', value: 'Far', filePath: '/project/presets.yaml', line: 1},
        ];
        vi.mocked(resolveVariables).mockReturnValue(new Map([['text', entries]]));

        const doc = mockDocument('{{text}}');
        const result = provider.provideHover(doc, {line: 0, character: 4} as vscode.Position);

        expect(result).not.toBeNull();

        const value = getHoverValue(result as vscode.Hover);
        expect(value).toContain('pages/presets.yaml');
        expect(value).toContain('presets.yaml');
    });

    it('sets correct range on hover', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({name: 'text', start: 6, end: 14});
        vi.mocked(resolveVariables).mockReturnValue(
            new Map([
                ['text', [{preset: 'default', value: 'v', filePath: '/p/presets.yaml', line: 0}]],
            ]),
        );

        const doc = mockDocument('Hello {{text}} world');
        const result = provider.provideHover(doc, {line: 0, character: 9} as vscode.Position);

        expect(result).not.toBeNull();
        expect((result as vscode.Hover).range).toMatchObject({
            start: {line: 0, character: 6},
            end: {line: 0, character: 14},
        });
    });
});
