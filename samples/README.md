# Evaluation samples

Fixtures for checking that extraction, mapping, and highlighting behave on the
cases that actually break this kind of pipeline.

```bash
python make_samples.py    # regenerates both papers (needs reportlab)
```

## paper_02 — handwritten (start here)

This is the one to test with. Upload both files to the app:

| File | What it is |
| --- | --- |
| `question-paper.pdf` | Printed, 8 questions, 21 marks, includes `7(a)` and `7(b)` |
| `answer-sheet.pdf` | **Handwritten**, 3 pages of ruled paper, blue ink |
| `expected-output.json` | A recorded `POST /api/process` response |

Either box takes several files, so the same sheet can also be uploaded as one
file per page — the pages are numbered across the whole document either way.

The handwriting is Segoe Print rendered with per-line baseline drift and slant,
on ruled paper with a red margin — close enough to a scanned exam script that
the OCR path is genuinely being exercised, unlike typed text.

### What the sheet deliberately does wrong

| Case | How | Verified result |
| --- | --- | --- |
| Answers out of order | Q2 answered first, then Q1 | Q1 → `a_2`, Q2 → `a_1` |
| Unanswered question | Q3 never attempted | `unanswered`, no answer id |
| Hand-drawn diagram | Q4 is a labelled plant cell | `containsDiagram: true`, mapped to Q4 |
| Answer across a page break | Q6 starts on page 2, ends on page 3 | one answer, a region on each page |
| Sub-parts written far apart | `7 b` on page 1, `7 (a)` on page 3 | each maps to its own part |
| Mixed number markers | `Ans 2.` `Q1.` `7 b` `7 (a)` `4.` `6.` | all normalise to the same key |
| A crossed-out correction | "The equation ~~is :~~ balanced equation is :" | transcribed without the cancelled words |

Recorded run: **18/21 (86%)**, 7 answered, 1 unanswered, every answered
question located with a bounding box — including both halves of the Q6 answer
that runs across the page break. The mapping is stable across runs; the marks
and the odd region move by a point or a page, which is why the mark is quoted
here and not asserted anywhere.

One thing this sheet does *not* exercise: the "Rough work" line at the end is
folded into the preceding block rather than reported as an unmatched answer.
That is defensible behaviour — rough work is not an answer — so paper_01 covers
the unmatched-answer path instead.

## paper_01 — typed baseline

Same idea, typed rather than handwritten, so OCR quality is not the variable.
Six questions, answers out of order, Q3 skipped, and a rough-work block that
**is** reported under `unmatchedAnswers`.

## On the recorded outputs

`expected-output.json` is a recording, not an assertion fixture — the model will
not reproduce it token for token. Compare the mapping *structure* (which answer
id each question got, which questions are unanswered, which answers are
unmatched), not the exact text or bounding boxes.

The pure logic that turns evidence into mappings has a real test:

```bash
cd ../backend && npm test
```

## Free-tier quota

Each assessment costs **three** Gemini calls (questions, answers, grading), and
the free tier allows **20 requests per day, per model**.

You do not need to do anything about this: the client walks a chain of eleven
models and moves on automatically when one is exhausted, which works out to
roughly 70 assessments a day. `GET /health` lists the chain in use, and the
backend log says which model served:

```
[gemini] Question extraction: gemini-3.6-flash daily_quota, falling back to gemini-3.5-flash
```

If all eleven are spent, the error says so and tells you the quota resets at
midnight Pacific.
