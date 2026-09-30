# Coach redesign — design

**Date:** 2026-09-30
**Branch:** `feature/coach-redesign` (from `worktree-redesign-tokens-home`, which carries the companion characters, PR #42)
**Status:** design approved in conversation; awaiting written-spec review
**Mockups:** `docs/design/coach-redesign/` — `answer-style-v2.html` (answers), `page-layout.html` (layout B chosen), `combo-8-10.html` (option A chosen), `sentence-style.html` (style 1 chosen). They are brainstorm fragments; open in a browser for the layout (styles are inline).

## Why

Coach answers today are mostly canned. Measured on the owner's Mac (qwen3.6:35b via Ollama): a cold model load costs ~14 s and reading a ~5k-token prompt ~12 s; the multi-round tool loop pushes turns past the 30 s budget, so the server sends its template fallback ("I couldn't put together a fuller answer just now.") with the disclaimer pasted underneath. The `{{tool.path}}`-only number rule adds regenerations. The page is a blank chat with no sense of the day, no structure in answers, and no progress while waiting.

## Goals

- Every question gets a real, informative, personable answer in the character's voice — data questions grounded in the user's numbers, general health/fitness questions answered like a knowledgeable friend.
- The Coach page leads with a clear, intuitive picture of today.
- Answers feel live: first words within seconds, streamed as they're written.
- Local by default; an opt-in hosted model (Claude) for better, faster answers.
- Unchanged guarantees: never invent the user's numbers, no diagnosis / medication dosing / supplement advice, crisis handling first.

## Non-goals

- Voice input, images, or charts beyond the answer card's tiles/list.
- Changing what data the app collects or the scoring model.
- Multi-user sharing of conversations; web client.
- Removing the local model.

## Decisions (from the brainstorm)

| Topic | Decision |
|---|---|
| Answer shape | Character talks first (conversational, in voice); when the answer uses the user's data, an **answer card** follows (headline, 1–4 number tiles *or* a ranked list, a "Try" tip, a tappable source line). General questions: talk only. Follow-up chips after each answer. |
| Page layout | Layout B: header → **today summary** → "What would you like to know?" + suggested questions → conversation → composer. |
| Today summary | **Headline sentence** (style 1: what happened → why → what to do today, in the character's voice) above **four "today vs usual" bars** (recovery, sleep, HRV, resting HR; white tick = 30-day usual; value shown as "26 / usual 58"). Tapping a bar or an underlined word asks about it. |
| Engine | **Local by default, hosted opt-in** (per-user setting, consent screen). |
| Pipeline | **Facts first, one pass**: route the question, build a compact fact sheet, one model call returning reply + optional card, validate numbers against the fact sheet, stream sentence by sentence. Replaces the multi-round tool loop. |

## 1. The page (mobile)

`CoachScreen` is rebuilt top to bottom; the companion character engine and moods (PR #42) are reused.

1. **Header** — title "Coach" with the small animated character; right: ☰ opens the conversations sheet (past chats + Coach memory), ✎ starts a new chat. The old memory bulb moves into the ☰ sheet.
2. **Today summary** (`CoachToday` component):
   - The headline sentence from `GET /me/coach/today`, in serif, with underlined tappable spans.
   - Four bars (`TodayBar`): label, fill = today's value on the metric's scale, white tick = 30-day usual, right-aligned "value / usual N". Scale: recovery 0–100; sleep, HRV and resting HR 0 → `1.4 × max(value, usual)`. Status: within ±10% of usual = **near** (metric colour: sleep violet, others neutral), otherwise **below** (rose) / **above** (teal) — inverted for resting HR, where lower is better. The same status drives the tap-to-ask wording.
   - Tap bar → sends "Why is my {metric} {higher|lower} than usual today?" (or "…about usual…").
   - Footnote under the bars: "Comparisons against your own readings, not medical advice." — shown once on the page, never inside replies.
   - Loading: skeleton bars; template sentence shows instantly when the AI sentence isn't ready. No data yet: "Once your first night syncs, I'll sum up your day here." and no bars.
3. **Conversation**
   - New/empty chat: "What would you like to know?" + three suggested questions picked from today's data (e.g. lowest-vs-usual metric first) plus one general question. Tapping sends.
   - Messages: user bubbles as today; assistant messages render **talk** (streamed text), then an **answer card** (`AnswerCard`: `tiles` or `ranked` variant, `tip`, `source` line that opens the relevant Metrics screen), then **follow-up chips**. Safety card, memory chips and an **error card** (muted, distinct, with Retry) are separate renderers.
   - While waiting: character in *thinking* mood + status line from the stream ("Looking at your sleep…") until the first sentence; then text grows sentence by sentence; card slides in on `card`; mood → *answering* on `done`.
   - A conversation continues until ✎. History renders cards, safety cards and memory chips exactly as when live.
4. **Composer** — pinned, placeholder "Ask {Name} anything…", `/` shortcuts kept, stop button while streaming (stop = abort the stream; partial text kept and marked "Stopped").
5. **Conversations sheet** (☰) — list of past conversations (first question as title, relative date), tap to open; "Coach memory" row; "New chat".

## 2. Answer pipeline (backend)

Replaces `orchestrator.ts`'s tool loop. New modules under `backend/src/coach/answer/`.

### 2.1 Route (`router.ts`, extended)
Deterministic classifier over the question (+ last turn for follow-ups): `today` | `sleep` | `trends` (week/month/habits/correlations/goals) | `general`. Ambiguous → `today` + general allowance. Crisis classifier (`guardrails/crisis.ts`) runs **before** routing, unchanged.

### 2.2 Fact sheet (`facts.ts`)
One database pass per route, rendered as labelled lines with stable ids, e.g.:
```
[recovery.today] Recovery today: 26 (usual 58, 30-day)
[hrv.today] HRV today: 41 ms (usual 52)
[sleep.total] Sleep last night: 6h 48m (usual 7h 13m)
[sleep.wakeups] Wake-ups last night: 4 (all after 04:00)
[habit.caffeine_late] Caffeine after 2pm: recovery −8 on days logged (n=21, confidence medium)
```
Route contents: `today` = today's scores + usual, last night summary, top two factors; `sleep` = last-night detail + 7-day sleep; `trends` = 7/30-day series summaries, habit correlations with n/confidence, goals; `general` = one profile line (goals, typical sleep) and no metrics. Every route adds confirmed memories. Target ≤ ~1,000 tokens. Missing data is stated explicitly ("No sleep recorded last night").

### 2.3 One model call (`prompt.ts`, rewritten)
System prompt: character persona (tone, focus, verbosity), today's date, the fact sheet, safety rules, and the output contract:
- Write the reply conversationally, in character, 2–5 sentences (persona verbosity scales this), referencing the user's numbers naturally.
- If (and only if) the reply relies on fact-sheet data, append a card as a fenced ```card JSON block: `{ "headline": string, "tiles"?: [{ "fact": factId, "label": string }] (1–4), "ranked"?: [{ "fact": factId, "label": string }] (2–5), "tip"?: string, "source": string }`. Tiles/ranked reference fact ids; the **server** fills the displayed values from the fact sheet.
- Only use numbers that appear in the fact sheet for anything about the user; general knowledge ranges are allowed for general questions ("most adults need 7–9 hours").
- Ask one short question back when natural.
History: last 10 messages (clean text, no disclaimers). The `{{tool.path}}` placeholder rule and the tool list are removed.

### 2.4 Validate (`validate.ts`)
- **Numbers:** extract every number/duration/time from each sentence; each must match a fact-sheet value (tolerance: ±1 on integers, ±1% or ±1 min on durations; "6h 48m" = "408 minutes" = "6.8 hours"), or be a general-knowledge figure in a `general`-route answer, or a date/time-of-day/list marker. A failing sentence is dropped if the reply still reads (≥ 1 sentence left); otherwise one regeneration with a corrective note; then an error card.
- **Card:** schema-checked; unknown fact ids dropped; a card with no valid tiles/ranked rows is dropped (talk still shown).
- **Topics:** disallowed topics (medical diagnosis, medication dosing, supplement recommendations) checked as today.

### 2.5 Stream
`POST /me/coach/message` with `Accept: text/event-stream` returns SSE events:
`status {label}` → `text {sentence}` (each validated sentence, in order) → `card {…resolved card…}` → `memory {proposals}` → `done {messageId, engine, durationMs}`; or `safety {text, resources}`; or `error {code, retryable}`. Sentences are validated as they complete (buffer until sentence end) so nothing shown is ever retracted. Without the `Accept` header the route returns the full JSON response (old app builds). Server budget: 45 s local / 30 s hosted; mobile client timeout raised above the server budget (fixes the current 20 s < 30 s mismatch).

### 2.6 Local model performance
- Keep warm: `keep_alive` 24h and a fire-and-forget warm-up call when the app opens the Coach tab or the status endpoint is hit.
- Prompt ≤ ~2k tokens total; `num_predict` 600; `think:false`; streaming from Ollama (`stream:true`) parsed into sentences.
- Optional `OLLAMA_FAST_MODEL` for `today`/`general` routes.
- Target on the owner's Mac: first sentence 3–6 s, full answer 8–15 s (warm).

### 2.7 Memory
`proposeMemory` is no longer a tool: the model may append a ```memory JSON block (`{category, value}`) which goes through the existing validation (closed categories, 140 chars, health-fact classifier) and is emitted as the `memory` event / chips. Memory notes are no longer concatenated into reply text.

## 3. Engines, consent, settings

- **Provider interface** (`model/provider.ts`) gains `stream(request): AsyncIterable<string>` alongside `generate`. Implementations: `OllamaProvider` (existing, streaming added) and new `AnthropicProvider` (official `@anthropic-ai/sdk`, `client.messages.stream(...)`, model from `COACH_HOSTED_MODEL` default `claude-opus-5-5`, `output_config.effort: "low"`, server-side refusal fallback enabled, `max_tokens` 2000). Key `ANTHROPIC_API_KEY`, server-only.
- **Selection:** `User.coachEngine` (`LOCAL` | `HOSTED`, default `LOCAL`). Hosted is offered only when `COACH_HOSTED_ENABLED=true` and a key is configured (`GET /me/coach/status` adds `engines: {hosted: {available, consented}}`, `engine`). If a hosted call fails (network/5xx/refusal after fallback), that message is answered locally and `done.engine = "local"` with a small "answered by the on-device model" note.
- **Consent:** `CoachConsent` gains `scope` (`LOCAL` | `HOSTED`, default `LOCAL`). Switching to hosted requires a current `HOSTED` consent: "Your question and a summary of your recent health numbers are sent to Anthropic to write the answer. Anthropic doesn't use it to train models. You can switch back any time." Only the fact sheet and recent conversation are sent — no identifiers.
- **Settings:** Profile → Coach → "AI engine" row (On-device / Claude), opening the consent screen when switching to Claude.
- **Cost note (README):** roughly 1.5k input + 300–500 output tokens per message on `claude-opus-5-5` ≈ 1–2 cents.

## 4. Today summary (backend)

- `GET /me/coach/today` → `{date, sentence: {text, spans:[{text, metric?}], source: "ai"|"template"}, bars: [{metric, value, usual, unit, status}], hasData}`.
- `CoachDaySummary` table (`userId`, `date`, `text`, `spans` JSON, `source`, `createdAt`; unique `userId+date`).
- Generated when the day's scores are computed after a sync (hook into the existing score job) and lazily on first request if missing; AI sentence written by the user's engine with the `today` fact sheet and a one-paragraph contract (what happened → why → what to do today, ≤ 45 words, in character, numbers only from the fact sheet, validated like replies). Until it exists, or if generation fails, the **template** sentence is returned: "Recovery {v}, {below|near|above} your usual {u}. {largest driver sentence}." Regenerated if the user's character changes.

## 5. Data model changes

- `CoachMessage`: add `card Json?`, `engine CoachEngine?`, `durationMs Int?`; `text` stored clean (no disclaimer, no memory notes). Existing rows are left as they are (history renders them as plain talk).
- New `CoachDaySummary` (above); new enum `CoachEngine`; `User.coachEngine`; `CoachConsent.scope` + enum.
- One Prisma migration (additive only).

## 6. Errors

| Case | Behaviour |
|---|---|
| Local model unreachable / timeout | Error card "I couldn't answer that just now" + Retry; summary shows template |
| Validation fails twice | Error card (not a template reply) |
| Hosted fails | Answer locally for that message, note shown |
| Stream drops mid-answer | Keep received sentences, error line under them, Retry resends |
| User taps stop | Abort; partial text kept, "Stopped" marker; not stored as a full answer |
| No data yet | Summary empty state; data questions answered with "I don't have your {x} yet" |
| Crisis detected | Safety card first, as today (override kept) |

## 7. Testing

**Backend (jest):** router classification table; fact sheet per route (contents, token budget, missing-data lines); number validator (matches, tolerance, unit equivalences, invented numbers, general-knowledge allowance, time/date/list exemptions); card parser/resolver (unknown ids, empty card); sentence streamer (buffering, ordering, drop-and-continue); SSE route (event sequence, JSON fallback without `Accept`, error/safety paths); providers against a fake (Ollama streaming parse; Anthropic via mocked SDK); engine selection + consent gating + hosted→local fallback; day-summary job, template, regeneration on character change; migration.
**Coach evals** (`npm run eval:coach`): fixtures updated to the new output contract; new fixtures for general questions, invented-number traps (must be caught), card correctness, voice per character.
**Mobile (jest-expo):** `CoachToday` (sentence spans, bars colours/ticks, tap-to-ask, empty/loading), `AnswerCard` variants, SSE reader (partial sentences, error mid-stream, stop), conversation rendering from history (cards/safety/memory), conversations sheet, engine setting + consent screen.
**Manual:** timing on the owner's Mac (warm first sentence ≤ 6 s), 10 real questions local vs hosted side by side, light/dark.

## 8. Delivery

One branch, one draft PR, five phases (each committed with tests green):
1. Backend answer pipeline (route, facts, prompt, validate, stream, SSE, warm local model, memory block); old tool loop kept behind the JSON path until phase 5.
2. Hosted provider, engine setting, consent scope, status fields.
3. Today summary (API, table, job hook, template).
4. Mobile Coach page rebuild (header, today summary, conversation renderers, SSE client, composer, conversations sheet, engine setting).
5. Clean-up (remove tool loop, disclaimer/memory-note concatenation, placeholder grounding), evals, README.
