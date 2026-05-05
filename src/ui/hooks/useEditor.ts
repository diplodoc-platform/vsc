import type {MarkdownEditorMode, MarkdownEditorPreset} from '@gravity-ui/markdown-editor';

import {useMarkdownEditor, wysiwygToolbarConfigs} from '@gravity-ui/markdown-editor';
import {useEffect, useMemo, useRef} from 'react';
import {Math as MathExtension} from '@gravity-ui/markdown-editor/extensions/additional/Math/index.js';
import {Mermaid as MermaidExtension} from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
import {YfmHtmlBlock} from '@gravity-ui/markdown-editor/extensions/additional/YfmHtmlBlock/index.js';
import {YfmPageConstructorExtension} from '@gravity-ui/markdown-editor-page-constructor-extension';
import {wYfmPageConstructorItemData} from '@gravity-ui/markdown-editor-page-constructor-extension/configs';

import {YfmInclude} from '../../extensions/yfm-include';
import {YfmFrontmatter} from '../../extensions/yfm-frontmatter';
import {YfmDirective} from '../../extensions/yfm-directive';
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
];

export function useEditor({setFileName, preset, mode}: EditorParams) {
    const isSettingContent = useRef<boolean>(false);

    const editor = useMarkdownEditor({
        preset: preset ?? 'yfm',
        md: {
            html: true,
        },
        initial: {
            mode: mode ?? 'wysiwyg',
        },
        wysiwygConfig: {
            extensions: (builder) => {
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
                builder.use(YfmPageConstructorExtension, {});
                builder.use(YfmHtmlBlock, {});
                builder.use(YfmInclude);
                builder.use(YfmFrontmatter);
                builder.use(YfmDirective);
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

                vscodeApi.postMessage({command: 'change', text: editor.getValue()});
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
