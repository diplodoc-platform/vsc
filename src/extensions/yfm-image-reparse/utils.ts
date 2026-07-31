import type {InlineAttrs} from './types';

const LEADING_ATTRS_RE = /^\s*(\{[^}]+\})/;

export function parseInlineAttrs(attrsStr: string): {width: string | null; height: string | null} {
    const widthMatch = /width=(\d+)/.exec(attrsStr);
    const heightMatch = /height=(\d+)/.exec(attrsStr);

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

    const rawAttrs = m[1].slice(1, -1);
    const {width, height} = parseInlineAttrs(m[1]);

    return {consumeLength: m[0].length, width, height, rawAttrs};
}

const EMPTY_MANAGED_ATTR_RE = /^(?:width|height)=$/;

function setRawAttr(rawAttrs: string, name: string, value: string, prepend: boolean): string {
    const key = `${name}=`;
    const attr = `${key}${value}`;
    const parts: string[] = [];
    let replaced = false;

    for (const part of rawAttrs.split(/\s+/)) {
        if (!part || EMPTY_MANAGED_ATTR_RE.test(part)) {
            continue;
        }

        if (part.startsWith(key)) {
            if (!replaced) {
                parts.push(attr);
                replaced = true;
            }

            continue;
        }

        parts.push(part);
    }

    if (!replaced) {
        if (prepend) {
            parts.unshift(attr);
        } else {
            parts.push(attr);
        }
    }

    return parts.join(' ');
}

function removeRawAttr(rawAttrs: string, name: string): string {
    const key = `${name}=`;

    return rawAttrs
        .split(/\s+/)
        .filter((part) => part && !part.startsWith(key))
        .join(' ');
}

export function rebuildRawAttrs(
    rawAttrs: string,
    width: string | null,
    height: string | null,
): string {
    let result = rawAttrs;

    if (width !== null) {
        if (width) {
            result = setRawAttr(result, 'width', width, true);
        } else {
            result = removeRawAttr(result, 'width');
        }
    }

    if (height !== null) {
        if (height) {
            result = setRawAttr(result, 'height', height, false);
        } else {
            result = removeRawAttr(result, 'height');
        }
    }

    return result.trim();
}
