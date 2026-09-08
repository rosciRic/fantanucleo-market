# ⚽ Fantanucleo Market 26/27 — Dashboard

Dashboard web moderna, reattiva e veloce per la lega **Fantanucleo Market** (stagione 2026/27).  
Mantiene sempre aggiornati i tre pilastri della lega: **Rose ordinate per valore/punti**, **Svincolati con quotazioni e contrassegno estero (`*`)** e **Mercato con crediti e cambi residui**.

---

## 🔄 Workflow Automatizzato (Come aggiornare ogni Giornata)

Il funzionamento è **100% automatizzato**: non devi spostare a mano i file né rinominarli.

### 📥 Step 1 — Scarica i file nei Download
* **Per la 1ª e 2ª Giornata**: Scarica soltanto il file dei risultati (es. `Risultati 1ª 2026_2027.xlsx`). Le quotazioni verranno estratte in automatico dal listone dell'asta estiva.
* **Dalla 3ª Giornata in poi**: Scarica nella tua cartella **Download** sia il file dei Risultati che il file delle Quotazioni aggiornate da Fantacalcio.it (es. `Risultati 3ª 2026_2027.xlsx` e `Quotazioni_Fantacalcio_Stagione_2026_27...xlsx`).
  > ⚠️ **Nota**: Se dalla 3ª giornata manca il file delle Quotazioni nei Download, lo script bloccherà il caricamento avvisandoti di scaricarlo prima di procedere.

### ⚡ Step 2 — Esegui lo script
Apri il terminale e lancia semplicemente:
```bash
python3 ~/Downloads/fantanucleo_26_27/organizza_fanta.py
```
*(Oppure trascina lo script o esegui dal percorso della cartella del progetto).*

### 🛠️ Cosa fa lo script in automatico:
1. **Identifica la giornata**: Legge il numero dal nome del file `.xlsx`.
2. **Estrazione e Generazione CSV**:
   - `classifiche_campionato_N.csv` → Classifica Generale e Punti.
   - `rose_N.csv` → Composizione delle 18 rose (ordinate per valore `cr` di ogni giocatore).
   - `svincolati_N.csv` → Giocatori svincolati liberi con quotazione attuale. I giocatori ceduti all'estero/fuori lista mostrano la marca `*` (es. `Lukaku*`, `Leao*`) e quotazione `0`.
   - `cambi_N.csv` → Cambi effettuati, cambi rimasti e crediti residui (con badge verde).
   - `quotazioni_N.csv` → Quotazioni ufficiali del listone della giornata.
3. **Pulizia automatica dei Download**: Sposta e archivia gli `.xlsx` direttamente dentro `giornata_N/`, lasciando la tua cartella `Downloads` completamente pulita.
4. **Aggiornamento Manifest**: Aggiorna `manifest.json` per permettere la selezione istantanea della nuova giornata.
5. **Avvio Dashboard**: Avvia il server locale su `http://localhost:8080` e apre automaticamente il browser.

---

## 🚀 Deploy Online su GitHub Pages

Puoi pubblicare la dashboard su internet gratuitamente in 3 minuti, rendendola consultabile da tutti i tuoi compagni di lega su smartphone e PC.

### 1️⃣ Creazione della Repository su GitHub
1. Vai su [GitHub.com](https://github.com) e crea una nuova repository pubblica nominata **`fantanucleo-market`**.
2. Apri il terminale nella cartella del progetto ed esegui:
```bash
cd ~/Downloads/fantanucleo_26_27
git init
git add .
git commit -m "Initial commit — Fantanucleo Market"
git branch -M main
git remote add origin https://github.com/TUO_UTENTE/fantanucleo-market.git
git push -u origin main
```
*(Sostituisci `TUO_UTENTE` con il tuo username GitHub).*

### 2️⃣ Attivazione di GitHub Pages
1. Nella pagina del tuo repository su GitHub, vai su **Settings** (Impostazioni) ⚙️ → **Pages**.
2. Sotto **Build and deployment** > **Source**, seleziona **Deploy from a branch**.
3. Seleziona il branch **`main`** e la cartella **`/ (root)`**, poi clicca su **Save**.
4. Dopo circa 1-2 minuti, il tuo sito sarà online all'indirizzo:
   `https://TUO_UTENTE.github.io/fantanucleo-market/`

### 3️⃣ Workflow settimanale per pubblicare gli aggiornamenti
Ogni volta che si gioca una nuova giornata:
1. Scarica i file in `Downloads`.
2. Esegui `python3 organizza_fanta.py`.
3. Pubblica le novità su GitHub con 3 semplici comandi:
```bash
git add .
git commit -m "Aggiornamento Giornata N"
git push
```
La dashboard online per tutti i partecipanti si aggiornerà all'istante!

---

## 📱 Caratteristiche della Dashboard
- **Layout Flessibile & Modulo 1400px**: Adattamento fluido da mobile (1 colonna per ruolo) a desktop (4 colonne per ruoli P, D, C, A).
- **Ordinamento Rose**: Calciatori ordinati per valore decrescente in crediti (`cr`) per ogni giornata.
- **Svincolati Chiari**: Intestazione `Quot. (cr)` con celle numeriche pulite e indicatore `*` per i fuori lista/estero.
- **Crediti & Cambi**: Monitoraggio cambi rimanenti e tag verdino crediti (es. `+9 cr`).
