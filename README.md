# Blindspot

> **"See what your reasoning might be missing."**

An AI-powered reasoning analysis tool that surfaces blind spots, assumptions, and overlooked factors — without ever making the decision for you.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add your Gemini API key

Copy the example env file and add your key:

```bash
copy .env.example .env
```

Edit `.env`:

```
GEMINI_API_KEY=your_actual_key_here
PORT=3001
```

### 3. Run

```bash
npm run dev
```

Open → **http://localhost:3001**

---

## Architecture

```
public/           Static frontend (HTML + CSS + JS modules)
├── index.html
├── css/
│   ├── reset.css
│   ├── tokens.css        Design system variables
│   ├── layout.css        Page sections, nav, hero
│   ├── components.css    Buttons, form, cards
│   ├── xray.css          Reasoning X-Ray grid
│   └── reflection.css    Reflection section
└── js/
    ├── state.js          AppState object
    ├── api.js            /analyze fetch wrapper + retry
    ├── validate.js       AI response schema validator
    ├── render.js         DOM construction (never innerHTML with AI content)
    └── app.js            Entry point + event wiring

server.js         Express proxy — keeps API key server-side
```

## Test Scenarios

Run these manually in the browser to verify:

| Test | Decision | Expected |
|---|---|---|
| Internship | "Accept a 6-month tech internship" | Academic impact, mentorship, startup risk surfaced |
| Laptop | "MacBook vs cheap Windows laptop" | Actual workload, repairability, future needs |
| Moving | "Move to Bangalore for a job" | Support system, cost of living, opportunity cost |
| Vague input | "I need to make a decision" | Clarifying questions, minimal blind spots |
| Error | Kill server, submit form | Friendly error message + retry button |
| Malformed JSON | N/A | Handled by validate.js — no crash |

## Security Notes

- API key lives only in `.env` — never sent to the browser
- All AI content rendered via `textContent` — never `innerHTML`
- User input sanitised and length-limited on the server
- Rate limiting: 15 requests/minute per IP
