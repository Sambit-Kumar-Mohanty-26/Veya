// Run: npm test  (node --experimental-strip-types, no runner)
import assert from "node:assert/strict";
import { snapToInk, type InkBand } from "./coordinates.ts";

const MARGIN = 0.005;
const line = (top: number, bottom: number): InkBand => ({ top, bottom, left: 0.1, right: 0.8 });

// Three lines of one answer, then the next answer's first line well below.
const page = [line(0.1, 0.14), line(0.15, 0.19), line(0.2, 0.24), line(0.3, 0.34)];

// The model's box cuts into its own first and last line: snap out to the ink.
{
  const box = snapToInk({ x: 0.12, y: 0.11, width: 0.6, height: 0.12 }, page);
  assert.equal(round(box.y), round(0.1 - MARGIN));
  assert.equal(round(box.y + box.height), round(0.24 + MARGIN));
  assert.equal(round(box.x), round(0.1 - MARGIN));
}

// The box stops a sliver into the next answer, whose number marker hangs out
// into the margin: that line belongs to the answer below, so it is left alone.
{
  const marked = [...page.slice(0, 3), { ...page[3], left: 0.04 }];
  const box = snapToInk({ x: 0.1, y: 0.1, width: 0.7, height: 0.21 }, marked);
  assert.equal(round(box.y + box.height), round(0.24 + MARGIN));
}

// Same sliver, but the line keeps the margin above it — this answer runs on.
{
  const box = snapToInk({ x: 0.1, y: 0.1, width: 0.7, height: 0.21 }, page);
  assert.equal(round(box.y + box.height), round(0.34 + MARGIN));
}

// Out of reach entirely: neither rule claims it.
{
  const box = snapToInk({ x: 0.1, y: 0.1, width: 0.7, height: 0.15 }, page);
  assert.equal(round(box.y + box.height), round(0.24 + MARGIN));
}

// The box starts below this answer's own opening line — the one carrying the
// number marker, so it hangs into the margin. That line is claimed back,
// whether the box clips it or misses it entirely.
for (const top of [0.135, 0.15]) {
  const marked = [{ ...page[0], left: 0.04 }, ...page.slice(1)];
  const box = snapToInk({ x: 0.1, y: top, width: 0.7, height: 0.1 }, marked);
  assert.equal(round(box.y), round(0.1 - MARGIN), `claims the marker line from ${top}`);
  assert.equal(round(box.x), round(0.04 - MARGIN));
}

// A one-line answer two blank lines up is not adjacent, marker or not.
{
  const marked = [{ ...page[0], left: 0.04, top: 0.06, bottom: 0.1 }, ...page.slice(1)];
  const box = snapToInk({ x: 0.1, y: 0.15, width: 0.7, height: 0.1 }, marked);
  assert.equal(round(box.y), round(0.15 - MARGIN));
}

// The box covers the next answer's opening line outright: the claim is cut
// there rather than stretched over two answers.
{
  const marked = [...page.slice(0, 3), { ...page[3], left: 0.04 }];
  const box = snapToInk({ x: 0.1, y: 0.1, width: 0.7, height: 0.25 }, marked);
  assert.equal(round(box.y + box.height), round(0.24 + MARGIN));
}

// No ink measured (a photo page): the model's box survives, padded.
{
  const box = snapToInk({ x: 0.2, y: 0.3, width: 0.4, height: 0.1 }, []);
  assert.equal(round(box.y), round(0.3 - MARGIN));
  assert.equal(round(box.y + box.height), round(0.4 + MARGIN));
}

// Clamped to the page, never negative.
{
  const box = snapToInk({ x: 0, y: 0, width: 1, height: 1 }, []);
  assert.deepEqual([box.x, box.y, box.width, box.height], [0, 0, 1, 1]);
}

function round(value: number) {
  return Math.round(value * 1e6);
}

console.log("coordinates self-check passed");
