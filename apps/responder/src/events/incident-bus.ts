import type { AgentStep, RCA } from '@sre/shared';

export type BusMessage =
  | { kind: 'step'; step: AgentStep }
  | { kind: 'rca'; rca: RCA }
  | { kind: 'done' }
  | { kind: 'failed'; reason: string };

type Listener = (msg: BusMessage) => void;

const channels = new Map<string, Set<Listener>>();

export function publish(incidentId: string, msg: BusMessage): void {
  const set = channels.get(incidentId);
  if (!set) return; // no live subscribers; DB replay catches a late joiner up
  for (const listener of [...set]) listener(msg);
}

export function subscribe(incidentId: string, listener: Listener): () => void {
  let set = channels.get(incidentId);
  if (!set) {
    set = new Set();
    channels.set(incidentId, set);
  }
  set.add(listener);
  return () => {
    const s = channels.get(incidentId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) channels.delete(incidentId);
  };
}
