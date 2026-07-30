import {describe, expect, it} from 'vitest';

import {matchLeadingAttrs, parseInlineAttrs} from './utils';

describe('parseInlineAttrs', () => {
    it('extracts width', () => {
        expect(parseInlineAttrs('{width=600}')).toMatchObject({width: '600', height: null});
    });

    it('extracts height', () => {
        expect(parseInlineAttrs('{height=300}')).toMatchObject({width: null, height: '300'});
    });

    it('extracts both dimensions', () => {
        expect(parseInlineAttrs('{width=400 height=200}')).toMatchObject({
            width: '400',
            height: '200',
        });
    });

    it('returns nulls for non-numeric values', () => {
        expect(parseInlineAttrs('{width=foo}')).toMatchObject({width: null, height: null});
    });
});

describe('matchLeadingAttrs', () => {
    it('matches {width=X} at the start of a text node', () => {
        const result = matchLeadingAttrs('{width=600}');

        expect(result).toMatchObject({
            width: '600',
            height: null,
            consumeLength: '{width=600}'.length,
        });
    });

    it('matches {height=X}', () => {
        const result = matchLeadingAttrs('{height=300}');

        expect(result).toMatchObject({width: null, height: '300'});
    });

    it('matches {width=X height=Y}', () => {
        const result = matchLeadingAttrs('{width=400 height=200}');

        expect(result).toMatchObject({width: '400', height: '200'});
    });

    it('allows leading whitespace', () => {
        const result = matchLeadingAttrs(' {width=400}');

        expect(result).not.toBeNull();
        expect(result?.consumeLength).toBe(' {width=400}'.length);
    });

    it('consumes only the attrs block, leaving the rest of the text', () => {
        const text = '{width=400} some more text';
        const result = matchLeadingAttrs(text);

        expect(result?.consumeLength).toBe('{width=400}'.length);
    });

    it('returns null when text does not start with attrs', () => {
        expect(matchLeadingAttrs('hello world')).toBeNull();
    });

    it('returns null for {attrs} without width or height', () => {
        expect(matchLeadingAttrs('{class=foo}')).toBeNull();
    });

    it('returns null when {width=X} is not at the start', () => {
        expect(matchLeadingAttrs('text {width=400}')).toBeNull();
    });
});
