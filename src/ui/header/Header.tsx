import {Text} from '@gravity-ui/uikit';

import styles from './Header.module.scss';

interface HeaderProps {
    fileName?: string;
}

export function Header({fileName}: HeaderProps) {
    if (!fileName) {
        return null;
    }

    return (
        <Text className={styles.header} variant="subheader-1">
            <span>📄</span>
            {fileName}
        </Text>
    );
}
