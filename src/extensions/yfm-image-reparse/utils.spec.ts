import {describe, expect, it} from 'vitest';

import {matchLeadingAttrs, parseInlineAttrs, rebuildRawAttrs} from './utils';

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
            rawAttrs: 'width=600',
            consumeLength: '{width=600}'.length,
        });
    });

    it('matches {height=X}', () => {
        const result = matchLeadingAttrs('{height=300}');

        expect(result).toMatchObject({width: null, height: '300', rawAttrs: 'height=300'});
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

    it('returns null when {width=X} is not at the start', () => {
        expect(matchLeadingAttrs('text {width=400}')).toBeNull();
    });

    it('matches arbitrary attrs like {inline=false}', () => {
        const result = matchLeadingAttrs('{inline=false}');

        expect(result).toMatchObject({width: null, height: null, rawAttrs: 'inline=false'});
    });

    it('preserves all attrs in rawAttrs', () => {
        const result = matchLeadingAttrs('{width=400 inline=false something=value}');

        expect(result).toMatchObject({
            width: '400',
            rawAttrs: 'width=400 inline=false something=value',
        });
    });
});

describe('rebuildRawAttrs', () => {
    it('replaces width in rawAttrs', () => {
        expect(rebuildRawAttrs('width=400 inline=false', '600', null)).toBe(
            'width=600 inline=false',
        );
    });

    it('replaces height in rawAttrs', () => {
        expect(rebuildRawAttrs('height=300', null, '500')).toBe('height=500');
    });

    it('adds width if not present', () => {
        expect(rebuildRawAttrs('inline=false', '400', null)).toBe('width=400 inline=false');
    });

    it('adds height if not present', () => {
        expect(rebuildRawAttrs('inline=false', null, '300')).toBe('inline=false height=300');
    });

    it('leaves rawAttrs unchanged when both are null', () => {
        expect(rebuildRawAttrs('inline=false something=value', null, null)).toBe(
            'inline=false something=value',
        );
    });

    it('updates both width and height', () => {
        expect(rebuildRawAttrs('width=400 height=300', '600', '500')).toBe('width=600 height=500');
    });
});
