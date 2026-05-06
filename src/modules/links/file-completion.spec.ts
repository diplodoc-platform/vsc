import type * as vscode from 'vscode';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscodeModule from 'vscode';

import {FilePathCompletionProvider} from './file-completion';

const readDirMock = vi.mocked(vscodeModule.workspace.fs.readDirectory);

function mockDocument(text: string, languageId = 'yaml'): vscode.TextDocument {
    const lines = text.split('\n');

    return {
        languageId,
        uri: {toString: () => '/workspace/docs/toc.yaml', fsPath: '/workspace/docs/toc.yaml'},
        lineCount: lines.length,
        lineAt: (i: number) => ({text: lines[i] ?? '', lineNumber: i}),
        getText: () => text,
    } as unknown as vscode.TextDocument;
}

function pos(line: number, character: number): vscode.Position {
    return new vscodeModule.Position(line, character);
}

async function getItems(
    provider: FilePathCompletionProvider,
    doc: vscode.TextDocument,
    position: vscode.Position,
): Promise<vscode.CompletionItem[]> {
    const result = await provider.provideCompletionItems(doc, position);

    expect(result).toBeDefined();

    return result as vscode.CompletionItem[];
}

describe('FilePathCompletionProvider', () => {
    const provider = new FilePathCompletionProvider();

    beforeEach(() => {
        vi.clearAllMocks();
        readDirMock.mockResolvedValue([]);
    });

    it('provides completions for href field', async () => {
        readDirMock.mockResolvedValue([
            ['page.md', vscodeModule.FileType.File],
            ['guide', vscodeModule.FileType.Directory],
        ]);

        const doc = mockDocument('  href: ');
        const items = await getItems(provider, doc, pos(0, 8));

        expect(items).toHaveLength(2);
        expect(items[0].label).toBe('guide');
        expect(items[0].insertText).toBe('guide/');
        expect(items[1].label).toBe('page.md');
        expect(items[1].insertText).toBe('page.md');
    });

    it('provides completions for style list items', async () => {
        readDirMock.mockResolvedValue([['custom.css', vscodeModule.FileType.File]]);

        const doc = mockDocument('resources:\n  style:\n    - ');
        const items = await getItems(provider, doc, pos(2, 6));

        expect(items).toHaveLength(1);
        expect(items[0].label).toBe('custom.css');
    });

    it('filters by partial input', async () => {
        readDirMock.mockResolvedValue([
            ['page.md', vscodeModule.FileType.File],
            ['presets.yaml', vscodeModule.FileType.File],
        ]);

        const doc = mockDocument('  href: pa');
        const items = await getItems(provider, doc, pos(0, 10));

        expect(items).toHaveLength(1);
        expect(items[0].label).toBe('page.md');
    });

    it('skips hidden files', async () => {
        readDirMock.mockResolvedValue([
            ['.git', vscodeModule.FileType.Directory],
            ['page.md', vscodeModule.FileType.File],
        ]);

        const doc = mockDocument('  href: ');
        const items = await getItems(provider, doc, pos(0, 8));

        expect(items).toHaveLength(1);
        expect(items[0].label).toBe('page.md');
    });

    it('skips node_modules', async () => {
        readDirMock.mockResolvedValue([
            ['node_modules', vscodeModule.FileType.Directory],
            ['docs', vscodeModule.FileType.Directory],
        ]);

        const doc = mockDocument('  href: ');
        const items = await getItems(provider, doc, pos(0, 8));

        expect(items).toHaveLength(1);
        expect(items[0].label).toBe('docs');
    });

    it('returns undefined for non-yaml documents', async () => {
        const doc = mockDocument('  href: ', 'markdown');
        const items = await provider.provideCompletionItems(doc, pos(0, 8));

        expect(items).toBeUndefined();
    });

    it('returns undefined for non-link fields', async () => {
        const doc = mockDocument('  name: ');
        const items = await provider.provideCompletionItems(doc, pos(0, 8));

        expect(items).toBeUndefined();
    });

    it('returns undefined when value starts with http', async () => {
        const doc = mockDocument('  href: https://');
        const items = await provider.provideCompletionItems(doc, pos(0, 16));

        expect(items).toBeUndefined();
    });

    it('triggers re-suggest for directory completions', async () => {
        readDirMock.mockResolvedValue([['subdir', vscodeModule.FileType.Directory]]);

        const doc = mockDocument('  href: ');
        const items = await getItems(provider, doc, pos(0, 8));

        expect(items[0].command).toBeDefined();
        expect(items[0].command?.command).toBe('editor.action.triggerSuggest');
    });

    it('sorts directories before files', async () => {
        readDirMock.mockResolvedValue([
            ['zebra.md', vscodeModule.FileType.File],
            ['alpha', vscodeModule.FileType.Directory],
        ]);

        const doc = mockDocument('  href: ');
        const items = await getItems(provider, doc, pos(0, 8));

        expect(items[0].label).toBe('alpha');
        expect(items[1].label).toBe('zebra.md');
    });

    it('handles readDirectory errors gracefully', async () => {
        readDirMock.mockRejectedValue(new Error('not found'));

        const doc = mockDocument('  href: nonexistent/');
        const items = await getItems(provider, doc, pos(0, 20));

        expect(items).toHaveLength(0);
    });

    it('works with src field', async () => {
        readDirMock.mockResolvedValue([['image.png', vscodeModule.FileType.File]]);

        const doc = mockDocument('  src: ');
        const items = await getItems(provider, doc, pos(0, 7));

        expect(items).toHaveLength(1);
    });

    it('preserves directory part in insertText', async () => {
        readDirMock.mockResolvedValue([['custom.css', vscodeModule.FileType.File]]);

        const doc = mockDocument('  style: _assets/');
        const items = await getItems(provider, doc, pos(0, 17));

        expect(items[0].insertText).toBe('_assets/custom.css');
    });
});
