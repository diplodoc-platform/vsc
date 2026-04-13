import type {ReactNode} from 'react';

import {Component} from 'react';

import {t} from '../../i18n';

import styles from './ErrorBoundary.module.scss';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    static getDerivedStateFromError(error: Error): State {
        return {error};
    }

    state: State = {error: null};

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
