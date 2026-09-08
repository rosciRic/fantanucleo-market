# ⚽ Fantanucleo Market 26/27 — Web Dashboard

> Dashboard web moderna, veloce e reattiva per la gestione e la consultazione live della lega di Fantacalcio **Fantanucleo** (Stagione 2026/2027).

---

## 🌟 Caratteristiche Principali

- **👥 Rose Ordinati per Valore**: Visualizzazione a fisarmonica (accordion) delle 18 squadre della lega, con i calciatori ordinati per valore decrescente in crediti (`cr`) aggiornato ad ogni giornata.
- **📋 Svincolati & Listone**: Tabella con ricerca in tempo reale, filtri rapidi per ruolo (P, D, C, A) e ordinamento dinamico per FVM, Medie e Quotazione. I calciatori ceduti all'estero o fuori lista sono chiaramente contrassegnati con l'asterisco (`*`) e quotazione 0.
- **💰 Crediti & Cambi**: Monitoraggio immediato del numero di cambi effettuati, cambi rimanenti e crediti residui per ciascun fantallenatore.

---

## 🛠️ Tecnologie Utilizzate

- **Frontend**: HTML5 Semantico, CSS3 (Design System con variabili HSL e Glassmorphism), JavaScript (ES6+ Vanilla).
- **Data Engine**: Python 3 con `openpyxl` per l'estrazione automatizzata, la pulizia dei dati e la conversione dai report Excel ufficiali di Fantacalcio.it.
- **Hosting**: GitHub Pages (Deploy automatico).

---

## 🔄 Workflow di Aggiornamento Settimanale

La gestione dei dati è completamente automatizzata tramite lo script Python `organizza_fanta.py`:

```
┌────────────────────────────────┐
│   Download Excel da            │
│   Fantacalcio.it               │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│   Esecuzione Automatica:       │
│   python3 organizza_fanta.py   │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ 1. Estrazione CSV Giornata     │
│ 2. Archiviazione `.xlsx`       │
│ 3. Aggiornamento `manifest`    │
│ 4. Push su GitHub & Deploy     │
└────────────────────────────────┘
```

### Comandi da Terminale per Aggiornare la Dashboard:

1. **Scarica i nuovi file nei Download** (`Risultati Nª.xlsx` e `Quotazioni_Fantacalcio_Nª.xlsx`).
2. **Esegui lo script di conversione**:
   ```bash
   python3 organizza_fanta.py
   ```
3. **Pubblica le modifiche su GitHub**:
   ```bash
   git add .
   git commit -m "Aggiornamento Giornata N"
   git push
   ```

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT.
