import type {ExtensionAuto} from '@gravity-ui/markdown-editor';

import {yfmDirectiveNodeName, yfmDirectiveTokenName} from './const';
import {yfmDirectivePlugin} from './plugin';

export const YfmDirective: ExtensionAuto = (builder) => {
    builder
        .configureMd((md) => md.use(yfmDirectivePlugin))
        .addNode(yfmDirectiveNodeName, () => ({
            fromMd: {
                tokenSpec: {
                    name: yfmDirectiveNodeName,
                    type: 'block' as const,
                    noCloseToken: true,
                    getAttrs: (token) => ({directiveName: token.info}),
                },
                tokenName: yfmDirectiveTokenName,
            },
            spec: {
                attrs: {directiveName: {default: ''}},
                content: 'text*',
                group: 'block',
                code: true,
                marks: '',
                selectable: true,
                escapeText: false,
                parseDOM: [
                    {
                        tag: 'div.yfm-directive',
                        preserveWhitespace: 'full' as const,
                        getAttrs: (dom) => ({
                            directiveName: (dom as HTMLElement).dataset.directive ?? '',
                        }),
                    },
                ],
                toDOM(node) {
                    return [
                        'div',
                        {class: 'yfm-directive', 'data-directive': node.attrs.directiveName},
                        ['code', 0],
                    ];
                },
            },
            toMd: (state, node) => {
                state.write(`::: ${node.attrs.directiveName}\n`);
                state.text(node.textContent, false);
                state.write('\n:::');
                state.closeBlock(node);
            },
        }));
};
