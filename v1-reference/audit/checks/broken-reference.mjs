import { existsSync, statSync } from 'node:fs';
import { posix, join, dirname } from 'node:path';
import { readText, finding as _finding, stripFencedCodeBlocks } from '../finding.mjs';

const f = (p) => _finding({ surface: p.surface ?? 'cross-file', ...p });

// Validates that markdown link targets and bare paths in agent ## Documents
// sections actually resolve to a file on disk. Catches breakage left behind
// when migrate folds content under a new location, when optimize extracts
// sections into siblings, or when files are renamed without updating
// inbound references.
//
// `surface` controls the surface tag on emitted findings (and for agents we
// also scan the ## Documents bare-path block).
export function checkBrokenReference(absPath, rel, consumerRoot, surface) {
  const text = readText(absPath);
  if (!text) return [];

  const findings = [];
  const stripped = stripFencedCodeBlocks(text);
  const lines = stripped.split('\n');
  const seen = new Set();

  // Inline markdown links + image links
  forEachInlineLink(stripped, (target, lineNum) => {
    emit(target, lineNum);
  });

  // Reference-style link definitions
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\[[^\]]+\]:\s+(\S+)/);
    if (m) emit(m[1], i + 1);
  }

  // Agent `## Documents` bare paths
  if (surface === 'agent') {
    for (const { path, line } of agentDocumentPaths(text)) {
      emit(path, line);
    }
  }

  function emit(rawTarget, line) {
    const target = stripTitle(rawTarget);
    if (!isLocalPath(target)) return;
    const cleanTarget = target.split('#')[0].split('?')[0];
    if (!cleanTarget) return;
    const key = `${line}::${cleanTarget}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (resolveTarget(cleanTarget, absPath, consumerRoot)) return;
    findings.push(f({
      surface,
      id: 'broken-reference',
      severity: 'warning',
      file: rel,
      line,
      message: `Reference to "${cleanTarget}" does not resolve to a file on disk.`,
      detail: 'Either the target was moved/renamed (update the link) or this file was relocated without rewriting its links. `git log -- <path>` may help locate the new path.',
      fixable: 'manual',
    }));
  }

  return findings;
}

function forEachInlineLink(text, cb) {
  const re = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const lineNum = text.slice(0, m.index).split('\n').length;
    cb(m[3], lineNum);
  }
}

function agentDocumentPaths(text) {
  const m = text.match(/##\s+documents?\b([\s\S]*?)(?=\n##|\s*$)/i);
  if (!m) return [];
  const sectionStart = text.slice(0, m.index).split('\n').length;
  const out = [];
  const sectionLines = m[1].split('\n');
  for (let i = 0; i < sectionLines.length; i++) {
    const line = sectionLines[i].trim();
    if (!line || line.startsWith('#')) continue;
    if (/^[-*]\s/.test(line)) continue; // Markdown bullets — not a bare path
    if (/^\[.+?\]\(.+?\)$/.test(line)) continue; // Already a markdown link — covered by inline scan
    if (!/[./]/.test(line)) continue; // Skip prose lines
    if (/\s/.test(line)) continue; // Bare paths have no whitespace
    out.push({ path: line, line: sectionStart + i });
  }
  return out;
}

function stripTitle(target) {
  const m = target.match(/^(\S+)\s+["'(]/);
  return m ? m[1] : target.trim();
}

function isLocalPath(p) {
  if (!p) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return false; // http:, https:, mailto:, etc.
  if (p.startsWith('#')) return false;
  if (p.startsWith('<') && p.endsWith('>')) return false;
  return true;
}

function resolveTarget(target, absPath, consumerRoot) {
  // Try relative-to-file first (the markdown default).
  const relativeAbs = posix.resolve(dirname(absPath), target);
  if (existsAndAccessible(relativeAbs)) return true;
  // Then try consumer-root absolute (our ## Documents convention).
  const rootAbs = join(consumerRoot, target.replace(/^\.?\//, ''));
  if (existsAndAccessible(rootAbs)) return true;
  return false;
}

function existsAndAccessible(p) {
  if (!existsSync(p)) return false;
  try { statSync(p); return true; } catch { return false; }
}
