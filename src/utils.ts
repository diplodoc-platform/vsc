import type {EditorInstance} from './ui/shortcuts/types';
import type * as vscode from 'vscode';

export type ElementType =
    | 'table'
    | 'note'
    | 'cut'
    | 'tab'
    | 'codeBlock'
    | 'include'
    | 'quote'
    | 'mermaid'
    | 'frontmatter'
    | 'pageConstructor'
    | 'htmlBlock'
    | 'video';

export function insertElement(type: ElementType): string {
    const elements = {
        table: '#|\n|| | ||\n|| | ||\n|#',
        note: '{% note info "Note title" %}\n\nAdd content for note\n\n{% endnote %}',
        cut: '{% cut "Cut title" %}\n\nAdd content for cut\n\n{% endcut %}',
        tab: '{% list tabs %}\n\n- Tab title 1\n\nTab 1\n\n- Tab title 2\n\nTab 2\n\n{% endlist %}',
        codeBlock: '```\n```',
        include: '{% include []() %}',
        quote: '> ',
        mermaid: '```mermaid\nsequenceDiagram\n  Alice->>Bob: Hi Bob\n  Bob->>Alice: Hi Alice\n```',
        frontmatter: '---\n\n---',
        pageConstructor:
            '::: page-constructor\nblocks:\n  - type: "header-block"\n    title: "Title"\n    description: "Description"\n:::',
        htmlBlock: '::: html\n<div>HTML content</div>\n:::',
        video: '@[]()',
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

export function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
    let timer: ReturnType<typeof setTimeout>;

    return ((...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }) as T;
}

export function debounceByKey<T extends (...args: Parameters<T>) => void>(
    fn: T,
    ms: number,
    keyFn: (...args: Parameters<T>) => string,
): T & {clear: (key: string) => void} {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const debounced = ((...args: Parameters<T>) => {
        const key = keyFn(...args);
        const existing = timers.get(key);

        if (existing) {
            clearTimeout(existing);
        }

        timers.set(
            key,
            setTimeout(() => {
                timers.delete(key);
                fn(...args);
            }, ms),
        );
    }) as T & {clear: (key: string) => void};

    debounced.clear = (key: string) => {
        const timer = timers.get(key);

        if (timer) {
            clearTimeout(timer);
            timers.delete(key);
        }
    };

    return debounced;
}

export function isBlocksYaml(document: vscode.TextDocument): boolean {
    if (document.languageId !== 'yaml') {
        return false;
    }

    const text = document.getText();

    return /^\s*blocks\s*:/m.test(text);
}

export function wrapPageConstructor(text: string): string {
    return `::: page-constructor\n${text}\n:::`;
}

export function unwrapPageConstructor(text: string): string {
    return text.replace(/^\s*::: page-constructor\s*\n/, '').replace(/\n:::\s*$/, '');
}

export function isExternalUrl(value: string): boolean {
    return /^https?:\/\//.test(value);
}

export function isInternalPath(value: string): boolean {
    const normalized = value.trim();

    if (!normalized) {
        return false;
    }

    if (isExternalUrl(normalized)) {
        return false;
    }

    if (
        normalized.startsWith('./') ||
        normalized.startsWith('../') ||
        normalized.startsWith('/') ||
        normalized.startsWith('#')
    ) {
        return true;
    }

    return /\.[a-zA-Z0-9]+$/.test(normalized);
}
