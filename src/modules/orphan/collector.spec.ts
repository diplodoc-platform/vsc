import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {collectBlocksYamlFiles, collectReferencedFiles} from './collector';

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

describe('collectReferencedFiles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findFilesMock.mockResolvedValue([]);
    });

    it('collects href paths from toc.yaml', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  - name: Page\n    href: guide/intro.md',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/guide/intro.md')).toBe(true);
    });

    it('collects multiple hrefs', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: index.md\nitems:\n  - href: page.md\n  - href: other.md',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/index.md')).toBe(true);
        expect(result.has('/docs/page.md')).toBe(true);
        expect(result.has('/docs/other.md')).toBe(true);
    });

    it('skips external URLs', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: https://example.com\n  href: page.md',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/page.md')).toBe(true);
        expect([...result].some((p) => p.includes('example.com'))).toBe(false);
    });

    it('follows include.path recursively', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: index.md\n  include:\n    path: sub/toc.yaml',
            '/docs/sub/toc.yaml': '  href: sub-page.md',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/index.md')).toBe(true);
        expect(result.has('/docs/sub/sub-page.md')).toBe(true);
    });

    it('handles circular toc includes', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: page.md\n  include:\n    path: toc.yaml',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/page.md')).toBe(true);
    });

    it('collects {% include %} from referenced .md files', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: index.md',
            '/docs/index.md': '# Title\n{% include [desc](includes/fragment.md) %}\nMore text',
            '/docs/includes/fragment.md': 'fragment content',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/index.md')).toBe(true);
        expect(result.has('/docs/includes/fragment.md')).toBe(true);
    });

    it('follows nested {% include %} recursively', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: index.md',
            '/docs/index.md': '{% include [a](a.md) %}',
            '/docs/a.md': '{% include [b](b.md) %}',
            '/docs/b.md': 'final content',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/index.md')).toBe(true);
        expect(result.has('/docs/a.md')).toBe(true);
        expect(result.has('/docs/b.md')).toBe(true);
    });

    it('handles circular md includes', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: a.md',
            '/docs/a.md': '{% include [b](b.md) %}',
            '/docs/b.md': '{% include [a](a.md) %}',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/a.md')).toBe(true);
        expect(result.has('/docs/b.md')).toBe(true);
    });

    it('strips fragments from include paths', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/toc.yaml')]);
        mockFiles({
            '/docs/toc.yaml': '  href: index.md',
            '/docs/index.md': '{% include [section](includes/frag.md#section1) %}',
            '/docs/includes/frag.md': 'content',
        });

        const result = await collectReferencedFiles();

        expect(result.has('/docs/includes/frag.md')).toBe(true);
    });

    it('returns empty set when no toc.yaml found', async () => {
        findFilesMock.mockResolvedValue([]);

        const result = await collectReferencedFiles();

        expect(result.size).toBe(0);
    });
});

describe('collectBlocksYamlFiles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findFilesMock.mockResolvedValue([]);
    });

    it('returns yaml files containing blocks: key', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/pc.yaml')]);
        mockFiles({
            '/docs/pc.yaml': 'blocks:\n  - type: header-block',
        });

        const result = await collectBlocksYamlFiles();

        expect(result.has('/docs/pc.yaml')).toBe(true);
    });

    it('skips yaml files without blocks: key', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/config.yaml')]);
        mockFiles({
            '/docs/config.yaml': 'title: My docs\nitems:\n  - name: page',
        });

        const result = await collectBlocksYamlFiles();

        expect(result.size).toBe(0);
    });

    it('skips toc.yaml, presets.yaml, redirects.yaml, theme.yaml', async () => {
        findFilesMock.mockResolvedValue([
            makeUri('/docs/toc.yaml'),
            makeUri('/docs/presets.yaml'),
            makeUri('/docs/redirects.yaml'),
            makeUri('/docs/theme.yaml'),
        ]);
        mockFiles({
            '/docs/toc.yaml': 'blocks:\n  - type: test',
            '/docs/presets.yaml': 'blocks:\n  - type: test',
            '/docs/redirects.yaml': 'blocks:\n  - type: test',
            '/docs/theme.yaml': 'blocks:\n  - type: test',
        });

        const result = await collectBlocksYamlFiles();

        expect(result.size).toBe(0);
    });

    it('skips hidden yaml files (starting with dot)', async () => {
        findFilesMock.mockResolvedValue([makeUri('/docs/.yfm')]);
        mockFiles({
            '/docs/.yfm': 'blocks:\n  - type: test',
        });

        const result = await collectBlocksYamlFiles();

        expect(result.size).toBe(0);
    });

    it('returns empty set when no yaml files found', async () => {
        findFilesMock.mockResolvedValue([]);

        const result = await collectBlocksYamlFiles();

        expect(result.size).toBe(0);
    });
});
