# Veya — AI Assessment Extraction & Answer Mapping

Upload a printed question paper and a student's handwritten answer sheet —
each as a single PDF, or as one file per photographed page. The app extracts
every question, finds every answer block, works out which answer belongs to
which question, and highlights the exact region on the sheet when a teacher
clicks a question.

- **Live app:** https://veya-dev.vercel.app/

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| PDF rendering | `pdfjs-dist`, rendered to canvas |
| Backend | Express 4, TypeScript, Node 20+ |
| AI / OCR | Google Gemini flash models, vision + JSON response mode, with automatic fallback |
| Validation | Zod on every model response |
| Storage | None — files are held in memory for the length of one request |

## Running locally

Backend:

```bash
cd backend
npm install
cp .env.example .env      # add your GEMINI_API_KEY
npm run dev               # http://localhost:4000
```

Frontend:

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev               # http://localhost:3000
```

Try it with the bundled sample — a printed question paper and a 3-page
handwritten answer sheet in `samples/paper_02/`. See `samples/README.md` for
what it deliberately gets wrong.

Checks:

```bash
cd backend  && npm test && npm run typecheck
cd frontend && npm test && npm run typecheck && npm run build
```

## Approach

The interesting part of this problem is not "ask a model to map answers to
questions". It is being able to say *why* a given answer was matched, and being
honest when the match is doubtful. So the pipeline splits the two jobs:

**The model reports evidence. The backend decides.**

```
question paper ─┐
                ├─ two parallel vision calls ─→ questions[] + answerBlocks[]
answer sheet ───┘
                                                      │
                        every (question × answer) pair ┤ scored on 4 signals
                                                      │
                          best-pair-first assignment ─→ mappings[] + unmatched[]
                                                      │
                                       one text call ─→ marks + feedback
```

### Extraction

Both documents go to Gemini with `responseMimeType: "application/json"`, and
every response is parsed through a Zod schema before it is trusted. The two
calls are independent, so they run concurrently.

Questions keep their printed order and split labelled sub-parts (`11(a)`,
`11(b)`) into separate entries. Answer blocks record the question number the
student actually wrote, a transcription, an OCR confidence, and a page region.

Blocks are detected one page at a time, which is what a vision model is good at.
Asked instead for a single block carrying a region per page, it returned one
region and dropped the other half's coordinates in all three runs of the sample
sheet. So an answer that runs across a page break comes back as two blocks
carrying the same question number, and `mergeContinuations` puts them back
together server-side — where a page number and a question number are just data
to compare.

### Mapping score

Each question/answer pair is scored on four signals:

```
mappingScore = explicitNumberScore × 0.45   // the number the student wrote
             + semanticScore       × 0.25   // content-word overlap
             + sequenceScore       × 0.15   // students usually answer in order
             + ocrConfidence       × 0.15   // how legible the block was
```

```
≥ 0.85   high confidence
0.60 …   needs review
< 0.60   not matched — the question is reported unanswered
```

Assignment then runs **best pair first across the whole candidate set**, not
question by question. Walking questions in order lets an early weak claim
(Q1 → a1 at 0.62) block a far stronger one later (Q5 → a1 at 0.95); sorting
every candidate by score first settles the certain pairings before the doubtful
ones get to choose. `backend/src/services/mapping.test.ts` pins this with an
out-of-order sheet.

### Highlighting

Regions are stored as fractions of the page (`x`, `y`, `width`, `height` in
0–1), never pixels, so one number works at any zoom, viewport, or render scale.

The viewer rasterises each PDF page to its own canvas with pdf.js and positions
the overlay against that canvas's measured size. A browser's built-in PDF plugin
would letterbox the page inside its viewport, and the overlay would have no way
to know where the page actually landed — every highlight would be slightly, or
completely, wrong.

Asked for a box that "tightly encloses the handwriting", the model lands within
half a line of the truth — measured against the ink on the sample sheet it
started 3px inside its own first line on one answer and reached 59% of the way
into the *next* answer's opening line on another. Half a line either way, so how
much of a line the box covers cannot say who the line belongs to.

Pixels can. The canvas the page was just rasterised to is scanned once for rows
of ink, grouped into lines, and the model's box is used only to *choose* the
lines — the edges come from the ink. Where a line begins settles the boundary
cases: a number marker hangs out into the left margin, so a line further left
than the one above it opens a new answer, and a line that keeps the margin
continues the current one. `frontend/lib/coordinates.test.ts` pins both.

### Surviving the free tier

The free tier allows 20 requests per day *per model*, and one assessment costs
three calls — so a single pinned model stops working after about six runs.

A 429 is really two different problems sharing a status code. A per-minute limit
clears in seconds and is worth waiting for; a per-day quota cannot clear today,
so retrying it just burns time before failing anyway. The client reads the
`QuotaFailure` detail to tell them apart, then:

- **per-minute limit or overload** — waits the delay Gemini asks for, once
- **daily quota, retired model, or a wait longer than 15s** — gives up on that
  model immediately and moves to the next in the chain

A model that fails is benched for a cooldown, so later calls in the same request
skip it rather than re-paying for the same 429. And because there is always
another model waiting, a busy model is abandoned rather than waited on — the
in-model retry only happens on the last candidate in the chain.

The chain is eleven models: full flash first for the best bounding boxes, then
lite variants, then pro as a last resort (its free-tier daily allowance is tiny,
so it is only worth a call once everything else is spent).

```
gemini-3.6-flash → gemini-3.7-flash → gemini-3.5-flash → gemini-flash-latest
  → gemini-3-flash-preview → gemini-3.5-flash-lite → gemini-3.1-flash-lite
  → gemini-flash-lite-latest → gemini-3.1-flash-lite-preview
  → gemini-3.1-pro-preview → gemini-pro-latest
```

Every name was probed against a live key; the retired 2.5 family is deliberately
absent. `GET /health` returns the chain in use. `GEMINI_MODEL` overrides it and
accepts a comma-separated list, so you can pin one model or supply your own
order without touching the code.

A real run with the first two models already spent:

```
[gemini] Answer extraction: gemini-3.6-flash daily_quota, falling back to gemini-3.7-flash
[gemini] Answer extraction: gemini-3.7-flash overloaded, falling back to gemini-3.5-flash
[gemini] Grading: gemini-3.5-flash daily_quota, falling back to gemini-flash-latest
[gemini] Grading: gemini-flash-latest daily_quota, falling back to gemini-3-flash-preview
[process] a8751f73 8q 7a 34283ms
```

### Honest coordinates

If the model cannot locate a block, the region's `bbox` is `null` and the viewer
says the answer could not be located. It never invents a box. A fabricated
rectangle draws a confident green highlight over the wrong handwriting, which is
worse for a teacher than no highlight at all.

Snapping obeys the same rule: with no ink measured — a photo upload, a page too
dark to threshold — the model's box is drawn as given rather than fitted to a
guess.

## Assumptions and limitations

- One student's answer sheet per run.
- Files up to 10MB each; PDF, PNG, or JPG. Either document may be up to 20
  files, taken in upload order — that order is the page order, for the model
  and for the viewer alike.
- Nothing is persisted. Teacher overrides live in the browser tab and are lost
  on reload, so reassigning an answer sends the question and the new answer
  text back to `POST /api/grade` to be marked again.
- The stage captions during processing are timed, not streamed — the backend
  runs the pipeline as a single request and cannot report its position.
- Semantic similarity is word overlap, not embeddings. It is a corroborating
  signal at 25% weight, deliberately not the primary one.
- Grading is the model's judgement, offered as a starting point for the teacher,
  not an authority.
- Bounding boxes are snapped to the ink on the rendered page, so the model only
  has to name the right lines, not measure them. Two answers written with no
  number markers and no blank line between them are the case it cannot separate
  — nothing on the page separates them either.
- Each assessment costs three Gemini calls and the free tier allows 20 requests
  per day *per model*. The client falls back across eleven models, so the real
  budget is roughly 70 assessments a day rather than six (see below).
- Later entries in the chain are lite models. They transcribe and map just as
  well, but locate handwriting poorly and often decline to box it at all. So
  once the flash models are spent for the day, answers come back mapped and
  graded with `bbox: null`, and the viewer says the position could not be
  located rather than drawing a guessed box.
- Grading is a text-only call: it marks the transcription, not the page. A
  diagram question is therefore graded from the OCR description of the diagram,
  which is the least reliable mark on the sheet.

## Edge cases handled

| Case | Behaviour |
| --- | --- |
| Answers written out of order | Best-pair-first assignment, not positional |
| Unanswered questions | Reported `unanswered` with no region |
| Answers with no question number | Falls back to semantic + sequence evidence |
| Extra answers matching nothing | Listed under the question list, selectable and highlighted like any answer |
| Multi-page answers | Detected per page, rejoined by the backend into one answer with a region on each |
| A document uploaded as several files | Pages numbered across the whole document, not per file |
| Low-confidence matches | Flagged, with alternatives the teacher can switch to; picking one re-marks that question |
| Region not locatable | `bbox: null`; the viewer says so instead of guessing |
| A page that will not render | The viewer says so; the answer was still processed |
| Phone-width viewport | List and sheet become tabs, the nav collapses to a drawer |
| Per-minute rate limit / overload | Waits the delay Gemini asks for, then falls back |
| Daily quota exhausted | Not retried — falls straight through to the next model |
| Every model exhausted | One message naming the quota and when it resets |
| Retired or wrong model | Skipped; 404 on a pinned model names `GEMINI_MODEL` |
| Truncated model response | Reported as cut off, naming `GEMINI_MAX_OUTPUT_TOKENS` |
| Missing API key | `/health` reports `aiConfigured: false` |
| Grading failure | Mapping and highlighting still returned |
| Oversized or wrong-type file | Rejected client-side and server-side |

## Deployment

**Render (backend)** — root directory `backend`

```
Build:  npm install && npm run build
Start:  npm start
Env:    GEMINI_API_KEY, ALLOWED_ORIGIN=https://<your-app>.vercel.app
        GEMINI_MODEL and GEMINI_MAX_OUTPUT_TOKENS are optional overrides
```

**Vercel (frontend)** — root directory `frontend`, Next.js preset

```
Env:    NEXT_PUBLIC_API_URL=https://<your-api>.onrender.com
```

`ALLOWED_ORIGIN` accepts a comma-separated list if you need preview
deployments too.

## Layout

```
backend/src/
  server.ts                  routes, upload limits, error classification
  types.ts                   the shape of everything crossing the wire
  services/
    gemini.ts                the only place that calls the model
    questionExtractor.ts     question paper -> questions[]
    answerExtractor.ts       answer sheet -> answer blocks[]
    scoring.ts               number normalisation and the four signals
    mapper.ts                candidate scoring and final assignment
    grading.ts               marks and per-question feedback
    processAssessment.ts     the pipeline
    mapping.test.ts          self-check for the pure logic

frontend/
  app/page.tsx               phase state machine
  components/                one component per screen in the design
  lib/                       api client, pdf.js wrapper, ink snapping, coordinate maths

samples/                     evaluation fixtures — see samples/README.md
```
