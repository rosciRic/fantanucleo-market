# ⚽ Fantanucleo Market 26/27 — Web Dashboard

> Web Dashboard ultra-veloce, responsive e offline-first per la consultazione live e storica della lega di Fantacalcio **Fantanucleo** (Stagione 2026/2027).

🌐 **Sito Live (GitHub Pages)**: [https://rosciric.github.io/fantanucleo-market/](https://rosciric.github.io/fantanucleo-market/)

La pubblicazione usa GitHub Actions. In **Settings → Pages → Build and deployment**, seleziona **GitHub Actions** come sorgente. Il workflow pubblica solo frontend, manifest e JSON delle giornate.

---

## 🌟 Caratteristiche Principali

- **🔍 Database Giocatori & Possesso (530+ Calciatori)**:
  - Indicatore immediato: 🟢 **Libero** (svincolato) oppure **Preso** (fantasquadra o `2x +1` se posseduto in più gironi).
  - **Dettaglio Inline**: Cliccando su qualsiasi riga si apre il cassetto con statistiche complete (FVM, Fantamedia, Media Voto, Partite) o elenco di tutte le fantasquadre proprietarie.
  - **Filtri & Ordinamento Rapido**: Filtro istantaneo per Ruolo (P, D, C, A), per Stato (Svincolati / Posseduti) e chip di ordinamento (Ruolo, Quotazione ↓, Nome A-Z).
- **📋 Rose degli Avversari (18 Squadre)**:
  - Classifica generale con punti e valore complessivo rosa (`cr`).
  - **Visualizzazione Tattica per Reparto**: I 23 calciatori di ogni rosa sono divisi ordinatamente in Portieri 🧤, Difensori 🛡️, Centrocampisti ⚙️ e Attaccanti ⚡, ordinati per valore decrescente.
- **💰 Crediti Residui & Cambi**:
  - Tabella cambi rimasti con barra di avanzamento colorata a soglie visive e crediti residui.
- **⚡ Architettura JSON-First & Prestazioni 60 FPS**:
  - Dati pre-aggregati a monte in un singolo file compatto `data_N.json` per giornata (~110 KB).
  - Virtualizzazione mobile con `content-visibility: auto` e pulsante flottante "Torna in Cima".

---

## 🔄 Guida Operativa: Come Aggiornare i Dati

Per aggiornare il sito a ogni giornata usa lo script incluso nella repository. Cerca i file Excel nella cartella `~/Downloads`, prepara i dati e li pubblica su GitHub Pages tramite Git.

### 1. Aggiornamento Settimanale Standard (Nuova Giornata)

Al termine delle partite di campionato e del calcolo dei risultati:

1. Scarica da Fantacalcio.it il file dei risultati della giornata e il listone delle quotazioni. Lasciali nella cartella `~/Downloads`.
2. Se è la prima volta, installa la dipendenza Python:
   ```bash
   cd ~/Projects/fantanucleo_26_27
   python3 -m pip install openpyxl
   ```
3. A ogni nuova giornata apri il terminale ed esegui:
   ```bash
   cd ~/Projects/fantanucleo_26_27
   python3 organizza_fanta.py
   ```
   In alternativa, dalla cartella del progetto:
   ```bash
   ./aggiorna_fanta.sh
   ```
4. Lo script ricava la giornata dai nomi dei file, controlla i dati, genera JSON e CSV, aggiorna `manifest.json` e archivia gli Excel elaborati in `giornata_N/`.
5. Se i dati sono validi, crea un commit limitato ai file di quella giornata e al manifest, poi esegue `git push`. GitHub Actions pubblica il sito; puoi seguirne l'esito nella scheda **Actions** della repository.
6. Lo script apre anche la dashboard locale su `http://localhost:8080` per controllare i dati.

**Prima pubblicazione:** configura l'accesso GitHub dal computer con Git Credential Manager o GitHub CLI (`gh auth login` e `gh auth setup-git`). Non inserire token GitHub nei file del progetto.

---

### 2. Aggiornamento Infrasettimanale (Solo Listone Quotazioni)

Se a metà settimana cambiano le quotazioni di mercato e non ci sono nuove giornate da calcolare:

1. Scarica il nuovo Excel delle quotazioni (`Quotazioni_Fantacalcio*.xlsx`) in `~/Downloads`.
2. Esegui lo stesso comando dalla cartella del progetto:
   ```bash
   cd ~/Projects/fantanucleo_26_27
   python3 organizza_fanta.py
   ```
   Se non trova file `Risultati*.xlsx`, aggiorna le quotazioni dell'ultima giornata, rigenera il JSON, aggiorna il manifest e pubblica i file aggiornati.

---

### 3. Test & Sviluppo in Locale

Per visualizzare e testare il sito in locale senza inviare modifiche su GitHub:

```bash
# Avvia il server web locale
python3 -m http.server 8000

# Apri nel browser
http://localhost:8000
```

---

## 📁 Struttura della Repository

```
fantanucleo_26_27/
├── index.html            # Markup semantico dell'applicazione (3 tab)
├── style.css             # Design system Stadio Notturno, responsive
├── app.js                # Logica frontend vanilla (caricamento JSON, filtri, accordion)
├── manifest.json         # Registro JSON delle giornate disponibili ([1, 2, 3, ...])
├── organizza_fanta.py    # Script master di parsing Excel, archiviazione e auto-deploy
├── export_json.py        # Generatore JSON unificato pre-calcolato (data_N.json)
├── aggiorna_fanta.sh     # Wrapper bash per l'aggiornamento dei dati
└── giornata_N/           # Dati per ogni giornata di campionato
    ├── data_N.json       # JSON unificato consumato dall'app web (~110 KB)
    ├── rose_N.csv
    ├── svincolati_N.csv
    ├── quotazioni_N.csv
    ├── cambi_N.csv
    └── classifiche_campionato_N.csv
```

---

## 📄 Licenza

Progetto distribuito sotto licenza MIT.
