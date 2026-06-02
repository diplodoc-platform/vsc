import type * as vscode from 'vscode';

import {beforeEach, describe, expect, it, vi} from 'vitest';

import {LinkProvider} from './index';

vi.mock('../utils', () => ({
    findYfmRoot: (fsPath: string) => (fsPath.startsWith('/docs/') ? '/docs' : null),
    isInExcludedDir: () => false,
}));

function mockDocument(text: string, languageId = 'yaml'): vscode.TextDocument {
    const lines = text.split('\n');

    return {
        languageId,
        uri: {toString: () => '/docs/ru/toc.yaml', fsPath: '/docs/ru/toc.yaml'},
        lineCount: lines.length,
        lineAt: (i: number) => ({text: lines[i] ?? '', lineNumber: i}),
        getText: () => text,
    } as unknown as vscode.TextDocument;
}

describe('LinkProvider', () => {
    let provider: LinkProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new LinkProvider();
    });

    it('provides links for href fields', () => {
        const doc = mockDocument('items:\n  - name: Page\n    href: page.md');
        const links = provider.provideDocumentLinks(doc);

        expect(links).toHaveLength(1);
        expect(links[0].target?.toString()).toContain('page.md');
    });

    it('provides links for input fields inside openapi includer blocks resolved to project root', () => {
        const doc = mockDocument(
            [
                'items:',
                '  - name: API',
                '    include:',
                '      path: custom/backend/api',
                '      includers:',
                '        - name: openapi',
                '          input: ru/openapi/prod/api.yaml',
            ].join('\n'),
        );
        const links = provider.provideDocumentLinks(doc);

        const inputLink = links.find((l) => l.target?.toString().includes('api.yaml'));

        expect(inputLink).toBeDefined();
        expect(inputLink?.target?.toString()).toBe('/docs/ru/openapi/prod/api.yaml');
    });

    it('provides links for input fields outside includer blocks (resolved to doc dir)', () => {
        const doc = mockDocument(
            ['items:', '  - name: Page', '    input: some-file.yaml'].join('\n'),
        );
        const links = provider.provideDocumentLinks(doc);

        expect(links).toHaveLength(1);
        expect(links[0].target?.toString()).toBe('/docs/ru/some-file.yaml');
    });

    it('provides links for path in normal include (without includers)', () => {
        const doc = mockDocument(
            ['items:', '  - include:', '      path: sub/toc.yaml', '      mode: link'].join('\n'),
        );
        const links = provider.provideDocumentLinks(doc);

        const pathLink = links.find((l) => l.target?.toString().includes('toc.yaml'));

        expect(pathLink).toBeDefined();
        expect(pathLink?.target?.toString()).toBe('/docs/ru/sub/toc.yaml');
    });
});
