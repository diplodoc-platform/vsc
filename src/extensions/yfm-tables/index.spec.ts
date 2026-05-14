import {describe, expect, it, vi} from 'vitest';

import {YfmTables} from './index';

interface MockNode {
    type: {name: string};
    attrs: Record<string, unknown>;
    textContent: string;
    childCount: number;
    firstChild: MockNode | null;
    content: {content: MockNode[]};
    forEach: (fn: (child: MockNode, offset: number, index: number) => void) => void;
    isTextblock: boolean;
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
        renderContent: vi.fn(),
        closeBlock: vi.fn(),
        setNoAutoBlank: vi.fn(),
        unsetNoAutoBlank: vi.fn(),
    };
}

function makeNode(
    type: string,
    children: MockNode[] = [],
    attrs: Record<string, unknown> = {},
): MockNode {
    return {
        type: {name: type},
        attrs,
        textContent: children.map((c) => c.textContent).join(''),
        childCount: children.length,
        firstChild: children[0] ?? null,
        content: {content: children},
        forEach(fn: (child: MockNode, offset: number, index: number) => void) {
            children.forEach((c, i) => fn(c, 0, i));
        },
        isTextblock: type === 'paragraph',
    };
}

function makeParagraph(text: string): MockNode {
    const node = makeNode('paragraph');

    node.textContent = text;
    node.childCount = text ? 1 : 0;
    node.firstChild = text ? ({textContent: text} as MockNode) : null;

    return node;
}

function makeCell(text: string): MockNode {
    return makeNode('yfm_td', [makeParagraph(text)]);
}

function makeRow(cells: MockNode[]): MockNode {
    return makeNode('yfm_tr', cells);
}

function makeTbody(rows: MockNode[]): MockNode {
    return makeNode('yfm_tbody', rows);
}

describe('YfmTables', () => {
    it('registers yfm_tbody and table overrides', () => {
        const overrides: string[] = [];
        const builder = {
            overrideNodeSerializerSpec(name: string) {
                overrides.push(name);
                return builder;
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
        YfmTables(builder as any);

        expect(overrides).toContain('yfm_tbody');
        expect(overrides).toContain('table');
    });
});

describe('yfm_tbody compact serializer', () => {
    function getSerializer() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fn: (...args: any[]) => void = () => {};
        const builder = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrideNodeSerializerSpec(name: string, cb: any) {
                if (name === 'yfm_tbody') {
                    fn = cb(() => {});
                }

                return builder;
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, new-cap
        YfmTables(builder as any);

        return fn;
    }

    it('produces compact format for simple table', () => {
        const serialize = getSerializer();
        const state = makeMockState();
        const tbody = makeTbody([
            makeRow([makeCell('A'), makeCell('B')]),
            makeRow([makeCell('C'), makeCell('D')]),
        ]);

        serialize(state, tbody, {}, 0);

        expect(state.out).toBe('|| A | B ||\n|| C | D ||\n');
    });

    it('preserves space for empty cells', () => {
        const serialize = getSerializer();
        const state = makeMockState();
        const tbody = makeTbody([makeRow([makeCell(''), makeCell('')])]);

        serialize(state, tbody, {}, 0);

        expect(state.out).toBe('|| | ||\n');
    });

    it('handles single-cell rows', () => {
        const serialize = getSerializer();
        const state = makeMockState();
        const tbody = makeTbody([makeRow([makeCell('Only')])]);

        serialize(state, tbody, {}, 0);

        expect(state.out).toBe('|| Only ||\n');
    });
});
