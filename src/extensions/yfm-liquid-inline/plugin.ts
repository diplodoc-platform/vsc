import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline';

export const yfmLiquidInlineTokenName = 'yfm_liquid_inline';
export const yfmLiquidInlineNodeName = 'yfm-liquid-inline';

const OPEN = 0x7b;
const PERCENT = 0x25;

const INCLUDE_RE = /^\{%[-\s]*include\s/;

function yfmLiquidInlineRule(state: StateInline, silent: boolean): boolean {
    const start = state.pos;

    if (state.src.charCodeAt(start) !== OPEN || state.src.charCodeAt(start + 1) !== PERCENT) {
        return false;
    }

    const closeIdx = state.src.indexOf('%}', start + 2);

    if (closeIdx === -1) {
        return false;
    }

    const end = closeIdx + 2;
    const raw = state.src.slice(start, end);

    if (INCLUDE_RE.test(raw)) {
        return false;
    }

    if (!silent) {
        const token = state.push(yfmLiquidInlineTokenName, '', 0);
        token.content = raw;
        token.markup = raw;
    }

    state.pos = end;

    return true;
}

export function yfmLiquidInlinePlugin(md: MarkdownIt) {
    md.inline.ruler.before('text', yfmLiquidInlineTokenName, yfmLiquidInlineRule);
}
