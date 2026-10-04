require("dotenv").config();
const express = require("express");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── Gemini client ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ─── Sanitize user input ───────────────────────────────────────────────────────
function sanitize(str) {
  return String(str || "")
    .trim()
    .slice(0, 2000);
}

// ─── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Blindspot, a critical reasoning analysis engine.

Your purpose is to help users identify potential blind spots in their reasoning. You are NOT a decision-maker.

STRICT RULES:
1. NEVER tell the user what to decide. Never say "you should choose X", "accept", "reject", "buy", "move", or any equivalent.
2. Use language like: "One assumption in this reasoning may be...", "This may be worth examining...", "A factor that appears underexplored is...", "The decision may depend on..."
3. Be SPECIFIC to the user's actual words. Do not give generic life-advice.
4. If the user's input is very vague (fewer than 20 meaningful words total), return mostly empty arrays and populate "questions_to_explore" with clarifying questions instead of speculating.
5. Keep each explanation to 2–4 sentences maximum.
6. Do NOT diagnose psychological conditions or cognitive biases by clinical name.
7. Use "possible reasoning pattern" framing, not "you have X bias".
8. Acknowledge uncertainty. Use hedged language throughout.
9. Respond ONLY with valid JSON matching the exact schema provided. No text outside the JSON.

RESPONSE SCHEMA — you must follow this exactly:
{
  "decision_summary": "string — 1 concise sentence summarising what the user is deciding",
  "blind_spots": [{ "title": "string", "explanation": "string", "why_it_matters": "string", "question_to_explore": "string" }],
  "assumptions": [{ "title": "string", "explanation": "string", "why_it_matters": "string", "question_to_explore": "string" }],
  "missing_information": [{ "title": "string", "explanation": "string", "why_it_matters": "string", "question_to_explore": "string" }],
  "tradeoffs": [{ "title": "string", "explanation": "string", "why_it_matters": "string", "question_to_explore": "string" }],
  "contradictions": [{ "title": "string", "explanation": "string", "why_it_matters": "string", "question_to_explore": "string" }],
  "possible_reasoning_patterns": [{ "title": "string", "explanation": "string", "why_it_matters": "string" }],
  "questions_to_explore": ["string"],
  "evidence_to_seek": [{ "title": "string", "description": "string" }],
  "what_could_change_my_mind": [{ "belief": "string", "assumption_supporting_it": "string", "evidence_that_could_shift_it": "string" }]
}

Aim for 2–4 items in each array (where applicable). Quality over quantity.`;

// ─── Build user prompt from inputs ────────────────────────────────────────────
function buildUserPrompt({ decision, reasoning, basis, uncertainty }) {
  const isVague =
    (decision + reasoning + (basis || "") + (uncertainty || ""))
      .replace(/\s+/g, " ")
      .trim()
      .split(" ").length < 20;

  let prompt = `DECISION: ${decision}\n\nCURRENT REASONING: ${reasoning}`;
  if (basis) prompt += `\n\nINFORMATION THIS IS BASED ON: ${basis}`;
  if (uncertainty) prompt += `\n\nAREAS OF UNCERTAINTY: ${uncertainty}`;

  if (isVague) {
    prompt += `\n\nNOTE: The user's input is brief. Focus on generating clarifying questions in "questions_to_explore" rather than speculative blind spots. Keep other arrays minimal unless clearly supported.`;
  }

  prompt += `\n\nAnalyse this reasoning for blind spots, assumptions, missing information, trade-offs, contradictions, possible reasoning patterns, questions to explore, evidence to seek, and what could change the user's mind. Return only valid JSON.`;

  return prompt;
}

function parseJsonResponse(text, providerName) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // Fall through to the provider-specific error below.
      }
    }
    throw new Error(`${providerName} returned invalid JSON.`);
  }
}

function getErrorStatus(error) {
  return error?.status ?? error?.statusCode ?? error?.response?.status;
}

// ─── Simple in-memory rate limiter ────────────────────────────────────────────
const requestLog = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const maxReqs = 15;
  const timestamps = (requestLog.get(ip) || []).filter(
    (t) => now - t < windowMs,
  );
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > maxReqs;
}

// ─── NVIDIA Fallback ──────────────────────────────────────────────────────────
async function callNvidiaFallback(userPrompt) {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (!nvidiaKey) throw new Error("NVIDIA_API_KEY is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response;
  try {
    response = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${nvidiaKey}`,
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-70b-instruct",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 2048,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = new Error(`NVIDIA API returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("NVIDIA returned an empty response.");
  }
  return parseJsonResponse(text, "NVIDIA");
}

// ─── /analyze endpoint ────────────────────────────────────────────────────────
app.post("/analyze", async (req, res) => {
  // Rate limit
  const ip = req.ip || "unknown";
  if (isRateLimited(ip)) {
    return res
      .status(429)
      .json({
        error: "Too many requests. Please wait a moment before trying again.",
      });
  }

  // Extract and sanitize
  const { decision, reasoning, basis, uncertainty } = req.body || {};
  const clean = {
    decision: sanitize(decision),
    reasoning: sanitize(reasoning),
    basis: sanitize(basis),
    uncertainty: sanitize(uncertainty),
  };

  // Server-side required field validation
  if (!clean.decision || !clean.reasoning) {
    return res
      .status(400)
      .json({ error: "Decision and reasoning are required." });
  }

  const userPrompt = buildUserPrompt(clean);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(userPrompt);
    const text = result.response.text();
    const parsed = parseJsonResponse(text, "Gemini");

    return res.json({ analysis: parsed });
  } catch (err) {
    const primaryStatus = getErrorStatus(err);
    console.error(
      "[/analyze primary error]",
      primaryStatus || "unknown",
      err.message,
    );

    try {
      const fallbackResult = await callNvidiaFallback(userPrompt);
      return res.json({ analysis: fallbackResult });
    } catch (fallbackErr) {
      const fallbackStatus = getErrorStatus(fallbackErr);
      console.error(
        "[/analyze fallback error]",
        fallbackStatus || "unknown",
        fallbackErr.message,
      );
      return res
        .status(503)
        .json({
          error:
            "The analysis services are temporarily unavailable. Please try again shortly.",
        });
    }
  }
});

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Catch-all → serve index.html ─────────────────────────────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Blindspot server running → http://localhost:${PORT}`);
});
