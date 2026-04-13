import {ThemeProvider, Toaster, ToasterProvider, configure} from '@gravity-ui/uikit';

import {ErrorBoundary} from '../error/ErrorBoundary';
import {useVscodeTheme} from '../useVscodeTheme';

import styles from './TocEditor.module.scss';

configure({
    lang: (document.documentElement.lang || 'en') as 'ru' | 'en',
});

const toaster = new Toaster();

function TocEditor() {
    return <div className={styles.tocEditor}>TOC Editor</div>;
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
