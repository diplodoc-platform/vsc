import type {ExtensionAuto} from '@gravity-ui/markdown-editor';

import {describe, expect, it} from 'vitest';

import {yfmLiquidInlineNodeName, yfmLiquidInlineTokenName} from './plugin';

import {YfmLiquidInline} from './index';

type ExtensionBuilder = Parameters<ExtensionAuto>[0];

interface MockMd {
    use(plugin: unknown): void;
}

interface LiquidInlineNodeDef {
    fromMd: {
        tokenSpec: {
            name: string;
            type: string;
            noCloseToken: boolean;
            getAttrs: (token: {content: string}) => {content: string};
        };
        tokenName: string;
    };
    spec: {
        parseDOM: Array<{getAttrs: (dom: {textContent: string | null}) => {content: string}}>;
        toDOM: (node: {attrs: {content: string}}) => [string, Record<string, string>, string];
    };
    toMd: (state: MockSerializerState, node: {attrs: {content: string}}) => void;
}

interface MockSerializerState {
    text(str: string, raw?: boolean): void;
}

interface NodeDefResult {
    def: LiquidInlineNodeDef;
    configureMdCb: ((md: MockMd) => void) | undefined;
}

function getNodeDef(): NodeDefResult {
    let def = {} as LiquidInlineNodeDef;
    let configureMdCb: ((md: MockMd) => void) | undefined;

    const builder = {
        configureMd(cb: (md: MockMd) => void) {
            configureMdCb = cb;
            return builder;
        },
        addNode(name: string, cb: () => LiquidInlineNodeDef) {
            if (name === yfmLiquidInlineNodeName) {
                def = cb();
            }
            return builder;
        },
    };

    // eslint-disable-next-line new-cap
    YfmLiquidInline(builder as unknown as ExtensionBuilder);

    return {def, configureMdCb};
}

function getToMd(): LiquidInlineNodeDef['toMd'] {
    return getNodeDef().def.toMd;
}

function makeMockState(): MockSerializerState & {readonly out: string} {
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

describe('YfmLiquidInline node definition', () => {
    it('calls configureMd with the inline plugin', () => {
        const {configureMdCb} = getNodeDef();
        const used: unknown[] = [];
        const md: MockMd = {use: (plugin: unknown) => used.push(plugin)};

        configureMdCb?.(md);

        expect(used).toHaveLength(1);
    });

    it('fromMd.tokenSpec has correct name and tokenName', () => {
        const {def} = getNodeDef();

        expect(def.fromMd.tokenSpec.name).toBe(yfmLiquidInlineNodeName);
        expect(def.fromMd.tokenName).toBe(yfmLiquidInlineTokenName);
    });

    it('getAttrs maps token.content to the content attr', () => {
        const {def} = getNodeDef();
        const {getAttrs} = def.fromMd.tokenSpec;

        expect(getAttrs({content: '{% if x %}'})).toEqual({content: '{% if x %}'});
    });

    it('parseDOM.getAttrs reads textContent from the DOM element', () => {
        const {def} = getNodeDef();
        const {getAttrs} = def.spec.parseDOM[0];

        expect(getAttrs({textContent: '{% endif %}'})).toEqual({content: '{% endif %}'});
        expect(getAttrs({textContent: null})).toEqual({content: ''});
    });

    it('toDOM returns a span with the node content as the text child', () => {
        const {def} = getNodeDef();
        const result = def.spec.toDOM({attrs: {content: '{% else %}'}});

        expect(result[0]).toBe('span');
        expect(result[2]).toBe('{% else %}');
    });
});

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
