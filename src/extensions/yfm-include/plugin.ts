import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block';

export const yfmIncludeTokenName = 'yfm_include';

const INCLUDE_RE = /^{%\s*include\s*\[([^\]]*)\]\(([^)]*)\)\s*%}\s*$/;

function yfmIncludeBlockRule(
    state: StateBlock,
    startLine: number,
    _endLine: number,
    silent: boolean,
): boolean {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(pos, max);

    if (!INCLUDE_RE.test(line)) {
        return false;
    }

    if (silent) {
        return true;
    }

    const token = state.push(yfmIncludeTokenName, 'div', 0);
    token.map = [startLine, startLine + 1];
    token.content = line;

    state.line = startLine + 1;

    return true;
}

export function yfmIncludePlugin(md: MarkdownIt) {
    md.block.ruler.before('paragraph', yfmIncludeTokenName, yfmIncludeBlockRule);
}
