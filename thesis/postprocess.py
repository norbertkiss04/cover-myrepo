import sys
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt


def insert_toc_field(doc, heading_text="Tartalomjegyzék"):
    body = doc.element.body

    first_heading_idx = None
    for i, child in enumerate(body):
        if child.tag == qn("w:p"):
            pPr = child.find(qn("w:pPr"))
            if pPr is not None:
                pStyle = pPr.find(qn("w:pStyle"))
                if pStyle is not None and pStyle.get(qn("w:val")) == "Heading1":
                    first_heading_idx = i
                    break

    if first_heading_idx is None:
        first_heading_idx = 0

    sdt_elements = body.findall(qn("w:sdt"))
    for sdt in sdt_elements:
        body.remove(sdt)

    toc_heading = OxmlElement("w:p")
    toc_pPr = OxmlElement("w:pPr")
    toc_pStyle = OxmlElement("w:pStyle")
    toc_pStyle.set(qn("w:val"), "TOCHeading")
    toc_pPr.append(toc_pStyle)
    toc_heading.append(toc_pPr)
    toc_run = OxmlElement("w:r")
    toc_rPr = OxmlElement("w:rPr")
    toc_run.append(toc_rPr)
    toc_text = OxmlElement("w:t")
    toc_text.text = heading_text
    toc_run.append(toc_text)
    toc_heading.append(toc_run)

    toc_para = OxmlElement("w:p")

    run1 = OxmlElement("w:r")
    fldChar1 = OxmlElement("w:fldChar")
    fldChar1.set(qn("w:fldCharType"), "begin")
    run1.append(fldChar1)
    toc_para.append(run1)

    run2 = OxmlElement("w:r")
    instrText = OxmlElement("w:instrText")
    instrText.set(qn("xml:space"), "preserve")
    instrText.text = ' TOC \\o "1-3" \\h \\z \\u '
    run2.append(instrText)
    toc_para.append(run2)

    run3 = OxmlElement("w:r")
    fldChar2 = OxmlElement("w:fldChar")
    fldChar2.set(qn("w:fldCharType"), "separate")
    run3.append(fldChar2)
    toc_para.append(run3)

    run4 = OxmlElement("w:r")
    run4_rPr = OxmlElement("w:rPr")
    run4.append(run4_rPr)
    placeholder = OxmlElement("w:t")
    placeholder.text = "Tartalomjegyzék frissítéséhez: jobb klikk → Jegyzék frissítése"
    run4.append(placeholder)
    toc_para.append(run4)

    run5 = OxmlElement("w:r")
    fldChar3 = OxmlElement("w:fldChar")
    fldChar3.set(qn("w:fldCharType"), "end")
    run5.append(fldChar3)
    toc_para.append(run5)

    page_break = OxmlElement("w:p")
    pb_pPr = OxmlElement("w:pPr")
    page_break.append(pb_pPr)
    pb_run = OxmlElement("w:r")
    br = OxmlElement("w:br")
    br.set(qn("w:type"), "page")
    pb_run.append(br)
    page_break.append(pb_run)

    body.insert(first_heading_idx, page_break)
    body.insert(first_heading_idx, toc_para)
    body.insert(first_heading_idx, toc_heading)


def postprocess(docx_path):
    doc = Document(docx_path)
    insert_toc_field(doc)
    doc.save(docx_path)
    print(f"Post-processed: {docx_path} (TOC field inserted)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        thesis_dir = Path(__file__).parent
        docx_path = thesis_dir / "build" / "thesis_body.docx"
    else:
        docx_path = Path(sys.argv[1])

    if not docx_path.exists():
        print(f"ERROR: {docx_path} does not exist")
        sys.exit(1)

    postprocess(str(docx_path))
