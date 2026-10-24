# Fantanucleo Market 26/27

Dashboard statica della lega: calciatori, rose, classifica, crediti e cambi.

**[Apri il sito](https://rosciric.github.io/fantanucleo-market/)** · [Stato pubblicazione](https://github.com/rosciRic/fantanucleo-market/actions)

## Come funziona

- Frontend HTML, CSS e JavaScript senza framework, font esterni o dipendenze da scaricare nel browser.
- Tema scuro Stadio Notturno, con pulsanti P/D/C/A nei colori dei ruoli.
- Pulsanti per giornate e ruoli; listone completo a scorrimento, senza paginazione. Ricerca per nome, club o fantasquadra; pulsanti Tutti / Svincolati / Presi. Ordinamento automatico P → D → C → A, poi quotazione decrescente e nome alfabetico a parità di valore. Le card mostrano la prima fantasquadra proprietaria e +X; aprendo il dettaglio compare l’elenco completo con etichette separate.
- Elenco squadre compatto con posizione e punti; rose apribili anche da tastiera in una tabella con ruolo, club, quotazione e costo di acquisto.
- Crediti e cambi ordinati per cambi rimasti decrescenti, poi crediti residui decrescenti e nome a parità di valori.
- Il pulsante “Giornata N · Cambia” apre una griglia di giornate e si richiude dopo la scelta, con Esc o cliccando fuori. Con molte giornate il pannello scorre al suo interno; la giornata selezionata è evidenziata.
- Un JSON per giornata, caricato su richiesta. Versione distinta per giornata, cache HTTP e cache in memoria delle ultime tre giornate consultate, annullamento delle richieste superate, timeout e pulsante per riprovare.
- Giocatori ordinati una sola volta al caricamento; dettagli generati alla prima apertura della card. Cambiare scheda conserva il contenuto già preparato per quella giornata e gli stessi filtri.
- Python prepara e controlla i dati sul computer. GitHub Pages serve solo file statici: non occorrono un server applicativo, un database remoto o token nel frontend.

## Preparazione iniziale

Servono Python 3.10 o successivo e Git. Node.js serve solo per il controllo sintattico JavaScript in sviluppo/CI.

```bash
cd ~/Projects/fantanucleo_26_27
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Configura l'accesso Git al tuo account, per esempio con GitHub CLI:

```bash
gh auth login
gh auth setup-git
```

Le credenziali restano gestite dagli strumenti Git: non inserirle nei sorgenti o nell'URL della repository.

In **Settings → Pages → Build and deployment**, seleziona **GitHub Actions**. Ogni push su `main` avvia controlli e pubblicazione; le pull request eseguono soltanto i controlli.

## Aggiornare il sito a ogni giornata

Scarica da Fantacalcio gli Excel dei risultati e delle quotazioni. Nei comandi seguenti sostituisci i nomi di esempio con quelli effettivi.

### 1. Aggiorna il checkout e controlla i file

```bash
cd ~/Projects/fantanucleo_26_27
git pull --ff-only
./aggiorna_fanta.sh "$HOME/Downloads/Risultati_8ª_2026_2027.xlsx" \
  --quotes "$HOME/Downloads/Quotazioni_Fantacalcio.xlsx" --dry-run
```

`--dry-run` legge e valida i file senza modificare i dati. Se la giornata non è riconoscibile dal nome o dal foglio, aggiungi `--day 8`.

### 2. Importa e pubblica

```bash
./aggiorna_fanta.sh "$HOME/Downloads/Risultati_8ª_2026_2027.xlsx" \
  --quotes "$HOME/Downloads/Quotazioni_Fantacalcio.xlsx" --publish
```

Lo script:

1. Legge gli Excel e prepara direttamente il JSON in una cartella temporanea, senza scrivere e rileggere CSV intermedi.
2. Verifica le 18 squadre, le rose complete, i possessori, i contatori e i valori numerici.
3. Salva la giornata e aggiorna il manifest solo dopo la validazione. Copia gli Excel nella cartella della giornata; gli originali nei Download restano disponibili.
4. Con `--publish`, crea un commit limitato ai dati della giornata e a `manifest.json`, quindi esegue il push su `main`. Gli Excel restano locali, ignorati da Git.

I CSV sono facoltativi: aggiungi `--csv` al comando di importazione per esportarli. I CSV storici restano disponibili, ma non vengono aggiornati senza questa opzione. Gli aggiornamenti delle sole quotazioni leggono classifica, rose e statistiche dal JSON esistente.

Il push avvia GitHub Actions: controlla che **Publish GitHub Pages** termini con successo. Il messaggio “Push completato” non significa che il deploy sia già terminato.

**Comando rapido:** se nei Download c'è un solo file risultati e un solo listone `Quotazioni_Fantacalcio*.xlsx`, puoi usare:

```bash
./aggiorna_fanta.sh --dry-run
./aggiorna_fanta.sh --publish
```

Se ci sono più file candidati, lo script si ferma: seleziona i percorsi esplicitamente. Poiché i Download non vengono svuotati, i percorsi espliciti sono consigliati.

### Aggiornare soltanto le quotazioni

```bash
./aggiorna_fanta.sh --quotes "$HOME/Downloads/Quotazioni_Fantacalcio.xlsx" --dry-run
./aggiorna_fanta.sh --quotes "$HOME/Downloads/Quotazioni_Fantacalcio.xlsx" --publish
```

Aggiorna l'ultima giornata disponibile; aggiungi `--day N` per una giornata esistente specifica. Classifica, rose e statistiche restano quelle dell'ultimo file risultati importato per quella giornata. La quotazione del listone prevale su quella del foglio svincolati.

### Importare e vedere l'anteprima prima del push

Senza `--publish` lo script salva **solo in locale**:

```bash
./aggiorna_fanta.sh "$HOME/Downloads/Risultati_8ª_2026_2027.xlsx" \
  --quotes "$HOME/Downloads/Quotazioni_Fantacalcio.xlsx"
python3 site_data.py --build
python3 -m http.server 8000 --bind 127.0.0.1 --directory _site
```

Apri [l'anteprima locale](http://127.0.0.1:8000/). Per fermare il server premi `Ctrl+C`. Dopo aver controllato, ripeti il comando di importazione con `--publish`.

Il wrapper usa automaticamente `.venv/bin/python`, quando presente, e funziona da qualsiasi cartella. Puoi usare anche `python3 organizza_fanta.py` con gli stessi argomenti, dopo aver attivato l'ambiente virtuale.

### Se qualcosa si interrompe

- **Dati non validi:** correggi il file sorgente e ripeti `--dry-run`. La giornata precedente resta disponibile.
- **File già in stage o branch diverso da `main`:** l'importazione locale resta salvata; completa il lavoro Git in corso prima di pubblicare.
- **Push fallito dopo il commit:** risolvi il problema di rete/autenticazione e riprova `git push origin main`. Non usare un push forzato. Se il remoto contiene altri commit, integra prima quelle modifiche.
- **Deploy fallito:** apri il log della Action. Il sito pubblicato precedentemente rimane disponibile.

## Sviluppo e controlli

```bash
source .venv/bin/activate
python3 -m unittest discover -s tests -v
node --check app.js
python3 site_data.py --build
```

La build valida dati e versione del manifest e copia in `_site/` solo HTML, CSS, JavaScript, manifest e JSON pubblici. I workflow eseguono gli stessi controlli prima del deploy. Non modificare `_site/` direttamente.

Per validare i JSON esistenti e aggiornare le versioni del manifest:

```bash
python3 export_json.py
```

Solo per ricostruire esplicitamente i JSON dai CSV storici, usa `python3 export_json.py --from-csv`: sovrascrive i JSON, quindi verifica che quei CSV siano aggiornati.

Il manifest usa versioni per giornata derivate dal contenuto: una rigenerazione identica non produce aggiornamenti artificiali. I JSON sono generati; correggi gli Excel sorgente e ripeti l’importazione. Quando modifichi CSS o JavaScript, aggiorna anche `?v=` in `index.html` per invalidare la cache degli asset.

## File principali

| File | Funzione |
| --- | --- |
| `index.html` | Struttura accessibile e controlli |
| `style.css` | Palette e layout responsive |
| `app.js` | Caricamento, ricerca, filtri e viste |
| `organizza_fanta.py` | Importazione Excel e pubblicazione esplicita |
| `export_json.py` | Composizione dati in memoria e conversione CSV storici |
| `site_data.py` | Validazione, manifest e build statica |
| `aggiorna_fanta.sh` | Comando di aggiornamento |
| `requirements.txt` | Dipendenza Python versionata |
| `tests/` | Controlli della pipeline |
| `giornata_N/` | JSON, CSV facoltativi e copie locali degli Excel |
| `.github/workflows/` | Controlli PR e pubblicazione Pages |

## Licenza

Licenza dichiarata dal progetto: MIT.
