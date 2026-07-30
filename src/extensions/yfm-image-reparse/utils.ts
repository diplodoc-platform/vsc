import type {InlineAttrs} from './types';

const LEADING_ATTRS_RE = /^\s*(\{[^}]*(?:width|height)=[^}]*\})/;

export function parseInlineAttrs(attrsStr: string): {width: string | null; height: string | null} {
    const widthMatch = attrsStr.match(/width=(\d+)/);
    const heightMatch = attrsStr.match(/height=(\d+)/);

    return {
        width: widthMatch ? widthMatch[1] : null,
        height: heightMatch ? heightMatch[1] : null,
    };
}

export function matchLeadingAttrs(text: string): InlineAttrs | null {
    const m = LEADING_ATTRS_RE.exec(text);

    if (!m) {
        return null;
    }

    const {width, height} = parseInlineAttrs(m[1]);

    if (width === null && height === null) {
        return null;
    }

    return {consumeLength: m[0].length, width, height};
}
