import { createHash } from 'node:crypto';
import type { ErrorEvent } from '@sre/shared';

// Strip the bits that change every crash but don't change WHAT broke:
// absolute paths, UUIDs, hex addresses, line/col numbers.
export function normalize(input: string): string {
  return input
    // absolute paths → keep only the file name.
    //   "/srv/app/src/users.service.ts" → "users.service.ts"
    .replace(/(?:\/[^\s():]+)*\/([^\s/():]+)/g, '$1')
    // UUIDs like "3f2504e0-4f89-11d3-9a0c-0305e82c3301" → "<uuid>"
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    // hex addresses like "0x7ffee3b2" and long bare hex runs → "<hex>"
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    // line:col numbers like ":42:18" or ":42" → gone
    .replace(/:\d+(?::\d+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pulls the top stack frames as "file:function", e.g. "users.service.ts:getUser".
// Handles both "at fn (location)" and "at location" stack line shapes.
export function parseFrames(stack: string, limit = 3): string[] {
  const frames: string[] = [];
  for (const line of stack.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;

    const withFn = trimmed.match(/^at\s+(.+?)\s+\((.+)\)$/);
    const noFn = trimmed.match(/^at\s+(.+)$/);
    if (!withFn && !noFn) continue;

    const fn = withFn ? withFn[1] : '<anon>';
    const location = withFn ? withFn[2] : noFn![1];

    const fileWithPos = location.split('/').pop() ?? location;
    const file = fileWithPos.replace(/:\d+(?::\d+)?$/, '');

    frames.push(`${file}:${fn}`);
    if (frames.length === limit) break;
  }
  return frames;
}

export function fingerprint(event: ErrorEvent): string {
  const material = normalize(event.message) + '\n' + parseFrames(event.stack).join('\n');
  return createHash('sha256').update(material).digest('hex');
}
