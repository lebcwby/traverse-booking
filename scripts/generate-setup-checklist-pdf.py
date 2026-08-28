"""
Build the Traverse Hospitality vacation-rental setup checklist PDF.

Design intent: this is printed, put on a clipboard, and walked around a
property with a pen. So it optimises for that, not for screen looks —
generous row height for a tick, real square checkboxes with enough stroke
weight to survive a cheap printer, and a palette that still reads correctly
in black and white (navy bands go dark grey, blue accents go mid grey, and
nothing depends on hue to be legible).
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)

# ── Brand ────────────────────────────────────────────────────────────────
NAVY = colors.HexColor("#14142b")
INK = colors.HexColor("#1e293b")
BODY = colors.HexColor("#475569")
MUTED = colors.HexColor("#64748b")
BLUE = colors.HexColor("#3b82f6")
LINE = colors.HexColor("#cbd5e1")
BAND = colors.HexColor("#f1f5f9")

REPO = "/Users/Nadim/guesty direct booking website/guesty-direct-booking-template-main"
OUT = f"{REPO}/public/traverse-rental-setup-checklist.pdf"
LOGO_WHITE = f"{REPO}/public/book-traverse-wordmark-white.png"

PAGE_W, PAGE_H = letter
MARGIN = 0.6 * inch
HEADER_H = 0.92 * inch
FOOTER_H = 0.55 * inch

# ── Styles ───────────────────────────────────────────────────────────────
h_section = ParagraphStyle(
    "sec", fontName="Helvetica-Bold", fontSize=11.5, leading=14,
    textColor=NAVY, spaceBefore=0, spaceAfter=0, alignment=TA_LEFT,
)
p_item = ParagraphStyle(
    "item", fontName="Helvetica", fontSize=9.3, leading=11.9, textColor=INK,
)
p_note = ParagraphStyle(
    "note", fontName="Helvetica-Oblique", fontSize=8.4, leading=11, textColor=MUTED,
)
p_intro = ParagraphStyle(
    "intro", fontName="Helvetica", fontSize=9.5, leading=13, textColor=BODY,
)
p_fill = ParagraphStyle(
    "fill", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=MUTED,
)

# ── Content ──────────────────────────────────────────────────────────────
# (section title, [items], optional footnote)
SECTIONS = [
    # Deliberately first: every other section is something to ADD, this is the
    # only one about taking things away, and it is the step that actually comes
    # first when you walk a property.
    ("Personal Belongings & Clutter", [
        "<b>Personal belongings out</b>, or locked in an owner closet \u2014 and disclosed in the listing",
        "<b>Valuables, heirlooms and irreplaceable items removed</b>",
        "<b>Shelves, counters, dressers and table tops clear</b>, with open space left",
        "<b>Family photos, collections, paperwork, mail and medications gone</b>",
        "<b>Closets and drawers cleared</b>, with room for guests to unpack",
        "Half-used consumables binned \u2014 toiletries, old spices, freezer archaeology",
        "Excess furniture removed \u2014 no function for a guest, no reason to keep it",
        "<b>D\u00e9cor intentional and simple</b>, not overly personal",
    ], "Guests want to feel at home \u2014 not like they are in someone else's home."),
    ("Furniture", [
        "Beds, with mattresses and linens for every sleeping position advertised",
        "Sofa or proper seating area — comfortable seating for everyone the home sleeps",
        "<b>Dining table and chairs sized to the listing</b> — if it sleeps 6, the table seats 6",
        "Dressers or closets, so guests can unpack rather than live out of a suitcase",
    ], None),
    ("Appliances", [
        "Refrigerator",
        "Stove and oven",
        "Microwave",
        "Toaster",
        "Coffee maker",
        "Dishwasher — optional, strongly preferred",
        "Washer and dryer — near-essential for longer stays",
        "Nice to add: slow cooker, waffle maker, pressure cooker",
    ], None),
    ("Kitchen Supplies", [
        "Cookware — pots, pans, cooking utensils. <b>Avoid Teflon</b>: it scrapes and peels",
        "Dinnerware for maximum occupancy — matching, nothing chipped",
        "Sharp knives and a cutting board",
        "Mixing bowls, baking sheet, colander",
        "Pantry basics — salt, pepper, cooking oil, everyday spices",
        "Coffee and tea, with a starter supply",
        "Bin bags, and a bin with a lid",
    ], "Traverse-managed properties: we supply dish soap and dishwasher detergent."),
    ("Bathrooms", [
        "Bath towels, hand towels, washcloths — <b>counted against how many the home sleeps</b>",
        "Bath mat, and somewhere to hang wet towels",
        "Toilet paper, with a spare roll visible",
        "<b>A hairdryer in every bathroom</b> — not one shared between floors",
        "Clear counter or shelf space for a guest's own toiletries",
        "Mirror with usable light",
    ], "Traverse-managed properties: we supply hand soap, shampoo, conditioner and body wash."),
    ("Bedrooms", [
        "Bedsheets, pillowcases and blankets for every bed",
        "<b>Zippered mattress and pillow encasements</b> — what stands between one incident and a new mattress",
        "Two pillows per single bed; four for a full, queen or king",
        "Extra pillows and blankets, accessible without asking",
        "At least four hangers per guest — not wire ones",
        "Bedside surface, reachable light, and a power outlet each side of the bed",
        "<b>Blackout curtains in every bedroom</b>",
        "Optional: alarm clock, full-length mirror, white-noise machine",
    ], None),
    ("Cleaning Supplies", [
        "Vacuum cleaner",
        "Mop and bucket",
        "Broom and dustpan",
        "Cleaning cloths or sponges",
    ], "Guests clean up their own spills if you make it possible."),
    ("Safety Equipment", [
        "<b>Smoke detectors in every bedroom and in common areas</b>",
        "<b>CO detectors outside every bedroom, and at least one on every level</b>",
        "Fire extinguisher — more than one in a larger home",
        "First aid kit",
        "Check the dates. An expired extinguisher is worse than none",
    ], None),
    ("Utilities and Amenities", [
        "Heating, and air conditioning where the building has it",
        "Reliable wifi — network name and password written somewhere obvious in the home",
        "TV with streaming services or cable",
        "Iron and ironing board",
        "Trash cans and recycling bins",
        "<b>Two or three fans</b> — most Colorado mountain homes have no AC",
        "<b>Thermostat-controlled portable heaters</b> for rooms that run cold",
    ], None),
    ("Guest Comfort", [
        "Extra blankets and pillows",
        "Window coverings throughout for privacy and light control",
        "Blackout coverings specifically in bedrooms",
        "A small welcome amenity — water, local snacks, coffee",
    ], None),
    ("Worth Adding If You Can", [
        "Outdoor furniture — patio set or deck chairs",
        "BBQ grill",
        "Board games, books, rainy-afternoon options",
        "Crib, high chair or pack-and-play — families filter for these",
    ], None),
    ("Colorado Specifics", [
        "<b>Somewhere for wet gear</b> — boots, boards and soaked layers need a designated spot",
        "<b>Altitude basics</b> — extra water glasses, humidifier in dry months",
        "<b>Real winter parking instructions</b> — which space, what code, what happens when it snows",
        "<b>Layered bedding</b> — mountain nights swing hard",
        "<b>Honest lift and trailhead proximity</b> — flat five minutes, or uphill in ski boots?",
    ], None),
    ("The Two Things No Inventory List Captures", [
        "<b>Cleanliness</b> — rarely about dirt. Hair in a drain, dust on a fan, a sticky remote",
        "<b>Accuracy</b> — every amenity you claim, present and working on the day",
    ], "These are what guest ratings weight most heavily. Tick every box above and still miss these, and you sit at 4.6."),
]


BOX_PT = 9.5


def _square():
    """A fixed 9.5pt square.

    Drawn as its own nested table rather than as a BOX style on the outer
    cell: the outer cell's height is driven by its text, so a two-line item
    produced a tall rectangle instead of a checkbox. 0.8pt stroke — hairlines
    disappear on cheap office printers, and this is meant to be printed.
    """
    return Table(
        [[""]], colWidths=[BOX_PT], rowHeights=[BOX_PT],
        style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, INK),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))


def checkbox_table(items):
    rows = [[_square(), Paragraph(t, p_item)] for t in items]
    t = Table(rows, colWidths=[BOX_PT, PAGE_W - 2 * MARGIN - BOX_PT])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2.8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8),
        # Nudge the square down onto the first line's cap height.
        ("TOPPADDING", (0, 0), (0, -1), 4.8),
        ("LEFTPADDING", (1, 0), (1, -1), 9),
    ]))
    return t


def section_flowables(title, items, note):
    header = [
        Paragraph(title.upper(), h_section),
        Spacer(1, 2),
        Table([[""]], colWidths=[PAGE_W - 2 * MARGIN], rowHeights=[1.6],
              style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), BLUE)])),
        Spacer(1, 5),
    ]
    # Keep the heading with only the first few items, then let the rest flow.
    # Binding the heading to the WHOLE table pushed entire sections to the next
    # page and left half-empty pages behind.
    head_n = min(3, len(items))
    out = [KeepTogether(header + [checkbox_table(items[:head_n])])]
    if len(items) > head_n:
        out.append(checkbox_table(items[head_n:]))
    if note:
        out += [Spacer(1, 2), Paragraph(note, p_note)]
    out.append(Spacer(1, 8))
    return out


def draw_chrome(canvas, doc):
    canvas.saveState()

    # Header band
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, stroke=0, fill=1)
    try:
        canvas.drawImage(LOGO_WHITE, MARGIN, PAGE_H - HEADER_H + 0.36 * inch,
                         width=1.55 * inch, height=0.372 * inch,
                         mask="auto", preserveAspectRatio=True, anchor="sw")
    except Exception:
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawString(MARGIN, PAGE_H - HEADER_H + 0.46 * inch, "TRAVERSE HOSPITALITY")

    canvas.setFillColor(colors.HexColor("#9ec5ff"))
    canvas.setFont("Helvetica-Bold", 7.6)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - HEADER_H + 0.60 * inch,
                           "V A C A T I O N   R E N T A L")
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - HEADER_H + 0.34 * inch,
                           "Setup Checklist")

    # Footer
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, FOOTER_H, PAGE_W - MARGIN, FOOTER_H)
    canvas.setFont("Helvetica", 7.6)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, FOOTER_H - 14,
                      "Traverse Hospitality  ·  Colorado short-term rental management  ·  (970) 533-3583")
    canvas.drawString(MARGIN, FOOTER_H - 24,
                      "Free written listing audit: audit.booktraverse.com")
    canvas.drawRightString(PAGE_W - MARGIN, FOOTER_H - 14, f"Page {doc.page}")
    canvas.drawRightString(PAGE_W - MARGIN, FOOTER_H - 24, "booktraverse.com")
    canvas.restoreState()


def build():
    doc = BaseDocTemplate(
        OUT, pagesize=letter,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=HEADER_H + 0.28 * inch, bottomMargin=FOOTER_H + 0.30 * inch,
        title="Vacation Rental Setup Checklist",
        author="Traverse Hospitality",
        subject="Printable setup and furnishing checklist for short-term rental owners",
        creator="Traverse Hospitality — booktraverse.com",
    )
    frame = Frame(MARGIN, doc.bottomMargin,
                  PAGE_W - 2 * MARGIN,
                  PAGE_H - doc.topMargin - doc.bottomMargin, id="body")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=draw_chrome)])

    story = []

    # Fill-in line — this is an onboarding document, so it should be able to
    # carry which property and who walked it.
    story.append(Table(
        [[Paragraph("PROPERTY", p_fill), Paragraph("WALKED BY", p_fill), Paragraph("DATE", p_fill)]],
        colWidths=[(PAGE_W - 2 * MARGIN) * 0.46, (PAGE_W - 2 * MARGIN) * 0.30,
                   (PAGE_W - 2 * MARGIN) * 0.24],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BAND),
            ("LINEBELOW", (0, 0), (-1, -1), 0.7, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 17),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ])))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "Airbnb retired the Plus program in November 2023 and replaced it with Guest Favorites — "
        "no inspector, no application. The badge went away; the standard didn't. This is the list "
        "we walk when we onboard a property in Colorado. Work down it once and you will find things.",
        p_intro))
    story.append(Spacer(1, 12))

    for title, items, note in SECTIONS:
        story += section_flowables(title, items, note)

    doc.build(story)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
