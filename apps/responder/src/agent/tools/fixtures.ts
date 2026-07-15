/** apps/responder/fixtures/ — same relative depth from src/ and dist/. */
export const fixturesDir = new URL('../../../fixtures/', import.meta.url);
export const fixtureUrl = (name: string) => new URL(name, fixturesDir);
