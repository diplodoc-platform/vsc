import type {ExtensionAuto, SerializerNodeToken} from '@gravity-ui/markdown-editor';

import {rebuildRawAttrs} from '../yfm-image-reparse/utils';

type State = Parameters<SerializerNodeToken>[0];
type PMNode = Parameters<SerializerNodeToken>[1];

function hasContent(node: PMNode): boolean {
    return node.nodeSize > 2;
}

function isNodeEmpty(node: PMNode): boolean {
    let empty = true;

    node.descendants((n) => {
        if (n.isText && n.textContent) {
            empty = false;
        }
        if (n.isAtom) {
            empty = false;
        }

        return empty;
    });

    return empty;
}

function tabsOpener(variant: '' | ' radio'): (state: State, node: PMNode) => void {
    return (state, node) => {
        const group = node.attrs['data-diplodoc-group'] as string | undefined;
        const groupSuffix = group && group !== 'unknown' ? ` group=${group}` : '';

        state.write(`{% list tabs${variant}${groupSuffix} %}`);
    };
}

export const YfmSerializer: ExtensionAuto = (builder) => {
    builder.overrideNodeSerializerSpec('bullet_list', () => (state, node) => {
        state.renderList(node, '  ', () => '- ');
    });

    builder.overrideNodeSerializerSpec('image', () => (state, node) => {
        const attrs = node.attrs as Record<string, string | null>;
        let result = '![';

        if (attrs.alt) {
            result += state.esc(attrs.alt);
        }

        result += '](';

        if (attrs.src) {
            result += attrs.src;
        }

        if (attrs.title) {
            const quote = (state as unknown as {quote(s: string): string}).quote;
            result += ` ${quote(attrs.title)}`;
        }

        if (attrs.rawAttrs) {
            const rebuilt = rebuildRawAttrs(attrs.rawAttrs, attrs.width, attrs.height);

            result += ')';

            if (rebuilt) {
                result += `{${rebuilt}}`;
            }
        } else {
            if (attrs.width || attrs.height) {
                result += ` =${attrs.width || ''}x${attrs.height || ''}`;
            }
            result += ')';
        }

        state.write(result);
    });

    builder.overrideNodeSerializerSpec('yfm_note_title', (prev) => (state, node, parent, index) => {
        if (hasContent(node)) {
            prev(state, node, parent, index);
            return;
        }

        serializeEmptyNoteTitle(state, parent);
    });

    builder.overrideNodeSerializerSpec('yfm_cut_title', (prev) => (state, node, parent, index) => {
        if (hasContent(node)) {
            prev(state, node, parent, index);
            return;
        }

        const markup = parent.attrs['data-markup'];

        if (typeof markup === 'string' && markup.startsWith(':')) {
            serializeEmptyDirectiveCutTitle(state);
            return;
        }

        serializeEmptyCutTitle(state);
    });

    builder.overrideNodeSerializerSpec(
        'yfm_note_content',
        (prev) => (state, node, parent, index) => {
            if (!isNodeEmpty(node)) {
                prev(state, node, parent, index);
                return;
            }

            state.write('\n');
        },
    );

    builder.overrideNodeSerializerSpec(
        'yfm_cut_content',
        (prev) => (state, node, parent, index) => {
            if (!isNodeEmpty(node)) {
                prev(state, node, parent, index);
                return;
            }

            state.write('\n');
        },
    );

    builder.overrideNodeSerializerSpec('yfm_tabs', (_prev) => (state, node) => {
        tabsOpener('')(state, node);
        state.write('\n');
        state.write('\n');

        const children: PMNode[] = [];
        node.content.forEach((a) => {
            children.push(a);
        });

        const tabList = children[0].content;
        tabList.forEach((tab: PMNode, _: number, i: number) => {
            state.write('- ' + (tab.textContent || ''));
            state.write('\n');
            state.write('\n');

            if (children[i + 1]) {
                state.renderList(children[i + 1], '  ', () => '  ');
            }
        });

        state.write('{% endlist %}');
        state.closeBlock(node);
    });

    builder.overrideNodeSerializerSpec('yfm_radio_tabs', (_prev) => (state, node) => {
        tabsOpener(' radio')(state, node);
        state.write('\n');
        state.write('\n');

        const children: {node: PMNode}[] = [];
        node.content.forEach((child) => {
            children.push({node: child});
        });

        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            if (child.node.type.name !== 'yfm_radio_tab') {
                continue;
            }

            state.write('- ' + (child.node.textContent || ''));
            state.write('\n');
            state.write('\n');

            const nextChild = children[i + 1];

            if (nextChild?.node.type.name === 'yfm_tab_panel') {
                state.renderList(nextChild.node, '  ', () => '  ');
            }
        }

        state.write('{% endlist %}');
        state.closeBlock(node);
    });
};

function serializeEmptyNoteTitle(state: State, parent: PMNode): void {
    const type = parent.attrs['note-type'] ?? 'info';

    state.write(`{% note ${type} "" %}\n`);
    state.write('\n');
    state.closeBlock();
}

function serializeEmptyCutTitle(state: State): void {
    state.write('{% cut "" %}\n');
    state.write('\n');
    state.closeBlock();
}

function serializeEmptyDirectiveCutTitle(state: State): void {
    state.write(':::cut []');
    state.ensureNewLine();
    state.closeBlock();
}
