import styles from './Sidebar.module.scss';
import {t} from '../../i18n';

export function Sidebar() {
    return (
        <div className={styles.sidebar}>
            {t('sidebar.welcome')}
        </div>
    );
}
