export const KEY_VALUE_RE = /^(\s*)([\w-]+)\s*:\s*/;
export const MD_COLOR_RE = /\{([^{}]+)\}\(/g;
export const FENCE_RE = /^\s*(`{3,}|~{3,})/;
export const COLOR_FUNCTION_RE = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
export const BARE_HEX_RE = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
