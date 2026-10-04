/**
 * validate.js — Schema validation for AI analysis response.
 * All fields default to empty arrays / strings — never throws.
 */

const ARRAY_FIELDS = [
  'blind_spots',
  'assumptions',
  'missing_information',
  'tradeoffs',
  'contradictions',
  'possible_reasoning_patterns',
  'questions_to_explore',
  'evidence_to_seek',
  'what_could_change_my_mind',
];

/**
 * Ensure item has the expected shape for a finding card.
 * @param {any} item
 * @returns {{ title: string, explanation: string, why_it_matters: string, question_to_explore: string }}
 */
function normalizeFinding(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    title:             String(item.title || '').trim(),
    explanation:       String(item.explanation || '').trim(),
    why_it_matters:    String(item.why_it_matters || '').trim(),
    question_to_explore: String(item.question_to_explore || '').trim(),
  };
}

function normalizePattern(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    title:          String(item.title || '').trim(),
    explanation:    String(item.explanation || '').trim(),
    why_it_matters: String(item.why_it_matters || '').trim(),
  };
}

function normalizeEvidence(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    title:       String(item.title || '').trim(),
    description: String(item.description || '').trim(),
  };
}

function normalizeWCMM(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    belief:                    String(item.belief || '').trim(),
    assumption_supporting_it:  String(item.assumption_supporting_it || '').trim(),
    evidence_that_could_shift_it: String(item.evidence_that_could_shift_it || '').trim(),
  };
}

/**
 * Validate and normalise an AI analysis response.
 * @param {any} raw
 * @returns {object} Safe, normalised analysis object
 */
export function validateAnalysis(raw) {
  if (!raw || typeof raw !== 'object') {
    raw = {};
  }

  const findingFields = ['blind_spots', 'assumptions', 'missing_information', 'tradeoffs', 'contradictions'];

  const result = {
    decision_summary: String(raw.decision_summary || '').trim(),

    blind_spots:        [],
    assumptions:        [],
    missing_information: [],
    tradeoffs:          [],
    contradictions:     [],
    possible_reasoning_patterns: [],
    questions_to_explore: [],
    evidence_to_seek:   [],
    what_could_change_my_mind: [],
  };

  // Normalise finding arrays
  for (const field of findingFields) {
    if (Array.isArray(raw[field])) {
      result[field] = raw[field]
        .map(normalizeFinding)
        .filter(Boolean)
        .filter(item => item.title || item.explanation);
    }
  }

  // Patterns
  if (Array.isArray(raw.possible_reasoning_patterns)) {
    result.possible_reasoning_patterns = raw.possible_reasoning_patterns
      .map(normalizePattern)
      .filter(Boolean)
      .filter(item => item.title || item.explanation);
  }

  // Questions — may be strings or objects
  if (Array.isArray(raw.questions_to_explore)) {
    result.questions_to_explore = raw.questions_to_explore
      .map(q => (typeof q === 'string' ? q.trim() : String(q?.question || q || '').trim()))
      .filter(Boolean);
  }

  // Evidence
  if (Array.isArray(raw.evidence_to_seek)) {
    result.evidence_to_seek = raw.evidence_to_seek
      .map(normalizeEvidence)
      .filter(Boolean)
      .filter(item => item.title || item.description);
  }

  // WCMM
  if (Array.isArray(raw.what_could_change_my_mind)) {
    result.what_could_change_my_mind = raw.what_could_change_my_mind
      .map(normalizeWCMM)
      .filter(Boolean)
      .filter(item => item.belief);
  }

  return result;
}
