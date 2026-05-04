import subprocess
import sys
import os
import tempfile
from pathlib import Path


LO_MACRO = '''\
import uno
import time

def update_and_export(input_url, output_url):
    localContext = uno.getComponentContext()
    resolver = localContext.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", localContext)
    ctx = resolver.resolve(
        "uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext")
    smgr = ctx.ServiceManager
    desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)

    from com.sun.star.beans import PropertyValue
    props = (
        PropertyValue("Hidden", 0, True, 0),
        PropertyValue("UpdateDocMode", 0, 1, 0),
    )
    doc = desktop.loadComponentFromURL(input_url, "_blank", 0, props)
    doc.updateLinks(1)
    indexes = doc.getDocumentIndexes()
    for i in range(indexes.getCount()):
        indexes.getByIndex(i).update()
    doc.getTextFields().refresh()
    doc.store()

    export_props = (PropertyValue("FilterName", 0, "writer_pdf_Export", 0),)
    doc.storeToURL(output_url, export_props)
    doc.close(True)
'''


def export_pdf(input_docx, output_pdf):
    input_path = Path(input_docx).resolve()
    output_path = Path(output_pdf).resolve()

    result = subprocess.run(
        [
            "libreoffice",
            "--headless",
            "--convert-to", "pdf",
            "--outdir", str(output_path.parent),
            str(input_path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )

    generated = output_path.parent / (input_path.stem + ".pdf")
    if generated.exists() and generated != output_path:
        generated.rename(output_path)

    if output_path.exists():
        print(f"    PDF exported: {output_path}")
        print("    NOTE: TOC page numbers will appear after updating in LibreOffice")
    else:
        print(f"    ERROR: PDF export failed")
        print(f"    stderr: {result.stderr}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.docx> <output.pdf>")
        sys.exit(1)

    export_pdf(sys.argv[1], sys.argv[2])
