import {List, Text} from '@gravity-ui/uikit';

import {getFilesMap} from '../../utils';

import styles from './FilesList.module.scss';

interface FilesListProps {
    fileName: string;
    files: string[];
    onFileClick: (file: string) => void;
}

export function FilesList({fileName, files, onFileClick}: FilesListProps) {
    const filesMap = getFilesMap(fileName, files);

    return (
        <div className={styles.filesList}>
            {Array.from(filesMap.entries()).map(([dir, files]) => (
                <div key={dir}>
                    {dir !== '' && (
                        <Text variant="body-2" className={styles.dir}>
                            {dir + ':'}
                        </Text>
                    )}
                    <List
                        itemClassName={styles.fileItem}
                        itemsClassName={styles.filesItems}
                        items={files}
                        renderItem={(file: string) => (
                            <Text variant="body-2">{file.split('/').pop()}</Text>
                        )}
                        virtualized={false}
                        onItemClick={(file: string) => onFileClick(file)}
                        filterable={false}
                    />
                </div>
            ))}
        </div>
    );
}
