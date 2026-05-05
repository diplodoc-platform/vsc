import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

vi.mock('../utils', () => ({
    findYfmRoot: (fsPath: string) => (fsPath.startsWith('/docs/') ? '/docs' : null),
}));

import {handleFileRenamed, renameTocEntry} from './on-rename';

const findFilesMock = vi.mocked(vscode.workspace.findFiles);
const readFileMock = vi.mocked(vscode.workspace.fs.readFile);

function textToBytes(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

function makeUri(path: string) {
    return {fsPath: path, toString: () => path} as vscode.Uri;
}

function mockFiles(files: Record<string, string>) {
    readFileMock.mockImplementation(async (uri) => {
        const path = (uri as unknown as {fsPath: string}).fsPath;
        const text = files[path];

        if (text === undefined) {
            throw new Error(`File not found: ${path}`);
        }

        return textToBytes(text);
    });
}

describe('renameTocEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('replaces href value in toc line', async () => {
        mockFiles({
            '/docs/toc.yaml': '  - name: Page\n    href: old.md',
        });

        await renameTocEntry(makeUri('/docs/toc.yaml'), 1, 'new.md');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0][0] as any;
        const replacement = edit.edits[0].edit;

        expect(replacement.newText).toBe('    href: new.md');
        expect(replacement.range.start.line).toBe(1);
    });

    it('preserves list item format', async () => {
        mockFiles({
            '/docs/toc.yaml': '  - href: old.md',
        });

        await renameTocEntry(makeUri('/docs/toc.yaml'), 0, 'new.md');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0][0] as any;
        const replacement = edit.edits[0].edit;

        expect(replacement.newText).toBe('  - href: new.md');
    });
});

describe('handleFileRenamed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findFilesMock.mockResolvedValue([]);
    });

    it('does nothing when file is not in toc', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: other.md',
        });

        await handleFileRenamed(makeUri('/docs/old.md'), makeUri('/docs/new.md'));

        expect(vi.mocked(vscode.window.showQuickPick)).not.toHaveBeenCalled();
    });

    it('shows QuickPick when file is in toc', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  - name: Page\n    href: old.md',
        });

        vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

        await handleFileRenamed(makeUri('/docs/old.md'), makeUri('/docs/new.md'));

        expect(vi.mocked(vscode.window.showQuickPick)).toHaveBeenCalledOnce();
        const options = vi.mocked(vscode.window.showQuickPick).mock.calls[0][0] as Array<{
            label: string;
            id: string;
        }>;
        expect(options.map((o) => o.id)).toEqual(['rename', 'redirect', 'nothing']);
    });

    it('does nothing when file is outside yfm root', async () => {
        await handleFileRenamed(makeUri('/other/old.md'), makeUri('/other/new.md'));

        expect(vi.mocked(vscode.window.showQuickPick)).not.toHaveBeenCalled();
    });
});
