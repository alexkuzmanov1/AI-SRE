import type { ErrorEvent } from '@sre/shared';

// Placeholder proving the @sre/shared seam resolves. Real Fastify app lands in Phase 1.
const placeholder: ErrorEvent = {
  service: 'responder',
  message: 'workspace wiring ok',
  stack: '',
  route: '/health',
  timestamp: new Date().toISOString(),
};

console.log(placeholder);
