import {MarkdownEditorView} from '@gravity-ui/markdown-editor';
import {ThemeProvider, Toaster, ToasterProvider, configure} from '@gravity-ui/uikit';
import {useMemo, useState} from 'react';

import {ErrorBoundary} from '../error/ErrorBoundary';
import {useVscodeTheme} from '../useVscodeTheme';
import {Header} from '../header/Header';
import {useShortcuts} from '../shortcuts';
import {useEditor, vscodeApi} from '../hooks/useEditor';

import styles from './TocEditor.module.scss';

configure({
    lang: (document.documentElement.lang || 'en') as 'ru' | 'en',
});

const toaster = new Toaster();

function TocEditor() {
    const [fileName, setFileName] = useState<string>('');

    const editor = useEditor({
        setFileName,
        mode: 'markup',
    });

    const commands = useMemo(
        () => [
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
        <div className={styles.tocEditor}>
            <Header fileName={fileName} />
            <div className={styles.content}>
                <MarkdownEditorView stickyToolbar autofocus editor={editor} />
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
                    <TocEditor />
                </ErrorBoundary>
            </ToasterProvider>
        </ThemeProvider>
    );
}
