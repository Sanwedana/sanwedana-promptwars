/**
 * validate.js — Schema validation for AI analysis response.
 * All fields default to empty arrays / strings — never throws.
 */

const MAX_TEXT_LENGTH = 4000;
const MAX_ITEMS_PER_SECTION = 20;

function text(value) {
  return String(value || "")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

/**
 * Ensure item has the expected shape for a finding card.
 * @param {any} item
 * @returns {{ title: string, explanation: string, why_it_matters: string, question_to_explore: string }}
 */
function normalizeFinding(item) {
  if (!item || typeof item !== "object") return null;
  return {
    title: text(item.title),
    explanation: text(item.explanation),
    why_it_matters: text(item.why_it_matters),
    question_to_explore: text(item.question_to_explore),
  };
}

function normalizePattern(item) {
  if (!item || typeof item !== "object") return null;
  return {
    title: text(item.title),
    explanation: text(item.explanation),
    why_it_matters: text(item.why_it_matters),
  };
}

function normalizeEvidence(item) {
  if (!item || typeof item !== "object") return null;
  return {
    title: text(item.title),
    description: text(item.description),
  };
}

function normalizeWCMM(item) {
  if (!item || typeof item !== "object") return null;
  return {
    belief: text(item.belief),
    assumption_supporting_it: text(item.assumption_supporting_it),
    evidence_that_could_shift_it: text(item.evidence_that_could_shift_it),
  };
}

/**
 * Validate and normalise an AI analysis response.
 * @param {any} raw
 * @returns {object} Safe, normalised analysis object
 */
export function validateAnalysis(raw) {
  if (!raw || typeof raw !== "object") {
    raw = {};
  }

  const findingFields = [
    "blind_spots",
    "assumptions",
    "missing_information",
    "tradeoffs",
    "contradictions",
  ];

  const result = {
    decision_summary: String(raw.decision_summary || "").trim(),

    blind_spots: [],
    assumptions: [],
    missing_information: [],
    tradeoffs: [],
    contradictions: [],
    possible_reasoning_patterns: [],
    questions_to_explore: [],
    evidence_to_seek: [],
    what_could_change_my_mind: [],
  };

  // Normalise finding arrays
  for (const field of findingFields) {
    if (Array.isArray(raw[field])) {
      result[field] = raw[field]
        .slice(0, MAX_ITEMS_PER_SECTION)
        .map(normalizeFinding)
        .filter(Boolean)
        .filter((item) => item.title || item.explanation);
    }
  }

  // Patterns
  if (Array.isArray(raw.possible_reasoning_patterns)) {
    result.possible_reasoning_patterns = raw.possible_reasoning_patterns
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map(normalizePattern)
      .filter(Boolean)
      .filter((item) => item.title || item.explanation);
  }

  // Questions — may be strings or objects
  if (Array.isArray(raw.questions_to_explore)) {
    result.questions_to_explore = raw.questions_to_explore
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map((q) => (typeof q === "string" ? text(q) : text(q?.question || q)))
      .filter(Boolean);
  }

  // Evidence
  if (Array.isArray(raw.evidence_to_seek)) {
    result.evidence_to_seek = raw.evidence_to_seek
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map(normalizeEvidence)
      .filter(Boolean)
      .filter((item) => item.title || item.description);
  }

  // WCMM
  if (Array.isArray(raw.what_could_change_my_mind)) {
    result.what_could_change_my_mind = raw.what_could_change_my_mind
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map(normalizeWCMM)
      .filter(Boolean)
      .filter((item) => item.belief);
  }

  return result;
}
