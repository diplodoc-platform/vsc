import {describe, expect, it} from 'vitest';

import {findImageMatches} from './matches';

describe('findImageMatches', () => {
    it('finds an image markup run', () => {
        const [m] = findImageMatches('![alt](./a.png)', new Set());

        expect(m).toMatchObject({alt: 'alt', src: './a.png', index: 0, length: 15});
    });

    it('finds several runs in one text', () => {
        const matches = findImageMatches('![](a.png) and ![b](c.gif)', new Set());

        expect(matches.map((m) => m.src)).toEqual(['a.png', 'c.gif']);
    });

    it('skips sources known to be broken', () => {
        const matches = findImageMatches('![](./broken.gif)', new Set(['./broken.gif']));

        expect(matches).toHaveLength(0);
    });

    it('still matches a different src while another is broken', () => {
        const matches = findImageMatches('![](./fixed.gif)', new Set(['./broken.gif']));

        expect(matches.map((m) => m.src)).toEqual(['./fixed.gif']);
    });

    it('ignores plain links without the leading !', () => {
        expect(findImageMatches('[text](./page.md)', new Set())).toHaveLength(0);
    });

    it('returns null width, height, rawAttrs when no inline attrs', () => {
        const [m] = findImageMatches('![](./a.png)', new Set());

        expect(m).toMatchObject({width: null, height: null, rawAttrs: null});
    });

    it('captures width and rawAttrs from {width=600}', () => {
        const [m] = findImageMatches('![](./a.png){width=600}', new Set());

        expect(m).toMatchObject({src: './a.png', width: '600', rawAttrs: 'width=600'});
        expect(m.length).toBe('![](./a.png){width=600}'.length);
    });

    it('captures both dimensions', () => {
        const [m] = findImageMatches('![](./a.png){width=400 height=200}', new Set());

        expect(m).toMatchObject({width: '400', height: '200'});
    });

    it('preserves arbitrary attrs in rawAttrs', () => {
        const [m] = findImageMatches('![](./a.png){width=400 inline=false}', new Set());

        expect(m).toMatchObject({
            width: '400',
            rawAttrs: 'width=400 inline=false',
        });
    });

    it('consumes the {attrs} so it is not left as text', () => {
        const [m] = findImageMatches('prefix ![](./a.png){width=400} suffix', new Set());

        expect(m.index).toBe(7);
        expect(m.length).toBe('![](./a.png){width=400}'.length);
    });
});
