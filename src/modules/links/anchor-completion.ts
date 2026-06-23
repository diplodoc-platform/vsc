import * as vscode from 'vscode';

export interface AnchorInfo {
    id: string;
    isSection: boolean;
    headingText?: string;
}

export interface AnchorContext {
    targetPath: string;
    prefix: string;
    isInclude: boolean;
    anchorStart: number;
}

const EXPLICIT_ANCHOR_IN_HEADING_RE = /\{#([a-zA-Z0-9_-]+)\}/;
const INLINE_ANCHOR_RE = /\{#([a-zA-Z0-9_-]+)\}/g;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
}

export function parseAnchors(content: string, mode: 'all' | 'sections-only'): AnchorInfo[] {
    const lines = content.split('\n');
    const anchors: AnchorInfo[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
        const headingMatch = HEADING_RE.exec(line);

        if (headingMatch) {
            const rawText = headingMatch[2].trim();
            const explicitMatch = EXPLICIT_ANCHOR_IN_HEADING_RE.exec(rawText);
            const cleanText = rawText.replace(/\{[^}]*\}/g, '').trim();
            const id = explicitMatch ? explicitMatch[1] : slugify(cleanText);

            if (id && !seen.has(id)) {
                seen.add(id);
                anchors.push({id, isSection: true, headingText: cleanText});
            }

            continue;
        }

        if (mode === 'all') {
            INLINE_ANCHOR_RE.lastIndex = 0;
            let match;

            while ((match = INLINE_ANCHOR_RE.exec(line)) !== null) {
                const id = match[1];

                if (!seen.has(id)) {
                    seen.add(id);
                    anchors.push({id, isSection: false});
                }
            }
        }
    }

    return anchors;
}

export function findAnchorLine(content: string, anchorId: string): number | null {
    if (!content) {
        return null;
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headingMatch = HEADING_RE.exec(line);

        if (headingMatch) {
            const rawText = headingMatch[2].trim();
            const explicitMatch = EXPLICIT_ANCHOR_IN_HEADING_RE.exec(rawText);

            if (explicitMatch && explicitMatch[1] === anchorId) {
                return i;
            }

            const cleanText = rawText.replace(/\{[^}]*\}/g, '').trim();

            if (slugify(cleanText) === anchorId) {
                return i;
            }

            continue;
        }

        if (line.includes(`{#${anchorId}}`)) {
            return i;
        }
    }

    return null;
}

const INCLUDE_ANCHOR_RE = /\{%\s*include\s*\[[^\]]*\]\(([^)#]*)#([^)]*)$/;
const LINK_ANCHOR_RE = /\[[^\]]*\]\(([^)#]*)#([^)]*)$/;

export function getAnchorContext(lineText: string, character: number): AnchorContext | null {
    const upToCursor = lineText.substring(0, character);

    const includeMatch = INCLUDE_ANCHOR_RE.exec(upToCursor);

    if (includeMatch) {
        const prefix = includeMatch[2];

        return {
            targetPath: includeMatch[1],
            prefix,
            isInclude: true,
            anchorStart: character - prefix.length,
        };
    }

    const linkMatch = LINK_ANCHOR_RE.exec(upToCursor);

    if (linkMatch) {
        const prefix = linkMatch[2];

        return {
            targetPath: linkMatch[1],
            prefix,
            isInclude: false,
            anchorStart: character - prefix.length,
        };
    }

    return null;
}

async function readFileContent(uri: vscode.Uri): Promise<string | null> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);

        return Buffer.from(bytes).toString('utf-8');
    } catch {
        return null;
    }
}

export class AnchorCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.CompletionItem[] | undefined> {
        const lineText = document.lineAt(position.line).text;
        const context = getAnchorContext(lineText, position.character);

        if (!context) {
            return undefined;
        }

        const docDir = vscode.Uri.joinPath(document.uri, '..');
        const targetUri = vscode.Uri.joinPath(docDir, context.targetPath || '.');
        const content = await readFileContent(targetUri);

        if (content === null) {
            return [];
        }

        const mode = context.isInclude ? 'sections-only' : 'all';
        const anchors = parseAnchors(content, mode);
        const range = new vscode.Range(
            position.line,
            context.anchorStart,
            position.line,
            position.character,
        );

        return anchors
            .filter((a) => a.id.startsWith(context.prefix))
            .map((anchor) => {
                const item = new vscode.CompletionItem(
                    anchor.id,
                    vscode.CompletionItemKind.Reference,
                );

                item.insertText = anchor.id;
                item.filterText = anchor.id;
                item.range = range;
                item.sortText = `0_${anchor.id}`;

                if (anchor.headingText) {
                    item.detail = anchor.headingText;
                }

                return item;
            });
    }
}
