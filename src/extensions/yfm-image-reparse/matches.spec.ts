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
});
