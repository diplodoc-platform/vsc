import type {InlineAttrs} from './types';

const LEADING_ATTRS_RE = /^\s*(\{[^}]+\})/;

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

    const rawAttrs = m[1].slice(1, -1); // content between { and }
    const {width, height} = parseInlineAttrs(m[1]);

    return {consumeLength: m[0].length, width, height, rawAttrs};
}

export function rebuildRawAttrs(
    rawAttrs: string,
    width: string | null,
    height: string | null,
): string {
    let result = rawAttrs;

    if (width !== null) {
        if (/width=\S+/.test(result)) {
            result = result.replace(/width=\S+/, `width=${width}`);
        } else {
            result = `width=${width} ${result}`;
        }
    }

    if (height !== null) {
        if (/height=\S+/.test(result)) {
            result = result.replace(/height=\S+/, `height=${height}`);
        } else {
            result = `${result} height=${height}`;
        }
    }

    return result.trim();
}
