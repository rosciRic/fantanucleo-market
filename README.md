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

La gestione e la pubblicazione dei dati sono totalmente automatizzate. Ecco le operazioni passo-passo per ogni scenario:

### 1. Aggiornamento Settimanale Standard (Nuova Giornata)

Al termine delle partite di campionato e del calcolo dei risultati:

1. **Scarica i 2 file Excel da Fantacalcio.it** (verranno salvati nella tua cartella `Downloads`):
   - `Risultati_Nª_2026_2027.xlsx`
   - `Quotazioni_Fantacalcio_Nª.xlsx`
2. **Apri il terminale ed esegui**:
   ```bash
   cd ~/Projects/fantanucleo_26_27
   python3 organizza_fanta.py
   ```
   *Oppure, se hai copiato `aggiorna_fanta.sh` in `Downloads` accanto alla cartella del progetto:*
   ```bash
   ./aggiorna_fanta.sh
   ```
3. **Cosa avviene in automatico**:
   - Riconosce il numero di giornata `N`.
   - Genera il file unificato `giornata_N/data_N.json` (e i CSV di archivio).
   - Archivia i file Excel elaborati dentro `giornata_N/` dopo aver verificato i dati importati.
   - Aggiorna `manifest.json`.
   - Crea un commit limitato ai dati della giornata e al manifest, poi esegue il push.
   - Avvia il server locale su `http://localhost:8080` e apre il browser per la verifica immediata.
   - Entro ~60 secondi il sito live su GitHub Pages sarà aggiornato.

---

### 2. Aggiornamento Infrasettimanale (Solo Listone Quotazioni)

Se a metà settimana cambiano le quotazioni di mercato e non ci sono nuove giornate da calcolare:

1. **Scarica solo l'Excel delle quotazioni** nei `Downloads`:
   - `Quotazioni_Fantacalcio_*.xlsx`
2. **Esegui lo script**:
   ```bash
   python3 organizza_fanta.py
   ```
3. **Cosa avviene in automatico**:
   - Lo script rileva che è presente solo il file quotazioni.
   - Aggiorna e rigenera il JSON dell'ultima giornata senza alterare punteggi e cambi.
   - Crea un commit limitato ai dati aggiornati e al manifest, poi esegue il push.

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
├── style.css             # Design System Dark Steel Navy (#1e2d4a), responsive
├── app.js                # Logica frontend vanilla (caricamento JSON, filtri, accordion)
├── manifest.json         # Registro JSON delle giornate disponibili ([1, 2, 3, ...])
├── organizza_fanta.py    # Script master di parsing Excel, archiviazione e auto-deploy
├── export_json.py        # Generatore JSON unificato pre-calcolato (data_N.json)
├── aggiorna_fanta.sh     # Wrapper bash eseguibile da cartella Downloads
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
