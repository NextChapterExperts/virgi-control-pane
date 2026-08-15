#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "======================================================================"
echo "          VIRKI Control Plane — Master Test Suite                     "
echo "======================================================================"

echo ""
echo "[1/2] Prüfe Python-Syntax (py_compile)..."
python3 -m py_compile server/*.py tests/*.py
echo "✓ Python-Syntax OK"

echo ""
echo "[2/2] Führe Pytest-Suite aus..."
PYTHONPATH=. .venv/bin/pytest tests/ -v
echo "✓ Alle Pytest-Tests erfolgreich bestanden!"

echo ""
echo "======================================================================"
echo "  ✓ ALLE CONTROL-PLANE TESTS ERFOLGREICH BESTANDEN!                   "
echo "======================================================================"
