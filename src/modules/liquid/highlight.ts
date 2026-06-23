import * as vscode from 'vscode';

import {LIQUID_BLOCK_OPENERS, LIQUID_CONTROL_KEYWORDS} from './constants';
import {getLiquidTagKeyword} from './utils';

interface TagOccurrence {
    keyword: string;
    line: number;
    start: number;
    end: number;
}

function collectTags(document: vscode.TextDocument): TagOccurrence[] {
    const tags: TagOccurrence[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        const tagRe = /\{%-?\s*(\w+)[^%]*?-?%\}/g;
        let m: RegExpExecArray | null;

        while ((m = tagRe.exec(lineText)) !== null) {
            const keyword = m[1];

            if (LIQUID_CONTROL_KEYWORDS.has(keyword)) {
                tags.push({keyword, line: i, start: m.index, end: m.index + m[0].length});
            }
        }
    }

    return tags;
}

function baseOf(keyword: string): string {
    if (keyword.startsWith('end')) {
        return keyword.slice(3);
    }
    if (keyword === 'elsif' || keyword === 'else') {
        return 'if';
    }
    return keyword;
}

function findGroup(tags: TagOccurrence[], targetIdx: number): TagOccurrence[] {
    const target = tags[targetIdx];
    const base = baseOf(target.keyword);
    const closerKeyword = LIQUID_BLOCK_OPENERS[base];

    if (!closerKeyword) {
        return [];
    }

    for (let i = 0; i < tags.length; i++) {
        if (tags[i].keyword !== base) {
            continue;
        }

        const openerIdx = i;
        const group: TagOccurrence[] = [tags[openerIdx]];
        let depth = 1;

        for (let j = openerIdx + 1; j < tags.length; j++) {
            const kw = tags[j].keyword;

            if (kw === base) {
                depth++;
            } else if (kw === closerKeyword) {
                depth--;

                if (depth === 0) {
                    group.push(tags[j]);

                    const closerIdx = j;
                    const inRange = targetIdx >= openerIdx && targetIdx <= closerIdx;

                    if (inRange) {
                        return group;
                    }

                    break;
                }
            } else if (depth === 1 && base === 'if' && (kw === 'elsif' || kw === 'else')) {
                group.push(tags[j]);
            }
        }
    }

    return [];
}

export class LiquidHighlightProvider implements vscode.DocumentHighlightProvider {
    provideDocumentHighlights(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.DocumentHighlight[] | null {
        const lineText = document.lineAt(position.line).text;
        const tag = getLiquidTagKeyword(lineText, position.character);

        if (!tag) {
            return null;
        }

        const allTags = collectTags(document);
        const targetIdx = allTags.findIndex(
            (t) => t.line === position.line && t.start === tag.start,
        );

        if (targetIdx === -1) {
            return null;
        }

        const group = findGroup(allTags, targetIdx);

        if (group.length <= 1) {
            return null;
        }

        return group.map(
            (t) =>
                new vscode.DocumentHighlight(
                    new vscode.Range(t.line, t.start, t.line, t.end),
                    vscode.DocumentHighlightKind.Read,
                ),
        );
    }
}
