import styles from './Sidebar.module.scss';
import {FilesList} from '../FilesList/FilesList';
import {useVscodeTheme} from '../../useVscodeTheme';
import {ErrorBoundary} from '../../error/ErrorBoundary';
import {Button, ThemeProvider, Toaster, ToasterProvider} from '@gravity-ui/uikit';
import {t} from '../../../i18n';
import {useEffect, useState} from 'react';
import { Search } from '../Search/Search';

declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void;
};

const vscodeApi = acquireVsCodeApi();

const toaster = new Toaster();

export function Sidebar() {
    const [fileName, setFileName] = useState<string>('');
    const [files, setFiles] = useState<string[]>([]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const {command, files} = event.data;
            if (command === 'setFiles') {
                setFiles(files || []);
            }
        };

        window.addEventListener('message', handleMessage);
        vscodeApi.postMessage({command: 'requestFiles'});

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleFileClick = (file: string) => {
        vscodeApi.postMessage({command: 'openFile', file});
    };

    return (
        <div className={styles.sidebar}>
            <Search fileName={fileName} setFileName={setFileName} />
            <FilesList fileName={fileName} files={files} onFileClick={handleFileClick} />
            <Button size='l' view='action' className={styles.initButton}>
                {t('sidebar.init')}
            </Button>
        </div>
    );
}

export function App() {
    const theme = useVscodeTheme();

    return (
        <ThemeProvider theme={theme}>
            <ToasterProvider toaster={toaster}>
                <ErrorBoundary>
                    <Sidebar />
                </ErrorBoundary>
            </ToasterProvider>
        </ThemeProvider>
    );
}
