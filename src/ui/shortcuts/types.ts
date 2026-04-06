import type {useMarkdownEditor} from '@gravity-ui/markdown-editor';

export type EditorInstance = ReturnType<typeof useMarkdownEditor>;

export interface EditorCommand {
    action: string;
    key?: string;
    cmdOrCtrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: (editor: EditorInstance) => void;
}
