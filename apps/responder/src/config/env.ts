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

export const env = {
  PORT: Number(required('PORT')),
  DATABASE_URL: required('DATABASE_URL'),

  ANTHROPIC_API_KEY: deferred('ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL: deferred('ANTHROPIC_MODEL'),
  GITHUB_TOKEN: deferred('GITHUB_TOKEN'),
  TARGET_REPO: deferred('TARGET_REPO'),
  TARGET_REPO_PATH: deferred('TARGET_REPO_PATH'),
} as const;
