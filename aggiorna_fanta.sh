#!/bin/bash
# ⚽ Fantanucleo Market — Script di aggiornamento automatico
# Esegui questo script dalla cartella Download per elaborare i file ed inviare le modifiche su GitHub!

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$DIR/fantanucleo_26_27"

if [ -d "$PROJECT_DIR" ]; then
    python3 "$PROJECT_DIR/organizza_fanta.py" "$@"
else
    python3 organizza_fanta.py "$@"
fi
