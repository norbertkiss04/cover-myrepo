import subprocess
import sys
from pathlib import Path


def export_pdf(input_docx, output_pdf):
    input_path = Path(input_docx).resolve()
    output_path = Path(output_pdf).resolve()

    result = subprocess.run(
        [
            "libreoffice",
            "--headless",
            "--invisible",
            "--norestore",
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
    else:
        print(f"    ERROR: PDF export failed")
        print(f"    stderr: {result.stderr}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.docx> <output.pdf>")
        sys.exit(1)

    export_pdf(sys.argv[1], sys.argv[2])
