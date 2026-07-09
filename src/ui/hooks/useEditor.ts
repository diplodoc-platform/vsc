import type {MarkdownEditorMode, MarkdownEditorPreset} from '@gravity-ui/markdown-editor';

import {useMarkdownEditor, wysiwygToolbarConfigs} from '@gravity-ui/markdown-editor';
import {useEffect, useMemo, useRef} from 'react';
import {Color, colorMarkName} from '@gravity-ui/markdown-editor/extensions/yfm/Color/index.js';
import {Math as MathExtension} from '@gravity-ui/markdown-editor/extensions/additional/Math/index.js';
import {Mermaid as MermaidExtension} from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
import {YfmHtmlBlock} from '@gravity-ui/markdown-editor/extensions/additional/YfmHtmlBlock/index.js';
import {YfmPageConstructorExtension} from '@gravity-ui/markdown-editor-page-constructor-extension';
import {wYfmPageConstructorItemData} from '@gravity-ui/markdown-editor-page-constructor-extension/configs';

import {YfmInclude} from '../../extensions/yfm-include';
import {wYfmIncludeItemData} from '../../extensions/yfm-include/toolbar';
import {YfmFrontmatter} from '../../extensions/yfm-frontmatter';
import {YfmDirective} from '../../extensions/yfm-directive';
import {YfmTables} from '../../extensions/yfm-tables';
import {YfmSerializer} from '../../extensions/yfm-serializer';
import {isTrustedOrigin} from '../utils';
import {debounce} from '../../utils';

interface EditorParams {
    setFileName: (name: string) => void;
    preset?: MarkdownEditorPreset;
    mode?: MarkdownEditorMode;
}

declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
};

export const vscodeApi = acquireVsCodeApi();

const {
    wMathInlineItemData,
    wMathBlockItemData,
    wMermaidItemData,
    wYfmHtmlBlockItemData,
    wCommandMenuConfigByPreset,
} = wysiwygToolbarConfigs;

const HIDDEN_COMMAND_MENU_IDS = new Set(['checkbox', 'file']);

const commandMenuActions = [
    ...wCommandMenuConfigByPreset.yfm.filter((item) => !HIDDEN_COMMAND_MENU_IDS.has(item.id)),
    wMathInlineItemData,
    wMathBlockItemData,
    wMermaidItemData,
    wYfmPageConstructorItemData,
    wYfmHtmlBlockItemData,
    wYfmIncludeItemData,
];

export function useEditor({setFileName, preset, mode}: EditorParams) {
    const isSettingContent = useRef<boolean>(false);
    const lastContent = useRef<string>('');

    const editor = useMarkdownEditor({
        preset: preset ?? 'yfm',
        md: {
            html: true,
        },
        initial: {
            mode: mode ?? 'wysiwyg',
        },
        wysiwygConfig: {
            escapeConfig: {
                commonEscape: /.^/,
                startOfLineEscape: /.^/,
            },
            extensions: (builder) => {
                builder.use(Color);
                builder.overrideMarkSpec(colorMarkName, (prev) => ({
                    ...prev,
                    toDOM(mark) {
                        const color = mark.attrs[colorMarkName];

                        return ['span', {style: `color: ${color};`, 'data-color': color}, 0];
                    },
                }));
                builder.use(MathExtension, {
                    loadRuntimeScript: () => {
                        import('@diplodoc/latex-extension/runtime');
                        import('@diplodoc/latex-extension/runtime/styles');
                    },
                });
                builder.use(MermaidExtension, {
                    loadRuntimeScript: () => {
                        import('@diplodoc/mermaid-extension/runtime');
                    },
                });
                builder.use(YfmPageConstructorExtension, {
                    transformerOptions: {
                        lang: (document.documentElement.lang || 'en') as 'en',
                    },
                });
                builder.use(YfmHtmlBlock, {});
                builder.use(YfmInclude);
                builder.use(YfmFrontmatter);
                builder.use(YfmDirective);
                builder.use(YfmTables);
                builder.use(YfmSerializer);
                builder.overrideNodeSpec('paragraph', (prev) => ({
                    ...prev,
                    attrs: {...prev.attrs, id: {default: null}},
                }));
                builder.overrideNodeSerializerSpec(
                    'paragraph',
                    (prev) => (state, node, parent, index) => {
                        prev(state, node, parent, index);

                        const id = node.attrs?.id;

                        if (id && typeof id === 'string') {
                            if (state.out.endsWith('\n')) {
                                state.out = state.out.slice(0, -1) + ` {#${id}}\n`;
                            } else {
                                state.out += ` {#${id}}`;
                            }
                        }
                    },
                );
            },
            extensionOptions: {
                commandMenu: {
                    actions: commandMenuActions,
                },
            },
        },
    });

    const sendChange = useMemo(
        () =>
            debounce(() => {
                if (isSettingContent.current) {
                    return;
                }

                const value = editor.getValue();

                if (value === lastContent.current) {
                    return;
                }

                lastContent.current = value;
                vscodeApi.postMessage({command: 'change', text: value});
            }, 300),
        [editor],
    );

    useEffect(() => {
        editor.on('change', sendChange);

        return () => editor.off('change', sendChange);
    }, [editor, sendChange]);

    useEffect(() => {
        function onMessage(event: MessageEvent) {
            if (!isTrustedOrigin(event.origin)) {
                return;
            }

            const {command, text, fileName: name, mode} = event.data ?? {};

            if (command === 'setContent') {
                setFileName(name ?? '');
                isSettingContent.current = true;
                editor.replace(text ?? '');
                setTimeout(() => {
                    isSettingContent.current = false;
                    lastContent.current = editor.getValue();
                }, 350);
            } else if (command === 'setMode' && mode) {
                editor.setEditorMode(mode);
            }
        }

        window.addEventListener('message', onMessage);
        vscodeApi.postMessage({command: 'ready'});

        return () => window.removeEventListener('message', onMessage);
    }, [editor]);

    return editor;
}
