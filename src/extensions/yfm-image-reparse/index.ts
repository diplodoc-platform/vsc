import type {ExtensionAuto} from '@gravity-ui/markdown-editor';
import type {Node, NodeType} from '@gravity-ui/markdown-editor/pm/model';
import type {EditorState, Transaction} from '@gravity-ui/markdown-editor/pm/state';

import {Plugin, PluginKey} from '@gravity-ui/markdown-editor/pm/state';
import {
    ImgSizeAttr,
    imageNodeName,
} from '@gravity-ui/markdown-editor/extensions/yfm/ImgSize/const.js';

import {findImageMatches} from './matches';
import {matchLeadingAttrs} from './utils';

const FAILED_META = 'image-load-failed';
const RAW_ATTRS = 'rawAttrs';

const key = new PluginKey<Set<string>>('yfmImageReparse');

type TextOp = {
    pos: number;
    kind: 'text';
    from: number;
    to: number;
    src: string;
    alt: string;
    width: string | null;
    height: string | null;
    rawAttrs: string | null;
};

type AttrOp = {
    pos: number;
    kind: 'attr';
    imgPos: number;
    textFrom: number;
    textTo: number;
    mergedAttrs: Record<string, unknown>;
};

function collectTextOps(
    node: Node,
    pos: number,
    parent: Node | null,
    failed: ReadonlySet<string>,
): TextOp[] {
    if (!node.isText || !node.text) {
        return [];
    }

    if (parent?.type.spec.code || node.marks.some((mark) => mark.type.spec.code)) {
        return [];
    }

    return findImageMatches(node.text, failed).map((match) => ({
        pos: pos + match.index,
        kind: 'text' as const,
        from: pos + match.index,
        to: pos + match.index + match.length,
        src: match.src,
        alt: match.alt,
        width: match.width,
        height: match.height,
        rawAttrs: match.rawAttrs,
    }));
}

function buildAttrOp(
    node: Node,
    pos: number,
    parent: Node | null,
    index: number,
    imageType: NodeType,
): AttrOp | null {
    if (node.type !== imageType || !parent) {
        return null;
    }

    const nextIdx = index + 1;

    if (nextIdx >= parent.childCount) {
        return null;
    }

    const nextNode = parent.child(nextIdx);

    if (!nextNode.isText || !nextNode.text) {
        return null;
    }

    const attrs = matchLeadingAttrs(nextNode.text);

    if (!attrs) {
        return null;
    }

    const nextPos = pos + node.nodeSize;

    return {
        pos: nextPos,
        kind: 'attr',
        imgPos: pos,
        textFrom: nextPos,
        textTo: nextPos + attrs.consumeLength,
        mergedAttrs: {
            ...node.attrs,
            [RAW_ATTRS]: attrs.rawAttrs,
            ...(attrs.width === null ? {} : {[ImgSizeAttr.Width]: attrs.width}),
            ...(attrs.height === null ? {} : {[ImgSizeAttr.Height]: attrs.height}),
        },
    };
}

function applyTextOp(tr: Transaction, imageType: NodeType, op: TextOp): Transaction {
    return tr.replaceWith(
        op.from,
        op.to,
        imageType.create({
            [ImgSizeAttr.Src]: op.src,
            [ImgSizeAttr.Alt]: op.alt || null,
            [ImgSizeAttr.Title]: null,
            [RAW_ATTRS]: op.rawAttrs,
            ...(op.width === null ? {} : {[ImgSizeAttr.Width]: op.width}),
            ...(op.height === null ? {} : {[ImgSizeAttr.Height]: op.height}),
        }),
    );
}

function applyAttrOp(tr: Transaction, op: AttrOp): Transaction {
    return tr.delete(op.textFrom, op.textTo).setNodeMarkup(op.imgPos, undefined, op.mergedAttrs);
}

function buildFixupTransaction(state: EditorState) {
    const imageType = state.schema.nodes[imageNodeName];

    if (!imageType) {
        return null;
    }

    const failed = key.getState(state) ?? new Set<string>();
    const ops: Array<TextOp | AttrOp> = [];

    state.doc.descendants((node, pos, parent, index) => {
        ops.push(...collectTextOps(node, pos, parent, failed));

        const attrOp = buildAttrOp(node, pos, parent, index, imageType);

        if (attrOp) {
            ops.push(attrOp);
        }
    });

    if (!ops.length) {
        return null;
    }

    ops.sort((a, b) => b.pos - a.pos);

    let tr = state.tr;

    for (const op of ops) {
        if (op.kind === 'text') {
            tr = applyTextOp(tr, imageType, op);
        } else {
            tr = applyAttrOp(tr, op);
        }
    }

    return tr;
}

export const YfmImageReparse: ExtensionAuto = (builder) => {
    builder.overrideNodeSpec(imageNodeName, (prev) => ({
        ...prev,
        attrs: {
            ...prev.attrs,
            [RAW_ATTRS]: {default: null},
        },
    }));

    builder.addPlugin(
        () =>
            new Plugin<Set<string>>({
                key,
                state: {
                    init: () => new Set<string>(),
                    apply: (tr, failed) => {
                        const src = tr.getMeta(FAILED_META);

                        if (typeof src === 'string') {
                            const next = new Set(failed);
                            next.add(src);

                            return next;
                        }

                        return failed;
                    },
                },
                view: (editorView) => {
                    const timerId = setTimeout(() => {
                        const tr = buildFixupTransaction(editorView.state);

                        if (tr) {
                            editorView.dispatch(tr);
                        }
                    }, 0);

                    return {
                        destroy() {
                            clearTimeout(timerId);
                        },
                    };
                },
                appendTransaction: (trs, _oldState, newState) => {
                    if (trs.some((tr) => tr.getMeta(FAILED_META))) {
                        return null;
                    }

                    if (!trs.some((tr) => tr.docChanged)) {
                        return null;
                    }

                    return buildFixupTransaction(newState);
                },
            }),
    );
};
