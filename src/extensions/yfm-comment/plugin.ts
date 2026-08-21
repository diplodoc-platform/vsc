import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block';

export const yfmCommentTokenName = 'yfm_comment';

const COMMENT_RE = /^\[\/\/\]:\s*#\s*\(.*\)\s*$/;

function yfmCommentBlockRule(
    state: StateBlock,
    startLine: number,
    _endLine: number,
    silent: boolean,
): boolean {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(pos, max);

    if (!COMMENT_RE.test(line)) {
        return false;
    }

    if (silent) {
        return true;
    }

    const token = state.push(yfmCommentTokenName, 'div', 0);
    token.map = [startLine, startLine + 1];
    token.content = line;

    state.line = startLine + 1;

    return true;
}

export function yfmCommentPlugin(md: MarkdownIt) {
    md.block.ruler.before('reference', yfmCommentTokenName, yfmCommentBlockRule);
}
