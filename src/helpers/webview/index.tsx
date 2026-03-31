import React from 'react';
import {createRoot} from 'react-dom/client';
import {useMarkdownEditor, MarkdownEditorView} from '@gravity-ui/markdown-editor';
import {configure, ThemeProvider, ToasterProvider, Toaster} from '@gravity-ui/uikit';
import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import '@gravity-ui/markdown-editor/styles/styles.css';

configure({lang: 'ru'});

const toaster = new Toaster();

declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
};

const vscodeApi = acquireVsCodeApi();

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
    let timer: ReturnType<typeof setTimeout>;
    return ((...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }) as T;
}

class ErrorBoundary extends React.Component<
    {children: React.ReactNode},
    {error: Error | null}
> {
    state = {error: null};
    
    static getDerivedStateFromError(error: Error) {
        return {error};
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{padding: 16, color: '#f47067', fontFamily: 'monospace', fontSize: 12}}>
                    <b>Ошибка редактора:</b>
                    <pre style={{whiteSpace: 'pre-wrap'}}>{String(this.state.error)}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

function Editor() {
    const [fileName, setFileName] = React.useState<string>('');

    const editor = useMarkdownEditor({
        preset: 'commonmark',
        md: {html: false},
        initial: {mode: 'wysiwyg'},
    });

    const sendChange = React.useMemo(
        () => debounce(() => {
            vscodeApi.postMessage({command: 'change', text: editor.getValue()});
        }, 300),
        [editor]
    );

    React.useEffect(() => {
        editor.on('change', sendChange);
        return () => editor.off('change', sendChange);
    }, [editor, sendChange]);

    React.useEffect(() => {
        function onMessage(event: MessageEvent) {
            const {command, text, fileName: name} = event.data ?? {};
            if (command === 'setContent') {
                setFileName(name ?? '');
                editor.replace(text ?? '');
            }
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [editor]);

    return (
        <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
            {fileName && (
                <div style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--vscode-sideBarTitle-foreground, #ccc)',
                    background: 'var(--vscode-sideBar-background, #1e1e1e)',
                    borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border, #333)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    flexShrink: 0,
                }}>
                    <span style={{opacity: 0.6}}>📄</span>
                    {fileName}
                </div>
            )}
            <div style={{flex: 1, overflow: 'hidden', minHeight: 0}}>
                <MarkdownEditorView
                    stickyToolbar
                    autofocus
                    editor={editor}
                />
            </div>
        </div>
    );
}

function App() {
    return (
        <ThemeProvider theme="dark">
            <ToasterProvider toaster={toaster}>
                <ErrorBoundary>
                    <Editor />
                </ErrorBoundary>
            </ToasterProvider>
        </ThemeProvider>
    );
}

const container = document.getElementById('root');

if (container) {
    createRoot(container).render(<App />);
} else {
    document.body.innerHTML = '<div style="padding:16px;color:red">root element not found</div>';
}
