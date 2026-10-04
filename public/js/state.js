/**
 * state.js — Single source of truth for application state.
 * No subscription system needed — callers trigger renders directly.
 */

export const AppState = {
  /** @type {'idle' | 'loading' | 'success' | 'error'} */
  status: 'idle',

  /** @type {{ decision: string, reasoning: string, basis: string, uncertainty: string }} */
  input: {
    decision: '',
    reasoning: '',
    basis: '',
    uncertainty: '',
  },

  /** @type {object | null} Validated AI analysis result */
  analysis: null,

  /** @type {string | null} Human-readable error message */
  error: null,
};

/**
 * Update AppState with shallow merge.
 * @param {Partial<typeof AppState>} updates
 */
export function setState(updates) {
  Object.assign(AppState, updates);
}
