import MarkdownIt from 'markdown-it';
import {describe, expect, it} from 'vitest';

import {yfmDirectivePlugin} from './plugin';

const TOKEN_NAME = 'yfm_directive';

function createMd() {
    const md = new MarkdownIt();
    yfmDirectivePlugin(md);
    return md;
}

function findToken(tokens: MarkdownIt.Token[], name: string) {
    return tokens.find((t) => t.type === name);
}

function findAllTokens(tokens: MarkdownIt.Token[], name: string) {
    return tokens.filter((t) => t.type === name);
}

describe('yfmDirectivePlugin', () => {
    it('parses ::: no-translate block', () => {
        const md = createMd();
        const tokens = md.parse('::: no-translate\nHello world\n:::\n', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.info).toBe('no-translate');
        expect(token?.content).toBe('Hello world');
    });

    it('parses block without space after :::', () => {
        const md = createMd();
        const tokens = md.parse(':::no-translate\nHello world\n:::\n', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.info).toBe('no-translate');
        expect(token?.content).toBe('Hello world');
    });

    it('parses any directive name', () => {
        const md = createMd();

        const t1 = findToken(md.parse('::: custom-block\ncontent\n:::\n', {}), TOKEN_NAME);
        expect(t1?.info).toBe('custom-block');

        const t2 = findToken(md.parse('::: warning\ncontent\n:::\n', {}), TOKEN_NAME);
        expect(t2?.info).toBe('warning');

        const t3 = findToken(md.parse('::: my_directive\ncontent\n:::\n', {}), TOKEN_NAME);
        expect(t3?.info).toBe('my_directive');
    });

    it('parses directive with en-dash (U+2013)', () => {
        const md = createMd();
        const tokens = md.parse('::: no\u2013translate\ntext\n:::\n', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.info).toBe('no\u2013translate');
        expect(token?.content).toBe('text');
    });

    it('captures multiline content', () => {
        const md = createMd();
        const src = '::: no-translate\nLine 1\nLine 2\nLine 3\n:::\n';
        const tokens = md.parse(src, {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('Line 1\nLine 2\nLine 3');
    });

    it('does not match without closing :::', () => {
        const md = createMd();
        const tokens = md.parse('::: no-translate\nHello world\n', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('parses empty block', () => {
        const md = createMd();
        const tokens = md.parse('::: no-translate\n:::\n', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('');
    });

    it('does not consume content after closing :::', () => {
        const md = createMd();
        const tokens = md.parse('::: no-translate\ntext\n:::\n\n# Heading', {});
        const heading = tokens.find((t) => t.type === 'heading_open');

        expect(heading).toBeDefined();
    });

    it('parses block in the middle of the document', () => {
        const md = createMd();
        const src = '# Title\n\n::: no-translate\nPreserved text\n:::\n\nMore content';
        const tokens = md.parse(src, {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('Preserved text');
    });

    it('preserves markdown inside the block', () => {
        const md = createMd();
        const src = '::: no-translate\n**bold** and _italic_\n- list item\n:::\n';
        const tokens = md.parse(src, {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('**bold** and _italic_\n- list item');
    });

    it('does not match bare ::: without directive name', () => {
        const md = createMd();
        const tokens = md.parse(':::\ntext\n:::\n', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('parses multiple directive blocks', () => {
        const md = createMd();
        const src = '::: no-translate\nfirst\n:::\n\n::: custom-block\nsecond\n:::\n';
        const tokens = findAllTokens(md.parse(src, {}), TOKEN_NAME);

        expect(tokens).toHaveLength(2);
        expect(tokens[0].info).toBe('no-translate');
        expect(tokens[0].content).toBe('first');
        expect(tokens[1].info).toBe('custom-block');
        expect(tokens[1].content).toBe('second');
    });
});
