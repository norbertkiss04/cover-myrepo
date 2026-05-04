from docx import Document
from docx.shared import Pt, Cm, Inches, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import OxmlElement, parse_xml
import re
import sys
from pathlib import Path


FONT_NAME = "Times New Roman"
BODY_SIZE = Pt(12)
H1_SIZE = Pt(14)
H2_SIZE = Pt(12)
H3_SIZE = Pt(12)
BIB_SIZE = Pt(10)
CODE_FONT = "Courier New"
CODE_SIZE = Pt(9)
LINE_SPACING = 1.5
HEADING_COLOR = RGBColor(0, 0, 0)
BODY_COLOR = RGBColor(0, 0, 0)


def set_run_font(run, name=FONT_NAME, size=BODY_SIZE, bold=None, italic=None, color=BODY_COLOR):
    run.font.name = name
    run.font.size = size
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color

    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)
    rFonts.set(qn("w:ascii"), name)
    rFonts.set(qn("w:hAnsi"), name)
    rFonts.set(qn("w:eastAsia"), name)
    rFonts.set(qn("w:cs"), name)

    theme_attrs = [qn("w:asciiTheme"), qn("w:hAnsiTheme"), qn("w:eastAsiaTheme"), qn("w:cstheme")]
    for attr in theme_attrs:
        if rFonts.get(attr):
            del rFonts.attrib[attr]


def set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.JUSTIFY, space_before=Pt(0),
                         space_after=Pt(0), line_spacing=LINE_SPACING, first_indent=None,
                         keep_next=False, page_break_before=False):
    pf = para.paragraph_format
    pf.alignment = alignment
    pf.space_before = space_before
    pf.space_after = space_after
    pf.line_spacing = line_spacing
    pf.first_line_indent = first_indent
    pf.keep_with_next = keep_next
    pf.page_break_before = page_break_before


def is_code_style(style_name):
    return style_name == "Source Code"


def is_heading(style_name):
    return style_name.startswith("Heading")


def get_heading_level(style_name):
    match = re.search(r"(\d+)", style_name)
    return int(match.group(1)) if match else 0


def fix_paragraph(para):
    style_name = para.style.name

    if is_heading(style_name):
        level = get_heading_level(style_name)
        if level == 1:
            size = H1_SIZE
            set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.LEFT,
                                 space_before=Pt(12), space_after=Pt(12),
                                 line_spacing=LINE_SPACING, keep_next=True,
                                 page_break_before=True)
        elif level == 2:
            size = H2_SIZE
            set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.LEFT,
                                 space_before=Pt(12), space_after=Pt(6),
                                 line_spacing=LINE_SPACING, keep_next=True)
        else:
            size = H3_SIZE
            set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.LEFT,
                                 space_before=Pt(6), space_after=Pt(6),
                                 line_spacing=LINE_SPACING, keep_next=True)

        for run in para.runs:
            set_run_font(run, size=size, bold=True, color=HEADING_COLOR)

    elif is_code_style(style_name):
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.LEFT,
                             space_before=Pt(0), space_after=Pt(0),
                             line_spacing=1.0)
        for run in para.runs:
            set_run_font(run, name=CODE_FONT, size=CODE_SIZE, bold=False, color=BODY_COLOR)

    elif style_name == "Bibliography":
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.LEFT,
                             space_before=Pt(0), space_after=Pt(6),
                             line_spacing=1.0)
        for run in para.runs:
            set_run_font(run, size=BIB_SIZE, color=BODY_COLOR)

    elif style_name == "Compact":
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.JUSTIFY,
                             space_before=Pt(0), space_after=Pt(3),
                             line_spacing=LINE_SPACING,
                             first_indent=None)
        para.paragraph_format.left_indent = Cm(1.0)
        for run in para.runs:
            existing_bold = run.font.bold
            existing_italic = run.font.italic
            set_run_font(run, size=BODY_SIZE, bold=existing_bold,
                         italic=existing_italic, color=BODY_COLOR)

    elif "TOC" in style_name or "toc" in style_name:
        pass

    elif style_name in ["Title", "Subtitle", "Author", "Date"]:
        for run in para.runs:
            set_run_font(run, color=BODY_COLOR)

    else:
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.JUSTIFY,
                             space_before=Pt(0), space_after=Pt(6),
                             line_spacing=LINE_SPACING)
        for run in para.runs:
            existing_bold = run.font.bold
            existing_italic = run.font.italic

            if run.font.name and "courier" in run.font.name.lower():
                set_run_font(run, name=CODE_FONT, size=CODE_SIZE,
                             bold=existing_bold, italic=existing_italic, color=BODY_COLOR)
            else:
                set_run_font(run, size=BODY_SIZE,
                             bold=existing_bold, italic=existing_italic, color=BODY_COLOR)


def fix_table(table):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    tbl = table._tbl
    tblPr = tbl.find(qn("w:tblPr"))
    if tblPr is None:
        tblPr = OxmlElement("w:tblPr")
        tbl.insert(0, tblPr)

    existing_borders = tblPr.find(qn("w:tblBorders"))
    if existing_borders is not None:
        tblPr.remove(existing_borders)

    borders = OxmlElement("w:tblBorders")
    for border_name in ["top", "left", "bottom", "right", "insideH", "insideV"]:
        border = OxmlElement(f"w:{border_name}")
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "4")
        border.set(qn("w:space"), "0")
        border.set(qn("w:color"), "000000")
        borders.append(border)
    tblPr.append(borders)

    for i, row in enumerate(table.rows):
        for cell in row.cells:
            for para in cell.paragraphs:
                para.paragraph_format.space_before = Pt(2)
                para.paragraph_format.space_after = Pt(2)
                para.paragraph_format.line_spacing = 1.0
                para.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
                for run in para.runs:
                    if i == 0:
                        set_run_font(run, size=Pt(10), bold=True, color=BODY_COLOR)
                    else:
                        set_run_font(run, size=Pt(10), bold=False, color=BODY_COLOR)

            tc = cell._tc
            tcPr = tc.find(qn("w:tcPr"))
            if tcPr is None:
                tcPr = OxmlElement("w:tcPr")
                tc.insert(0, tcPr)


def fix_page_setup(doc):
    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)

        sectPr = section._sectPr
        pgMar = sectPr.find(qn("w:pgMar"))
        if pgMar is not None:
            pgMar.set(qn("w:gutter"), "567")


def generate_toc(doc):
    headings = []
    for para in doc.paragraphs:
        if is_heading(para.style.name) and para.text.strip():
            level = get_heading_level(para.style.name)
            if level <= 3:
                headings.append((level, para.text.strip()))

    body = doc.element.body

    insert_before = None
    for i, child in enumerate(body):
        if child.tag == qn("w:p"):
            pPr = child.find(qn("w:pPr"))
            if pPr is not None:
                pStyle = pPr.find(qn("w:pStyle"))
                if pStyle is not None and "Heading" in pStyle.get(qn("w:val"), ""):
                    insert_before = i
                    break

    if insert_before is None:
        return

    toc_elements = []

    toc_title = OxmlElement("w:p")
    toc_pPr = OxmlElement("w:pPr")
    toc_pStyle = OxmlElement("w:pStyle")
    toc_pStyle.set(qn("w:val"), "Heading1")
    toc_pPr.append(toc_pStyle)

    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:before"), "240")
    spacing.set(qn("w:after"), "240")
    toc_pPr.append(spacing)

    page_break = OxmlElement("w:pageBreakBefore")
    page_break.set(qn("w:val"), "false")
    toc_pPr.append(page_break)

    toc_title.append(toc_pPr)
    toc_run = OxmlElement("w:r")
    toc_rPr = OxmlElement("w:rPr")
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(qn("w:ascii"), FONT_NAME)
    rFonts.set(qn("w:hAnsi"), FONT_NAME)
    toc_rPr.append(rFonts)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), "28")
    toc_rPr.append(sz)
    b = OxmlElement("w:b")
    toc_rPr.append(b)
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "000000")
    toc_rPr.append(color)
    toc_run.append(toc_rPr)
    toc_text = OxmlElement("w:t")
    toc_text.text = "Tartalomjegyzék"
    toc_run.append(toc_text)
    toc_title.append(toc_run)
    toc_elements.append(toc_title)

    for level, text in headings:
        if text == "Tartalomjegyzék":
            continue

        entry = OxmlElement("w:p")
        entry_pPr = OxmlElement("w:pPr")

        indent = OxmlElement("w:ind")
        indent_val = str((level - 1) * 360)
        indent.set(qn("w:left"), indent_val)
        entry_pPr.append(indent)

        tabs = OxmlElement("w:tabs")
        tab = OxmlElement("w:tab")
        tab.set(qn("w:val"), "right")
        tab.set(qn("w:leader"), "dot")
        tab.set(qn("w:pos"), "9072")
        tabs.append(tab)
        entry_pPr.append(tabs)

        entry_spacing = OxmlElement("w:spacing")
        entry_spacing.set(qn("w:before"), "60")
        entry_spacing.set(qn("w:after"), "60")
        entry_spacing.set(qn("w:line"), "240")
        entry_spacing.set(qn("w:lineRule"), "auto")
        entry_pPr.append(entry_spacing)

        entry.append(entry_pPr)

        entry_run = OxmlElement("w:r")
        entry_rPr = OxmlElement("w:rPr")
        rFonts = OxmlElement("w:rFonts")
        rFonts.set(qn("w:ascii"), FONT_NAME)
        rFonts.set(qn("w:hAnsi"), FONT_NAME)
        entry_rPr.append(rFonts)
        entry_sz = OxmlElement("w:sz")
        if level == 1:
            entry_sz.set(qn("w:val"), "24")
            entry_b = OxmlElement("w:b")
            entry_rPr.append(entry_b)
        else:
            entry_sz.set(qn("w:val"), "22")
        entry_rPr.append(entry_sz)
        entry_color = OxmlElement("w:color")
        entry_color.set(qn("w:val"), "000000")
        entry_rPr.append(entry_color)
        entry_run.append(entry_rPr)
        entry_text = OxmlElement("w:t")
        entry_text.set(qn("xml:space"), "preserve")
        entry_text.text = text
        entry_run.append(entry_text)
        entry.append(entry_run)

        toc_elements.append(entry)

    page_break_para = OxmlElement("w:p")
    pb_pPr = OxmlElement("w:pPr")
    page_break_para.append(pb_pPr)
    pb_run = OxmlElement("w:r")
    br_elem = OxmlElement("w:br")
    br_elem.set(qn("w:type"), "page")
    pb_run.append(br_elem)
    page_break_para.append(pb_run)
    toc_elements.append(page_break_para)

    for elem in reversed(toc_elements):
        body.insert(insert_before, elem)


def fix_document_theme(doc):
    body = doc.element.body
    sectPr_list = body.findall(qn("w:sectPr"))

    for rPr in doc.element.iter(qn("w:rPr")):
        rFonts = rPr.find(qn("w:rFonts"))
        if rFonts is not None:
            for attr in [qn("w:asciiTheme"), qn("w:hAnsiTheme"), qn("w:eastAsiaTheme"), qn("w:cstheme")]:
                if rFonts.get(attr) is not None:
                    del rFonts.attrib[attr]
            if not rFonts.get(qn("w:ascii")):
                rFonts.set(qn("w:ascii"), FONT_NAME)
                rFonts.set(qn("w:hAnsi"), FONT_NAME)
                rFonts.set(qn("w:eastAsia"), FONT_NAME)
                rFonts.set(qn("w:cs"), FONT_NAME)


def remove_pandoc_toc_sdt(doc):
    body = doc.element.body
    for sdt in body.findall(qn("w:sdt")):
        body.remove(sdt)


def postprocess(docx_path):
    doc = Document(docx_path)

    remove_pandoc_toc_sdt(doc)
    fix_page_setup(doc)
    fix_document_theme(doc)

    for para in doc.paragraphs:
        fix_paragraph(para)

    for table in doc.tables:
        fix_table(table)

    generate_toc(doc)

    doc.save(docx_path)
    print(f"    Post-processed: {docx_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        docx_path = Path(__file__).parent / "build" / "thesis_body.docx"
    else:
        docx_path = Path(sys.argv[1])

    if not docx_path.exists():
        print(f"ERROR: {docx_path} does not exist")
        sys.exit(1)

    postprocess(str(docx_path))
