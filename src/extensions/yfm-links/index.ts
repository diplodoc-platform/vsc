import type {ExtensionAuto} from '@gravity-ui/markdown-editor';
import type {Mark, Node} from '@gravity-ui/markdown-editor/pm/model';

const WRAPPED_LINK_MARKS = '__wrappedLinkMarks';
const FORMATTING_MARKS = ['strong', 'em'] as const;

function getWrapped(state: Record<string, unknown>): string[] | undefined {
    return state[WRAPPED_LINK_MARKS] as string[] | undefined;
}

function getCommonFormattingMarks(parent: Node, startIndex: number): string[] {
    const child = parent.child(startIndex);
    const linkMark = child.marks.find((m) => m.type.name === 'link');

    if (!linkMark) {
        return [];
    }

    let common: string[] = FORMATTING_MARKS.filter((name) =>
        child.marks.some((m) => m.type.name === name),
    );

    for (let i = startIndex + 1; i < parent.childCount; i++) {
        const node = parent.child(i);

        if (!node.marks.some((m) => m.type.name === 'link' && m.eq(linkMark))) {
            break;
        }

        common = common.filter((name) => node.marks.some((m) => m.type.name === name));
    }

    return common;
}

function buildMarkSyntax(marks: string[]): string {
    let syntax = '';

    if (marks.includes('strong')) {
        syntax += '**';
    }

    if (marks.includes('em')) {
        syntax += '*';
    }

    return syntax;
}

function callPrev(
    prev: {open: string | Function; close: string | Function},
    which: 'open' | 'close',
    args: unknown[],
): string {
    const fn = prev[which];

    return typeof fn === 'function' ? fn(...args) : (fn as string);
}

export const YfmLinks: ExtensionAuto = (builder) => {
    builder.configureMd((md) => {
        const orig = md.normalizeLink.bind(md);

        md.normalizeLink = (url: string) => {
            const normalized = orig(url);

            return normalized.replace(/%7B/gi, '{').replace(/%7D/gi, '}');
        };

        return md;
    });

    builder.overrideMarkSerializerSpec('link', (prev) => ({
        open(state, mark: Mark, parent: Node, index: number) {
            const s = state as unknown as Record<string, unknown>;
            const common = getCommonFormattingMarks(parent, index);

            if (common.length > 0) {
                s[WRAPPED_LINK_MARKS] = common;
            }

            const base = callPrev(prev, 'open', [state, mark, parent, index]);

            return common.length > 0 ? `${buildMarkSyntax(common)}${base}` : base;
        },
        close(state, mark: Mark, parent: Node, index: number) {
            const s = state as unknown as Record<string, unknown>;
            const common = getWrapped(s) || [];

            if (common.length > 0) {
                delete s[WRAPPED_LINK_MARKS];
            }

            const base = callPrev(prev, 'close', [state, mark, parent, index]);

            return common.length > 0 ? `${base}${buildMarkSyntax(common)}` : base;
        },
    }));

    for (const markName of FORMATTING_MARKS) {
        builder.overrideMarkSerializerSpec(markName, (prev) => ({
            open(state, mark: Mark, parent: Node, index: number) {
                const wrapped = getWrapped(state as unknown as Record<string, unknown>);

                if (wrapped?.includes(markName)) {
                    return '';
                }

                return callPrev(prev, 'open', [state, mark, parent, index]);
            },
            close(state, mark: Mark, parent: Node, index: number) {
                const wrapped = getWrapped(state as unknown as Record<string, unknown>);

                if (wrapped?.includes(markName)) {
                    return '';
                }

                return callPrev(prev, 'close', [state, mark, parent, index]);
            },
        }));
    }
};
