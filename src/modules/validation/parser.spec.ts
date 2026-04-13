import {describe, expect, it} from 'vitest';

import {parseContent} from './parser';

describe('parseContent', () => {
    it('extracts frontmatter', () => {
        const input = '---\ntitle: Hello\n---\nBody text';
        const {fmContent, pcContent} = parseContent(input);

        expect(fmContent).not.toBeNull();
        expect(fmContent?.type).toBe('fm');
        expect(fmContent?.content).toBe('title: Hello');
        expect(fmContent?.startLine).toBe(1);
        expect(fmContent?.endLine).toBe(1);
        expect(pcContent).toEqual([]);
    });

    it('returns null frontmatter when absent', () => {
        const {fmContent} = parseContent('Just body text');
        expect(fmContent).toBeNull();
    });

    it('handles multi-line frontmatter', () => {
        const input = '---\ntitle: Hello\ndescription: World\ntags:\n  - a\n---\nBody';
        const {fmContent} = parseContent(input);

        expect(fmContent?.content).toBe('title: Hello\ndescription: World\ntags:\n  - a');
        expect(fmContent?.startLine).toBe(1);
        expect(fmContent?.endLine).toBe(4);
    });

    it('extracts a single page-constructor block', () => {
        const input = '::: page-constructor\nblocks:\n  - type: header\n:::';
        const {pcContent} = parseContent(input);

        expect(pcContent).toHaveLength(1);
        expect(pcContent[0].type).toBe('pc');
        expect(pcContent[0].content).toBe('blocks:\n  - type: header');
    });

    it('extracts page-constructor block after frontmatter', () => {
        const input =
            '---\ntitle: Test\n---\nSome text\n::: page-constructor\nblocks:\n  - type: a\n:::';
        const {fmContent, pcContent} = parseContent(input);

        expect(fmContent).not.toBeNull();
        expect(pcContent).toHaveLength(1);
        expect(pcContent[0].startLine).toBeGreaterThan(fmContent?.endLine ?? Infinity);
    });

    it('extracts multiple page-constructor blocks', () => {
        const input =
            '::: page-constructor\nfirst: 1\n:::\ntext\n::: page-constructor\nsecond: 2\n:::';
        const {pcContent} = parseContent(input);

        expect(pcContent).toHaveLength(2);
        expect(pcContent[0].content).toBe('first: 1');
        expect(pcContent[1].content).toBe('second: 2');
    });

    it('trims blank lines inside page-constructor blocks', () => {
        const input = '::: page-constructor\n\n  blocks:\n    - type: x\n\n:::';
        const {pcContent} = parseContent(input);

        expect(pcContent[0].content).toBe('  blocks:\n    - type: x');
    });

    it('ignores unclosed page-constructor blocks', () => {
        const input = '::: page-constructor\nblocks:\n  - type: a';
        const {pcContent} = parseContent(input);
        expect(pcContent).toEqual([]);
    });

    it('returns empty for plain text', () => {
        const {fmContent, pcContent} = parseContent('Hello world');
        expect(fmContent).toBeNull();
        expect(pcContent).toEqual([]);
    });
});
