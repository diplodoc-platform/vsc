import {t} from '../../../i18n';
import {TextInput} from '@gravity-ui/uikit';

interface SearchProps {
    fileName: string;
    setFileName: (file: string) => void;
}

export function Search({fileName, setFileName}: SearchProps) {
    return (
        <TextInput
            size='l'
            placeholder={t('sidebar.search_placeholder')}
            autoComplete={true}
            hasClear={true}
            value={fileName}
            onUpdate={setFileName}
        />
    );
}
