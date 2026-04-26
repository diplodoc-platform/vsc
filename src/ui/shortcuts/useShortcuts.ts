import type {EditorCommand, EditorInstance} from './types';

import {useEffect} from 'react';

import {isTrustedOrigin} from '../utils';

import {matchesShortcut} from './match';

export function useShortcuts(commands: EditorCommand[], editor: EditorInstance) {
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            for (const cmd of commands) {
                if (
                    cmd.key &&
                    matchesShortcut(
                        event,
                        cmd as Required<Pick<EditorCommand, 'key'>> & EditorCommand,
                    )
                ) {
                    event.preventDefault();
                    cmd.handler(editor);

                    return;
                }
            }
        }

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [editor, commands]);

    useEffect(() => {
        function onMessage(event: MessageEvent) {
            if (!isTrustedOrigin(event.origin)) {
                return;
            }

            const {command, action} = event.data ?? {};

            if (command === 'action') {
                const cmd = commands.find((c) => c.action === action);
                cmd?.handler(editor);
            }
        }

        window.addEventListener('message', onMessage);

        return () => window.removeEventListener('message', onMessage);
    }, [editor, commands]);
}
