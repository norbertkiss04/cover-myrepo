import sys
from pathlib import Path
from docxcompose.composer import Composer
from docx import Document


def merge_documents(output_path, *input_paths):
    paths = [Path(p) for p in input_paths]

    for p in paths:
        if not p.exists():
            print(f"ERROR: {p} does not exist")
            sys.exit(1)

    base = Document(str(paths[0]))
    composer = Composer(base)

    for p in paths[1:]:
        doc = Document(str(p))
        composer.append(doc)

    composer.save(str(output_path))
    print(f"Merged {len(paths)} documents → {output_path}")


if __name__ == "__main__":
    thesis_dir = Path(__file__).parent
    build_dir = thesis_dir / "build"

    eleje = build_dir / "eleje.docx"
    body = build_dir / "thesis_body.docx"
    vege = build_dir / "vege.docx"
    output = build_dir / "thesis_final.docx"

    merge_documents(output, eleje, body, vege)
