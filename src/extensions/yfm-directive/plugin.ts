import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block';

const OPEN_RE = /^:::\s*(\S+.*?)\s*$/;
const CLOSE_RE = /^:::\s*$/;

export const yfmDirectiveTokenName = 'yfm_directive';
export const yfmLiquidTagTokenName = 'yfm_liquid_tag';

const LIQUID_TAG_RE = /^{%[\s\S]*?%}\s*$/;
const LIQUID_OPEN_RE = /^{%[-\s]*(\w+)/;
const INCLUDE_RE = /^{%\s*include\s/;

const KNOWN_LIQUID_TAGS = new Set(['note', 'cut', 'list']);

function makeCloseRe(tagName: string): RegExp {
    return new RegExp(`^{%[-\\s]*end${tagName}\\s*-?%}\\s*$`);
}

function yfmDirectiveBlockRule(
    state: StateBlock,
    startLine: number,
    endLine: number,
    silent: boolean,
): boolean {
    const openPos = state.bMarks[startLine] + state.tShift[startLine];
    const openMax = state.eMarks[startLine];
    const openStr = state.src.slice(openPos, openMax);

    const openMatch = OPEN_RE.exec(openStr);

    if (!openMatch) {
        return false;
    }

    let closeLine = -1;

    for (let i = startLine + 1; i < endLine; i++) {
        const pos = state.bMarks[i] + state.tShift[i];
        const max = state.eMarks[i];
        const line = state.src.slice(pos, max);

        if (CLOSE_RE.test(line)) {
            closeLine = i;
            break;
        }
    }

    if (closeLine === -1) {
        return false;
    }

    if (silent) {
        return true;
    }

    const directiveName = openMatch[1];
    const contentStart = state.bMarks[startLine + 1];
    const contentEnd = state.bMarks[closeLine];
    const content = state.src.slice(contentStart, contentEnd).replace(/\n$/, '');

    const token = state.push(yfmDirectiveTokenName, 'div', 0);
    token.map = [startLine, closeLine + 1];
    token.content = content;
    token.info = directiveName;

    state.line = closeLine + 1;

    return true;
}

function yfmLiquidTagBlockRule(
    state: StateBlock,
    startLine: number,
    endLine: number,
    silent: boolean,
): boolean {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(pos, max);

    if (!LIQUID_TAG_RE.test(line) || INCLUDE_RE.test(line)) {
        return false;
    }

    const nameMatch = LIQUID_OPEN_RE.exec(line);
    const tagName = nameMatch?.[1] ?? '';

    const baseName = tagName.startsWith('end') ? tagName.slice(3) : tagName;

    if (KNOWN_LIQUID_TAGS.has(baseName)) {
        return false;
    }

    if (silent) {
        return true;
    }
    const isEndTag = tagName.startsWith('end');

    let closeLine = -1;

    if (tagName && !isEndTag) {
        const closeRe = makeCloseRe(tagName);

        for (let i = startLine + 1; i < endLine; i++) {
            const linePos = state.bMarks[i] + state.tShift[i];
            const lineMax = state.eMarks[i];
            const lineStr = state.src.slice(linePos, lineMax);

            if (closeRe.test(lineStr)) {
                closeLine = i;
                break;
            }
        }
    }

    const lastLine = closeLine === -1 ? startLine : closeLine;
    const contentStart = state.bMarks[startLine];
    const contentEnd = state.eMarks[lastLine];
    const content = state.src.slice(contentStart, contentEnd);

    const token = state.push(yfmLiquidTagTokenName, 'div', 0);
    token.map = [startLine, lastLine + 1];
    token.content = content;

    state.line = lastLine + 1;

    return true;
}

export function yfmDirectivePlugin(md: MarkdownIt) {
    md.block.ruler.before('paragraph', yfmDirectiveTokenName, yfmDirectiveBlockRule);
    md.block.ruler.before('paragraph', yfmLiquidTagTokenName, yfmLiquidTagBlockRule);
}
