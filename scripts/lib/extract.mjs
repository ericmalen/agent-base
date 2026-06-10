// extract.mjs — pure extraction logic for inventory-extract.
// No I/O here except what callers inject; everything is unit-testable.
//
// Block model (plan §3):
// - fence-aware Markdown parsing: a `#` inside a code fence is NOT a heading
// - pre-first-heading content = explicit `preamble` pseudo-block
// - setext headings supported (=== → h1, --- → h2)
// - YAML frontmatter = its own node
// - blocks split at heading levels 1–3; deeper headings stay inside their block
// - JSON/JSONC surfaces = one whole-file node + top-level key inventory
//   (routing for JSON happens via key-merge ops, not byte slicing)
//
// Invariant (tested): the concatenation of a file's block bytes is
// byte-identical to the original file content. Blocks TILE the file.

import { createHash } from 'node:crypto';

export const SPLIT_MAX_HEADING_LEVEL = 3;

// ── Line splitting (terminator-preserving) ──────────────────────────────────

// Split text into lines, each KEEPING its terminator. Guarantees join(lines) === text.
export function splitLinesKeepEnds(text) {
  if (text === '') return [];
  const lines = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      lines.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

const stripEnd = (line) => line.replace(/\r?\n$/, '');

// ── File-level metadata ─────────────────────────────────────────────────────

export function detectLineEnding(text) {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/\n/g) ?? []).length - crlf;
  if (crlf === 0 && lf === 0) return 'none';
  if (crlf > 0 && lf > 0) return 'mixed';
  return crlf > 0 ? 'crlf' : 'lf';
}

export function hasFinalNewline(text) {
  return text.length > 0 && text.endsWith('\n');
}

export function isBinary(buf) {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// ── Markdown block parser ───────────────────────────────────────────────────

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const ATX_RE = /^ {0,3}(#{1,6})(\s|$)/;
const SETEXT_RE = /^ {0,3}(=+|-+)\s*$/;

function atxLevel(line) {
  const m = ATX_RE.exec(line);
  return m ? m[1].length : 0;
}

function atxText(line) {
  return stripEnd(line).replace(/^ {0,3}#{1,6}\s*/, '').replace(/\s#+\s*$/, '').trim();
}

// Parse markdown text into blocks: [{ kind, heading, level, headingPath,
// startLine, endLine, text }] — 1-based inclusive line numbers over
// terminator-preserving lines. Blocks tile the input exactly.
export function parseMarkdownBlocks(text) {
  const lines = splitLinesKeepEnds(text);
  if (lines.length === 0) return [];

  // 1. Frontmatter
  let cursor = 0; // index into lines
  const blocks = [];
  if (stripEnd(lines[0]).trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      const t = stripEnd(lines[i]).trim();
      if (t === '---' || t === '...') {
        blocks.push({ kind: 'frontmatter', heading: null, level: 0, headingPath: [], start: 0, end: i });
        cursor = i + 1;
        break;
      }
    }
  }

  // 2. Heading scan (fence-aware), over lines[cursor..]
  // headingAt[i] = {level, text} when line i starts a new block.
  const headingAt = new Map();
  let inFence = false;
  let fenceMark = '';
  let prevNonBlankIsPlain = false; // candidate line for setext underline

  for (let i = cursor; i < lines.length; i++) {
    const raw = stripEnd(lines[i]);
    const fm = FENCE_RE.exec(raw);
    if (fm) {
      if (!inFence) {
        inFence = true;
        fenceMark = fm[1][0];
      } else if (fm[1][0] === fenceMark && raw.trim().length >= 3 && /^[`~]+$/.test(raw.trim())) {
        inFence = false;
      }
      prevNonBlankIsPlain = false;
      continue;
    }
    if (inFence) { prevNonBlankIsPlain = false; continue; }

    const lvl = atxLevel(raw);
    if (lvl > 0) {
      if (lvl <= SPLIT_MAX_HEADING_LEVEL) headingAt.set(i, { level: lvl, text: atxText(lines[i]), setext: false });
      prevNonBlankIsPlain = false;
      continue;
    }

    if (SETEXT_RE.test(raw) && prevNonBlankIsPlain) {
      const level = raw.trim()[0] === '=' ? 1 : 2;
      if (level <= SPLIT_MAX_HEADING_LEVEL) headingAt.set(i - 1, { level, text: stripEnd(lines[i - 1]).trim(), setext: true });
      prevNonBlankIsPlain = false;
      continue;
    }

    prevNonBlankIsPlain = raw.trim() !== '' && !headingAt.has(i);
  }

  // 3. Assemble blocks: preamble (cursor → first heading), then heading sections.
  const headingIdxs = [...headingAt.keys()].sort((a, b) => a - b);
  const firstHeading = headingIdxs.length ? headingIdxs[0] : lines.length;

  if (cursor < firstHeading) {
    blocks.push({ kind: 'preamble', heading: null, level: 0, headingPath: [], start: cursor, end: firstHeading - 1 });
  }

  const stack = []; // ancestor headings
  for (let k = 0; k < headingIdxs.length; k++) {
    const startIdx = headingIdxs[k];
    const endIdx = (k + 1 < headingIdxs.length ? headingIdxs[k + 1] : lines.length) - 1;
    const { level, text: htext } = headingAt.get(startIdx);
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const headingPath = stack.map((s) => s.text);
    stack.push({ level, text: htext });
    blocks.push({ kind: 'section', heading: htext, level, headingPath, start: startIdx, end: endIdx });
  }

  // 4. Materialize text + 1-based line numbers; verify tiling.
  const out = blocks.map((b) => ({
    kind: b.kind,
    heading: b.heading,
    level: b.level,
    headingPath: b.headingPath,
    startLine: b.start + 1,
    endLine: b.end + 1,
    text: lines.slice(b.start, b.end + 1).join(''),
  }));

  const joined = out.map((b) => b.text).join('');
  if (joined !== text) {
    throw new Error('extractor invariant violated: blocks do not tile the file');
  }
  return out;
}

// ── JSON / JSONC ────────────────────────────────────────────────────────────

// Strip // and /* */ comments (string-aware) so JSONC parses as JSON.
export function stripJsonComments(text) {
  let out = '';
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\') { out += text[i + 1] ?? ''; i += 2; continue; }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') { inString = true; out += c; i++; continue; }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export function topLevelJsonKeys(text) {
  try {
    const parsed = JSON.parse(stripJsonComments(text));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { keys: Object.keys(parsed), parseError: false };
    }
    return { keys: [], parseError: false };
  } catch {
    return { keys: [], parseError: true };
  }
}

// ── Surface classification ──────────────────────────────────────────────────

// Enumerated AI surfaces (plan §3). Paths are repo-relative, forward slashes.
export function classifySurface(path) {
  const base = path.split('/').pop();
  const lower = path.toLowerCase();

  if (base === 'AGENTS.md' || base === 'CLAUDE.md' || base === 'CLAUDE.local.md') return 'instructions';
  if (path === '.github/copilot-instructions.md') return 'copilot-instructions';
  if (path.startsWith('.github/instructions/')) return 'github-instructions';
  if (path.startsWith('.github/prompts/')) return 'github-prompts';
  if (path.startsWith('.github/chatmodes/')) return 'github-chatmodes';
  if (path.startsWith('.github/skills/') || path.startsWith('.github/agents/')) return 'github-misplaced';
  if (path.startsWith('.claude/')) {
    if (path === '.claude/settings.json' || path === '.claude/settings.local.json') return 'claude-settings';
    return 'claude-assets';
  }
  if (path === '.vscode/settings.json') return 'vscode-settings';
  if (base === '.cursorrules' || base === '.windsurfrules' || base === '.clinerules') return 'other-tool';
  if (path.startsWith('.cursor/rules/')) return 'other-tool';
  if (path === 'GEMINI.md' || base === '.aider.conf.yml') return 'other-tool';
  if (lower === '.replit' || path.startsWith('.codeium/')) return 'other-tool';
  return null; // not an enumerated surface → sweep territory
}

export function fileKind(path) {
  if (/\.(md|mdc|markdown)$/i.test(path)) return 'markdown';
  if (/\.json$/i.test(path)) return 'json';
  return 'text';
}

// ── Content sweep ───────────────────────────────────────────────────────────

// Marker list (approved Phase 0; recall over precision — tune against fixtures).
export const SWEEP_MARKERS = [
  /\bclaude\b/i,
  /\bcopilot\b/i,
  /\bcursor\b/i,
  /\bwindsurf\b/i,
  /\baider\b/i,
  /\bgemini\b/i,
  /\bagents\.md\b/i,
  /\bsystem prompt\b/i,
  /\bai assistant\b/i,
  /\bwhen writing code\b/i,
  /\byou are an?\b/i,
  /\bllm\b/i,
  /\binstructions for (the )?ai\b/i,
];

const SWEEP_MAX_BYTES = 1024 * 1024;
const SWEEP_MAX_HITS_PER_FILE = 10;
const SWEEP_CONTEXT_CAP = 200;

export function sweepFile(path, text) {
  if (text.length > SWEEP_MAX_BYTES) {
    return { file: path, skipped: 'too-large', hits: [] };
  }
  const hits = [];
  const lines = splitLinesKeepEnds(text);
  for (let i = 0; i < lines.length && hits.length < SWEEP_MAX_HITS_PER_FILE; i++) {
    const line = stripEnd(lines[i]);
    for (const re of SWEEP_MARKERS) {
      const m = re.exec(line);
      if (m) {
        hits.push({ line: i + 1, marker: m[0].toLowerCase(), text: line.trim().slice(0, SWEEP_CONTEXT_CAP) });
        break; // one hit per line is enough
      }
    }
  }
  return hits.length ? { file: path, hits } : null;
}

// ── Whole-file extraction → nodes ───────────────────────────────────────────

// Returns { fileMeta, blocks } where blocks carry no IDs yet (assigned by caller
// in deterministic order across the whole repo).
export function extractFile(path, text) {
  const kind = fileKind(path);
  const fileMeta = {
    path,
    kind,
    surface: classifySurface(path),
    lineEnding: detectLineEnding(text),
    finalNewline: hasFinalNewline(text),
    sha256: sha256(text),
    bytes: Buffer.byteLength(text, 'utf8'),
  };

  let blocks;
  if (kind === 'markdown') {
    blocks = parseMarkdownBlocks(text);
  } else if (kind === 'json') {
    const { keys, parseError } = topLevelJsonKeys(text);
    fileMeta.jsonKeys = keys;
    if (parseError) fileMeta.jsonParseError = true;
    blocks = [{ kind: 'file', heading: null, level: 0, headingPath: [], startLine: 1, endLine: splitLinesKeepEnds(text).length || 1, text }];
  } else {
    blocks = [{ kind: 'file', heading: null, level: 0, headingPath: [], startLine: 1, endLine: splitLinesKeepEnds(text).length || 1, text }];
  }
  return { fileMeta, blocks };
}
