import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Matches [text](href) — captures the href and its position within the line
const LINK_RE = /\[(?:[^\]]*)\]\(([^)]+)\)/g;

export function validateLinks(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diags: vscode.Diagnostic[] = [];
    const filePath = document.uri.fsPath;
    const fileDir = path.dirname(filePath);
    const text = document.getText();
    const lines = text.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        let match: RegExpExecArray | null;
        const re = new RegExp(LINK_RE.source, 'g');

        while ((match = re.exec(line)) !== null) {
            const href = match[1].trim();

            // Skip external URLs, anchors, and non-md links
            if (href.startsWith('http://') || href.startsWith('https://')) continue;
            if (href.startsWith('#')) continue;
            if (href.startsWith('mailto:')) continue;

            // Strip inline fragment (#section) and query string
            const hrefClean = href.split('#')[0].split('?')[0];
            if (!hrefClean) continue;

            // Only validate .md links (or extensionless assumed as .md)
            const ext = path.extname(hrefClean).toLowerCase();
            if (ext && ext !== '.md') continue;

            const target = ext === '.md'
                ? path.resolve(fileDir, hrefClean)
                : path.resolve(fileDir, hrefClean + '.md');

            if (!fs.existsSync(target)) {
                // Range covers the href part inside the parentheses
                const hrefStart = match.index + match[0].indexOf('(' + match[1]) + 1;
                const hrefEnd = hrefStart + match[1].length;

                diags.push(new vscode.Diagnostic(
                    new vscode.Range(lineIdx, hrefStart, lineIdx, hrefEnd),
                    `Link target not found: '${hrefClean}'`,
                    vscode.DiagnosticSeverity.Warning,
                ));
            }
        }
    }

    return diags;
}
