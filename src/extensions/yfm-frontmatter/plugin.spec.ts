import MarkdownIt from 'markdown-it';
import {describe, expect, it} from 'vitest';

import {yfmFrontmatterPlugin} from './plugin';

const TOKEN_NAME = 'yfm_frontmatter';

function createMd() {
    const md = new MarkdownIt();
    yfmFrontmatterPlugin(md);
    return md;
}

function findToken(tokens: MarkdownIt.Token[], name: string) {
    return tokens.find((t) => t.type === name);
}

describe('yfmFrontmatterPlugin', () => {
    it('parses frontmatter at the start of document', () => {
        const md = createMd();
        const tokens = md.parse('---\ntitle: Hello\n---\n\n# Content', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('title: Hello');
    });

    it('captures multiline YAML content', () => {
        const md = createMd();
        const src = '---\ntitle: Hello\ndescription: World\ntags:\n  - a\n  - b\n---\n';
        const tokens = md.parse(src, {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('title: Hello\ndescription: World\ntags:\n  - a\n  - b');
    });

    it('does not match frontmatter without closing ---', () => {
        const md = createMd();
        const tokens = md.parse('---\ntitle: Hello\n\n# Content', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('parses frontmatter after preceding content when body is non-empty', () => {
        const md = createMd();
        const tokens = md.parse('# Title\n\n---\nkey: value\n---', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('key: value');
    });

    it('does not match empty --- pair in the middle of the document', () => {
        const md = createMd();
        const tokens = md.parse('# Title\n\n---\n---\n\nMore text', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeUndefined();
    });

    it('parses empty frontmatter', () => {
        const md = createMd();
        const tokens = md.parse('---\n---\n\n# Content', {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toBe('');
    });

    it('does not consume content after closing ---', () => {
        const md = createMd();
        const tokens = md.parse('---\nkey: val\n---\n\n# Heading', {});
        const heading = tokens.find((t) => t.type === 'heading_open');

        expect(heading).toBeDefined();
    });

    it('takes priority over hr rule for --- at line 0', () => {
        const md = createMd();
        const tokens = md.parse('---\nkey: val\n---', {});
        const hr = tokens.find((t) => t.type === 'hr');

        expect(hr).toBeUndefined();
    });

    it('parses frontmatter when text precedes the opening ---', () => {
        const md = createMd();
        const src = 's\n\n---\ninterface:\n  toc: true\n  search: true\n  feedback: true\n---';
        const tokens = md.parse(src, {});
        const token = findToken(tokens, TOKEN_NAME);

        expect(token).toBeDefined();
        expect(token?.content).toContain('interface:');
        expect(token?.content).toContain('toc: true');
    });
});
