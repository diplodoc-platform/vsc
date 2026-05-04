export const HREF_RE = /^\s*(?:-\s+)?href:\s+['"]?([^'"#\s]+)['"]?\s*$/;
export const INCLUDE_PATH_RE = /^\s+path:\s+['"]?([^'"#\s]+)['"]?\s*$/;
export const MD_INCLUDE_RE = /{%\s*include\s*\[[^\]]*\]\(([^)]+)\)\s*%}/g;
