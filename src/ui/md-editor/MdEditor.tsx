import {useMarkdownEditor, MarkdownEditorView} from '@gravity-ui/markdown-editor';
import {configure, ThemeProvider, ToasterProvider, Toaster} from '@gravity-ui/uikit';
import styles from './MdEditor.module.scss';
import {t} from '../../i18n';
import {Component, ReactNode, useEffect, useMemo, useRef, useState} from 'react';
import {debounce} from './utils';

import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import '@gravity-ui/markdown-editor/styles/styles.css';

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

class ErrorBoundary extends Component<
    {children: ReactNode},
    {error: Error | null}
> {
    state = {error: null};

    static getDerivedStateFromError(error: Error) {
        return {error};
    }

    render() {
        if (this.state.error) {
            return (
                <div className={styles.error}>
                    <b>{t('editor.error')}:</b>
                    <pre>{String(this.state.error)}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

function MdEditor() {
    const [fileName, setFileName] = useState<string>('');
    const isSettingContent = useRef(false);

    const editor = useMarkdownEditor({
        preset: 'commonmark',
        md: {html: false},
        initial: {mode: 'wysiwyg'},
    });

    const sendChange = useMemo(
        () => debounce(() => {
            if (isSettingContent.current) return;
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
            const {command, text, fileName: name} = event.data ?? {};

            if (command === 'setContent') {
                setFileName(name ?? '');
                isSettingContent.current = true;
                editor.replace(text ?? '');
                setTimeout(() => { isSettingContent.current = false; }, 350);
            }
        }
        window.addEventListener('message', onMessage);

        return () => window.removeEventListener('message', onMessage);
    }, [editor]);

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
                />
            </div>
        </div>
    );
}

export function App() {
    return (
        <ThemeProvider theme="dark">
            <ToasterProvider toaster={toaster}>
                <ErrorBoundary>
                    <MdEditor />
                </ErrorBoundary>
            </ToasterProvider>
        </ThemeProvider>
    );
}
