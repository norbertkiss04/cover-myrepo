from docx import Document
from docx.shared import Pt, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from copy import deepcopy


def set_font(style, name="Times New Roman", size=Pt(12), bold=False, italic=False):
    font = style.font
    font.name = name
    font.size = size
    font.bold = bold
    font.italic = italic
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)
    rfonts.set(qn("w:eastAsia"), name)
    rfonts.set(qn("w:cs"), name)


def set_spacing(paragraph_format, before=Pt(0), after=Pt(0), line_spacing=1.5):
    paragraph_format.space_before = before
    paragraph_format.space_after = after
    paragraph_format.line_spacing = line_spacing


def set_page_margins(section):
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)
    section.gutter = Cm(1.0)


def configure_reference():
    doc = Document("/tmp/opencode/default-reference.docx")

    for section in doc.sections:
        set_page_margins(section)
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)

    style = doc.styles["Normal"]
    set_font(style, "Times New Roman", Pt(12))
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    set_spacing(pf, before=Pt(0), after=Pt(0), line_spacing=1.5)
    pf.first_line_indent = None

    style = doc.styles["Body Text"]
    set_font(style, "Times New Roman", Pt(12))
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    set_spacing(pf, before=Pt(0), after=Pt(6), line_spacing=1.5)
    pf.first_line_indent = None

    style = doc.styles["First Paragraph"]
    set_font(style, "Times New Roman", Pt(12))
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    set_spacing(pf, before=Pt(0), after=Pt(6), line_spacing=1.5)
    pf.first_line_indent = None

    style = doc.styles["Heading 1"]
    set_font(style, "Times New Roman", Pt(14), bold=True)
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_spacing(pf, before=Pt(12), after=Pt(12), line_spacing=1.5)
    pf.keep_with_next = True
    pf.page_break_before = True
    pf.first_line_indent = None

    style = doc.styles["Heading 2"]
    set_font(style, "Times New Roman", Pt(12), bold=True)
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_spacing(pf, before=Pt(12), after=Pt(6), line_spacing=1.5)
    pf.keep_with_next = True
    pf.page_break_before = False
    pf.first_line_indent = None

    style = doc.styles["Heading 3"]
    set_font(style, "Times New Roman", Pt(12), bold=True)
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_spacing(pf, before=Pt(6), after=Pt(6), line_spacing=1.5)
    pf.keep_with_next = True
    pf.page_break_before = False
    pf.first_line_indent = None

    for i in range(4, 10):
        style = doc.styles[f"Heading {i}"]
        set_font(style, "Times New Roman", Pt(12), bold=True)
        pf = style.paragraph_format
        pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
        set_spacing(pf, before=Pt(6), after=Pt(6), line_spacing=1.5)
        pf.keep_with_next = True
        pf.page_break_before = False
        pf.first_line_indent = None

    style = doc.styles["Bibliography"]
    set_font(style, "Times New Roman", Pt(10))
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_spacing(pf, before=Pt(0), after=Pt(6), line_spacing=1.0)
    pf.first_line_indent = None

    style = doc.styles["Caption"]
    set_font(style, "Times New Roman", Pt(10), italic=True)
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_spacing(pf, before=Pt(6), after=Pt(6), line_spacing=1.0)

    for caption_style_name in ["Table Caption", "Image Caption"]:
        style = doc.styles[caption_style_name]
        set_font(style, "Times New Roman", Pt(10), italic=True)
        pf = style.paragraph_format
        pf.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_spacing(pf, before=Pt(6), after=Pt(6), line_spacing=1.0)

    style = doc.styles["Figure"]
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if "Source Code" in [s.name for s in doc.styles]:
        style = doc.styles["Source Code"]
    else:
        style = doc.styles["Compact"]
    set_font(style, "Courier New", Pt(9))
    pf = style.paragraph_format
    set_spacing(pf, before=Pt(0), after=Pt(0), line_spacing=1.0)

    for char_style in doc.styles:
        if char_style.type.name == "CHARACTER" and "Verbatim" in char_style.name:
            char_style.font.name = "Courier New"
            char_style.font.size = Pt(9)

    style = doc.styles["TOC Heading"]
    set_font(style, "Times New Roman", Pt(14), bold=True)
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_spacing(pf, before=Pt(12), after=Pt(12), line_spacing=1.5)

    style = doc.styles["Block Text"]
    set_font(style, "Times New Roman", Pt(11))
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    set_spacing(pf, before=Pt(6), after=Pt(6), line_spacing=1.5)
    pf.left_indent = Cm(1.0)

    output_path = "/home/hower/Desktop/Prog/cover-myrepo/thesis/reference.docx"
    doc.save(output_path)
    print(f"Reference template saved to {output_path}")


if __name__ == "__main__":
    configure_reference()
