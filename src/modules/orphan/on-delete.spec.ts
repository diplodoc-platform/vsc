import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

vi.mock('../utils', () => ({
    findYfmRoot: (fsPath: string) => (fsPath.startsWith('/docs/') ? '/docs' : null),
}));

import {addRedirect, findTocReferences, handleFileDeleted, removeTocEntry} from './on-delete';

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

describe('findTocReferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findFilesMock.mockResolvedValue([]);
    });

    it('finds references to a deleted file in toc.yaml', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  - name: Page\n    href: guide/intro.md',
        });

        const refs = await findTocReferences(makeUri('/docs/guide/intro.md'));

        expect(refs).toHaveLength(1);
        expect(refs[0].hrefValue).toBe('guide/intro.md');
        expect(refs[0].lineIndex).toBe(1);
    });

    it('returns empty array when file not in any toc', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  - name: Page\n    href: other.md',
        });

        const refs = await findTocReferences(makeUri('/docs/missing.md'));

        expect(refs).toHaveLength(0);
    });

    it('finds references in multiple toc files', async () => {
        findFilesMock.mockResolvedValue([
            makeUri('/docs/toc.yaml'),
            makeUri('/docs/other/toc.yaml'),
        ]);
        mockFiles({
            '/docs/toc.yaml': '  href: page.md',
            '/docs/other/toc.yaml': '  href: page.md',
        });

        const refs = await findTocReferences(makeUri('/docs/page.md'));

        expect(refs.length).toBeGreaterThanOrEqual(1);
        expect(refs[0].hrefValue).toBe('page.md');
    });

    it('skips external URLs', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: https://example.com',
        });

        const refs = await findTocReferences(makeUri('/docs/https://example.com'));

        expect(refs).toHaveLength(0);
    });
});

describe('removeTocEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removes href line from toc', async () => {
        mockFiles({
            '/docs/toc.yaml':
                '  - name: Page1\n    href: page1.md\n  - name: Page2\n    href: page2.md',
        });

        await removeTocEntry(makeUri('/docs/toc.yaml'), 1);

        const editCall = vi.mocked(vscode.workspace.applyEdit).mock.calls[0];

        expect(editCall).toBeDefined();
    });

    it('removes preceding name line when present', async () => {
        mockFiles({
            '/docs/toc.yaml':
                '  - name: Page1\n    href: page1.md\n  - name: Page2\n    href: page2.md',
        });

        await removeTocEntry(makeUri('/docs/toc.yaml'), 1);

        const editCall = vi.mocked(vscode.workspace.applyEdit).mock.calls[0];

        expect(editCall).toBeDefined();
    });

    it('removes only href when entry has nested items', async () => {
        const toc = [
            '  - name: Level 1',
            '    href: a.md',
            '    items:',
            '      - name: Page 1',
            '        href: page1.md',
        ].join('\n');

        mockFiles({'/docs/toc.yaml': toc});

        await removeTocEntry(makeUri('/docs/toc.yaml'), 1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0][0] as any;
        const range = edit.edits[0].edit.range;

        // Should delete only line 1 (href), not line 0 (name)
        expect(range.start.line).toBe(1);
        expect(range.end.line).toBe(2);
    });

    it('removes name+href when entry has no nested items', async () => {
        const toc = [
            '  - name: Leaf',
            '    href: leaf.md',
            '  - name: Other',
            '    href: other.md',
        ].join('\n');

        mockFiles({'/docs/toc.yaml': toc});

        await removeTocEntry(makeUri('/docs/toc.yaml'), 1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0][0] as any;
        const range = edit.edits[0].edit.range;

        expect(range.start.line).toBe(0);
        expect(range.end.line).toBe(2);
    });
});

describe('addRedirect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('appends redirect to existing redirects.yaml', async () => {
        mockFiles({
            '/docs/redirects.yaml': 'common:\n  - from: /old\n    to: /new\n',
        });

        await addRedirect(makeUri('/docs/redirects.yaml'), '/deleted', '/target');

        const editCall = vi.mocked(vscode.workspace.applyEdit).mock.calls[0];

        expect(editCall).toBeDefined();
    });

    it('creates redirects.yaml when it does not exist', async () => {
        readFileMock.mockRejectedValue(new Error('not found'));

        await addRedirect(makeUri('/docs/redirects.yaml'), '/deleted', '/target');

        const writeCall = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0];

        expect(writeCall).toBeDefined();
    });
});

describe('handleFileDeleted', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findFilesMock.mockResolvedValue([]);
    });

    it('does nothing when file is not in toc', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: other.md',
        });

        await handleFileDeleted(makeUri('/docs/deleted.md'));

        expect(vi.mocked(vscode.window.showQuickPick)).not.toHaveBeenCalled();
    });
});
