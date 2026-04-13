import type {EditorInstance} from './ui/shortcuts/types';

type ElementType = 'table' | 'note';

export function insertElement(type: ElementType): string {
    const elements = {
        table: '| Cell content | Cell content |\n| --- | --- |\n| Cell content | Cell content |',
        note: '{% note info "Note title" %}\n\nAdd content for note\n\n{% endnote %}',
    };

    return elements[type];
}

export function insertAtCursor(editor: EditorInstance, text: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cm = (editor as any).markupEditor?.cm;

    if (!cm) {
        editor.append('\n' + text);
        return;
    }

    const state = cm.state;
    const from = state.selection.main.from;
    const line = state.doc.lineAt(from);
    const lineIsEmpty = line.length === 0;
    const insertPos = lineIsEmpty ? from : line.to;
    const prefix = lineIsEmpty ? '' : '\n\n';
    const insert = prefix + text + '\n';

    cm.dispatch({
        changes: {from: insertPos, insert},
        selection: {anchor: insertPos + insert.length},
    });
    cm.focus();
}
