import type * as vscode from 'vscode';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscodeModule from 'vscode';

import {getNavigationLines, validateLinks} from './diagnostics';

const statMock = vi.mocked(vscodeModule.workspace.fs.stat);

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

function mockCollection() {
    const set = vi.fn();
    const del = vi.fn();

    return {
        collection: {set, delete: del} as unknown as vscode.DiagnosticCollection,
        getSetCall: () => {
            const call = set.mock.calls[0] as unknown[];
            return {uri: call[0], diagnostics: call[1] as vscode.Diagnostic[]};
        },
        set,
    };
}

describe('validateLinks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        statMock.mockResolvedValue({} as vscode.FileStat);
    });

    it('reports error for missing file', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument('  href: missing.md');
        const {collection, getSetCall, set} = mockCollection();

        await validateLinks(doc, collection);

        expect(set).toHaveBeenCalledOnce();

        const {uri, diagnostics} = getSetCall();
        expect(uri).toBe(doc.uri);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Link is unreachable: missing.md');
        expect(diagnostics[0].source).toBe('Diplodoc');
        expect(diagnostics[0].severity).toBe(0);
    });

    it('reports no error for existing file', async () => {
        const doc = mockDocument('  href: exists.md');
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        expect(getSetCall().diagnostics).toHaveLength(0);
    });

    it('skips external URLs', async () => {
        const doc = mockDocument('  href: https://example.com');
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        expect(statMock).not.toHaveBeenCalled();
        expect(getSetCall().diagnostics).toHaveLength(0);
    });

    it('skips non-link fields', async () => {
        const doc = mockDocument('  name: something');
        const {collection} = mockCollection();

        await validateLinks(doc, collection);

        expect(statMock).not.toHaveBeenCalled();
    });

    it('skips redirect from/to fields', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument('  - from: /old-page\n    to: /new-page');
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        expect(statMock).not.toHaveBeenCalled();
        expect(getSetCall().diagnostics).toHaveLength(0);
    });

    it('skips non-yaml documents', async () => {
        const doc = mockDocument('  href: page.md', 'markdown');
        const {collection, set} = mockCollection();

        await validateLinks(doc, collection);

        expect(set).not.toHaveBeenCalled();
    });

    it('reports multiple missing files', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument('  href: a.md\n  href: b.md');
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        const {diagnostics} = getSetCall();
        expect(diagnostics).toHaveLength(2);
        expect(diagnostics[0].message).toBe('Link is unreachable: a.md');
        expect(diagnostics[1].message).toBe('Link is unreachable: b.md');
    });

    it('range covers only the value', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument('    href: page.md');
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        const {diagnostics} = getSetCall();
        expect(diagnostics[0].range.start.character).toBe(10);
        expect(diagnostics[0].range.end.character).toBe(17);
    });

    it('skips url inside navigation section', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument(
            [
                'navigation:',
                '  header:',
                '    leftItems:',
                '      - text: Docs',
                '        url: /docs/',
            ].join('\n'),
        );
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        expect(statMock).not.toHaveBeenCalled();
        expect(getSetCall().diagnostics).toHaveLength(0);
    });

    it('skips icon inside navigation section', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument(
            [
                'navigation:',
                '  header:',
                '    rightItems:',
                '      - text: Link',
                '        icon: /icons/link.svg',
            ].join('\n'),
        );
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        expect(statMock).not.toHaveBeenCalled();
        expect(getSetCall().diagnostics).toHaveLength(0);
    });

    it('still validates href outside navigation', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument(
            [
                'navigation:',
                '  header:',
                '    leftItems:',
                '      - text: Docs',
                '        url: /docs/',
                'items:',
                '  - name: Page',
                '    href: missing.md',
            ].join('\n'),
        );
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        const {diagnostics} = getSetCall();
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Link is unreachable: missing.md');
    });

    it('reports error for missing file in YAML list under link field', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument(
            ['resources:', '  style:', '    - _assets/style/custom.css'].join('\n'),
        );
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        const {diagnostics} = getSetCall();
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Link is unreachable: _assets/style/custom.css');
    });

    it('reports no error for existing file in YAML list', async () => {
        const doc = mockDocument(
            ['resources:', '  style:', '    - _assets/style/custom.css'].join('\n'),
        );
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        expect(getSetCall().diagnostics).toHaveLength(0);
    });

    it('skips external URLs in YAML list', async () => {
        const doc = mockDocument(
            ['resources:', '  script:', '    - https://cdn.example.com/app.js'].join('\n'),
        );
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        expect(statMock).not.toHaveBeenCalled();
        expect(getSetCall().diagnostics).toHaveLength(0);
    });

    it('does not treat list items under non-link fields as links', async () => {
        const doc = mockDocument(['items:', '  - missing-file.md'].join('\n'));
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        expect(statMock).not.toHaveBeenCalled();
        expect(getSetCall().diagnostics).toHaveLength(0);
    });

    it('does not suppress validation when navigation is a scalar', async () => {
        statMock.mockRejectedValue(new Error('not found'));
        const doc = mockDocument(
            ['navigation: ./nav.yaml', 'items:', '  - name: Page', '    href: missing.md'].join(
                '\n',
            ),
        );
        const {collection, getSetCall} = mockCollection();

        await validateLinks(doc, collection);

        const {diagnostics} = getSetCall();
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Link is unreachable: missing.md');
    });
});

describe('getNavigationLines', () => {
    it('returns lines inside navigation block', () => {
        const doc = mockDocument(
            [
                'title: My Docs',
                'navigation:',
                '  logo:',
                '    url: https://example.com',
                '  header:',
                '    leftItems:',
                '      - text: Link',
                '        url: /path',
                'items:',
                '  - name: Page',
            ].join('\n'),
        );

        const lines = getNavigationLines(doc);

        expect(lines.has(0)).toBe(false);
        expect(lines.has(1)).toBe(false);
        expect(lines.has(2)).toBe(true);
        expect(lines.has(3)).toBe(true);
        expect(lines.has(4)).toBe(true);
        expect(lines.has(5)).toBe(true);
        expect(lines.has(6)).toBe(true);
        expect(lines.has(7)).toBe(true);
        expect(lines.has(8)).toBe(false);
        expect(lines.has(9)).toBe(false);
    });

    it('returns empty set for scalar navigation', () => {
        const doc = mockDocument(
            ['navigation: false', 'items:', '  - name: Page', '    href: page.md'].join('\n'),
        );

        const lines = getNavigationLines(doc);
        expect(lines.size).toBe(0);
    });

    it('includes empty lines and comments within navigation', () => {
        const doc = mockDocument(
            ['navigation:', '  logo:', '', '  # comment', '  header:', 'items:'].join('\n'),
        );

        const lines = getNavigationLines(doc);
        expect(lines.has(1)).toBe(true);
        expect(lines.has(2)).toBe(true);
        expect(lines.has(3)).toBe(true);
        expect(lines.has(4)).toBe(true);
        expect(lines.has(5)).toBe(false);
    });
});
