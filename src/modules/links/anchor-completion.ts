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

const EXPLICIT_ANCHOR_IN_HEADING_RE = /\{#([\p{L}\p{N}_-]+)\}/u;
const INLINE_ANCHOR_RE = /\{#([\p{L}\p{N}_-]+)\}/gu;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const FENCED_CODE_RE = /^\s*(`{3,}|~{3,})/;

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}_-]/gu, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
}

export function parseAnchors(content: string, mode: 'all' | 'sections-only'): AnchorInfo[] {
    const lines = content.split('\n');
    const anchors: AnchorInfo[] = [];
    const seen = new Set<string>();
    let inCodeBlock = false;

    for (const line of lines) {
        if (FENCED_CODE_RE.test(line)) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) {
            continue;
        }

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

function isHeadingAnchorMatch(rawText: string, anchorId: string): boolean {
    const explicitMatch = EXPLICIT_ANCHOR_IN_HEADING_RE.exec(rawText);

    if (explicitMatch) {
        return explicitMatch[1] === anchorId;
    }

    const cleanText = rawText.replace(/\{[^}]*\}/g, '').trim();

    return slugify(cleanText) === anchorId;
}

export function findAnchorLine(content: string, anchorId: string): number | null {
    if (!content) {
        return null;
    }

    const lines = content.split('\n');
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (FENCED_CODE_RE.test(line)) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) {
            continue;
        }

        const headingMatch = HEADING_RE.exec(line);

        if (headingMatch && isHeadingAnchorMatch(headingMatch[2].trim(), anchorId)) {
            return i;
        }

        if (!headingMatch && line.includes(`{#${anchorId}}`)) {
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

        let content: string | null;

        if (context.targetPath) {
            const docDir = vscode.Uri.joinPath(document.uri, '..');
            const targetUri = vscode.Uri.joinPath(docDir, context.targetPath);

            content = await readFileContent(targetUri);
        } else {
            content = document.getText();
        }

        if (content === null) {
            return [];
        }

        const mode = context.isInclude ? 'sections-only' : 'all';
        const anchors = parseAnchors(content, mode);
        const hashPos = context.anchorStart > 0 ? context.anchorStart - 1 : context.anchorStart;
        const range = new vscode.Range(position.line, hashPos, position.line, position.character);

        return anchors
            .filter((a) => a.id.startsWith(context.prefix))
            .map((anchor) => {
                const anchorLabel = `#${anchor.id}`;
                const item = new vscode.CompletionItem(
                    {label: anchorLabel, description: 'Diplodoc'},
                    vscode.CompletionItemKind.Reference,
                );

                item.insertText = anchorLabel;
                item.filterText = anchorLabel;
                item.range = range;
                item.sortText = `!${anchor.id}`;

                if (anchor.headingText) {
                    item.detail = anchor.headingText;
                }

                return item;
            });
    }
}
