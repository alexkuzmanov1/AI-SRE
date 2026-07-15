import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { publish, subscribe, type BusMessage } from './incident-bus.js';

function doneMsg(): BusMessage {
  return { kind: 'done' };
}

test('two subscribers on the same incident both receive a published message', () => {
  const id = randomUUID();
  const receivedA: BusMessage[] = [];
  const receivedB: BusMessage[] = [];
  const unsubA = subscribe(id, (m) => receivedA.push(m));
  const unsubB = subscribe(id, (m) => receivedB.push(m));

  publish(id, doneMsg());

  assert.equal(receivedA.length, 1);
  assert.equal(receivedB.length, 1);
  unsubA();
  unsubB();
});

test('channel isolation: a subscriber to incident A does not receive incident B messages', () => {
  const a = randomUUID();
  const b = randomUUID();
  const receivedOnA: BusMessage[] = [];
  const unsub = subscribe(a, (m) => receivedOnA.push(m));

  publish(b, doneMsg());

  assert.equal(receivedOnA.length, 0);
  unsub();
});

test('unsubscribe stops delivery and leaves no listener behind', () => {
  const id = randomUUID();
  let calls = 0;
  const unsub = subscribe(id, () => {
    calls++;
  });

  publish(id, doneMsg());
  assert.equal(calls, 1);

  unsub();
  publish(id, doneMsg()); // channel now empty; must be a silent no-op

  assert.equal(calls, 1, 'listener must not fire after unsubscribe');
});

test('publishing to an incident with zero subscribers does not throw', () => {
  assert.doesNotThrow(() => publish(randomUUID(), doneMsg()));
});

test('calling the unsubscribe function twice is safe', () => {
  const id = randomUUID();
  const unsub = subscribe(id, () => {});
  unsub();
  assert.doesNotThrow(() => unsub());
});
