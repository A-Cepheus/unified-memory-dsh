import type { ClaudeFrontmatterSchema, ClaudeMemoryType } from '../types.js';

export interface ParsedFrontmatter {
  hasFrontmatter: boolean;
  parseError?: string;
  data: Record<string, unknown>;
  body: string;
}

function unquoteYamlScalar(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2) {
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }
  }
  return trimmed;
}

function parseInlineArray(raw: string): string[] {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  const items: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escape = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\' && quote === '"') {
      current += ch;
      escape = true;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ',') {
      if (current.trim()) items.push(unquoteYamlScalar(current));
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) items.push(unquoteYamlScalar(current));
  return items;
}

/**
 * Minimal, dependency-free YAML frontmatter parser tailored for Claude Code
 * topic memory files (flat & nested `metadata:` map) and `.claude/rules/*.md`
 * (`paths:` array, folded/literal strings, quoted strings).
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n') && normalized !== '---') {
    return { hasFrontmatter: false, data: {}, body: normalized };
  }

  const lines = normalized.split('\n');
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    return {
      hasFrontmatter: false,
      parseError: 'Unclosed YAML frontmatter delimiter',
      data: {},
      body: normalized,
    };
  }

  const fmLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n').replace(/^\n+/, '');
  const data: Record<string, unknown> = {};

  let i = 0;
  try {
    while (i < fmLines.length) {
      const line = fmLines[i];
      if (!line.trim() || line.trim().startsWith('#')) {
        i++;
        continue;
      }

      // Top-level key
      const match = /^([A-Za-z0-9_-]+)\s*:(.*)$/.exec(line);
      if (!match) {
        return {
          hasFrontmatter: true,
          parseError: `Invalid frontmatter line ${i + 2}: ${line}`,
          data: {},
          body,
        };
      }

      const key = match[1];
      const rest = match[2].trim();

      // Multiline scalar block (>-, >, |-, |)
      if (rest === '>' || rest === '>-' || rest === '|' || rest === '|-') {
        const blockLines: string[] = [];
        let baseIndent: number | null = null;
        i++;
        while (i < fmLines.length) {
          const next = fmLines[i];
          if (next.trim() === '') {
            blockLines.push('');
            i++;
            continue;
          }
          const indent = next.length - next.trimStart().length;
          if (indent === 0) break;
          if (baseIndent === null) baseIndent = indent;
          blockLines.push(next.slice(Math.min(baseIndent, indent)));
          i++;
        }
        const joined = rest.startsWith('>')
          ? blockLines
              .join('\n')
              .replace(/([^\n])\n([^\n])/g, '$1 $2')
              .trim()
          : blockLines.join('\n').trimEnd();
        data[key] = joined;
        continue;
      }

      // Inline array
      if (rest.startsWith('[') && rest.endsWith(']')) {
        data[key] = parseInlineArray(rest);
        i++;
        continue;
      }

      // Nested block (either array of `- item` or nested map `subkey: val`)
      if (rest === '') {
        i++;
        const nestedLines: string[] = [];
        while (i < fmLines.length) {
          const next = fmLines[i];
          if (!next.trim() || next.trim().startsWith('#')) {
            i++;
            continue;
          }
          const indent = next.length - next.trimStart().length;
          if (indent === 0) break;
          nestedLines.push(next.trim());
          i++;
        }

        if (nestedLines.length === 0) {
          data[key] = '';
        } else if (nestedLines.every((l) => l.startsWith('-'))) {
          data[key] = nestedLines.map((l) => unquoteYamlScalar(l.slice(1).trim()));
        } else {
          const nestedMap: Record<string, string> = {};
          for (const nl of nestedLines) {
            const nm = /^([A-Za-z0-9_-]+)\s*:(.*)$/.exec(nl);
            if (nm) {
              nestedMap[nm[1]] = unquoteYamlScalar(nm[2]);
            }
          }
          data[key] = nestedMap;
        }
        continue;
      }

      // Plain scalar
      data[key] = unquoteYamlScalar(rest);
      i++;
    }
  } catch (err) {
    return {
      hasFrontmatter: true,
      parseError: err instanceof Error ? err.message : String(err),
      data: {},
      body,
    };
  }

  return { hasFrontmatter: true, data, body };
}

export function extractTopicMetadata(parsed: ParsedFrontmatter): {
  name?: string;
  description?: string;
  type?: string;
  nodeType?: string;
  originSessionId?: string;
  modified?: string;
  schema: ClaudeFrontmatterSchema;
  extraTopLevel: Record<string, unknown>;
  extraMetadata: Record<string, string>;
} {
  if (!parsed.hasFrontmatter || parsed.parseError) {
    return {
      schema: 'none',
      extraTopLevel: {},
      extraMetadata: {},
    };
  }

  const d = parsed.data;
  const metaObj =
    d.metadata && typeof d.metadata === 'object' && !Array.isArray(d.metadata)
      ? (d.metadata as Record<string, string>)
      : null;

  const schema: ClaudeFrontmatterSchema = metaObj ? 'nested_metadata' : 'flat';
  const name = typeof d.name === 'string' ? d.name : undefined;
  const description = typeof d.description === 'string' ? d.description : undefined;
  const type =
    (metaObj && typeof metaObj.type === 'string' ? metaObj.type : undefined) ??
    (typeof d.type === 'string' ? d.type : undefined);
  const nodeType = metaObj && typeof metaObj.node_type === 'string' ? metaObj.node_type : undefined;
  const originSessionId =
    (metaObj && typeof metaObj.originSessionId === 'string'
      ? metaObj.originSessionId
      : undefined) ??
    (typeof d.originSessionId === 'string' ? d.originSessionId : undefined);
  const modified =
    metaObj && typeof metaObj.modified === 'string' ? metaObj.modified : undefined;

  const extraTopLevel: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (!['name', 'description', 'type', 'originSessionId', 'metadata'].includes(k)) {
      extraTopLevel[k] = v;
    }
  }

  const extraMetadata: Record<string, string> = {};
  if (metaObj) {
    for (const [k, v] of Object.entries(metaObj)) {
      if (!['node_type', 'type', 'originSessionId', 'modified'].includes(k)) {
        extraMetadata[k] = String(v);
      }
    }
  }

  return {
    name,
    description,
    type,
    nodeType,
    originSessionId,
    modified,
    schema,
    extraTopLevel,
    extraMetadata,
  };
}

function formatYamlScalar(value: string): string {
  const singleLine = value.replace(/\r?\n/g, ' ').trim();
  if (
    singleLine === '' ||
    /[:#[\]{}&*!|>'"%@`,?]/.test(singleLine) ||
    /^\s|\s$/.test(singleLine) ||
    /^(true|false|null|~|-)$/i.test(singleLine)
  ) {
    return JSON.stringify(singleLine);
  }
  return singleLine;
}

export interface SerializeTopicInput {
  name: string;
  description: string;
  type: ClaudeMemoryType;
  originSessionId?: string;
  modified?: string;
  body: string;
  extraTopLevel?: Record<string, unknown>;
  extraMetadata?: Record<string, string>;
}

/**
 * Serializes a Claude Code v2.1.x topic memory file using the canonical nested
 * `metadata:` frontmatter schema (`node_type: memory`, `type`, `originSessionId`, `modified`).
 */
export function serializeClaudeTopic(input: SerializeTopicInput): string {
  const modified = input.modified ?? new Date().toISOString();
  const lines: string[] = [
    '---',
    `name: ${formatYamlScalar(input.name)}`,
    `description: ${formatYamlScalar(input.description)}`,
  ];

  if (input.extraTopLevel) {
    for (const [k, v] of Object.entries(input.extraTopLevel)) {
      if (typeof v === 'string') {
        lines.push(`${k}: ${formatYamlScalar(v)}`);
      }
    }
  }

  lines.push('metadata:');
  lines.push('  node_type: memory');
  lines.push(`  type: ${formatYamlScalar(input.type)}`);
  if (input.originSessionId) {
    lines.push(`  originSessionId: ${formatYamlScalar(input.originSessionId)}`);
  }
  lines.push(`  modified: ${formatYamlScalar(modified)}`);

  if (input.extraMetadata) {
    for (const [k, v] of Object.entries(input.extraMetadata)) {
      lines.push(`  ${k}: ${formatYamlScalar(v)}`);
    }
  }

  lines.push('---');
  lines.push('');
  const cleanBody = input.body.replace(/\r\n/g, '\n').trim();
  if (cleanBody) {
    lines.push(cleanBody);
    lines.push('');
  }
  return lines.join('\n');
}
