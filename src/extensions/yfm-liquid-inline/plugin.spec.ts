import MarkdownIt from 'markdown-it';
import {describe, expect, it} from 'vitest';

import {yfmLiquidInlinePlugin, yfmLiquidInlineTokenName} from './plugin';

function createMd() {
    const md = new MarkdownIt();
    yfmLiquidInlinePlugin(md);
    return md;
}

function inlineTokens(md: MarkdownIt, src: string) {
    const tokens = md.parse(src, {});
    const inline = tokens.find((t) => t.type === 'inline');
    return inline?.children ?? [];
}

describe('yfmLiquidInlinePlugin', () => {
    it('captures an inline {% if %} tag inside a paragraph', () => {
        const md = createMd();
        const children = inlineTokens(md, 'before {% if a %}text\n');
        const liquid = children.filter((t) => t.type === yfmLiquidInlineTokenName);

        expect(liquid).toHaveLength(1);
        expect(liquid[0].content).toBe('{% if a %}');
    });

    it('captures several tags on one line', () => {
        const md = createMd();
        const children = inlineTokens(md, 'x {% if a %}A{% else %}B{% endif %} y\n');
        const liquid = children.filter((t) => t.type === yfmLiquidInlineTokenName);

        expect(liquid.map((t) => t.content)).toEqual(['{% if a %}', '{% else %}', '{% endif %}']);
    });

    it('keeps the text between tags as normal text', () => {
        const md = createMd();
        const children = inlineTokens(md, '{% if a %}A{% endif %}\n');
        const text = children.filter((t) => t.type === 'text').map((t) => t.content);

        expect(text.join('')).toContain('A');
    });

    it('does not capture {{ var }} output', () => {
        const md = createMd();
        const children = inlineTokens(md, 'value {{ foo }} here\n');
        const liquid = children.filter((t) => t.type === yfmLiquidInlineTokenName);

        expect(liquid).toHaveLength(0);
    });

    it('does not capture inline {% include %}', () => {
        const md = createMd();
        const children = inlineTokens(md, 'see {% include [t](f.md) %} end\n');
        const liquid = children.filter((t) => t.type === yfmLiquidInlineTokenName);

        expect(liquid).toHaveLength(0);
    });

    it('does not capture an unterminated {% tag', () => {
        const md = createMd();
        const children = inlineTokens(md, 'broken {% if a\n');
        const liquid = children.filter((t) => t.type === yfmLiquidInlineTokenName);

        expect(liquid).toHaveLength(0);
    });
});
