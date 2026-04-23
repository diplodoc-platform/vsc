import {
    MarkdownEditorView,
    useMarkdownEditor,
    wysiwygToolbarConfigs,
} from '@gravity-ui/markdown-editor';
import {Math as MathExtension} from '@gravity-ui/markdown-editor/extensions/additional/Math/index.js';
import {Mermaid as MermaidExtension} from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
import {ThemeProvider, Toaster, ToasterProvider, configure} from '@gravity-ui/uikit';
import {useEffect, useMemo, useRef, useState} from 'react';

import {YfmFrontmatter} from '../../extensions/yfm-frontmatter';
import {YfmInclude} from '../../extensions/yfm-include';
import {debounce} from '../utils';
import {ErrorBoundary} from '../error/ErrorBoundary';
import {useVscodeTheme} from '../useVscodeTheme';
import {editorShortcuts, useShortcuts} from '../shortcuts';

import styles from './MdEditor.module.scss';

configure({
    lang: (document.documentElement.lang || 'en') as 'ru' | 'en',
});

const toaster = new Toaster();

declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
};

const vscodeApi = acquireVsCodeApi();

const {
    wMathInlineItemData,
    wMathBlockItemData,
    wMathListItem,
    wMermaidItemData,
    wToolbarConfigByPreset,
    wCommandMenuConfigByPreset,
} = wysiwygToolbarConfigs;

const yfmBase = wToolbarConfigByPreset.yfm;
const wysiwygToolbarConfig = [
    ...yfmBase.slice(0, -1),
    [...yfmBase[yfmBase.length - 1], wMathListItem, wMermaidItemData],
];

const commandMenuActions = [
    ...wCommandMenuConfigByPreset.yfm,
    wMathInlineItemData,
    wMathBlockItemData,
    wMermaidItemData,
];

function MdEditor() {
    const [fileName, setFileName] = useState<string>('');
    const isSettingContent = useRef(false);

    const editor = useMarkdownEditor({
        preset: 'yfm',
        initial: {mode: 'wysiwyg'},
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
                builder.use(YfmInclude);
                builder.use(YfmFrontmatter);
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

    const commands = useMemo(
        () => [
            ...editorShortcuts,
            {
                action: 'save',
                key: 's',
                cmdOrCtrl: true,
                handler: () => vscodeApi.postMessage({command: 'save', text: editor.getValue()}),
            },
        ],
        [editor],
    );

    useShortcuts(editor, commands);

    return (
        <div className={styles.mdEditor}>
            {fileName && (
                <div className={styles.header}>
                    <span className={styles.headerIcon}>📄</span>
                    {fileName}
                </div>
            )}
            <div className={styles.content}>
                <MarkdownEditorView
                    stickyToolbar
                    autofocus
                    editor={editor}
                    wysiwygToolbarConfig={wysiwygToolbarConfig}
                />
            </div>
        </div>
    );
}

export function App() {
    const theme = useVscodeTheme();

    return (
        <ThemeProvider theme={theme}>
            <ToasterProvider toaster={toaster}>
                <ErrorBoundary>
                    <MdEditor />
                </ErrorBoundary>
            </ToasterProvider>
        </ThemeProvider>
    );
}
