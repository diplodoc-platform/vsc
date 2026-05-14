import type {ExtensionAuto, SerializerNodeToken} from '@gravity-ui/markdown-editor';

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

export const YfmSerializer: ExtensionAuto = (builder) => {
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
