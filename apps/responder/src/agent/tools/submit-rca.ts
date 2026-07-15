import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import type { RCA } from '@sre/shared';
import { type Tool, type ToolResult, ok, err } from './types.js';

const rcaSchema = z.object({
  root_cause: z.string().min(1),
  confidence: z.number().min(0).max(1),
  suspect_commit: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  proposed_patch: z.string().min(1), // AC: non-empty patch
  postmortem_md: z.string().min(1),
}) satisfies z.ZodType<RCA>;

export const schema: Anthropic.Tool = {
  name: 'submit_rca',
  description:
    'Terminal tool. Submit the final root-cause analysis. Call this exactly ' +
    'once, only after you have grounded every claim in evidence (commit shas, ' +
    'file:line). proposed_patch MUST be a unified diff that `git apply` accepts.',
  input_schema: {
    type: 'object',
    properties: {
      root_cause: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      suspect_commit: { type: 'string' },
      evidence: { type: 'array', items: { type: 'string' } },
      proposed_patch: { type: 'string', description: 'git apply-compatible diff' },
      postmortem_md: { type: 'string' },
    },
    required: [
      'root_cause',
      'confidence',
      'suspect_commit',
      'evidence',
      'proposed_patch',
      'postmortem_md',
    ],
  },
};

export async function execute(input: unknown): Promise<ToolResult> {
  const parsed = rcaSchema.safeParse(input);
  if (!parsed.success) {
    // Structured, model-correctable error — lists exactly what's wrong.
    return err(
      'Invalid RCA: ' +
        parsed.error.issues
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; '),
    );
  }
  // data IS the validated RCA. Loop (Phase 4) treats submit_rca as terminal by
  // name and calls setRca()/setStatus('resolved') with this payload.
  return ok(parsed.data satisfies RCA);
}

export default { schema, execute } satisfies Tool;
