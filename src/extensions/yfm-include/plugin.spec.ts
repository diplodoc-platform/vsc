import MarkdownIt from 'markdown-it';
import {describe, expect, it} from 'vitest';

import {yfmIncludePlugin} from './plugin';

const TOKEN_NAME = 'yfm_include';

function createMd() {
    const md = new MarkdownIt();
    yfmIncludePlugin(md);
    return md;
}

function findToken(tokens: MarkdownIt.Token[], name: string) {
    return tokens.find((t) => t.type === name);
}

describe('yfmIncludePlugin', () => {
    it('parses include directive', () => {
        const md = createMd();
        const tokens = md.parse('{% include [Title](path/to/file.md) %}', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token!.content).toBe('{% include [Title](path/to/file.md) %}');
    });

    it('parses include with empty title and path', () => {
        const md = createMd();
        const tokens = md.parse('{% include []() %}', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token!.content).toBe('{% include []() %}');
    });

    it('parses include with extra spaces', () => {
        const md = createMd();
        const tokens = md.parse('{%  include  [Title](path)  %}', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
    });

    it('does not match non-include directives', () => {
        const md = createMd();
        const tokens = md.parse('{% note info "Title" %}', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('does not match include inside a paragraph', () => {
        const md = createMd();
        const tokens = md.parse('Some text {% include [T](p) %} more text', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('can appear after other content', () => {
        const md = createMd();
        const tokens = md.parse('# Heading\n\n{% include [Desc](file.md) %}', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token!.content).toBe('{% include [Desc](file.md) %}');
    });

    it('does not consume following content', () => {
        const md = createMd();
        const tokens = md.parse('{% include [T](p) %}\n\n# Next', {});
        const heading = tokens.find((t) => t.type === 'heading_open');

        expect(heading).toBeDefined();
    });
});
