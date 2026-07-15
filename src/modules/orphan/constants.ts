export const HREF_RE = /^\s*(?:-\s+)?href:\s+['"]?([^'"#\s]+)['"]?\s*$/;
export const INCLUDE_PATH_RE = /^\s+path:\s+['"]?([^'"#\s]+)['"]?\s*$/;
export const INCLUDE_INLINE_PATH_RE = /include:\s*\{[^}]*\bpath:\s*['"]?([^'",}\s]+)/;
export const MD_INCLUDE_RE = /{%\s*include\s*\[[^\]]*\]\(([^)]+)\)\s*%}/g;

export const BULK_OPERATION_THRESHOLD = 3;
export const BULK_OPERATION_WINDOW_MS = 1500;
export const DELETE_FLUSH_DELAY_MS = 400;
