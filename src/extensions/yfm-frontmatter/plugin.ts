import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block';

const FENCE = /^---\s*$/;

export const yfmFrontmatterTokenName = 'yfm_frontmatter';

function yfmFrontmatterBlockRule(
    state: StateBlock,
    startLine: number,
    endLine: number,
    silent: boolean,
): boolean {
    const openPos = state.bMarks[startLine] + state.tShift[startLine];
    const openMax = state.eMarks[startLine];
    const openStr = state.src.slice(openPos, openMax);

    if (!FENCE.test(openStr)) {
        return false;
    }

    let closeLine = -1;
    for (let i = startLine + 1; i < endLine; i++) {
        const pos = state.bMarks[i] + state.tShift[i];
        const max = state.eMarks[i];
        const line = state.src.slice(pos, max);

        if (FENCE.test(line)) {
            closeLine = i;
            break;
        }
    }

    if (closeLine === -1) {
        return false;
    }

    const contentStart = state.bMarks[startLine + 1];
    const contentEnd = state.bMarks[closeLine];
    const content = state.src.slice(contentStart, contentEnd).replace(/\n$/, '');

    if (startLine !== 0 && content.trim().length === 0) {
        return false;
    }

    if (silent) {
        return true;
    }

    const token = state.push(yfmFrontmatterTokenName, 'pre', 0);
    token.map = [startLine, closeLine + 1];
    token.content = content;

    state.line = closeLine + 1;

    return true;
}

export function yfmFrontmatterPlugin(md: MarkdownIt) {
    md.block.ruler.before('hr', yfmFrontmatterTokenName, yfmFrontmatterBlockRule);
}
