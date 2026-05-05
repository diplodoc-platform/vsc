import type {Action, ActionSpec, ExtensionAuto} from '@gravity-ui/markdown-editor';

import {
    yfmIncludeAction,
    yfmIncludeNodeName,
    yfmIncludeNodeType,
    yfmIncludeTokenName,
} from './const';
import {yfmIncludePlugin} from './plugin';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace WysiwygEditor {
        interface Actions {
            [yfmIncludeAction]: Action;
        }
    }
}

const addYfmInclude: ActionSpec = {
    isEnable(state) {
        return state.selection.empty;
    },
    run(state, dispatch) {
        const type = yfmIncludeNodeType(state.schema);
        const node = type.create(null, state.schema.text('{% include []() %}'));

        dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    },
};

export const YfmInclude: ExtensionAuto = (builder) => {
    builder
        .configureMd((md) => md.use(yfmIncludePlugin))
        .addNode(yfmIncludeNodeName, () => ({
            fromMd: {
                tokenSpec: {
                    name: yfmIncludeNodeName,
                    type: 'block' as const,
                    noCloseToken: true,
                },
                tokenName: yfmIncludeTokenName,
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
                        tag: 'div.yfm-include',
                        preserveWhitespace: 'full' as const,
                    },
                ],
                toDOM() {
                    return ['div', {class: 'yfm-include'}, ['code', 0]];
                },
            },
            toMd: (state, node) => {
                state.text(node.textContent, false);
                state.closeBlock(node);
            },
        }));

    builder.addAction(yfmIncludeAction, () => addYfmInclude);
};
