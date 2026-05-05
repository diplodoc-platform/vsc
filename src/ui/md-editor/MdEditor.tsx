import {MarkdownEditorView, wysiwygToolbarConfigs} from '@gravity-ui/markdown-editor';
import {wYfmPageConstructorItemData} from '@gravity-ui/markdown-editor-page-constructor-extension/configs';
import {ThemeProvider, Toaster, ToasterProvider, configure} from '@gravity-ui/uikit';
import {useMemo, useState} from 'react';

import {wYfmIncludeItemData} from '../../extensions/yfm-include/toolbar';
import {ErrorBoundary} from '../error/ErrorBoundary';
import {useVscodeTheme} from '../useVscodeTheme';
import {editorShortcuts, useShortcuts} from '../shortcuts';
import {Header} from '../header/Header';
import {useEditor, vscodeApi} from '../hooks/useEditor';

import styles from './MdEditor.module.scss';

configure({
    lang: (document.documentElement.lang || 'en') as 'ru' | 'en',
});

const toaster = new Toaster();

const {wMathListItem, wMermaidItemData, wYfmHtmlBlockItemData, wToolbarConfigByPreset} =
    wysiwygToolbarConfigs;

const HIDDEN_TOOLBAR_IDS = new Set(['checkbox', 'file', 'underline']);

const yfmBase = wToolbarConfigByPreset.yfm;
const filterToolbar = (item: {id: string}) => !HIDDEN_TOOLBAR_IDS.has(item.id);
const wysiwygToolbarConfig = [
    ...yfmBase
        .slice(0, -1)
        .map((group) => (Array.isArray(group) ? group.filter(filterToolbar) : group)),
    [
        ...yfmBase[yfmBase.length - 1].filter(filterToolbar),
        wMathListItem,
        wMermaidItemData,
        wYfmHtmlBlockItemData,
        wYfmPageConstructorItemData,
        wYfmIncludeItemData,
    ],
];

function MdEditor() {
    const [fileName, setFileName] = useState<string>('');

    const editor = useEditor({setFileName});

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

    useShortcuts(commands, editor);

    return (
        <div className={styles.mdEditor}>
            <Header fileName={fileName} />
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
