import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function deferred(name: string): () => string {
  return () => required(name);
}

function deferredNumber(name: string): () => number {
  return () => Number(required(name));
}

export const env = {
  // Lazy on purpose: importing this module (e.g. an agent tool that only
  // needs TARGET_REPO_PATH) must not require PORT/DATABASE_URL to be set.
  // Each var is validated the first time its own getter is called.
  PORT: deferredNumber('PORT'),
  DATABASE_URL: deferred('DATABASE_URL'),

  ANTHROPIC_API_KEY: deferred('ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL: deferred('ANTHROPIC_MODEL'),
  GITHUB_TOKEN: deferred('GITHUB_TOKEN'),
  TARGET_REPO: deferred('TARGET_REPO'),
  TARGET_REPO_PATH: deferred('TARGET_REPO_PATH'),
} as const;
