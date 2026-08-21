import MarkdownIt from 'markdown-it';
import {describe, expect, it} from 'vitest';

import {yfmCommentPlugin} from './plugin';

const TOKEN_NAME = 'yfm_comment';

function createMd() {
    const md = new MarkdownIt();
    yfmCommentPlugin(md);
    return md;
}

function findToken(tokens: MarkdownIt.Token[], name: string) {
    return tokens.find((t) => t.type === name);
}

describe('yfmCommentPlugin', () => {
    it('parses comment', () => {
        const md = createMd();
        const tokens = md.parse('[//]: # (Comment text)', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('[//]: # (Comment text)');
    });

    it('parses empty comment', () => {
        const md = createMd();
        const tokens = md.parse('[//]: # ()', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('[//]: # ()');
    });

    it('parses comment with extra spaces', () => {
        const md = createMd();
        const tokens = md.parse('[//]:  #  (Comment text)', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
    });

    it('takes priority over the reference rule', () => {
        const md = createMd();
        const tokens = md.parse('[//]: # (Comment text)', {});

        expect(tokens).not.toHaveLength(0);
        expect(findToken(tokens, TOKEN_NAME)).toBeDefined();
    });

    it('does not match a link reference definition', () => {
        const md = createMd();
        const tokens = md.parse('[label]: https://example.com "Title"', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('does not match non-comment content', () => {
        const md = createMd();
        const tokens = md.parse('{% note info "Title" %}', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('does not match comment inside a paragraph', () => {
        const md = createMd();
        const tokens = md.parse('Some text [//]: # (Comment text) more text', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('can appear after other content', () => {
        const md = createMd();
        const tokens = md.parse('# Heading\n\n[//]: # (Comment text)', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('[//]: # (Comment text)');
    });

    it('does not consume following content', () => {
        const md = createMd();
        const tokens = md.parse('[//]: # (Comment text)\n\n# Next', {});
        const heading = tokens.find((t) => t.type === 'heading_open');

        expect(heading).toBeDefined();
    });
});
