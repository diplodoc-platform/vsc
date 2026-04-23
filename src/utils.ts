import type {EditorInstance} from './ui/shortcuts/types';

export type ElementType =
    | 'table'
    | 'note'
    | 'cut'
    | 'tab'
    | 'codeBlock'
    | 'include'
    | 'quote'
    | 'mermaid'
    | 'checkbox'
    | 'frontmatter';

export function insertElement(type: ElementType): string {
    const elements = {
        table: '| Cell content | Cell content |\n| --- | --- |\n| Cell content | Cell content |',
        note: '{% note info "Note title" %}\n\nAdd content for note\n\n{% endnote %}',
        cut: '{% cut "Cut title" %}\n\nAdd content for cut\n\n{% endcut %}',
        tab: '{% list tabs %}\n\n- Tab title 1\n\nTab 1\n\n- Tab title 2\n\nTab 2\n\n{% endlist %}',
        codeBlock: '```\n```',
        include: '{% include []() %}',
        quote: '> ',
        mermaid: '```mermaid\nsequenceDiagram\n  Alice->>Bob: Hi Bob\n  Bob->>Alice: Hi Alice\n```',
        checkbox: '[ ] ',
        frontmatter: '---\n\n---',
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
