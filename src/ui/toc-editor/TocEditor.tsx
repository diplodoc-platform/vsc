import {configure, ThemeProvider, ToasterProvider, Toaster} from '@gravity-ui/uikit';
import styles from './TocEditor.module.scss';
import {t} from '../../i18n';
import {Component, ReactNode} from 'react';

import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import '@gravity-ui/markdown-editor/styles/styles.css';

configure({
    lang: (document.documentElement.lang || 'en') as 'ru' | 'en',
});

const toaster = new Toaster();

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

function TocEditor() {
    return (
        <div className={styles.tocEditor}>
            TOC Editor
        </div>
    );
}

export function App() {
    return (
        <ThemeProvider theme="dark">
            <ToasterProvider toaster={toaster}>
                <ErrorBoundary>
                    <TocEditor />
                </ErrorBoundary>
            </ToasterProvider>
        </ThemeProvider>
    );
}
