/**
 * app.js — Entry point. Wires up DOM events and orchestrates state → API → render.
 */

import { AppState, setState } from './state.js';
import { analyzeReasoning } from './api.js';
import { validateAnalysis } from './validate.js';
import { renderXRay, renderReflection } from './render.js';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const form              = document.getElementById('decision-form');
const btnSubmit         = document.getElementById('btn-submit');
const btnSubmitText     = document.getElementById('btn-submit-text');
const btnSubmitSpinner  = document.getElementById('btn-submit-spinner');

const fieldDecision     = document.getElementById('field-decision');
const fieldReasoning    = document.getElementById('field-reasoning');
const fieldBasis        = document.getElementById('field-basis');
const fieldUncertainty  = document.getElementById('field-uncertainty');

const errorDecision     = document.getElementById('error-decision');
const errorReasoning    = document.getElementById('error-reasoning');

const errorBanner       = document.getElementById('error-banner');
const errorBannerText   = document.getElementById('error-banner-text');
const btnRetry          = document.getElementById('btn-retry');

const loadingOverlay    = document.getElementById('loading-overlay');
const xraySection       = document.getElementById('xray-section');
const xrayContainer     = document.getElementById('xray-container');
const reflectionSection = document.getElementById('reflection-section');
const reflectionContainer = document.getElementById('reflection-container');

const btnAnalyzeHero    = document.getElementById('btn-analyze-hero');
const btnTryExample     = document.getElementById('btn-try-example');
const btnAnalyzeAgain   = document.getElementById('btn-analyze-again');

// ─── Example decision (for demo / judge presentation) ─────────────────────────
const EXAMPLE = {
  decision: 'Whether to accept a 6-month tech internship at a startup',
  reasoning: 'The stipend is good (₹25,000/month), the office is only 20 minutes away, and it is in the tech industry I want to enter. The role involves real product work and the company has a decent LinkedIn presence.',
  basis: 'The offer letter, the company\'s website, and a recommendation from a friend who did an internship there last year.',
  uncertainty: 'Whether my college schedule next semester will conflict with the working hours.',
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function setFieldError(field, errorEl, message) {
  field.classList.toggle('is-invalid', !!message);
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  errorEl.textContent = message || '';
  errorEl.classList.toggle('is-visible', !!message);
}

function clearFieldErrors() {
  setFieldError(fieldDecision, errorDecision, '');
  setFieldError(fieldReasoning, errorReasoning, '');
}

function showErrorBanner(message) {
  errorBannerText.textContent = message;
  errorBanner.classList.add('is-visible');
  errorBanner.setAttribute('role', 'alert');
  errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideErrorBanner() {
  errorBanner.classList.remove('is-visible');
}

function setLoading(isLoading) {
  btnSubmit.disabled = isLoading;
  btnSubmit.setAttribute('aria-busy', String(isLoading));
  btnSubmitSpinner.style.display = isLoading ? 'block' : 'none';
  btnSubmitText.textContent = isLoading ? 'Analysing…' : 'X-Ray My Reasoning';
  loadingOverlay.classList.toggle('is-visible', isLoading);
}

function validateForm() {
  let valid = true;
  const decision = fieldDecision.value.trim();
  const reasoning = fieldReasoning.value.trim();

  if (!decision) {
    setFieldError(fieldDecision, errorDecision, 'Please describe what you are deciding.');
    valid = false;
  } else {
    setFieldError(fieldDecision, errorDecision, '');
  }

  if (!reasoning) {
    setFieldError(fieldReasoning, errorReasoning, 'Please share your current reasoning.');
    valid = false;
  } else if (reasoning.length < 10) {
    setFieldError(fieldReasoning, errorReasoning, 'Please provide a bit more detail about your reasoning.');
    valid = false;
  } else {
    setFieldError(fieldReasoning, errorReasoning, '');
  }

  return valid;
}

// ─── Core submission flow ─────────────────────────────────────────────────────

async function handleSubmit(e) {
  if (e) e.preventDefault();

  clearFieldErrors();
  hideErrorBanner();

  if (!validateForm()) {
    fieldDecision.focus();
    return;
  }

  const input = {
    decision:    fieldDecision.value.trim(),
    reasoning:   fieldReasoning.value.trim(),
    basis:       fieldBasis.value.trim(),
    uncertainty: fieldUncertainty.value.trim(),
  };

  setState({ status: 'loading', input, error: null });
  setLoading(true);

  // Temporarily hide previous results
  xraySection.classList.remove('is-visible');
  reflectionSection.classList.remove('is-visible');

  try {
    const raw = await analyzeReasoning(input);
    const analysis = validateAnalysis(raw);

    setState({ status: 'success', analysis });

    // Save to localStorage (optional restore on refresh)
    try {
      localStorage.setItem('blindspot_last', JSON.stringify({ input, analysis, ts: Date.now() }));
    } catch (_) { /* localStorage not critical */ }

    setLoading(false);
    renderResults(analysis);

  } catch (err) {
    setState({ status: 'error', error: err.message });
    setLoading(false);
    showErrorBanner(err.message || 'An unexpected error occurred. Please try again.');
  }
}

function renderResults(analysis) {
  // Render X-Ray
  renderXRay(analysis, xrayContainer);
  xraySection.classList.add('is-visible');

  // Render Reflection
  renderReflection(analysis, reflectionContainer);
  reflectionSection.classList.add('is-visible');

  // Scroll to X-Ray, then focus heading
  xraySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => {
    const xrayHeading = document.getElementById('xray-heading');
    if (xrayHeading) xrayHeading.focus();
  }, 600);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

form.addEventListener('submit', handleSubmit);

btnRetry.addEventListener('click', () => {
  hideErrorBanner();
  handleSubmit(null);
});

btnAnalyzeHero.addEventListener('click', () => {
  document.getElementById('canvas-section').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => fieldDecision.focus(), 500);
});

btnTryExample.addEventListener('click', () => {
  fieldDecision.value    = EXAMPLE.decision;
  fieldReasoning.value   = EXAMPLE.reasoning;
  fieldBasis.value       = EXAMPLE.basis;
  fieldUncertainty.value = EXAMPLE.uncertainty;
  document.getElementById('canvas-section').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => fieldDecision.focus(), 500);
});

if (btnAnalyzeAgain) {
  btnAnalyzeAgain.addEventListener('click', () => {
    document.getElementById('canvas-section').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => fieldDecision.focus(), 400);
  });
}

// ─── Character counters ───────────────────────────────────────────────────────

function setupCounter(field, counterId, max = 2000) {
  const counter = document.getElementById(counterId);
  if (!counter) return;
  const update = () => {
    const len = field.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.style.color = len > max * 0.9 ? 'var(--color-error)' : '';
  };
  field.addEventListener('input', update);
  update();
}

setupCounter(fieldDecision, 'counter-decision');
setupCounter(fieldReasoning, 'counter-reasoning');
setupCounter(fieldBasis, 'counter-basis');
setupCounter(fieldUncertainty, 'counter-uncertainty');

// ─── Restore last analysis from localStorage ──────────────────────────────────

(function maybeRestoreLast() {
  try {
    const saved = localStorage.getItem('blindspot_last');
    if (!saved) return;
    const { input, analysis, ts } = JSON.parse(saved);
    if (!input || !analysis) return;

    // Only restore if saved within last 2 hours
    if (Date.now() - ts > 2 * 60 * 60 * 1000) return;

    // Silently restore form values
    if (input.decision)    fieldDecision.value    = input.decision;
    if (input.reasoning)   fieldReasoning.value   = input.reasoning;
    if (input.basis)       fieldBasis.value       = input.basis;
    if (input.uncertainty) fieldUncertainty.value = input.uncertainty;

    // Show restored results
    setState({ status: 'success', analysis, input });
    renderResults(analysis);

    // Scroll back to top after render
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 50);
  } catch (_) { /* non-critical */ }
})();
