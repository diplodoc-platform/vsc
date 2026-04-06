import {Component, ReactNode} from 'react';
import styles from './ErrorBoundary.module.scss';
import {t} from '../../i18n';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = {error: null};

    static getDerivedStateFromError(error: Error): State {
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
