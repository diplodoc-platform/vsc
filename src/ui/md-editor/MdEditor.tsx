import {MarkdownEditorView, wysiwygToolbarConfigs} from '@gravity-ui/markdown-editor';
import {wYfmPageConstructorItemData} from '@gravity-ui/markdown-editor-page-constructor-extension/configs';
import {ThemeProvider, Toaster, ToasterProvider, configure} from '@gravity-ui/uikit';
import {useMemo, useState} from 'react';

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

const {wMathListItem, wMermaidItemData, wToolbarConfigByPreset} = wysiwygToolbarConfigs;
const yfmBase = wToolbarConfigByPreset.yfm;
const wysiwygToolbarConfig = [
    ...yfmBase.slice(0, -1),
    [...yfmBase[yfmBase.length - 1], wMathListItem, wMermaidItemData, wYfmPageConstructorItemData],
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
