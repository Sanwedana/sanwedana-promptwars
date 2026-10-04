/**
 * api.js — Thin fetch wrapper for the /analyze endpoint.
 * Handles retry logic and structured error extraction.
 */

const ANALYZE_URL = '/analyze';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1200;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call /analyze with retry logic.
 * @param {{ decision: string, reasoning: string, basis: string, uncertainty: string }} input
 * @returns {Promise<object>} Raw AI analysis object
 * @throws {Error} With a user-friendly .message
 */
export async function analyzeReasoning(input) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await res.json();

      if (!res.ok) {
        // Don't retry on client errors or auth failures
        if (res.status === 400 || res.status === 401) {
          throw Object.assign(new Error(data.error || 'Request error'), { noRetry: true });
        }
        throw new Error(data.error || `Server error (${res.status})`);
      }

      if (!data.analysis) {
        throw new Error('Unexpected response format from analysis service.');
      }

      return data.analysis;
    } catch (err) {
      lastError = err;
      if (err.noRetry || attempt === MAX_RETRIES - 1) break;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}
