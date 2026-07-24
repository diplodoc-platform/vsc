import type {ActionStorage} from '@gravity-ui/markdown-editor';

import {useState} from 'react';
import {Button, Popup, TextInput} from '@gravity-ui/uikit';

import {detectVideoService} from './detect';

type VideoFormProps = {
    editor: ActionStorage;
    hide: () => void;
    anchorElement: HTMLElement | null;
};

export const VideoForm: React.FC<VideoFormProps> = ({editor, anchorElement, hide}) => {
    const [url, setUrl] = useState('');

    const submit = () => {
        const value = url.trim();
        if (!value) {
            return;
        }

        editor.actions.video.run({service: detectVideoService(value), url: value});
        hide();
    };

    return (
        <Popup
            open
            anchorElement={anchorElement}
            placement={['bottom-start', 'bottom-end']}
            onOpenChange={(open) => {
                if (!open) {
                    hide();
                }
            }}
        >
            <div style={{display: 'flex', gap: 8, padding: 8, width: 360}}>
                <TextInput
                    autoFocus
                    size="m"
                    value={url}
                    onUpdate={setUrl}
                    placeholder="https://..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            submit();
                        }
                    }}
                />
                <Button view="action" size="m" onClick={submit}>
                    Insert
                </Button>
            </div>
        </Popup>
    );
};
