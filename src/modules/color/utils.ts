import * as vscode from 'vscode';
import {colord, extend} from 'colord';
import namesPlugin from 'colord/plugins/names';

import {BARE_HEX_RE, COLOR_FUNCTION_RE, FENCE_RE, KEY_VALUE_RE, MD_COLOR_RE} from './constants';

extend([namesPlugin]);

export function parseColor(raw: string): vscode.Color | null {
    const c = colord(raw);

    if (!c.isValid()) {
        return null;
    }

    const {r, g, b, a} = c.toRgb();

    return new vscode.Color(r / 255, g / 255, b / 255, a);
}

export function colorToHex(color: vscode.Color): string {
    return colord({
        r: Math.round(color.red * 255),
        g: Math.round(color.green * 255),
        b: Math.round(color.blue * 255),
        a: color.alpha,
    }).toHex();
}

export function colorToRgb(color: vscode.Color): string {
    return colord({
        r: Math.round(color.red * 255),
        g: Math.round(color.green * 255),
        b: Math.round(color.blue * 255),
        a: color.alpha,
    }).toRgbString();
}

export interface ColorMatch {
    range: vscode.Range;
    color: vscode.Color;
}

export function extractValueSpan(
    lineText: string,
    valueOffset: number,
): {raw: string; start: number; end: number} | null {
    const rest = lineText.substring(valueOffset);

    if (rest.length === 0 || rest === '\n') {
        return null;
    }

    const q = rest[0];

    if (q === "'" || q === '"') {
        const close = rest.indexOf(q, 1);
        if (close === -1) {
            return null;
        }

        return {
            raw: rest.substring(1, close),
            start: valueOffset,
            end: valueOffset + close + 1,
        };
    }

    const commentIdx = rest.search(/\s+#/);
    const val = commentIdx >= 0 ? rest.substring(0, commentIdx) : rest.trimEnd();

    if (val.length === 0) {
        return null;
    }

    return {raw: val, start: valueOffset, end: valueOffset + val.length};
}

export function findColors(document: vscode.TextDocument): ColorMatch[] {
    const results: ColorMatch[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const m = KEY_VALUE_RE.exec(line.text);

        if (!m) {
            continue;
        }

        const span = extractValueSpan(line.text, m[0].length);

        if (!span) {
            continue;
        }

        const color = parseColor(span.raw);

        if (!color) {
            continue;
        }

        results.push({
            range: new vscode.Range(i, span.start, i, span.end),
            color,
        });
    }

    return results;
}

export interface MarkdownColorMatch {
    range: vscode.Range;
    raw: string;
    color: vscode.Color | null;
}

function blankRange(chars: string[], from: number, to: number): void {
    for (let k = from; k < to && k < chars.length; k++) {
        chars[k] = ' ';
    }
}

function backtickRunEnd(text: string, start: number): number {
    let end = start;

    while (text[end] === '`') {
        end++;
    }
    return end;
}

function maskHtmlComments(chars: string[], text: string, inComment: boolean): boolean {
    let i = 0;
    let open = inComment;

    while (i < text.length) {
        const from = open ? i : text.indexOf('<!--', i);

        if (!open && from === -1) {
            break;
        }

        const searchFrom = open ? i : from + 4;
        const end = text.indexOf('-->', searchFrom);

        if (end === -1) {
            blankRange(chars, from, text.length);

            return true;
        }

        blankRange(chars, from, end + 3);
        open = false;
        i = end + 3;
    }

    return open;
}

function maskInlineCode(chars: string[]): void {
    const scan = chars.join('');
    let j = 0;

    while (j < scan.length) {
        if (scan[j] !== '`') {
            j++;
            continue;
        }

        const openEnd = backtickRunEnd(scan, j);
        const close = findClosingRun(scan, openEnd, openEnd - j);

        if (close === -1) {
            j = openEnd;
        } else {
            blankRange(chars, j, close);
            j = close;
        }
    }
}

function findClosingRun(scan: string, from: number, len: number): number {
    let k = from;

    while (k < scan.length) {
        if (scan[k] !== '`') {
            k++;

            continue;
        }

        const runEnd = backtickRunEnd(scan, k);

        if (runEnd - k === len) {
            return runEnd;
        }

        k = runEnd;
    }

    return -1;
}

function maskCodeAndComments(text: string, inComment: boolean): {masked: string; open: boolean} {
    const chars = text.split('');
    const open = maskHtmlComments(chars, text, inComment);

    maskInlineCode(chars);

    return {masked: chars.join(''), open};
}

export function findMarkdownColors(document: vscode.TextDocument): MarkdownColorMatch[] {
    const results: MarkdownColorMatch[] = [];
    let inFence = false;
    let inComment = false;

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;

        if (FENCE_RE.test(text)) {
            inFence = !inFence;
            continue;
        }

        if (inFence) {
            continue;
        }

        const {masked, open} = maskCodeAndComments(text, inComment);
        inComment = open;

        MD_COLOR_RE.lastIndex = 0;
        let m: RegExpExecArray | null;

        while ((m = MD_COLOR_RE.exec(masked)) !== null) {
            const raw = m[1];
            const nameStart = m.index + 1;

            results.push({
                range: new vscode.Range(i, nameStart, i, nameStart + raw.length),
                raw,
                color: parseColor(raw),
            });
        }
    }

    return results;
}

export interface ColorProblem {
    range: vscode.Range;
    raw: string;
}

export function isColorLike(raw: string, quoted: boolean): boolean {
    return raw.startsWith('#') || COLOR_FUNCTION_RE.test(raw) || (quoted && BARE_HEX_RE.test(raw));
}

export function findYamlColorProblems(document: vscode.TextDocument): ColorProblem[] {
    const results: ColorProblem[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;
        const m = KEY_VALUE_RE.exec(text);

        if (!m) {
            continue;
        }

        const valueOffset = m[0].length;
        const span = extractValueSpan(text, valueOffset);

        if (!span) {
            continue;
        }

        const quoted = text[valueOffset] === "'" || text[valueOffset] === '"';

        if (!isColorLike(span.raw, quoted) || parseColor(span.raw)) {
            continue;
        }

        results.push({range: new vscode.Range(i, span.start, i, span.end), raw: span.raw});
    }

    return results;
}
