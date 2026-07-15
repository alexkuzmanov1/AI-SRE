import type Anthropic from '@anthropic-ai/sdk';

/** Every execute() returns one of these — success with data, or a clean error.
 *  Tools NEVER throw; a missing file / bad sha / traversal attempt becomes
 *  { ok: false, error } that the model can read and react to. */
export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

/** The public shape of every tool file: exactly `{ schema, execute }`. */
export interface Tool {
  /** Anthropic-native tool definition: { name, description, input_schema }. */
  schema: Anthropic.Tool;
  /** Runs the tool. Input is the raw JSON the model produced; the tool is
   *  responsible for validating it (zod) and returning a ToolResult. */
  execute(input: unknown): Promise<ToolResult>;
}

export const ok = (data: unknown): ToolResult => ({ ok: true, data });
export const err = (error: string): ToolResult => ({ ok: false, error });
