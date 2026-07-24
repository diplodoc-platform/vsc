import {describe, expect, it} from 'vitest';

import {yfmLiquidInlineNodeName} from './plugin';

import {YfmLiquidInline} from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToMd(): (...args: any[]) => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let toMd: (...args: any[]) => void = () => {};
    const builder = {
        configureMd() {
            return builder;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        addNode(name: string, cb: () => any) {
            if (name === yfmLiquidInlineNodeName) {
                toMd = cb().toMd;
            }
            return builder;
        },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
    YfmLiquidInline(builder as any);

    return toMd;
}

function makeMockState() {
    let out = '';
    return {
        get out() {
            return out;
        },
        text(str: string) {
            out += str;
        },
    };
}

describe('YfmLiquidInline serializer', () => {
    it('serializes the node back to its exact source text', () => {
        const toMd = getToMd();
        const state = makeMockState();

        toMd(state, {attrs: {content: '{% endif %}'}});

        expect(state.out).toBe('{% endif %}');
    });

    it('does not escape special characters', () => {
        const toMd = getToMd();
        const state = makeMockState();

        toMd(state, {attrs: {content: "{% if a == 'x' %}"}});

        expect(state.out).toBe("{% if a == 'x' %}");
    });
});
