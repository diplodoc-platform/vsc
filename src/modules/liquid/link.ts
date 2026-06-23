import {readFileSync} from 'fs';
import * as vscode from 'vscode';

import {findVariableLine, resolveVariables} from './resolver';
import {VARIABLE_RE} from './constants';
import {findVariableInTag} from './utils';

export class LiquidLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const allVariables = resolveVariables(document.uri.fsPath);

        if (allVariables.size === 0) {
            return [];
        }

        const links: vscode.DocumentLink[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;

            links.push(...this.linksInOutputTags(lineText, i, allVariables));
            links.push(...this.linksInControlTags(lineText, i, allVariables));
        }

        return links;
    }

    private linksInOutputTags(
        lineText: string,
        lineIndex: number,
        allVariables: Map<string, Array<{filePath: string; line: number}>>,
    ): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];
        const re = new RegExp(VARIABLE_RE.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = re.exec(lineText)) !== null) {
            const name = match[1];

            if (!allVariables.has(name)) {
                continue;
            }

            const link = this.buildLink(
                name,
                match.index,
                match[0].length,
                lineIndex,
                allVariables,
            );

            if (link) {
                links.push(link);
            }
        }

        return links;
    }

    private linksInControlTags(
        lineText: string,
        lineIndex: number,
        allVariables: Map<string, Array<{filePath: string; line: number}>>,
    ): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];

        if (!/\{%/.test(lineText)) {
            return links;
        }

        const seen = new Set<number>();
        let charPos = 0;

        while (charPos < lineText.length) {
            const variable = findVariableInTag(lineText, charPos);

            if (!variable || seen.has(variable.start)) {
                charPos++;
                continue;
            }

            seen.add(variable.start);

            if (allVariables.has(variable.name)) {
                const link = this.buildLink(
                    variable.name,
                    variable.start,
                    variable.end - variable.start,
                    lineIndex,
                    allVariables,
                );

                if (link) {
                    links.push(link);
                }
            }

            charPos = variable.end + 1;
        }

        return links;
    }

    private buildLink(
        name: string,
        matchIndex: number,
        matchLength: number,
        lineIndex: number,
        allVariables: Map<string, Array<{filePath: string; line: number}>>,
    ): vscode.DocumentLink | null {
        const entries = allVariables.get(name);
        const entry = entries?.[0];

        if (!entry) {
            return null;
        }

        let line = entry.line;

        try {
            const content = readFileSync(entry.filePath, 'utf-8');
            line = findVariableLine(content, 'default', name) || entry.line;
        } catch {
            // keep entry.line
        }

        const range = new vscode.Range(lineIndex, matchIndex, lineIndex, matchIndex + matchLength);
        const args = encodeURIComponent(JSON.stringify([entry.filePath, line]));
        const target = vscode.Uri.parse(`command:diplodoc.goToPreset?${args}`);

        return new vscode.DocumentLink(range, target);
    }
}
