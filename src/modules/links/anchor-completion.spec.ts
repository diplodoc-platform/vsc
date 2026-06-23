import type * as vscode from 'vscode';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscodeModule from 'vscode';

import {
    AnchorCompletionProvider,
    findAnchorLine,
    getAnchorContext,
    parseAnchors,
} from './anchor-completion';

describe('parseAnchors — sections-only mode', () => {
    it('uses explicit {#id} anchor from heading', () => {
        const content = '## Installation {#install}\n\nSome text.\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors).toHaveLength(1);
        expect(anchors[0].id).toBe('install');
        expect(anchors[0].isSection).toBe(true);
    });

    it('auto-slugifies heading text when no explicit anchor', () => {
        const content = '### Prerequisites\n\nText.\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors[0].id).toBe('prerequisites');
        expect(anchors[0].isSection).toBe(true);
    });

    it('uses only the explicit id, not a mix with heading slug', () => {
        const content = '## Configuration {#config}\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors[0].id).toBe('config');
        expect(anchors[0].id).not.toContain('configuration');
    });

    it('includes all heading levels', () => {
        const content = '# H1\n## H2 {#h2}\n### H3\n#### H4\n##### H5\n###### H6\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors).toHaveLength(6);
        expect(anchors.map((a) => a.id)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
    });

    it('does NOT include inline {#id} anchors from paragraphs', () => {
        const content = '## Section\n\nSome text with inline anchor. {#inline-anchor}\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors).toHaveLength(1);
        expect(anchors[0].id).toBe('section');
    });

    it('returns heading text for detail', () => {
        const content = '## Installation {#install}\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors[0].headingText).toBe('Installation');
    });

    it('returns heading text without {#...} for auto-slug heading', () => {
        const content = '## My Section\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors[0].headingText).toBe('My Section');
    });

    it('deduplicates anchors when same id appears twice', () => {
        const content = '## Section {#dup}\n## Other {#dup}\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors).toHaveLength(1);
        expect(anchors[0].id).toBe('dup');
    });
});

describe('parseAnchors — all mode', () => {
    it('includes inline {#id} anchors from paragraphs', () => {
        const content = '## Section\n\nSome text with inline anchor. {#inline-anchor}\n';
        const anchors = parseAnchors(content, 'all');
        const ids = anchors.map((a) => a.id);

        expect(ids).toContain('section');
        expect(ids).toContain('inline-anchor');
    });

    it('inline anchors have isSection=false', () => {
        const content = 'Paragraph text. {#my-anchor}\n';
        const anchors = parseAnchors(content, 'all');

        const inline = anchors.find((a) => a.id === 'my-anchor');
        expect(inline).toBeDefined();
        expect(inline?.isSection).toBe(false);
    });

    it('does not duplicate: {#install} on heading is section, not also inline', () => {
        const content = '## Installation {#install}\n';
        const anchors = parseAnchors(content, 'all');

        const installAnchors = anchors.filter((a) => a.id === 'install');
        expect(installAnchors).toHaveLength(1);
        expect(installAnchors[0].isSection).toBe(true);
    });

    it('includes multiple inline anchors from same paragraph', () => {
        const content = 'Text {#anchor-a} more text. {#anchor-b}\n';
        const anchors = parseAnchors(content, 'all');
        const ids = anchors.map((a) => a.id);

        expect(ids).toContain('anchor-a');
        expect(ids).toContain('anchor-b');
    });
});

describe('parseAnchors — slugification', () => {
    it('lowercases heading text', () => {
        const content = '## UPPERCASE TITLE\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors[0].id).toBe('uppercase-title');
    });

    it('replaces spaces with hyphens', () => {
        const content = '## My Long Title\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors[0].id).toBe('my-long-title');
    });

    it('removes non-word chars from heading slug', () => {
        const content = '## Hello, World!\n';
        const anchors = parseAnchors(content, 'sections-only');

        expect(anchors[0].id).toBe('hello-world');
    });
});

describe('getAnchorContext', () => {
    it('detects anchor after # in an include', () => {
        const line = '{% include [label](./article.md#) %}';
        const ctx = getAnchorContext(line, 32);

        expect(ctx).not.toBeNull();
        expect(ctx?.isInclude).toBe(true);
        expect(ctx?.targetPath).toBe('./article.md');
        expect(ctx?.prefix).toBe('');
    });

    it('captures typed prefix after # in include', () => {
        const line = '{% include [label](./article.md#ins) %}';
        const ctx = getAnchorContext(line, 35);

        expect(ctx?.isInclude).toBe(true);
        expect(ctx?.prefix).toBe('ins');
        expect(ctx?.targetPath).toBe('./article.md');
    });

    it('detects anchor after # in a markdown link', () => {
        const line = '[Go to section](article.md#)';
        const ctx = getAnchorContext(line, 27);

        expect(ctx).not.toBeNull();
        expect(ctx?.isInclude).toBe(false);
        expect(ctx?.targetPath).toBe('article.md');
        expect(ctx?.prefix).toBe('');
    });

    it('captures typed prefix after # in markdown link', () => {
        const line = '[text](docs/file.md#inst)';
        const ctx = getAnchorContext(line, 24);

        expect(ctx?.isInclude).toBe(false);
        expect(ctx?.targetPath).toBe('docs/file.md');
        expect(ctx?.prefix).toBe('inst');
    });

    it('returns null when not in a link or include', () => {
        expect(getAnchorContext('Just regular text', 10)).toBeNull();
        expect(getAnchorContext('## Heading {#anchor}', 18)).toBeNull();
    });

    it('returns null before the # character', () => {
        const line = '[text](article.md#anchor)';
        const ctx = getAnchorContext(line, 17);

        expect(ctx).toBeNull();
    });

    it('anchorStart points to position right after #', () => {
        const line = '[text](docs/file.md#inst)';
        const ctx = getAnchorContext(line, 23);

        expect(ctx?.anchorStart).toBe(20);
    });
});

const readFileMock = vi.mocked(vscodeModule.workspace.fs.readFile);

function textToBytes(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

function makeDocument(lineText: string, languageId = 'markdown'): vscode.TextDocument {
    return {
        languageId,
        uri: {
            fsPath: '/workspace/docs/consumer.md',
            toString: () => '/workspace/docs/consumer.md',
        },
        lineCount: 1,
        lineAt: () => ({text: lineText, lineNumber: 0}),
        getText: () => lineText,
    } as unknown as vscode.TextDocument;
}

function pos(character: number): vscode.Position {
    return new vscodeModule.Position(0, character);
}

const ARTICLE_CONTENT = [
    '# Overview',
    '',
    '## Installation {#install}',
    '',
    '### Prerequisites',
    '',
    '## Configuration {#config}',
    '',
    'Some text with inline anchor. {#inline-anchor}',
    '',
    '## Troubleshooting',
    '',
    '## FAQ {#faq}',
].join('\n');

describe('AnchorCompletionProvider', () => {
    const provider = new AnchorCompletionProvider();

    beforeEach(() => {
        vi.clearAllMocks();
        readFileMock.mockResolvedValue(textToBytes(ARTICLE_CONTENT));
    });

    it('returns undefined when not in link/include context', async () => {
        const doc = makeDocument('Just some text');
        const result = await provider.provideCompletionItems(doc, pos(10));

        expect(result).toBeUndefined();
    });

    it('provides section anchors in an include context', async () => {
        const line = '{% include [e](./article.md#) %}';
        const doc = makeDocument(line);
        const result = await provider.provideCompletionItems(doc, pos(28));

        expect(result).toBeDefined();
        const ids = (result as vscode.CompletionItem[]).map((i) => i.label);
        expect(ids).toContain('overview');
        expect(ids).toContain('install');
        expect(ids).toContain('config');
        expect(ids).not.toContain('inline-anchor'); // inline anchor excluded
    });

    it('provides all anchors (including inline) in a link context', async () => {
        const line = '[read more](./article.md#)';
        const doc = makeDocument(line);
        const result = await provider.provideCompletionItems(doc, pos(25));

        expect(result).toBeDefined();
        const ids = (result as vscode.CompletionItem[]).map((i) => i.label);
        expect(ids).toContain('install');
        expect(ids).toContain('inline-anchor');
    });

    it('filters completions by typed prefix', async () => {
        const line = '[read](./article.md#ins)';
        const doc = makeDocument(line);
        const result = await provider.provideCompletionItems(doc, pos(23));

        const ids = (result as vscode.CompletionItem[]).map((i) => i.label);
        expect(ids).toContain('install');
        expect(ids).not.toContain('config');
        expect(ids).not.toContain('overview');
    });

    it('returns empty array when target file is not found', async () => {
        readFileMock.mockRejectedValue(new Error('not found'));

        const line = '[text](missing.md#)';
        const doc = makeDocument(line);
        const result = await provider.provideCompletionItems(doc, pos(18));

        expect(result).toEqual([]);
    });

    it('sets insertText to anchor id (without #)', async () => {
        const line = '[text](./article.md#)';
        const doc = makeDocument(line);
        const result = (await provider.provideCompletionItems(
            doc,
            pos(20),
        )) as vscode.CompletionItem[];

        const item = result.find((i) => i.label === 'install');
        expect(item).toBeDefined();
        expect(item?.insertText).toBe('install');
    });

    it('includes heading text as detail', async () => {
        const line = '[text](./article.md#)';
        const doc = makeDocument(line);
        const result = (await provider.provideCompletionItems(
            doc,
            pos(20),
        )) as vscode.CompletionItem[];

        const item = result.find((i) => i.label === 'install');
        expect(item?.detail).toBe('Installation');
    });
});

// ---------------------------------------------------------------------------
// findAnchorLine
// ---------------------------------------------------------------------------

describe('findAnchorLine', () => {
    const content = [
        '# Overview',
        '',
        '## Installation {#install}',
        '',
        '### Prerequisites',
        '',
        '## Configuration {#config}',
        '',
        'Some text with inline anchor. {#inline-anchor}',
        '',
        '## Troubleshooting',
    ].join('\n');

    it('finds line of heading with explicit {#id} anchor', () => {
        expect(findAnchorLine(content, 'install')).toBe(2);
    });

    it('finds line of heading with explicit {#config} anchor', () => {
        expect(findAnchorLine(content, 'config')).toBe(6);
    });

    it('finds line of heading by auto-slug', () => {
        expect(findAnchorLine(content, 'prerequisites')).toBe(4);
    });

    it('finds line of heading by auto-slug for single word', () => {
        expect(findAnchorLine(content, 'overview')).toBe(0);
    });

    it('finds line of inline {#id} anchor in paragraph', () => {
        expect(findAnchorLine(content, 'inline-anchor')).toBe(8);
    });

    it('returns null for unknown anchor', () => {
        expect(findAnchorLine(content, 'nonexistent')).toBeNull();
    });

    it('returns null for empty content', () => {
        expect(findAnchorLine('', 'anything')).toBeNull();
    });
});
