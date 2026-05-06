import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {computeNewMdHref, findMarkdownReferences} from './md-links';

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

describe('findMarkdownReferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findFilesMock.mockResolvedValue([]);
    });

    it('finds standard markdown links', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/guide.md')]);
        mockFiles({
            '/docs/guide.md': 'See [About](about.md) for details.',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/about.md'));

        expect(refs).toHaveLength(1);
        expect(refs[0].filePath).toBe('about.md');
        expect(refs[0].fragment).toBe('');
        expect(refs[0].lineIndex).toBe(0);
        expect(refs[0].hrefStart).toBe(12);
    });

    it('finds links with anchors and preserves fragment', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/guide.md')]);
        mockFiles({
            '/docs/guide.md': 'See [Settings](settings.md#yfmlint) for lint config.',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/settings.md'));

        expect(refs).toHaveLength(1);
        expect(refs[0].filePath).toBe('settings.md');
        expect(refs[0].fragment).toBe('#yfmlint');
        expect(refs[0].href).toBe('settings.md#yfmlint');
    });

    it('finds relative path links with dot-slash', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': 'Back to [index](./index.md)',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/index.md'));

        expect(refs).toHaveLength(1);
        expect(refs[0].filePath).toBe('./index.md');
    });

    it('finds image references', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': '![Screenshot](images/screen.png)',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/images/screen.png'));

        expect(refs).toHaveLength(1);
        expect(refs[0].filePath).toBe('images/screen.png');
    });

    it('finds include directives', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': '{% include [snippet](includes/snippet.md) %}',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/includes/snippet.md'));

        expect(refs).toHaveLength(1);
        expect(refs[0].filePath).toBe('includes/snippet.md');
    });

    it('finds multiple references in one file', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/index.md')]);
        mockFiles({
            '/docs/index.md': '[First](about.md) and [Second](about.md#section) link to about.',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/about.md'));

        expect(refs).toHaveLength(2);
        expect(refs[0].fragment).toBe('');
        expect(refs[1].fragment).toBe('#section');
    });

    it('finds references across multiple files', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page1.md'), makeUri('/docs/page2.md')]);
        mockFiles({
            '/docs/page1.md': '[Link](target.md)',
            '/docs/page2.md': '[Link](target.md)',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/target.md'));

        expect(refs).toHaveLength(2);
    });

    it('skips external URLs', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': '[External](https://example.com)',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/https://example.com'));

        expect(refs).toHaveLength(0);
    });

    it('skips anchor-only links', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': '[Jump](#section)',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/page.md'));

        expect(refs).toHaveLength(0);
    });

    it('skips links inside fenced code blocks', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': '```\n[Link](target.md)\n```',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/target.md'));

        expect(refs).toHaveLength(0);
    });

    it('finds links after code block ends', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': '```\ncode\n```\n[Link](target.md)',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/target.md'));

        expect(refs).toHaveLength(1);
        expect(refs[0].lineIndex).toBe(3);
    });

    it('returns empty when no files match', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': '[Link](other.md)',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/target.md'));

        expect(refs).toHaveLength(0);
    });

    it('returns empty when no md files in workspace', async () => {
        findFilesMock.mockResolvedValue([]);

        const refs = await findMarkdownReferences(makeUri('/docs/target.md'));

        expect(refs).toHaveLength(0);
    });

    it('handles unreadable files gracefully', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        readFileMock.mockRejectedValue(new Error('permission denied'));

        const refs = await findMarkdownReferences(makeUri('/docs/target.md'));

        expect(refs).toHaveLength(0);
    });

    it('computes correct hrefStart for links with preceding text', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/page.md')]);
        mockFiles({
            '/docs/page.md': 'Some text [link](target.md) more text',
        });

        const refs = await findMarkdownReferences(makeUri('/docs/target.md'));

        expect(refs).toHaveLength(1);
        // "Some text [link](target.md)" - the ( is at index 16, href starts at 17
        expect(refs[0].hrefStart).toBe(17);
    });
});

describe('computeNewMdHref', () => {
    it('computes relative path in same directory', () => {
        const result = computeNewMdHref(makeUri('/docs/page.md'), makeUri('/docs/new-name.md'));

        expect(result).toBe('new-name.md');
    });

    it('computes relative path to parent directory', () => {
        const result = computeNewMdHref(makeUri('/docs/sub/page.md'), makeUri('/docs/target.md'));

        expect(result).toBe('../target.md');
    });

    it('computes relative path to subdirectory', () => {
        const result = computeNewMdHref(makeUri('/docs/page.md'), makeUri('/docs/sub/target.md'));

        expect(result).toBe('sub/target.md');
    });
});
