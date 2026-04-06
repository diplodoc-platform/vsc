import {configure, ThemeProvider, ToasterProvider, Toaster} from '@gravity-ui/uikit';
import styles from './TocEditor.module.scss';
import {ErrorBoundary} from '../error/ErrorBoundary';
import {useVscodeTheme} from '../useVscodeTheme';

import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import '@gravity-ui/markdown-editor/styles/styles.css';

configure({
    lang: (document.documentElement.lang || 'en') as 'ru' | 'en',
});

const toaster = new Toaster();

function TocEditor() {
    return (
        <div className={styles.tocEditor}>
            TOC Editor
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
