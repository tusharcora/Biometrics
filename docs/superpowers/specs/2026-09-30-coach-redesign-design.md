# Coach redesign — design

**Date:** 2026-09-30
**Branch:** `feature/coach-redesign` (from `worktree-redesign-tokens-home`, which carries the companion characters, PR #42)
**Status:** implemented (phases 1–5); corrections from implementation are folded in below and marked "(as built)".
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
| Today summary | **Headline sentence** (style 1: what happened → why → what to do today, in the character's voice) above **four "today vs usual" bars** (recovery, sleep, HRV, resting HR; white tick = 30-day usual; value shown as "26 / 58"). Tapping a bar or an underlined word asks about it. |
| Engine | **Local by default, hosted opt-in** (per-user setting, consent screen). |
| Pipeline | **Facts first, one pass**: route the question, build a compact fact sheet, one model call returning reply + optional card, validate numbers against the fact sheet, stream sentence by sentence. Replaces the multi-round tool loop. |

## 1. The page (mobile)

`CoachScreen` is rebuilt top to bottom; the companion character engine and moods (PR #42) are reused.

1. **Header** — title "Coach" with the small animated character; right: ☰ opens the conversations sheet (past chats + Coach memory), ✎ starts a new chat. The old memory bulb moves into the ☰ sheet.
2. **Today summary** (`CoachToday` component):
   - The headline sentence from `GET /me/coach/today`, in serif, with underlined tappable spans.
   - Four bars (`TodayBar`): label, fill = today's value on the metric's scale, white tick = 30-day usual (kept visible over any fill — it is the main non-colour cue), right-aligned value with its unit and the usual as a bare number: "41.2 ms / 52.3", "6h 48m / 7h 13m", "26 / 58" (the accessibility label keeps the full words). Scale: recovery 0–100; sleep, HRV and resting HR 0 → `1.4 × max(value, usual)`. Status: within ±10% of usual = **near** (neutral grey; sleep keeps its violet — never amber, which would read as a warning), otherwise **below** (rose) / **above** (teal) — inverted for resting HR, where lower is better. Value numbers use text-safe status tokens (≥ 4.5:1 in both themes); the lighter fill tokens are for bars only. The same status drives the tap-to-ask wording.
   - A zero reading for sleep, HRV or resting HR is treated as missing (no bar, never a driver); a usual of 0 shows no tick.
   - Tap bar → sends "Why is my {metric} {higher|lower} than usual today?" (sleep: "Why was my sleep {shorter|longer} than usual last night?"; near usual: "How's my {metric} looking today?").
   - Footnote: "Comparisons against your own readings, not medical advice." — under the bars, and the page guarantees it appears exactly once (at page level when there is no sentence or bars), never inside replies.
   - Loading: skeleton bars; template sentence shows instantly when the AI sentence isn't ready. No data yet: "Once your first night syncs, I'll sum up your day here." and no bars.
3. **Conversation**
   - New/empty chat: "What would you like to know?" + three suggested questions picked from today's data (e.g. lowest-vs-usual metric first) plus one general question. Tapping sends.
   - Messages: user bubbles as today; assistant messages render **talk** (streamed text), then an **answer card** (`AnswerCard`: `tiles` or `ranked` variant — tiles show the difference from usual, e.g. "−25m vs usual", "+4 bpm vs usual", formatted by the server like the fact sheet; `tip`, `source` line that opens the relevant Metrics screen), then **follow-up chips**. Safety card, memory chips and an **error card** (muted, distinct, with Retry) are separate renderers.
   - While waiting: character in *thinking* mood + status line from the stream ("Looking at your sleep…") until the first sentence; then text grows sentence by sentence; card slides in on `card`; mood → *answering* on `done`.
   - A conversation continues until ✎. History renders cards, safety cards and memory chips exactly as when live.
   - The page opens at the top (today summary visible), not scrolled to the last message; new turns auto-scroll only while the user is following the bottom of the conversation, or on send.
4. **Composer** — pinned, placeholder "Ask {Name} anything…", `/` shortcuts kept, stop button while streaming (stop = abort the stream; partial text kept and marked "Stopped").
5. **Conversations sheet** (☰) — list of past conversations (first question as title, relative date), tap to open; "Coach memory" row; "New chat".
   Backed by `GET /me/coach/conversations` (`{ id, title, lastMessageAt, messageCount }`, newest first, 20 per page, `?before=<iso>`) and `GET /me/coach/conversations/:id`, whose messages carry `card`, `engine`, `stopped`, `safety` and `memoryProposals` so history renders exactly as it did live.

## 2. Answer pipeline (backend)

Replaces `orchestrator.ts`'s tool loop. New modules under `backend/src/coach/answer/`.

### 2.1 Route (`answer/route.ts`)
Deterministic classifier over the question (+ last turn for follow-ups): `today` | `sleep` | `trends` (week/month/habits/correlations/goals) | `general`. Ambiguous → `today` + general allowance. Crisis classifier (`guardrails/crisis.ts`) runs **before** routing, unchanged.

### 2.2 Fact sheet (`answer/facts.ts`)
One database pass per route, rendered as labelled lines with stable ids, e.g.:
```
[recovery.today] Recovery today: 26 (usual 58, 32 lower than usual)
[hrv.today] HRV today: 41 ms (usual 52 ms, 11 ms lower than usual)
[rhr.today] Resting heart rate today: 58 bpm (usual 55 bpm, 3 bpm higher than usual)
[sleep.total] Sleep last night: 6h 48m (usual 7h 13m, 25m less than usual)
[factor.hrv] HRV effect on the recovery score: -9 points
[habit.caffeine.hrv] Caffeine (3+ cups) and next-day HRV: 8% lower (n=21)
```
Route contents (as built): `today` = recovery, sleep score, HRV, resting HR, sleep last night and steps so far, each with its 30-day usual (the 30 days ending yesterday) and a precomputed comparison, plus the two biggest score drivers (`factor.*`); `sleep` = last night, sleep score, sleep goal, 7-night average, shortest and longest night this week, and nights recorded; `trends` = 7- and 30-day averages for recovery, sleep, HRV, resting HR and steps, 30-day trend percentages, confirmed habit correlations with their sample size (`habit.<habit>.<factor>`), and the sleep goal; `general` = sleep goal and typical sleep, no metrics. Every route adds confirmed memories as escaped context lines. Comparisons are precomputed so the model never does arithmetic. The data the app has no reading for — wake-up counts, bedtimes, per-habit time of day, correlation confidence labels — is not on the sheet. Target ≤ ~1,000 tokens. Missing data is stated explicitly ("No sleep recorded last night").

### 2.3 One model call (`answer/prompt.ts`)
System prompt: character persona (tone, focus, verbosity), today's date, the fact sheet, safety rules, and the output contract:
- Write the reply conversationally, in character, 2–5 sentences (persona verbosity scales this), referencing the user's numbers naturally.
- If (and only if) the reply relies on fact-sheet data, append a card as a fenced ```card JSON block: `{ "headline": string, "tiles"?: [{ "fact": factId, "label": string }] (1–4), "ranked"?: [{ "fact": factId, "label": string }] (2–5), "tip"?: string, "source": string }`. Tiles/ranked reference fact ids; the **server** fills the displayed values from the fact sheet.
- Answer the question in the first sentence; when explaining why, name the drivers on the sheet — score factors (`factor.*`) and the user's own habit patterns (`habit.*`) — and mention no metric or cause that isn't on the sheet.
- Give one concrete next step, described in words rather than new numbers or times.
- Only use numbers that appear in the fact sheet for anything about the user; general knowledge ranges are allowed for general questions and are stated impersonally ("most adults need 7–9 hours", not "you need"). Headline and tip follow the same number rule.
- A question back is optional — only when the answer would change the advice; never a generic check-in. Urgent symptoms (chest pain, fainting) are directed to urgent care.
- Persona texts are v3: the voice is unchanged, but no persona mandates a closing question.
History: last 10 messages (clean text, no disclaimers). The `{{tool.path}}` placeholder rule and the tool list are removed.

### 2.4 Validate (`answer/validate.ts`)
- **Numbers:** extract every number/duration/time from each sentence; each must match a number on the rendered fact sheet or a fact's value/usual (tolerance: ±1 on integers, ±1% on decimals, ±1% or ±1 min on durations; "6h 48m" = "408 minutes" = "6.8 hours"). **Hedged numbers** (as built): a number introduced by "about", "around", "roughly", "nearly", "almost", "close to", "~", "just under" or "just over" may be within ±10% of a value of the same kind (durations vs plain numbers) — "about 7 hours" for 6h 48m passes, "about 9 hours" and an unhedged "7 hours" do not. A general-knowledge figure is allowed only in a `general`-route answer and never in a sentence about the user ("you slept…", "your recovery…"). Times of day, month-name dates, ordinals and line-start list markers are exempt. A failing sentence is dropped if the reply still reads (≥ 1 sentence left); otherwise one regeneration with a corrective note; then an error card. The validator does not judge direction words or which metric a number is attached to; the evals do (`direction` and `attribution` checks).
- **Metric scope** (as built): a number is checked against the metric the sentence names, not the whole sheet. A unit that only one metric uses (durations → sleep, ms → HRV, bpm → resting HR, a step count → steps) matches that metric's values; shared kinds (percent, score, points) and bare numbers match only the named metric — or, when a sentence names two or more metrics, the union of those metrics' values plus metric-less lines. Night words ("night", "asleep", "sleeping") count as sleep. The sheet's own window phrases ("7-day", "over the last 30 days") are not numbers about the user. Number words followed by a unit or metric ("seven hours") are checked too.
- **Card:** schema-checked; unknown fact ids dropped; a card with no valid tiles/ranked rows is dropped (talk still shown).
  A model-written label containing digits is replaced by the fact's own label; `tip` passes the same sentence validation (a failing tip is dropped). The `source` line is set by the app from the route and window; any model-written source is ignored.
- **Topics:** disallowed topics (medical diagnosis, medication dosing, supplement recommendations) checked as today.

### 2.5 Stream
`POST /me/coach/message` with `Accept: text/event-stream` returns SSE events:
`status {label, conversationId?}` → `text {sentence}` (each validated sentence, in order) → `card {…resolved card…}` → `memory {proposals}` → `done {messageId, conversationId, engine, durationMs, stopped?}`; or `safety {text, resources}`; or `error {code, retryable}`. Sentences are validated as they complete (buffer until sentence end) so nothing shown is ever retracted. A new conversation is created up front and its id is announced on the first `status` (or `safety`) event, so a turn stopped before `done` still continues the same conversation. A stopped answer is stored with `stopped: true` and shown with a "Stopped" marker. Without the `Accept` header the route returns the full JSON response (old app builds); because those builds have no page footnote, the disclaimer is appended to that JSON response only — never to stored text or the SSE stream. Server budget: 45 s local / 30 s hosted; mobile client timeout raised above the server budget (fixes the current 20 s < 30 s mismatch).

### 2.6 Local model performance
- Keep warm: `keep_alive` 24h and a fire-and-forget warm-up call when the app opens the Coach tab or the status endpoint is hit.
- Prompt ≤ ~2k tokens total; `num_predict` 600; `think:false`; streaming from Ollama (`stream:true`) parsed into sentences.
- One local model for every route (`OLLAMA_MODEL`); the old `OLLAMA_FAST_MODEL` and `OLLAMA_THINK` settings are removed with the tool loop.
- Target on the owner's Mac: first sentence 3–6 s, full answer 8–15 s (warm).

### 2.7 Memory
`proposeMemory` is no longer a tool: the model may append a ```memory JSON block (`{category, value}`) which goes through the existing validation (closed categories, 140 chars, health-fact classifier) and is emitted as the `memory` event / chips. Memory notes are no longer concatenated into reply text.

## 3. Engines, consent, settings

- **Provider interface** (`model/provider.ts`) gains `stream(request): AsyncIterable<string>`; as built, `generate` was removed in phase 5 and the interface is `{ id, stream(), warm?() }`. Implementations: `OllamaProvider` (existing, streaming added) and new `AnthropicProvider` (official `@anthropic-ai/sdk`, `client.messages.stream(...)`, model from `COACH_HOSTED_MODEL` default `claude-opus-5-5`, `output_config.effort: "low"`, server-side refusal fallback enabled, `max_tokens` 2000). Key `ANTHROPIC_API_KEY`, server-only.
- **Selection:** `User.coachEngine` (`LOCAL` | `HOSTED`, default `LOCAL`). Hosted is offered only when `COACH_HOSTED_ENABLED=true` and a key is configured (`GET /me/coach/status` adds `engines: {hosted: {available, consented}}`, `engine`). If a hosted call fails (network/5xx/refusal after fallback), that message is answered locally and `done.engine = "local"` with a small "answered by the on-device model" note.
- **Hosted failure modes** (as built): a hosted stream that produces no text within ~10 s (`COACH_HOSTED_FIRST_TEXT_MS`) is abandoned and the message answered locally with the rest of the budget; the local model is warmed at the start of every hosted message so that fallback is not a cold load. A server-side refusal fallback that starts after text was already streamed ends the reply there rather than splicing two models' text; before any text it simply streams the fallback answer.
- **Consent:** `CoachConsent` gains `scope` (`LOCAL` | `HOSTED`, default `LOCAL`). Switching to hosted requires a current `HOSTED` consent: "Your question and a summary of your recent health numbers are sent to Anthropic to write the answer. Anthropic doesn't use it to train models. You can switch back any time." Only the fact sheet and recent conversation are sent. The app adds no name, email, account id or tokens, and the consent says plainly that anything the user types (including their name) is sent as part of the conversation. Hosted needs the current LOCAL coach consent as well: `GET /me/coach/status` reports `engine: "hosted"` only when hosted is chosen, available, and both consents are current. Granting, revoking and switching engine are serialised per user (a per-user advisory lock), and revoking hosted consent resets the engine to local.
- **Settings:** Profile → Coach → "AI engine" row (On-device / Claude), opening the consent screen when switching to Claude.
- **Cost note (README):** roughly 1.5k input + 300–500 output tokens per message on `claude-opus-5-5` ≈ 1–2 cents.

## 4. Today summary (backend)

- `GET /me/coach/today` → `{date, sentence: {text, spans:[{text, metric?}], source: "ai"|"template"}, bars: [{metric, value, usual, unit, status}], hasData}`.
- `CoachDaySummary` table (`userId`, `date`, `text`, `spans` JSON, `source`, `createdAt`; unique `userId+date`).
- Generated when the day's scores are computed after a sync (hook into the existing score job) and lazily on first request if missing; AI sentence written by the user's engine with the `today` fact sheet and a one-paragraph contract (what happened → why → what to do today, ≤ 45 words, in character, numbers only from the fact sheet, validated like replies). Until it exists, or if generation fails, the **template** sentence is returned: "Recovery {v}, {below|near|above} your usual {u}. {largest driver sentence}." Regenerated if the user's character changes.
- As built: the endpoint serves bars and the template sentence without coach consent (the user's own data, no model call); the AI sentence is written only for users with current LOCAL consent and the coach enabled. Summary jobs run on their own `coach-summary` queue with concurrency 1 (`COACH_SUMMARY_CONCURRENCY`), so they never hold a health-sync slot, and are skipped once the user's local date has moved past the job's date. A request to regenerate (forced, or a persona change) while a generation is running queues one follow-up run instead of being dropped. The summary prompt asks for suggestions in words, not new numbers or times.

## 5. Data model changes

- `CoachMessage`: add `card Json?`, `engine CoachEngine?`, `durationMs Int?`; `text` stored clean (no disclaimer, no memory notes). Existing rows are left as they are (history renders them as plain talk).
- New `CoachDaySummary` (above); new enum `CoachEngine`; `User.coachEngine`; `CoachConsent.scope` + enum (hosted consent versions are prefixed `hosted-`, so they never equal a local one).
- `CoachMemory.messageId String?` (FK to `CoachMessage`, `onDelete: SetNull`): the message that proposed the memory, so history shows memory chips on the right message. Older memories have none.
- Three additive Prisma migrations (answer pipeline; engine + consent scope; day summary + memory link), one per backend phase.
- Text stored by older builds (disclaimer and memory notes appended) is served clean: history, digests and the model's history window strip those additions on read.
- Retention: transcripts expire after 90 days as before; day summaries, like weekly digests, have no expiry (both are removed with the user's coach data or account). Note for the owner: memories are linked to their conversation with a cascade, so a confirmed memory is deleted when its conversation expires at 90 days — pre-existing behaviour, unchanged here.
- Weekly digest: written by the local engine from the `trends` fact sheet and gated on current LOCAL consent; stored without the disclaimer (the app shows the footnote under the recap).

## 6. Errors

| Case | Behaviour |
|---|---|
| Local model unreachable / timeout | Error card "I couldn't answer that just now" + Retry; summary shows template |
| Validation fails twice | Error card (not a template reply). The weekly digest instead falls back to a recap composed from the fact sheet, validated the same way. |
| Hosted fails | Answer locally for that message, note shown (including no first text within ~10 s); a decline after text has streamed stops the reply instead |
| Stream drops mid-answer | Keep received sentences, error line under them, Retry resends |
| User taps stop | Abort; partial text kept, "Stopped" marker; not stored as a full answer |
| No data yet | Summary empty state; data questions answered with "I don't have your {x} yet" |
| Crisis detected | Safety card first, as today (override kept) |

## 7. Testing

**Backend (jest):** router classification table; fact sheet per route (contents, token budget, missing-data lines); number validator (matches, tolerance, unit equivalences, invented numbers, general-knowledge allowance, time/date/list exemptions); card parser/resolver (unknown ids, empty card); sentence streamer (buffering, ordering, drop-and-continue); SSE route (event sequence, JSON fallback without `Accept`, error/safety paths); providers against a fake (Ollama streaming parse; Anthropic via mocked SDK); engine selection + consent gating + hosted→local fallback; day-summary job, template, regeneration on character change; migration.
**Coach evals** (`npm run eval:coach`, as built): fixtures run the real answer pipeline with a scripted stream — numbers (dropped sentences, regeneration, error after two failures, unit equivalence, tolerance, exemptions, missing data), hedged approximations, general questions, card fact ids (unknown ids, digit labels, invented tips, ranked variant), one voice fixture per character, memory, safety and errors. Every shown sentence and card value is always checked against the fact sheet. Must-fail fixtures prove the eval catches a contradicted direction, a real number on the wrong metric, and an invented number with the runtime validation switched off. `npm run eval:coach:local` runs the same questions through the real local model and reports warm first-sentence and full-answer times.
**Mobile (jest-expo):** `CoachToday` (sentence spans, bars colours/ticks, tap-to-ask, empty/loading), `AnswerCard` variants, SSE reader (partial sentences, error mid-stream, stop), conversation rendering from history (cards/safety/memory), conversations sheet, engine setting + consent screen.
**Manual:** timing on the owner's Mac (warm first sentence ≤ 6 s), 10 real questions local vs hosted side by side, light/dark.

## 8. Delivery

One branch, one draft PR, five phases (each committed with tests green):
1. Backend answer pipeline (route, facts, prompt, validate, stream, SSE, warm local model, memory block); old tool loop kept behind the JSON path until phase 5.
2. Hosted provider, engine setting, consent scope, status fields.
3. Today summary (API, table, job hook, template).
4. Mobile Coach page rebuild (header, today summary, conversation renderers, SSE client, composer, conversations sheet, engine setting).
5. Clean-up (remove tool loop, disclaimer/memory-note concatenation, placeholder grounding), evals, README.

The weekly digest moved onto the fact sheet and validator in phase 5, and `generate()` was removed from the provider interface.

## Changes during build

Behaviour decided during implementation (rulings in the build log), one line each:
- R6/R7: personal questions without "I/my" (time words, "we") get data, not `general`; trends windows end yesterday.
- R9/R11/R13/R20/R31: number validation is unit- and metric-scoped; window phrases exempt; night words count as sleep.
- R12/R15/R18/R19: prompt asks for answer-first, drivers incl. habit patterns, a next step in words, an optional question back; personas v3; card source app-derived.
- R14/R39: crisis safety event before persistence; stopped answers stored as stopped; conversation id on the first status/safety event.
- R21/R25: hosted mid-stream refusal fallback stops the reply; hosted first-text timeout then local fallback; local warm on hosted messages.
- R22/R23/R24: hosted consent wording; status engine needs local + hosted consent; consent changes serialised per user.
- R27/R28/R29/R30/R32: zero readings missing; today bars/template without consent; queued follow-up run; dedicated summary queue.
- R35/R36/R40/R41/R42: near = neutral grey; text-safe status tokens; tile deltas; bare usual numbers.
- R44: page opens at today; auto-scroll only when following; one disclaimer guaranteed.
- R46: old-app JSON replies keep the disclaimer in the response only.
- Digest (phase 5 review): written by the local engine, gated on LOCAL consent.
