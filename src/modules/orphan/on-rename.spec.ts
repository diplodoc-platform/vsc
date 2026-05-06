import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

vi.mock('../utils', () => ({
    findYfmRoot: (fsPath: string) => (fsPath.startsWith('/docs/') ? '/docs' : null),
}));

import {handleFileRenamed, renameTocEntry} from './on-rename';

const findFilesMock = vi.mocked(vscode.workspace.findFiles);
const readFileMock = vi.mocked(vscode.workspace.fs.readFile);
const applyEditMock = vi.mocked(vscode.workspace.applyEdit);

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

function mockFindFiles(tocFiles: string[], mdFiles: string[]) {
    findFilesMock.mockImplementation(async (pattern: string) => {
        if (typeof pattern === 'string' && pattern.includes('*.md')) {
            return mdFiles.map(makeUri);
        }

        return tocFiles.map(makeUri);
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
        const edit = applyEditMock.mock.calls[0][0] as any;
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
        const edit = applyEditMock.mock.calls[0][0] as any;
        const replacement = edit.edits[0].edit;

        expect(replacement.newText).toBe('  - href: new.md');
    });
});

describe('handleFileRenamed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findFilesMock.mockResolvedValue([]);
    });

    it('does nothing when file is not in toc and not linked in md', async () => {
        mockFindFiles(['/docs/toc.yaml'], ['/docs/other.md']);
        mockFiles({
            '/docs/toc.yaml': '  href: other.md',
            '/docs/other.md': 'no links here',
        });

        await handleFileRenamed(makeUri('/docs/old.md'), makeUri('/docs/new.md'));

        expect(vi.mocked(vscode.window.showQuickPick)).not.toHaveBeenCalled();
    });

    it('shows QuickPick when file is in toc', async () => {
        mockFindFiles(['/docs/toc.yaml'], []);
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

    it('shows QuickPick when file is only linked in markdown', async () => {
        mockFindFiles([], ['/docs/guide.md']);
        mockFiles({
            '/docs/guide.md': 'See [About](old.md) for details.',
        });

        vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

        await handleFileRenamed(makeUri('/docs/old.md'), makeUri('/docs/new.md'));

        expect(vi.mocked(vscode.window.showQuickPick)).toHaveBeenCalledOnce();
        const options = vi.mocked(vscode.window.showQuickPick).mock.calls[0][0] as Array<{
            label: string;
            id: string;
        }>;
        // No redirect option when only md refs
        expect(options.map((o) => o.id)).toEqual(['rename', 'nothing']);
    });

    it('updates markdown links when rename is chosen', async () => {
        mockFindFiles([], ['/docs/guide.md']);
        mockFiles({
            '/docs/guide.md': 'See [About](old.md) for details.',
        });

        vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
            label: 'Rename in markdown files',
            id: 'rename',
        });

        await handleFileRenamed(makeUri('/docs/old.md'), makeUri('/docs/new.md'));

        expect(applyEditMock).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const edit = applyEditMock.mock.calls[0][0] as any;

        expect(edit.edits[0].edit.newText).toBe('new.md');
    });

    it('shows combined label when both toc and md refs exist', async () => {
        mockFindFiles(['/docs/toc.yaml'], ['/docs/guide.md']);
        mockFiles({
            '/docs/toc.yaml': '  - name: Page\n    href: old.md',
            '/docs/guide.md': 'See [link](old.md)',
        });

        vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

        await handleFileRenamed(makeUri('/docs/old.md'), makeUri('/docs/new.md'));

        const options = vi.mocked(vscode.window.showQuickPick).mock.calls[0][0] as Array<{
            label: string;
            id: string;
        }>;
        expect(options[0].label).toBe('Rename in toc.yaml and markdown files');
    });
});
