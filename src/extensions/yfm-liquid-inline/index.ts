import type {ExtensionAuto} from '@gravity-ui/markdown-editor';

import {yfmLiquidInlineNodeName, yfmLiquidInlinePlugin, yfmLiquidInlineTokenName} from './plugin';

export const YfmLiquidInline: ExtensionAuto = (builder) => {
    builder
        .configureMd((md) => md.use(yfmLiquidInlinePlugin))
        .addNode(yfmLiquidInlineNodeName, () => ({
            fromMd: {
                tokenSpec: {
                    name: yfmLiquidInlineNodeName,
                    type: 'node' as const,
                    noCloseToken: true,
                    getAttrs: (token) => ({content: token.content}),
                },
                tokenName: yfmLiquidInlineTokenName,
            },
            spec: {
                atom: true,
                inline: true,
                group: 'inline',
                attrs: {content: {default: ''}},
                selectable: true,
                parseDOM: [
                    {
                        tag: 'span.yfm-liquid-inline',
                        getAttrs: (dom) => ({content: (dom as HTMLElement).textContent ?? ''}),
                    },
                ],
                toDOM(node) {
                    return [
                        'span',
                        {class: 'yfm-liquid-inline', contenteditable: 'false'},
                        node.attrs.content,
                    ];
                },
            },
            toMd: (state, node) => {
                state.text(node.attrs.content, false);
            },
        }));
};
