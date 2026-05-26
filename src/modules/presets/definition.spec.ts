import type * as vscode from 'vscode';
import type {VariableEntry} from './resolver';

import {readFileSync} from 'fs';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {findVariableLine, getVariableAtPosition, resolveVariables} from './resolver';
import {PresetsDefinitionProvider} from './definition';

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

vi.mock('../utils', () => ({
    findYfmRoot: vi.fn().mockReturnValue('/project'),
}));

vi.mock('./resolver', () => ({
    getVariableAtPosition: vi.fn(),
    resolveVariables: vi.fn(),
    findVariableLine: vi.fn(),
    findPresetsFiles: vi.fn().mockReturnValue([]),
    parsePresetsFile: vi.fn().mockReturnValue(null),
}));

function mockDocument(text: string, fsPath = '/project/page.md'): vscode.TextDocument {
    const lines = text.split('\n');
    const fileName = fsPath.split('/').pop() ?? '';

    return {
        lineCount: lines.length,
        lineAt: (line: number) => ({text: lines[line] ?? ''}),
        getText: () => text,
        uri: {fsPath},
        fileName,
    } as unknown as vscode.TextDocument;
}

describe('PresetsDefinitionProvider', () => {
    const provider = new PresetsDefinitionProvider();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when cursor is not on a variable', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue(null);

        const doc = mockDocument('Hello world');
        const result = provider.provideDefinition(doc, {line: 0, character: 3} as vscode.Position);

        expect(result).toBeNull();
    });

    it('returns null when variable not found in presets', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({name: 'unknown', start: 0, end: 13});
        vi.mocked(resolveVariables).mockReturnValue(new Map());

        const doc = mockDocument('{{unknown}}');
        const result = provider.provideDefinition(doc, {line: 0, character: 5} as vscode.Position);

        expect(result).toBeNull();
    });

    it('returns location pointing to correct line', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({name: 'text', start: 0, end: 8});

        const entries: VariableEntry[] = [
            {preset: 'default', value: 'Hello', filePath: '/project/presets.yaml', line: 1},
        ];
        vi.mocked(resolveVariables).mockReturnValue(new Map([['text', entries]]));
        vi.mocked(readFileSync).mockReturnValue('default:\n  text: Hello');
        vi.mocked(findVariableLine).mockReturnValue(1);

        const doc = mockDocument('{{text}}');
        const result = provider.provideDefinition(doc, {
            line: 0,
            character: 4,
        } as vscode.Position) as vscode.Location[];

        expect(result).toHaveLength(1);
        expect(result[0].uri).toMatchObject({fsPath: '/project/presets.yaml'});
        expect(result[0].range.start.line).toBe(1);
    });

    it('returns locations from multiple files', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({name: 'text', start: 0, end: 8});

        const entries: VariableEntry[] = [
            {preset: 'default', value: 'Near', filePath: '/project/pages/presets.yaml', line: 1},
            {preset: 'external', value: 'Ext', filePath: '/project/pages/presets.yaml', line: 3},
            {preset: 'default', value: 'Far', filePath: '/project/presets.yaml', line: 1},
        ];
        vi.mocked(resolveVariables).mockReturnValue(new Map([['text', entries]]));
        vi.mocked(readFileSync).mockReturnValue('default:\n  text: val');
        vi.mocked(findVariableLine).mockReturnValue(1);

        const doc = mockDocument('{{text}}');
        const result = provider.provideDefinition(doc, {
            line: 0,
            character: 4,
        } as vscode.Position) as vscode.Location[];

        expect(result).toHaveLength(2);
        expect(result[0].uri).toMatchObject({fsPath: '/project/pages/presets.yaml'});
        expect(result[1].uri).toMatchObject({fsPath: '/project/presets.yaml'});
    });

    it('skips files that fail to read', () => {
        vi.mocked(getVariableAtPosition).mockReturnValue({name: 'text', start: 0, end: 8});

        const entries: VariableEntry[] = [
            {preset: 'default', value: 'v', filePath: '/project/missing/presets.yaml', line: 1},
            {preset: 'default', value: 'v', filePath: '/project/presets.yaml', line: 1},
        ];
        vi.mocked(resolveVariables).mockReturnValue(new Map([['text', entries]]));
        vi.mocked(readFileSync).mockImplementation((p) => {
            if (String(p).includes('missing')) {
                throw new Error('ENOENT');
            }
            return 'default:\n  text: v';
        });
        vi.mocked(findVariableLine).mockReturnValue(1);

        const doc = mockDocument('{{text}}');
        const result = provider.provideDefinition(doc, {
            line: 0,
            character: 4,
        } as vscode.Position) as vscode.Location[];

        expect(result).toHaveLength(1);
        expect(result[0].uri).toMatchObject({fsPath: '/project/presets.yaml'});
    });

    it('navigates from external preset key to default in same presets.yaml', () => {
        const presetsContent = 'default:\n  text: Hello\nexternal:\n  text: World';
        const doc = mockDocument(presetsContent, '/project/presets.yaml');

        vi.mocked(findVariableLine).mockReturnValue(1);

        const result = provider.provideDefinition(doc, {
            line: 3,
            character: 3,
        } as vscode.Position) as vscode.Location[];

        expect(result).toHaveLength(1);
        expect(result[0].range.start.line).toBe(1);
    });

    it('returns null for default preset keys in presets.yaml', () => {
        const presetsContent = 'default:\n  text: Hello';
        const doc = mockDocument(presetsContent, '/project/presets.yaml');

        vi.mocked(findVariableLine).mockReturnValue(0);

        const result = provider.provideDefinition(doc, {
            line: 1,
            character: 3,
        } as vscode.Position);

        expect(result).toBeNull();
    });

    it('returns null for non-key positions in presets.yaml', () => {
        const presetsContent = 'default:\n  text: Hello';
        const doc = mockDocument(presetsContent, '/project/presets.yaml');

        const result = provider.provideDefinition(doc, {
            line: 1,
            character: 10,
        } as vscode.Position);

        expect(result).toBeNull();
    });
});
