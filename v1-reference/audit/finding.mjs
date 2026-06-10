import { readFileSync } from 'node:fs';

export function readText(absPath) {
  try { return readFileSync(absPath, 'utf8'); } catch { return null; }
}

export function lineOf(text, pattern) {
  const idx = text.search(pattern);
  if (idx === -1) return undefined;
  return text.slice(0, idx).split('\n').length;
}

export function isAiKitOwnAsset(consumerRelPath, manifest) {
  for (const entry of Object.values(manifest.files ?? {})) {
    if (entry.installedAs === consumerRelPath) {
      return entry.role === 'skill' || entry.role === 'agent';
    }
  }
  return false;
}

// Replace fenced code blocks (``` ... ```) with blank lines so detectors that
// scan prose don't false-positive on shell examples while preserving line numbers.
export function stripFencedCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ''));
}

export function finding({ id, severity, file, surface, line, message, detail, fixable, suggestedFix, convention }) {
  const f = { id, severity, file, surface, message, fixable };
  if (line != null) f.line = line;
  if (detail) f.detail = detail;
  if (suggestedFix) f.suggestedFix = suggestedFix;
  if (convention) f.convention = convention;
  return f;
}
