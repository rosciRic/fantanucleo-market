#!/bin/bash
# ⚽ Fantanucleo Market — Script di aggiornamento automatico
# Esegui questo script dalla cartella Download per elaborare i file ed inviare le modifiche su GitHub!

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/organizza_fanta.py" ]; then
    PROJECT_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/fantanucleo_26_27/organizza_fanta.py" ]; then
    PROJECT_DIR="$SCRIPT_DIR/fantanucleo_26_27"
else
    echo "Progetto Fantanucleo non trovato accanto allo script." >&2
    exit 1
fi

exec python3 "$PROJECT_DIR/organizza_fanta.py" "$@"
