import type {ExtensionAuto} from '@gravity-ui/markdown-editor';
import type {AttrOp, TextOp} from './types';

import {type EditorState, Plugin, PluginKey} from '@gravity-ui/markdown-editor/pm/state';
import {
    ImgSizeAttr,
    imageNodeName,
} from '@gravity-ui/markdown-editor/extensions/yfm/ImgSize/const.js';

import {findImageMatches} from './matches';
import {matchLeadingAttrs} from './utils';

const FAILED_META = 'image-load-failed';

const key = new PluginKey<Set<string>>('yfmImageReparse');

function buildFixupTransaction(state: EditorState) {
    const imageType = state.schema.nodes[imageNodeName];

    if (!imageType) {
        return null;
    }

    const failed = key.getState(state) ?? new Set<string>();

    const ops: Array<TextOp | AttrOp> = [];

    state.doc.descendants((node, pos, parent, index) => {
        if (node.isText && node.text) {
            if (parent?.type.spec.code || node.marks.some((mark) => mark.type.spec.code)) {
                return;
            }

            for (const match of findImageMatches(node.text, failed)) {
                ops.push({
                    pos: pos + match.index,
                    kind: 'text',
                    from: pos + match.index,
                    to: pos + match.index + match.length,
                    src: match.src,
                    alt: match.alt,
                    width: match.width,
                    height: match.height,
                });
            }
        }

        if (node.type === imageType && parent) {
            const nextIdx = index + 1;

            if (nextIdx < parent.childCount) {
                const nextNode = parent.child(nextIdx);
                const nextPos = pos + node.nodeSize;

                if (nextNode.isText && nextNode.text) {
                    const attrs = matchLeadingAttrs(nextNode.text);

                    if (attrs) {
                        ops.push({
                            pos: nextPos,
                            kind: 'attr',
                            imgPos: pos,
                            textFrom: nextPos,
                            textTo: nextPos + attrs.consumeLength,
                            mergedAttrs: {
                                ...node.attrs,
                                ...(attrs.width === null ? {} : {[ImgSizeAttr.Width]: attrs.width}),
                                ...(attrs.height === null
                                    ? {}
                                    : {[ImgSizeAttr.Height]: attrs.height}),
                            },
                        });
                    }
                }
            }
        }
    });

    if (!ops.length) {
        return null;
    }

    ops.sort((a, b) => b.pos - a.pos);

    let tr = state.tr;

    for (const op of ops) {
        if (op.kind === 'text') {
            tr = tr.replaceWith(
                op.from,
                op.to,
                imageType.create({
                    [ImgSizeAttr.Src]: op.src,
                    [ImgSizeAttr.Alt]: op.alt || null,
                    [ImgSizeAttr.Title]: null,
                    ...(op.width === null ? {} : {[ImgSizeAttr.Width]: op.width}),
                    ...(op.height === null ? {} : {[ImgSizeAttr.Height]: op.height}),
                }),
            );
        } else {
            tr = tr.delete(op.textFrom, op.textTo);
            tr = tr.setNodeMarkup(op.imgPos, undefined, op.mergedAttrs);
        }
    }

    return tr;
}

export const YfmImageReparse: ExtensionAuto = (builder) => {
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
