"""Generate the evaluation fixtures.

paper_01 is typed — a clean baseline where OCR is not the variable under test.
paper_02 is handwritten on ruled paper, which is what the product actually has
to cope with: real handwriting, a hand-drawn diagram, a crossed-out correction,
answers out of order, and an answer that runs across a page break.

    python make_samples.py

Requires reportlab. The handwriting uses Segoe Print, which ships with Windows;
set HAND_FONT to any TTF if you are generating these elsewhere.
"""

import os
import random

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

W, H = A4

HAND_FONT_CANDIDATES = [
    "C:/Windows/Fonts/segoepr.ttf",   # Segoe Print
    "C:/Windows/Fonts/Inkfree.ttf",   # Ink Free
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

INK = (0.10, 0.13, 0.42)      # blue-black ballpoint
RULE = (0.78, 0.84, 0.90)     # faint blue rule
MARGIN_RULE = (0.90, 0.55, 0.60)

# Deterministic wobble, so regenerating gives the same sheet.
random.seed(7)


# ---------------------------------------------------------------------------
# paper_02 question paper (printed)
# ---------------------------------------------------------------------------

QUESTIONS = [
    ("1.", "Define photosynthesis and write its balanced chemical equation.", "[3]"),
    ("2.", "Which blood vessel carries blood away from the heart?", "[2]"),
    ("3.", "State two factors that affect the rate of transpiration.", "[2]"),
    ("4.", "Draw a labelled diagram of a plant cell.", "[4]"),
    ("5.", "Explain the role of chlorophyll in photosynthesis.", "[3]"),
    ("6.", "What is the function of the nephron in the human kidney?", "[3]"),
    ("7(a)", "A plant kept in a dark cupboard turns pale. Explain why.", "[2]"),
    ("7(b)", "Suggest one measure that would help the plant recover.", "[2]"),
]


def build_question_paper(path):
    c = canvas.Canvas(path, pagesize=A4)

    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(W / 2, H - 62, "DELHI PUBLIC SCHOOL, BOKARO STEEL CITY")
    c.setFont("Helvetica", 11)
    c.drawCentredString(W / 2, H - 80, "Class 10 — Science (Biology) — Unit Test")
    c.setFont("Helvetica", 9.5)
    c.drawString(60, H - 104, "Time: 45 minutes")
    c.drawRightString(W - 60, H - 104, "Maximum Marks: 21")
    c.setLineWidth(0.7)
    c.line(60, H - 114, W - 60, H - 114)

    c.setFont("Helvetica-Oblique", 9)
    c.drawString(60, H - 132, "Answer all questions. Write the question number clearly before each answer.")

    y = H - 168
    for number, text, marks in QUESTIONS:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(62, y, number)
        c.setFont("Helvetica", 11)
        c.drawString(108, y, text)
        c.setFont("Helvetica", 10)
        c.drawRightString(W - 62, y, marks)
        y -= 46

    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(W / 2, 60, "— End of paper —")
    c.save()


# ---------------------------------------------------------------------------
# Answer sheet (handwritten)
# ---------------------------------------------------------------------------

LINE_GAP = 26


def register_hand_font():
    for path in HAND_FONT_CANDIDATES:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont("Hand", path))
            return os.path.basename(path)
    raise SystemExit(
        "No handwriting font found. Point HAND_FONT_CANDIDATES at a .ttf on this machine."
    )


def ruled_page(c, page_number):
    """Ruled exam paper: faint horizontal rules and a red left margin."""
    c.setStrokeColorRGB(*RULE)
    c.setLineWidth(0.4)
    y = H - 96
    while y > 60:
        c.line(46, y, W - 46, y)
        y -= LINE_GAP

    c.setStrokeColorRGB(*MARGIN_RULE)
    c.setLineWidth(0.7)
    c.line(96, H - 40, 96, 52)

    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 46, 36, f"Page {page_number}")


def hand(c, x, y, text, size=13.5, bold_ish=False):
    """One line of handwriting, with a little baseline drift and slant."""
    c.saveState()
    c.setFillColorRGB(*INK)
    c.setFont("Hand", size + (0.6 if bold_ish else 0))
    c.translate(x + random.uniform(-1.2, 1.2), y + random.uniform(-1.6, 1.6))
    c.rotate(random.uniform(-0.7, 0.7))
    c.drawString(0, 0, text)
    c.restoreState()


def wobbly_line(c, x1, y1, x2, y2, steps=14, jitter=0.9):
    """A straight line drawn by hand never is."""
    c.setStrokeColorRGB(*INK)
    c.setLineWidth(1.0)
    path = c.beginPath()
    path.moveTo(x1, y1)
    for i in range(1, steps + 1):
        t = i / steps
        path.lineTo(
            x1 + (x2 - x1) * t + random.uniform(-jitter, jitter),
            y1 + (y2 - y1) * t + random.uniform(-jitter, jitter),
        )
    c.drawPath(path)


def wobbly_ellipse(c, cx, cy, rx, ry, steps=40, jitter=1.1):
    import math

    c.setStrokeColorRGB(*INK)
    c.setLineWidth(1.0)
    path = c.beginPath()
    for i in range(steps + 1):
        a = 2 * math.pi * i / steps
        px = cx + rx * math.cos(a) + random.uniform(-jitter, jitter)
        py = cy + ry * math.sin(a) + random.uniform(-jitter, jitter)
        path.moveTo(px, py) if i == 0 else path.lineTo(px, py)
    c.drawPath(path)


def strike_through(c, x, y, width):
    """A cancelled word — the evidence model reports these."""
    wobbly_line(c, x, y + 4, x + width, y + 4.5, steps=6, jitter=0.6)


def answer_block(c, y, label, lines, indent=170):
    """Question number in the margin, answer text to its right."""
    if label:
        hand(c, 108, y, label, size=14, bold_ish=True)
    for line in lines:
        hand(c, indent, y, line)
        y -= LINE_GAP
    return y


def plant_cell_diagram(c, y):
    """A hand-drawn plant cell with leader lines and labels."""
    left, right = 200, 360
    top, bottom = y, y - 108

    # Cell wall, then the membrane just inside it.
    wobbly_line(c, left, top, right, top)
    wobbly_line(c, right, top, right, bottom)
    wobbly_line(c, right, bottom, left, bottom)
    wobbly_line(c, left, bottom, left, top)
    wobbly_line(c, left + 6, top - 6, right - 6, top - 6, steps=10)
    wobbly_line(c, right - 6, top - 6, right - 6, bottom + 6, steps=10)
    wobbly_line(c, right - 6, bottom + 6, left + 6, bottom + 6, steps=10)
    wobbly_line(c, left + 6, bottom + 6, left + 6, top - 6, steps=10)

    wobbly_ellipse(c, 258, y - 52, 21, 16)          # nucleus
    wobbly_ellipse(c, 315, y - 30, 13, 8)           # chloroplast
    wobbly_ellipse(c, 306, y - 74, 12, 7)           # chloroplast
    wobbly_ellipse(c, 232, y - 86, 16, 9)           # vacuole

    for (lx, ly), (tx, ty), text in [
        ((right, top - 4), (right + 40, top + 6), "Cell wall"),
        ((279, y - 52), (right + 40, y - 48), "Nucleus"),
        ((328, y - 30), (right + 40, y - 22), "Chloroplast"),
        ((248, y - 86), (right + 40, y - 92), "Vacuole"),
    ]:
        wobbly_line(c, lx, ly, tx - 4, ty, steps=8, jitter=0.6)
        hand(c, tx, ty - 4, text, size=12)

    return bottom - 24


def build_answer_sheet(path):
    c = canvas.Canvas(path, pagesize=A4)

    # ---- Page 1: Q2 first, then Q1, then 7(b) -----------------------------
    ruled_page(c, 1)
    hand(c, 110, H - 66, "Name: Riya Sharma", size=14)
    hand(c, 380, H - 66, "Roll No. 17", size=14)

    y = H - 122
    y = answer_block(c, y, "Ans 2.", [
        "Arteries carry blood away from the heart.",
        "They have thick muscular walls to withstand",
        "the high pressure of the blood.",
    ])

    y -= 18
    y = answer_block(c, y, "Q1.", [
        "Photosynthesis is the process by which green",
        "plants prepare their own food using sunlight,",
        "carbon dioxide and water.",
    ])

    # A word the student crossed out and rewrote.
    hand(c, 170, y, "The equation is :", size=13.5)
    strike_through(c, 170 + 84, y, 40)
    hand(c, 300, y, "balanced equation is :", size=13.5)
    y -= LINE_GAP + 6

    hand(c, 190, y, "6CO2  +  6H2O   ---light--->   C6H12O6  +  6O2", size=14)
    y -= LINE_GAP
    hand(c, 250, y, "chlorophyll", size=11.5)
    y -= LINE_GAP + 20

    answer_block(c, y, "7 b", [
        "Keep the plant back in bright sunlight so that",
        "it can make chlorophyll again.",
    ])
    c.showPage()

    # ---- Page 2: Q5, Q4 with diagram, Q6 starts ---------------------------
    ruled_page(c, 2)
    y = H - 118

    y = answer_block(c, y, "Q5.", [
        "Chlorophyll is the green pigment present in the",
        "chloroplast. It absorbs light energy from the sun",
        "and converts it into chemical energy.",
    ])

    y -= 16
    hand(c, 108, y, "4.", size=14, bold_ish=True)
    hand(c, 170, y, "Labelled diagram of a plant cell :", size=13.5)
    y -= LINE_GAP + 8
    y = plant_cell_diagram(c, y)

    y -= 12
    answer_block(c, y, "6.", [
        "The nephron is the functional unit of the kidney.",
        "It filters the blood and removes waste products",
    ])
    c.showPage()

    # ---- Page 3: Q6 continues, then 7(a), then rough work -----------------
    ruled_page(c, 3)
    y = H - 118

    # No question number here — this only makes sense as a continuation.
    y = answer_block(c, y, "", [
        "such as urea and excess salts. It also reabsorbs",
        "useful substances like glucose and water back",
        "into the blood.",
    ])

    y -= 20
    y = answer_block(c, y, "7 (a)", [
        "In the dark the plant cannot carry out",
        "photosynthesis, so it cannot make chlorophyll.",
        "Without chlorophyll the leaves lose their green",
        "colour and turn pale.",
    ])

    y -= 34
    hand(c, 170, y, "Rough work", size=12)
    y -= LINE_GAP
    hand(c, 190, y, "21 - 2 - 3 = 16 marks attempted", size=12.5)
    c.showPage()

    c.save()


# ---------------------------------------------------------------------------
# paper_01 — the typed baseline
# ---------------------------------------------------------------------------

QUESTIONS_01 = [
    ("1.", "Define photosynthesis.", "[2]"),
    ("2.", "Which blood vessel carries blood away from the heart?", "[2]"),
    ("3.", "State two factors that affect the rate of transpiration.", "[2]"),
    ("4.", "Explain the role of chlorophyll in a plant.", "[3]"),
    ("11(a)", "A plant kept in the dark turns pale. Explain why.", "[2]"),
    ("11(b)", "Suggest one measure to help the plant recover.", "[3]"),
]

# Out of order, Q3 skipped, and a rough-work block belonging to no question.
ANSWERS_01 = [
    ("Ans 2.", ["Arteries carry blood away from the heart.",
                "They have thick muscular walls."]),
    ("Q1.", ["Photosynthesis is the process by which green plants",
             "use sunlight to make glucose from carbon dioxide",
             "and water."]),
    ("11 b", ["Move the plant back into bright sunlight so it can",
              "resume making chlorophyll."]),
    ("4.", ["Chlorophyll is the green pigment that absorbs light",
            "energy for photosynthesis."]),
    ("11(a)", ["Without light the plant cannot make chlorophyll,",
               "so the leaves lose their green colour."]),
    ("", ["Rough work: 6CO2 + 6H2O -> C6H12O6 + 6O2"]),
]


def build_typed_question_paper(path):
    c = canvas.Canvas(path, pagesize=A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(W / 2, H - 70, "Class 10 Biology - Unit Test")
    y = H - 120
    for number, text, marks in QUESTIONS_01:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(60, y, number)
        c.setFont("Helvetica", 11)
        c.drawString(110, y, text)
        c.drawRightString(W - 60, y, marks)
        y -= 42
    c.save()


def build_typed_answer_sheet(path):
    c = canvas.Canvas(path, pagesize=A4)
    for page in range(2):
        c.setFont("Helvetica-Bold", 13)
        c.drawString(60, H - 60, "Student: Riya Sharma    Roll No. 17")

        c.setLineWidth(0.3)
        c.setStrokeColorRGB(0.8, 0.85, 0.9)
        for i in range(28):
            c.line(50, H - 100 - i * 24, W - 50, H - 100 - i * 24)

        y = H - 110
        for label, lines in (ANSWERS_01[:3] if page == 0 else ANSWERS_01[3:]):
            c.setFillColorRGB(0.1, 0.1, 0.35)
            if label:
                c.setFont("Helvetica-Bold", 12)
                c.drawString(60, y, label)
            c.setFont("Helvetica", 11.5)
            for line in lines:
                c.drawString(120, y, line)
                y -= 24
            y -= 36

        c.setFillColorRGB(0, 0, 0)
        c.showPage()
    c.save()


if __name__ == "__main__":
    os.makedirs("paper_01", exist_ok=True)
    os.makedirs("paper_02", exist_ok=True)

    build_typed_question_paper("paper_01/question-paper.pdf")
    build_typed_answer_sheet("paper_01/answer-sheet.pdf")

    build_question_paper("paper_02/question-paper.pdf")
    font = register_hand_font()
    build_answer_sheet("paper_02/answer-sheet.pdf")

    print("paper_01/question-paper.pdf   printed, 6 questions")
    print("paper_01/answer-sheet.pdf     typed, 2 pages")
    print("paper_02/question-paper.pdf   printed, 8 questions, 21 marks")
    print(f"paper_02/answer-sheet.pdf     handwritten ({font}), 3 pages")
