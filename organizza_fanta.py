#!/usr/bin/env python3
"""
organizza_fanta.py — Converte i file Risultati Nª 2026_2027.xlsx e Quotazioni nei CSV per la dashboard.

Genera i CSV essenziali per ogni giornata:
  1. classifiche_campionato_N.csv  → Classifica Generale + Punti
  2. rose_N.csv                    → Rose di tutte le 18 squadre
  3. svincolati_N.csv              → Calciatori liberi sul mercato
  4. cambi_N.csv                   → Cambi e crediti residui per ogni squadra
  5. quotazioni_N.csv              → Quotazioni attuali e variazioni dal listone ufficiale

Uso:
  python3 organizza_fanta.py                  # Elabora tutti gli xlsx trovati
  python3 organizza_fanta.py percorso.xlsx    # Elabora un file specifico
"""
import sys
import re
import csv
import json
import shutil
import socket
import webbrowser
import subprocess
from pathlib import Path
import openpyxl

DOWNLOADS_DIR = Path.home() / "Downloads"
FANTA_DIR = DOWNLOADS_DIR / "fantanucleo_26_27"


def extract_giornata_number(filepath: Path, wb: openpyxl.Workbook) -> int:
    """Ricava il numero della giornata dal nome del file o dal foglio."""
    match = re.search(r'(\d+)[ªa]?', filepath.name)
    if match:
        return int(match.group(1))
    try:
        val = str(wb.worksheets[0].cell(row=1, column=1).value or "")
        m = re.search(r'(\d+)', val)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return 1


def cell_str(cell):
    return str(cell).strip() if cell is not None else ''


def parse_classifica(sheet):
    """Estrae la Classifica Generale dal foglio risultati."""
    rows = list(sheet.iter_rows(values_only=True))
    campionato = []
    mode = None

    for r in rows:
        line = [cell_str(c) for c in r]
        if not any(line):
            continue
        joined = ' '.join(line)

        if 'CLASSIFICA GENERALE' in joined:
            mode = 'gen'
            continue
        elif any(kw in joined for kw in ['CLASSIFICA DI GIORNATA', 'CLASSIFICA COPPA', 'CAMBI DA FARE']):
            mode = None
            continue

        if mode == 'gen' and len(line) >= 4 and line[1].isdigit():
            campionato.append([
                'Generale',
                int(line[1]),
                line[2],
                float(line[3])
            ])

    return campionato


def parse_rose(sheet):
    """Estrae la composizione delle 18 rose (23 calciatori per squadra)."""
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []

    RUOLI = [(0, 3, 'P'), (3, 10, 'D'), (10, 18, 'C'), (18, 23, 'A')]
    parsed = []
    i = 0

    while i < len(rows):
        r = rows[i]
        teams = []
        for c in range(0, len(r), 3):
            name = cell_str(r[c])
            if name and name.lower() not in ('costo', 'totale', ''):
                teams.append((name, c))

        if teams:
            start = i + 1
            for p_idx in range(start, min(start + 25, len(rows))):
                p_row = rows[p_idx]
                if any(cell_str(c).lower() == 'totale' for c in p_row if c is not None):
                    break
                offset = p_idx - start
                ruolo = next((r for lo, hi, r in RUOLI if lo <= offset < hi), 'C')

                for t_name, c_col in teams:
                    if c_col < len(p_row) and p_row[c_col] is not None and cell_str(p_row[c_col]):
                        nome = cell_str(p_row[c_col])
                        costo = cell_str(p_row[c_col + 1]) if c_col + 1 < len(p_row) else '0'
                        parsed.append([t_name, ruolo, nome, int(costo) if costo.isdigit() else 0])

            i = start + 23
        else:
            i += 1

    return parsed


def parse_svincolati(sheet, quot_map=None):
    """Estrae l'elenco dei calciatori svincolati liberi. I calciatori fuori lista o andati all'estero sono contrassegnati con * e quotazione 0."""
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []

    header = [cell_str(c).upper() for c in rows[0]]

    def find_col(patterns, default_idx):
        for p in patterns:
            for idx, h in enumerate(header):
                if p in h:
                    return idx
        return default_idx

    idx_num = find_col(['#'], 0)
    idx_nome = find_col(['NOME'], 1)
    idx_fuori = find_col(['FUORI LISTA', 'FUORI'], 2)
    idx_sq = find_col(['SQ.'], 3)
    idx_ruolo = find_col(['R.'], 5)
    idx_pg = find_col(['PGV', 'PG'], 6)
    idx_mv = find_col(['MV'], 7)
    idx_fm = find_col(['FM'], 8)
    idx_fvm = find_col(['FVM'], 9)
    idx_quot = find_col(['QUOT.'], len(header) - 1)

    parsed = []

    for r in rows[1:]:
        if not r or not any(c is not None for c in r):
            continue
        line = [cell_str(c) for c in r]

        if idx_num < len(line) and not line[idx_num].isdigit():
            continue

        nome = line[idx_nome] if idx_nome < len(line) else ''
        if not nome:
            continue

        fuori = line[idx_fuori] if idx_fuori < len(line) else ''

        # Se 'fuori' o 'nome' contiene '*', è fuori lista / andato all'estero
        is_fuori_lista = ('*' in fuori) or ('*' in nome)
        clean_nome = nome.replace('*', '').strip()

        # Quotazione dal foglio o dal quot_map (listone)
        raw_quot = line[idx_quot] if idx_quot < len(line) else '0'
        if not raw_quot or not raw_quot.isdigit():
            raw_quot = '0'

        # Preferisci la quotazione del listone se disponibile
        if quot_map and clean_nome.lower() in quot_map:
            raw_quot = str(quot_map[clean_nome.lower()])

        # Se è fuori lista o la quotazione è 0 (estero/fuori rosa)
        if is_fuori_lista or raw_quot == '0':
            display_nome = f"{clean_nome}*"
            final_quot = '0'
        else:
            display_nome = clean_nome
            final_quot = raw_quot

        sq = line[idx_sq] if idx_sq < len(line) else ''
        ruolo = line[idx_ruolo] if idx_ruolo < len(line) else ''
        pg = line[idx_pg] if idx_pg < len(line) else '0'
        mv = line[idx_mv] if idx_mv < len(line) else '0'
        fm = line[idx_fm] if idx_fm < len(line) else '0'
        fvm = line[idx_fvm] if idx_fvm < len(line) else '0'

        parsed.append([
            display_nome,
            sq,
            ruolo,
            pg,
            mv,
            fm,
            fvm,
            final_quot,
        ])

    return parsed


def parse_cambi(sheet):
    """Estrae la tabella cambi e crediti dal foglio risultati."""
    rows_data = list(sheet.iter_rows(values_only=True))
    start = None
    for i, row in enumerate(rows_data):
        if any('CAMBI DA FARE' in str(c) for c in row if c):
            start = i + 1
            break
    if start is None:
        return []

    result = []
    for row in rows_data[start:]:
        vals = [c for c in row if c is not None]
        if not vals:
            break
        non_none = [(i, row[i]) for i in range(len(row)) if row[i] is not None]
        if len(non_none) < 3:
            break
        nome = str(non_none[0][1]).strip()
        cambi = non_none[1][1] if len(non_none) > 1 else ''
        crediti = non_none[2][1] if len(non_none) > 2 else ''
        extra = str(non_none[3][1]).strip() if len(non_none) > 3 else ''

        if not nome or nome.upper() in ('FANTASQUADRA', 'SQUADRA'):
            continue
        result.append([nome, cambi, crediti, extra])

    return result


def parse_listone_file(out_dir: Path = None, num: int = 1):
    """
    Cerca il file Excel del listone ufficiale per la giornata e ne estrae le quotazioni.
    """
    candidates = []
    if out_dir and out_dir.exists():
        candidates.extend(list(out_dir.glob("Quotazioni*.xlsx")))
    candidates.extend(list(DOWNLOADS_DIR.glob("Quotazioni_Fantacalcio*.xlsx")))
    candidates.extend(list(FANTA_DIR.glob("**/Quotazioni_Fantacalcio*.xlsx")))
    file_path = candidates[0] if candidates else None

    if not file_path or not file_path.exists():
        return []

    print(f"  → Lettura listone per G{num} da: {file_path.name}")
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        ws = wb['Tutti'] if 'Tutti' in wb.sheetnames else wb.worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        parsed = []
        for r in rows[2:]:
            if len(r) >= 8 and r[3] is not None:
                nome = str(r[3]).replace('*', '').strip()
                sq = str(r[4]).strip() if len(r) > 4 else ''
                ruolo = str(r[1]).strip() if len(r) > 1 else ''
                qta = str(r[5]).strip() if len(r) > 5 else '0'
                qti = str(r[6]).strip() if len(r) > 6 else '0'
                diff = str(r[7]).strip() if len(r) > 7 else '0'
                
                # G1 = Qt.I (fallback a Qt.A se 0), G2+ = Qt.A (fallback a Qt.I se 0)
                if num == 1:
                    valore = qti if (qti and qti != '0') else qta
                else:
                    valore = qta if (qta and qta != '0') else qti
                parsed.append([nome, sq, ruolo, valore, qti, diff])
        return parsed
    except Exception as e:
        print(f"Errore lettura listone ({file_path.name}): {e}")
        return []


def write_csv(path, header, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    return len(rows)


def convert(xlsx_path: Path):
    if not xlsx_path.exists():
        print(f"Errore: {xlsx_path} non trovato.")
        return

    print(f"Elaborazione: {xlsx_path.name}")
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)

    num = extract_giornata_number(xlsx_path, wb)

    # Per giornate successive alla 2ª, verifica che sia presente anche il file Quotazioni nei Download
    if num > 2:
        has_quot_in_dl = any(DOWNLOADS_DIR.glob("Quotazioni_Fantacalcio*.xlsx"))
        has_quot_in_out = (FANTA_DIR / f"giornata_{num}").exists() and any((FANTA_DIR / f"giornata_{num}").glob("Quotazioni*.xlsx"))
        if not (has_quot_in_dl or has_quot_in_out):
            wb.close()
            print(f"\n⚠️  ATTENZIONE: Trovato il file Risultati per la Giornata {num}, ma MANCA il file delle Quotazioni nei Download!")
            print(f"👉 Per elaborare la Giornata {num} devi scaricare prima l'Excel delle quotazioni da Fantacalcio.it.")
            print(f"❌ Nessun dato è stato caricato per la Giornata {num}.\n")
            return

    out = FANTA_DIR / f"giornata_{num}"
    out.mkdir(parents=True, exist_ok=True)

    for old in out.glob("*.csv"):
        old.unlink()

    # Foglio Risultati
    ris_sheet = wb[next((s for s in wb.sheetnames if 'risultat' in s.lower()), wb.sheetnames[0])]
    campionato = parse_classifica(ris_sheet)
    write_csv(out / f"classifiche_campionato_{num}.csv", ["Tipo", "Posizione", "Fantasquadra", "Punti"], campionato)

    # Foglio Rose
    rose_sheet = wb[next((s for s in wb.sheetnames if 'rose' in s.lower()), wb.sheetnames[1])]
    rose = parse_rose(rose_sheet)
    write_csv(out / f"rose_{num}.csv", ["Fantasquadra", "Ruolo", "Calciatore", "Costo"], rose)

    # Quotazioni Listone Ufficiale
    quotazioni = parse_listone_file(out, num)
    quot_map = {}
    if quotazioni:
        write_csv(out / f"quotazioni_{num}.csv", ["Nome", "Squadra", "Ruolo", "QtA", "QtI", "Diff"], quotazioni)
        print(f"  → quotazioni_{num}.csv scritte ({len(quotazioni)} calciatori)")
        for q in quotazioni:
            q_nome = q[0].replace('*', '').strip().lower()
            quot_map[q_nome] = q[3]

    # Foglio Svincolati
    svinc_sheet = wb[next((s for s in wb.sheetnames if 'svincolat' in s.lower()), wb.sheetnames[2])]
    svinc = parse_svincolati(svinc_sheet, quot_map)
    write_csv(out / f"svincolati_{num}.csv", ["Nome", "Squadra", "Ruolo", "PG", "MV", "FM", "FVM", "Quotazione"], svinc)

    # Cambi & Crediti
    cambi = parse_cambi(ris_sheet)
    write_csv(out / f"cambi_{num}.csv", ["Fantasquadra", "CambiRimasti", "CreditiRimasti", "CambiExtra"], cambi)

    # ── Organizzazione e rimozione completa da Downloads ──
    wb.close()
    dest_ris = out / f"Risultati_{num}ª_2026_2027.xlsx"
    if xlsx_path.resolve() != dest_ris.resolve():
        try:
            if dest_ris.exists():
                dest_ris.unlink()
            shutil.move(str(xlsx_path), str(dest_ris))
            print(f"  → Risultati archiviati in giornata_{num}/Risultati_{num}ª_2026_2027.xlsx")
        except Exception:
            pass

    for q_file in list(DOWNLOADS_DIR.glob("Quotazioni_Fantacalcio*.xlsx")):
        dest_q = out / f"Quotazioni_{num}ª_2026_2027.xlsx"
        try:
            if dest_q.exists() and q_file.resolve() != dest_q.resolve():
                dest_q.unlink()
            if q_file.resolve() != dest_q.resolve():
                shutil.move(str(q_file), str(dest_q))
                print(f"  → Quotazioni archiviate in giornata_{num}/Quotazioni_{num}ª_2026_2027.xlsx")
            else:
                q_file.unlink()
        except Exception:
            pass

    update_manifest()
    print(f"  ✓ Giornata {num} elaborata con successo\n")
    push_to_github(num)


def push_to_github(giornata_num):
    """Esegue git add, commit e push su GitHub per aggiornare GitHub Pages."""
    try:
        print(f"🚀 Pubblicazione Giornata {giornata_num} su GitHub Pages...")
        subprocess.run(['git', 'add', '.'], cwd=str(FANTA_DIR), check=True)
        subprocess.run(['git', 'commit', '-m', f"Aggiornamento Giornata {giornata_num}"], cwd=str(FANTA_DIR), check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        res = subprocess.run(['git', 'push'], cwd=str(FANTA_DIR), check=False, capture_output=True, text=True)
        if res.returncode == 0:
            print("  ✓ Sito live aggiornato: https://rosciric.github.io/fantanucleo-market/\n")
        else:
            print("  ✓ Codice sincronizzato con GitHub\n")
    except Exception as e:
        print(f"  ⚠️ Avviso push GitHub: {e}\n")


def update_manifest():
    giornate = sorted(
        int(re.search(r'\d+', d.name).group())
        for d in FANTA_DIR.glob('giornata_*') if d.is_dir()
    )
    with open(FANTA_DIR / 'manifest.json', 'w', encoding='utf-8') as f:
        json.dump({'giornate': giornate}, f)


def open_dashboard():
    PORT = 8080
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        porta_libera = s.connect_ex(('localhost', PORT)) != 0

    if porta_libera:
        print(f"🌐 Avvio server su http://localhost:{PORT} ...")
        subprocess.Popen(
            [sys.executable, '-m', 'http.server', str(PORT)],
            cwd=str(FANTA_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
    else:
        print(f"🌐 Server attivo su http://localhost:{PORT}")

    webbrowser.open(f'http://localhost:{PORT}')


def main():
    FANTA_DIR.mkdir(parents=True, exist_ok=True)

    if len(sys.argv) > 1:
        convert(Path(sys.argv[1]))
        open_dashboard()
        return

    candidates_ris = sorted(
        list(DOWNLOADS_DIR.glob("Risultati*.xlsx"))
        + [f for f in DOWNLOADS_DIR.glob("*.xlsx") if 'risultati' in f.name.lower()]
    )

    candidates_quot = sorted(list(DOWNLOADS_DIR.glob("Quotazioni_Fantacalcio*.xlsx")))

    if not candidates_ris:
        if candidates_quot:
            print("ℹ️ Trovato file Quotazioni nei Download. In attesa del file Risultati per elaborare la nuova giornata.")
        else:
            print("Nessun nuovo file Risultati.xlsx trovato nei Download.")
        open_dashboard()
        return

    for xlsx in candidates_ris:
        convert(xlsx)

    open_dashboard()


if __name__ == '__main__':
    main()
