/**
 * Codex agent adapter — stub.
 * Implement review() and resolve() here to add Codex/GPT-4 support.
 * The adapter contract is identical to claude.mjs.
 */

export async function review(_params) {
  throw new Error('Codex adapter not yet implemented. Set agent: claude in config.yml.');
}

export async function resolve(_params) {
  throw new Error('Codex adapter not yet implemented. Set agent: claude in config.yml.');
}
