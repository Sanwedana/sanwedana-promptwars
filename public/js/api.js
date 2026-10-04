/**
 * api.js — Thin fetch wrapper for the /analyze endpoint.
 * Handles retry logic and structured error extraction.
 */

const ANALYZE_URL = "/analyze";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1200;
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw Object.assign(
          new Error("The server returned an invalid response."),
          { noRetry: true },
        );
      }

      if (!res.ok) {
        if ([400, 401, 403, 404, 413, 415].includes(res.status)) {
          throw Object.assign(new Error(data.error || "Request error"), {
            noRetry: true,
          });
        }
        const error = new Error(
          data.error || "The analysis service is temporarily unavailable.",
        );
        error.status = res.status;
        throw error;
      }

      if (!data.analysis) {
        throw new Error("Unexpected response format from analysis service.");
      }

      return data.analysis;
    } catch (err) {
      lastError = err;
      if (err instanceof TypeError) {
        lastError = new Error(
          "Could not reach the analysis server. Please check that it is running and try again.",
        );
      }
      if (err.name === "AbortError") {
        lastError = Object.assign(
          new Error("The analysis request timed out. Please try again."),
          { noRetry: true },
        );
      }
      if (err.noRetry || attempt === MAX_RETRIES - 1) break;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
