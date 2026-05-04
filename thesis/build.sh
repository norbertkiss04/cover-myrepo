#!/usr/bin/env bash
set -euo pipefail

THESIS_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$THESIS_DIR/build"
CHAPTERS_DIR="$THESIS_DIR/chapters"
OFFICIAL_DIR="$THESIS_DIR/official_base"

mkdir -p "$BUILD_DIR"

echo "=== Step 1: Convert .doc templates to .docx ==="

libreoffice --headless --convert-to docx \
    "$OFFICIAL_DIR/eleje.doc" \
    --outdir "$BUILD_DIR" 2>/dev/null

libreoffice --headless --convert-to docx \
    "$OFFICIAL_DIR/vege.doc" \
    --outdir "$BUILD_DIR" 2>/dev/null

echo "    eleje.docx and vege.docx created in build/"

echo ""
echo "=== Step 2: Build thesis body with pandoc ==="

REFERENCE_DOC="$OFFICIAL_DIR/szakdolgozat_formai_ajanlas.docx"

pandoc \
    "$CHAPTERS_DIR/abstract.md" \
    "$CHAPTERS_DIR/ch01_introduction.md" \
    "$CHAPTERS_DIR/ch02_market_research.md" \
    "$CHAPTERS_DIR/ch03_technologies.md" \
    "$CHAPTERS_DIR/ch04_architecture.md" \
    "$CHAPTERS_DIR/ch05_ai_pipeline.md" \
    "$CHAPTERS_DIR/ch06_style_reference.md" \
    "$CHAPTERS_DIR/ch07_realtime_communication.md" \
    "$CHAPTERS_DIR/ch08_security_credits.md" \
    "$CHAPTERS_DIR/ch09_testing_cicd.md" \
    "$CHAPTERS_DIR/ch10_ai_usage.md" \
    "$CHAPTERS_DIR/ch11_conclusion.md" \
    "$CHAPTERS_DIR/references.md" \
    "$CHAPTERS_DIR/nyilatkozat.md" \
    --reference-doc="$REFERENCE_DOC" \
    --toc \
    --toc-depth=3 \
    -f markdown \
    -t docx \
    -o "$BUILD_DIR/thesis_body.docx"

echo "    thesis_body.docx created"

echo ""
echo "=== Step 3: Merge documents ==="

python3 "$THESIS_DIR/merge.py"

echo ""
echo "=== Step 4: Export to PDF ==="

libreoffice --headless --convert-to pdf \
    "$BUILD_DIR/thesis_final.docx" \
    --outdir "$BUILD_DIR" 2>/dev/null

echo "    thesis_final.pdf created"

echo ""
echo "=== Done ==="
echo "Output files:"
echo "    $BUILD_DIR/thesis_final.docx"
echo "    $BUILD_DIR/thesis_final.pdf"
echo ""
echo "NOTE: Fill in your details in build/eleje.docx (supervisor, degree, year)"
echo "      then re-run this script to regenerate the final output."
