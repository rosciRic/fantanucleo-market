#!/bin/bash
# ⚽ Fantanucleo Market — Script di aggiornamento automatico
# Importa e valida i dati. Aggiungi --publish per commit e push su GitHub.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/organizza_fanta.py" ]; then
    PROJECT_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/fantanucleo_26_27/organizza_fanta.py" ]; then
    PROJECT_DIR="$SCRIPT_DIR/fantanucleo_26_27"
else
    echo "Progetto Fantanucleo non trovato accanto allo script." >&2
    exit 1
fi

PYTHON_BIN=python3
if [ -x "$PROJECT_DIR/.venv/bin/python" ]; then
    PYTHON_BIN="$PROJECT_DIR/.venv/bin/python"
fi
exec "$PYTHON_BIN" "$PROJECT_DIR/organizza_fanta.py" "$@"
