# ⚽ Fantanucleo Market 26/27 — Web Dashboard

> Web Dashboard moderna, ultra-veloce e responsive per la gestione e la consultazione live della lega di Fantacalcio **Fantanucleo** (Stagione 2026/2027).

---

## 🌟 Caratteristiche Principali

- **🔍 Database Giocatori & Possesso Multi-Girone**:
  - Indicatore numerico di possesso ultra-compatto (`1x`, `2x +1`) per identificare immediatamente quanti e quali fantallenatori possiedono un calciatore.
  - **Card Modal Dettaglio Calciatore**: Cliccando su qualsiasi riga della tabella si apre una card interattiva in stile *dark glass* con l'elenco completo delle fantasquadre proprietarie, ruolo e quotazione.
- **📋 Svincolati Ordinati per Quotazione**:
  - Consultazione immediata dei calciatori liberi sul mercato, ordinati in automatico per **Quotazione decrescente (`cr`)**.
  - Filtri rapidi per ruolo (`P`, `D`, `C`, `A`) e ricerca istantanea in tempo reale (per calciatore o squadra Serie A).
- **💰 Crediti Residui & Cambi**:
  - Monitoraggio visuale dei cambi effettuati/rimanenti con barra di avanzamento e conteggio dei crediti residui per ciascuna fantasquadra.
- **📱 Design Responsive PC & Mobile**:
  - Layout adattivo che si converte automaticamente in **card compatte su dispositivi mobile (< 640px)** e tabelle ad alta densità informativa su PC desktop.
  - Tokens visivi per ruolo: Portiere (ambra), Difensore (blu), Centrocampista (verde), Attaccante (rosso).

---

## 🛠️ Tecnologie Utilizzate

- **Frontend**: HTML5 Semantico, CSS3 (Design System Vanilla CSS, HSL tokens, Glassmorphism, Tabular Nums), JavaScript ES6+ Vanilla.
- **Data Engine**: Python 3 con `openpyxl` per l'estrazione automatizzata, la pulizia dei dati e la conversione dai report Excel ufficiali di Fantacalcio.it.
- **Hosting & Deploy**: GitHub Pages (Deploy automatico).

---

## 🔄 Workflow di Aggiornamento Settimanale

La gestione dei dati è totalmente automatizzata tramite lo script Python `organizza_fanta.py`:

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

1. **Scarica i nuovi file nei Download** (`Risultati_Nª.xlsx` e `Quotazioni_Fantacalcio_Nª.xlsx`).
2. **Esegui lo script di conversione e pubblicazione**:
   ```bash
   python3 organizza_fanta.py
   ```
3. **Sito Live**:
   - **[https://rosciric.github.io/fantanucleo-market/](https://rosciric.github.io/fantanucleo-market/)**

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT.
