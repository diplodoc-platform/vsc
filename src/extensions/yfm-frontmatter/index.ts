import type {Action, ActionSpec, ExtensionAuto} from '@gravity-ui/markdown-editor';

import {
    yfmFrontmatterAction,
    yfmFrontmatterNodeName,
    yfmFrontmatterNodeType,
    yfmFrontmatterTokenName,
} from './const';
import {yfmFrontmatterPlugin} from './plugin';

declare global {
    interface WysiwygEditorActions {
        [yfmFrontmatterAction]: Action;
    }
}

const addFrontmatter: ActionSpec = {
    isEnable(state) {
        let hasFrontmatter = false;

        state.doc.forEach((node) => {
            if (node.type.name === yfmFrontmatterNodeName) {
                hasFrontmatter = true;
            }
        });

        return !hasFrontmatter;
    },
    run(state, dispatch) {
        const type = yfmFrontmatterNodeType(state.schema);
        const node = type.create(null);

        dispatch(state.tr.insert(0, node).scrollIntoView());
    },
};

export const YfmFrontmatter: ExtensionAuto = (builder) => {
    builder
        .configureMd((md) => md.use(yfmFrontmatterPlugin))
        .addNode(yfmFrontmatterNodeName, () => ({
            fromMd: {
                tokenSpec: {
                    name: yfmFrontmatterNodeName,
                    type: 'block' as const,
                    noCloseToken: true,
                },
                tokenName: yfmFrontmatterTokenName,
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
                        tag: 'pre.yfm-frontmatter',
                        preserveWhitespace: 'full' as const,
                    },
                ],
                toDOM() {
                    return ['pre', {class: 'yfm-frontmatter'}, ['code', 0]];
                },
            },
            toMd: (state, node) => {
                state.write('---\n');
                state.text(node.textContent, false);
                state.write('\n---');
                state.closeBlock(node);
            },
        }));

    builder.addAction(yfmFrontmatterAction, () => addFrontmatter);
};
