import type * as vscode from 'vscode';

import {describe, expect, it} from 'vitest';

import {isExternalUrl, parseLinkFromLine} from './utils';

function mockLine(text: string, lineNumber = 0): vscode.TextLine {
    return {text, lineNumber} as vscode.TextLine;
}

const baseUri = {toString: () => '/workspace/docs'} as vscode.Uri;

function expectLink(link: vscode.DocumentLink | null) {
    expect(link).not.toBeNull();

    const target = link?.target as {toString: () => string};
    const range = link?.range as vscode.Range;

    return {target: target.toString(), range};
}

describe('isExternalUrl', () => {
    it('detects http URLs', () => {
        expect(isExternalUrl('http://example.com')).toBe(true);
    });

    it('detects https URLs', () => {
        expect(isExternalUrl('https://example.com/page')).toBe(true);
    });

    it('rejects relative paths', () => {
        expect(isExternalUrl('guide/intro.md')).toBe(false);
    });

    it('rejects bare filenames', () => {
        expect(isExternalUrl('toc.yaml')).toBe(false);
    });
});

describe('parseLinkFromLine', () => {
    it('parses unquoted href', () => {
        const {target, range} = expectLink(
            parseLinkFromLine(mockLine('    href: guide/intro.md'), baseUri),
        );

        expect(target).toBe('/workspace/docs/guide/intro.md');
        expect(range.start.character).toBe(10);
        expect(range.end.character).toBe(24);
    });

    it('parses single-quoted href', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine("    href: 'guide/intro.md'"), baseUri),
        );

        expect(target).toBe('/workspace/docs/guide/intro.md');
    });

    it('parses double-quoted href', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine('    href: "guide/intro.md"'), baseUri),
        );

        expect(target).toBe('/workspace/docs/guide/intro.md');
    });

    it('parses include path', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine('      path: ../shared/toc.yaml'), baseUri),
        );

        expect(target).toContain('../shared/toc.yaml');
    });

    it('parses external URL as external link', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine('    href: https://example.com/docs'), baseUri),
        );

        expect(target).toBe('https://example.com/docs');
    });

    it('parses from/to in redirects', () => {
        const {target: fromTarget} = expectLink(
            parseLinkFromLine(mockLine('    from: old/page.html'), baseUri),
        );
        const {target: toTarget} = expectLink(
            parseLinkFromLine(mockLine('    to: new/page.html'), baseUri),
        );

        expect(fromTarget).toBe('/workspace/docs/old/page.html');
        expect(toTarget).toBe('/workspace/docs/new/page.html');
    });

    it('parses url field', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine("        url: './index.md'"), baseUri),
        );

        expect(target).toBe('/workspace/docs/./index.md');
    });

    it('parses src field', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine('    src: _assets/image.png'), baseUri),
        );

        expect(target).toBe('/workspace/docs/_assets/image.png');
    });

    it('parses icon field', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine('    icon: https://cdn.example.com/logo.svg'), baseUri),
        );

        expect(target).toBe('https://cdn.example.com/logo.svg');
    });

    it('parses yfm config fields', () => {
        expectLink(parseLinkFromLine(mockLine('input: ./docs'), baseUri));
        expectLink(parseLinkFromLine(mockLine('output: ./build'), baseUri));
        expectLink(parseLinkFromLine(mockLine('config: .yfm'), baseUri));
        expectLink(parseLinkFromLine(mockLine('theme: theme.yaml'), baseUri));
    });

    it('parses favicon-src field', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine('    favicon-src: _assets/favicon.ico'), baseUri),
        );

        expect(target).toBe('/workspace/docs/_assets/favicon.ico');
    });

    it('parses list item with key', () => {
        const {target} = expectLink(parseLinkFromLine(mockLine('  - href: page.md'), baseUri));

        expect(target).toBe('/workspace/docs/page.md');
    });

    it('parses script and style fields', () => {
        expectLink(parseLinkFromLine(mockLine('  - script: _assets/custom.js'), baseUri));
        expectLink(parseLinkFromLine(mockLine('  - style: _assets/custom.css'), baseUri));
    });

    it('parses host field', () => {
        const {target} = expectLink(
            parseLinkFromLine(mockLine('    host: https://sandbox.example.com'), baseUri),
        );

        expect(target).toBe('https://sandbox.example.com');
    });

    it('parses pdfFileUrl field', () => {
        expectLink(parseLinkFromLine(mockLine('pdfFileUrl: ./output.pdf'), baseUri));
    });

    it('parses schema field', () => {
        expectLink(parseLinkFromLine(mockLine('  - schema: ./translate-schema.yaml'), baseUri));
    });

    it('ignores non-link fields', () => {
        expect(parseLinkFromLine(mockLine('    name: My Page'), baseUri)).toBeNull();
        expect(parseLinkFromLine(mockLine('    title: Hello'), baseUri)).toBeNull();
        expect(parseLinkFromLine(mockLine('    description: Some text'), baseUri)).toBeNull();
        expect(parseLinkFromLine(mockLine('    content: markdown'), baseUri)).toBeNull();
        expect(parseLinkFromLine(mockLine('    type: header-block'), baseUri)).toBeNull();
    });

    it('ignores comments', () => {
        expect(parseLinkFromLine(mockLine('# href: page.md'), baseUri)).toBeNull();
    });

    it('ignores empty values', () => {
        expect(parseLinkFromLine(mockLine('    href:'), baseUri)).toBeNull();
        expect(parseLinkFromLine(mockLine('    href: '), baseUri)).toBeNull();
    });

    it('ignores plain text lines', () => {
        expect(parseLinkFromLine(mockLine('some random text'), baseUri)).toBeNull();
    });

    it('range covers only the value, not the key', () => {
        const {range} = expectLink(parseLinkFromLine(mockLine('    href: page.md'), baseUri));

        expect(range.start.character).toBe(10);
        expect(range.end.character).toBe(17);
    });
});
