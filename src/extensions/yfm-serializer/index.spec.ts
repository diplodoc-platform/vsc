import {describe, expect, it, vi} from 'vitest';

import {YfmSerializer} from './index';

interface MockNode {
    type: {name: string};
    attrs: Record<string, unknown>;
    textContent: string;
    nodeSize: number;
    isText?: boolean;
    isAtom?: boolean;
    content?: {size: number};
    descendants?: (fn: (node: MockNode) => boolean) => void;
}

function makeMockState() {
    let out = '';

    return {
        get out() {
            return out;
        },
        set out(value: string) {
            out = value;
        },
        write(text: string) {
            out += text;
        },
        ensureNewLine() {
            if (out.length && !out.endsWith('\n')) {
                out += '\n';
            }
        },
        renderInline(node: MockNode) {
            out += node.textContent;
        },
        closeBlock: vi.fn(),
    };
}

function makeNode(attrs: Record<string, unknown> = {}, text = '', nodeSize?: number): MockNode {
    return {
        type: {name: 'mock'},
        attrs,
        textContent: text,
        nodeSize: nodeSize ?? (text ? 2 + text.length : 2),
        isText: false,
        isAtom: false,
        content: {size: text ? text.length : 0},
        descendants(fn: (node: MockNode) => boolean) {
            if (text) {
                fn({
                    type: {name: 'text'},
                    attrs: {},
                    textContent: text,
                    nodeSize: text.length,
                    isText: true,
                    isAtom: false,
                } as MockNode);
            }
        },
    };
}

function makeEmptyContentNode(): MockNode {
    return {
        type: {name: 'mock'},
        attrs: {},
        textContent: '',
        nodeSize: 4,
        isText: false,
        isAtom: false,
        content: {size: 0},
        descendants(fn: (node: MockNode) => boolean) {
            fn({
                type: {name: 'paragraph'},
                attrs: {},
                textContent: '',
                nodeSize: 2,
                isText: false,
                isAtom: false,
                content: {size: 0},
            } as MockNode);
        },
    };
}

function makeContentNode(text: string): MockNode {
    return {
        type: {name: 'mock'},
        attrs: {},
        textContent: text,
        nodeSize: 4 + text.length,
        isText: false,
        isAtom: false,
        content: {size: text.length + 2},
        descendants(fn: (node: MockNode) => boolean) {
            fn({
                type: {name: 'text'},
                attrs: {},
                textContent: text,
                nodeSize: text.length,
                isText: true,
                isAtom: false,
            } as MockNode);
        },
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSerializer(nodeName: string): (...args: any[]) => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fn: (...args: any[]) => void = () => {};
    const builder = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overrideNodeSerializerSpec(name: string, cb: any) {
            if (name === nodeName) {
                fn = cb(() => {
                    throw new Error('prev should not be called for empty nodes');
                });
            }

            return builder;
        },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
    YfmSerializer(builder as any);

    return fn;
}

describe('YfmSerializer', () => {
    it('registers all overrides', () => {
        const overrides: string[] = [];
        const builder = {
            overrideNodeSerializerSpec(name: string) {
                overrides.push(name);
                return builder;
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
        YfmSerializer(builder as any);

        expect(overrides).toContain('yfm_note_title');
        expect(overrides).toContain('yfm_cut_title');
        expect(overrides).toContain('yfm_note_content');
        expect(overrides).toContain('yfm_cut_content');
    });
});

describe('yfm_note_title serializer fix', () => {
    const serialize = getSerializer('yfm_note_title');

    it('writes empty quotes for empty note title', () => {
        const state = makeMockState();
        const node = makeNode({}, '');
        const parent = makeNode({'note-type': 'info'});

        serialize(state, node, parent, 0);

        expect(state.out).toBe('{% note info "" %}\n\n');
    });

    it('preserves note type in empty title output', () => {
        const state = makeMockState();
        const node = makeNode({}, '');
        const parent = makeNode({'note-type': 'warning'});

        serialize(state, node, parent, 0);

        expect(state.out).toBe('{% note warning "" %}\n\n');
    });

    it('calls prev for non-empty note title', () => {
        const prevCalled = {value: false};
        const builder = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrideNodeSerializerSpec(name: string, cb: any) {
                if (name === 'yfm_note_title') {
                    const fn = cb(() => {
                        prevCalled.value = true;
                    });

                    fn({}, makeNode({}, 'My title', 10), makeNode({'note-type': 'info'}), 0);
                }

                return builder;
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
        YfmSerializer(builder as any);

        expect(prevCalled.value).toBe(true);
    });
});

describe('yfm_cut_title serializer fix', () => {
    const serialize = getSerializer('yfm_cut_title');

    it('writes empty quotes for empty cut title with tag syntax', () => {
        const state = makeMockState();
        const node = makeNode({}, '');
        const parent = makeNode({'data-markup': '{%'});

        serialize(state, node, parent, 0);

        expect(state.out).toBe('{% cut "" %}\n\n');
    });

    it('writes empty brackets for empty cut title with directive syntax', () => {
        const state = makeMockState();
        const node = makeNode({}, '');
        const parent = makeNode({'data-markup': ':::'});

        serialize(state, node, parent, 0);

        expect(state.out).toBe(':::cut []\n');
    });

    it('calls prev for non-empty cut title', () => {
        const prevCalled = {value: false};
        const builder = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrideNodeSerializerSpec(name: string, cb: any) {
                if (name === 'yfm_cut_title') {
                    const fn = cb(() => {
                        prevCalled.value = true;
                    });

                    fn({}, makeNode({}, 'Click me', 12), makeNode({'data-markup': '{%'}), 0);
                }

                return builder;
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
        YfmSerializer(builder as any);

        expect(prevCalled.value).toBe(true);
    });
});

describe('yfm_note_content serializer fix', () => {
    const serialize = getSerializer('yfm_note_content');

    it('does not substitute placeholder for empty content', () => {
        const state = makeMockState();

        serialize(state, makeEmptyContentNode(), makeNode(), 0);

        expect(state.out).toBe('\n');
        expect(state.out).not.toContain('Note content');
    });

    it('calls prev for non-empty content', () => {
        const prevCalled = {value: false};
        const builder = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrideNodeSerializerSpec(name: string, cb: any) {
                if (name === 'yfm_note_content') {
                    const fn = cb(() => {
                        prevCalled.value = true;
                    });

                    fn({}, makeContentNode('Some text'), makeNode(), 0);
                }

                return builder;
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
        YfmSerializer(builder as any);

        expect(prevCalled.value).toBe(true);
    });
});

describe('yfm_cut_content serializer fix', () => {
    const serialize = getSerializer('yfm_cut_content');

    it('does not substitute placeholder for empty content', () => {
        const state = makeMockState();

        serialize(state, makeEmptyContentNode(), makeNode(), 0);

        expect(state.out).toBe('\n');
        expect(state.out).not.toContain('Cut');
    });
});
