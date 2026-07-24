import type {ExtensionAuto} from '@gravity-ui/markdown-editor';

import {Plugin, PluginKey} from '@gravity-ui/markdown-editor/pm/state';
import {
    ImgSizeAttr,
    imageNodeName,
} from '@gravity-ui/markdown-editor/extensions/yfm/ImgSize/const.js';

import {findImageMatches} from './matches';

const FAILED_META = 'image-load-failed';

const key = new PluginKey<Set<string>>('yfmImageReparse');

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
                filterTransaction: (tr) => tr.getMeta(FAILED_META) === undefined,
                appendTransaction: (trs, _oldState, newState) => {
                    if (trs.some((tr) => tr.getMeta(FAILED_META))) {
                        return null;
                    }
                    if (!trs.some((tr) => tr.docChanged)) {
                        return null;
                    }

                    const imageType = newState.schema.nodes[imageNodeName];
                    if (!imageType) {
                        return null;
                    }

                    const failed = key.getState(newState) ?? new Set<string>();
                    const replacements: {from: number; to: number; alt: string; src: string}[] = [];

                    newState.doc.descendants((textNode, pos) => {
                        if (!textNode.isText || !textNode.text) {
                            return;
                        }

                        for (const match of findImageMatches(textNode.text, failed)) {
                            replacements.push({
                                from: pos + match.index,
                                to: pos + match.index + match.length,
                                alt: match.alt,
                                src: match.src,
                            });
                        }
                    });

                    if (!replacements.length) {
                        return null;
                    }

                    let tr = newState.tr;
                    for (const {from, to, alt, src} of replacements.reverse()) {
                        tr = tr.replaceWith(
                            from,
                            to,
                            imageType.create({
                                [ImgSizeAttr.Src]: src,
                                [ImgSizeAttr.Alt]: alt || null,
                                [ImgSizeAttr.Title]: null,
                            }),
                        );
                    }

                    return tr;
                },
            }),
    );
};
