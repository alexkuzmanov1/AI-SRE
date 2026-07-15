import { createHash } from 'node:crypto';
import type { ErrorEvent } from '@sre/shared';

export function normalize(input: string): string {
  return input
    .replace(/(?:\/[^\s():]+)*\/([^\s/():]+)/g, '$1')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/:\d+(?::\d+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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
