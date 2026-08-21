import type {Action, ActionSpec, ExtensionAuto} from '@gravity-ui/markdown-editor';

import {
    yfmCommentAction,
    yfmCommentNodeName,
    yfmCommentNodeType,
    yfmCommentTokenName,
} from './const';
import {yfmCommentPlugin} from './plugin';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace WysiwygEditor {
        interface Actions {
            [yfmCommentAction]: Action;
        }
    }
}

const addYfmComment: ActionSpec = {
    isEnable(state) {
        return state.selection.empty;
    },
    run(state, dispatch) {
        const type = yfmCommentNodeType(state.schema);
        const node = type.create(null, state.schema.text('[//]: # (Comment text)'));

        dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    },
};

export const YfmComment: ExtensionAuto = (builder) => {
    builder
        .configureMd((md) => md.use(yfmCommentPlugin))
        .addNode(yfmCommentNodeName, () => ({
            fromMd: {
                tokenSpec: {
                    name: yfmCommentNodeName,
                    type: 'block' as const,
                    noCloseToken: true,
                },
                tokenName: yfmCommentTokenName,
            },
            spec: {
                content: 'text*',
                group: 'block',
                code: true,
                marks: '',
                selectable: true,
                escapeText: false,
                parseDOM: [
                    {
                        tag: 'div.yfm-comment',
                        preserveWhitespace: 'full' as const,
                    },
                ],
                toDOM() {
                    return ['div', {class: 'yfm-comment'}, ['code', 0]];
                },
            },
            toMd: (state, node) => {
                state.text(node.textContent, false);
                state.closeBlock(node);
            },
        }));

    builder.addAction(yfmCommentAction, () => addYfmComment);
};
