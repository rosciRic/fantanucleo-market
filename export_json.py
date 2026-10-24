#!/usr/bin/env python3
"""
export_json.py — Genera data_{num}.json per Fantanucleo Market unificando:
1. Classifica generale
2. Crediti e Cambi residui
3. Rose indicizzate per squadra con quotazioni attuali
4. Database globale calciatori (530+) con indicatori di possesso e statistiche
"""
import csv
import re
from pathlib import Path

def is_asterisk(s):
    return bool(s and '*' in str(s))

def build_day(tables: dict, num: int) -> dict:
    """Build the public data from parsed rows, without intermediate files."""
    # 1. Classifiche
    standings = []
    for r in tables.get("classifiche_campionato", []):
        if r.get("Tipo") == "Generale":
            try:
                standings.append({
                    "pos": int(r.get("Posizione", 0)),
                    "team": r.get("Fantasquadra", "").strip(),
                    "pts": float(r.get("Punti", 0))
                })
            except ValueError:
                pass
    standings.sort(key=lambda x: x["pos"])

    # 2. Cambi & Crediti
    cambi = []
    for r in tables.get("cambi", []):
        c_rim = r.get("CambiRimasti", "").strip()
        cr_rim = r.get("CreditiRimasti", "").strip()
        cambi_val = int(c_rim) if c_rim.isdigit() else c_rim
        cred_val = int(cr_rim) if cr_rim.isdigit() else cr_rim
        cambi.append({
            "team": r.get("Fantasquadra", "").strip(),
            "cambi": cambi_val,
            "crediti": cred_val,
            "extra": r.get("CambiExtra", "").strip()
        })

    # 3. Quotazioni Listone Ufficiale
    quot_map = {}
    quot_list = []
    for r in tables.get("quotazioni", []):
        nome = r.get("Nome", "").strip()
        clean = nome.replace("*", "").strip()
        if not clean:
            continue
        try:
            qta = int(r.get("QtA", 0))
        except ValueError:
            qta = 0
        try:
            qti = int(r.get("QtI", 0))
        except ValueError:
            qti = 0
        try:
            diff = int(r.get("Diff", 0))
        except ValueError:
            diff = 0

        info = {
            "nome": clean,
            "sq": r.get("Squadra", "").strip(),
            "ruolo": r.get("Ruolo", "").strip(),
            "qta": qta,
            "qti": qti,
            "diff": diff,
            "is_fl": is_asterisk(nome)
        }
        quot_list.append(info)
        quot_map[clean.lower()] = info

    # 4. Rose
    rose_by_team = {}
    for r in tables.get("rose", []):
        team = r.get("Fantasquadra", "").strip()
        raw_name = r.get("Calciatore", "").strip()
        clean_name = raw_name.replace("*", "").strip()
        is_fl = is_asterisk(raw_name)
        try:
            costo = int(r.get("Costo", 0))
        except ValueError:
            costo = 0

        qinfo = quot_map.get(clean_name.lower(), {})
        sq = qinfo.get("sq", "")
        qta = qinfo.get("qta", costo)
        ruolo = r.get("Ruolo", "").strip() or qinfo.get("ruolo", "")

        if team not in rose_by_team:
            rose_by_team[team] = []
        rose_by_team[team].append({
            "ruolo": ruolo,
            "nome": clean_name,
            "costo": costo,
            "sq": sq,
            "qta": qta,
            "fl": is_fl or qinfo.get("is_fl", False)
        })

    # 5. Svincolati
    sv_list = []
    for r in tables.get("svincolati", []):
        raw_name = r.get("Nome", "").strip()
        clean_name = raw_name.replace("*", "").strip()
        is_fl = is_asterisk(raw_name)
        try:
            quot = int(r.get("Quotazione", 0))
        except ValueError:
            quot = 0
        pg_str = r.get("PG", "").strip()
        fvm_str = r.get("FVM", "").strip()
        sv_list.append({
            "nome": clean_name,
            "sq": r.get("Squadra", "").strip(),
            "ruolo": r.get("Ruolo", "").strip(),
            "pg": int(pg_str) if pg_str.isdigit() else 0,
            "mv": float(r.get("MV", 0)) if r.get("MV") else 0.0,
            "fm": float(r.get("FM", 0)) if r.get("FM") else 0.0,
            "fvm": int(fvm_str) if fvm_str.isdigit() else 0,
            "quot": quot,
            "fl": is_fl
        })

    # 6. Database Unificato Giocatori & Possesso
    db_map = {}

    # 6a. Da listone quotazioni (escludendo fuori lista *)
    for q in quot_list:
        if q["is_fl"]:
            continue
        key = q["nome"].lower()
        db_map[key] = {
            "nome": q["nome"],
            "ruolo": q["ruolo"],
            "sq": q["sq"],
            "quot": q["qta"],
            "qti": q["qti"],
            "diff": q["diff"],
            "fvm": 0,
            "fm": 0.0,
            "mv": 0.0,
            "pg": 0,
            "owners": [],
            "isSvincolato": False
        }

    # 6b. Mappa possessori dalle rose (escludendo fuori lista *)
    for team, players in rose_by_team.items():
        for p in players:
            if p["fl"]:
                continue
            key = p["nome"].lower()
            if key not in db_map:
                qinfo = quot_map.get(key, {})
                db_map[key] = {
                    "nome": p["nome"],
                    "ruolo": p["ruolo"] or qinfo.get("ruolo", ""),
                    "sq": p["sq"] or qinfo.get("sq", ""),
                    "quot": p["qta"],
                    "qti": qinfo.get("qti", 0),
                    "diff": qinfo.get("diff", 0),
                    "fvm": 0,
                    "fm": 0.0,
                    "mv": 0.0,
                    "pg": 0,
                    "owners": [],
                    "isSvincolato": False
                }
            if team not in db_map[key]["owners"]:
                db_map[key]["owners"].append(team)

    # 6c. Svincolati (escludendo fuori lista *)
    for sv in sv_list:
        if sv["fl"]:
            continue
        key = sv["nome"].lower()
        if key not in db_map:
            db_map[key] = {
                "nome": sv["nome"],
                "ruolo": sv["ruolo"],
                "sq": sv["sq"],
                "quot": sv["quot"],
                "qti": 0,
                "diff": 0,
                "fvm": sv["fvm"],
                "fm": sv["fm"],
                "mv": sv["mv"],
                "pg": sv["pg"],
                "owners": [],
                "isSvincolato": True
            }
        else:
            db_map[key]["isSvincolato"] = True
            if sv["fvm"]: db_map[key]["fvm"] = sv["fvm"]
            if key not in quot_map: db_map[key]["quot"] = sv["quot"]
            if sv["sq"]: db_map[key]["sq"] = sv["sq"]
            if sv["fm"]: db_map[key]["fm"] = sv["fm"]
            if sv["mv"]: db_map[key]["mv"] = sv["mv"]
            if sv["pg"]: db_map[key]["pg"] = sv["pg"]

    # Calcolo rapido contatori
    giocatori = list(db_map.values())
    counts = {"": len(giocatori), "P": 0, "D": 0, "C": 0, "A": 0}
    for g in giocatori:
        r = g.get("ruolo", "").upper()
        if r in counts:
            counts[r] += 1

    return {
        "giornata": num,
        "counts": counts,
        "standings": standings,
        "cambi": cambi,
        "rose": rose_by_team,
        "giocatori": giocatori
    }

def read_tables(giornata_dir: Path, num: int) -> dict:
    tables = {}
    for name in ('classifiche_campionato', 'cambi', 'quotazioni', 'rose', 'svincolati'):
        path = giornata_dir / f'{name}_{num}.csv'
        if path.exists():
            with path.open(encoding='utf-8', newline='') as source:
                tables[name] = list(csv.DictReader(source))
    return tables


def generate_giornata_json(giornata_dir: Path, num: int) -> dict:
    """Compatibility entry point for explicit CSV archive conversion."""
    return build_day(read_tables(giornata_dir, num), num)


def tables_from_data(data: dict) -> dict:
    """Recover results from the canonical JSON for a quotes-only update."""
    return {
        'classifiche_campionato': [
            dict(Tipo='Generale', Posizione=str(t['pos']), Fantasquadra=t['team'], Punti=str(t['pts']))
            for t in data['standings']
        ],
        'cambi': [
            dict(Fantasquadra=t['team'], CambiRimasti=str(t['cambi']),
                 CreditiRimasti=str(t['crediti']), CambiExtra=t['extra'])
            for t in data['cambi']
        ],
        'rose': [
            dict(Fantasquadra=team, Ruolo=p['ruolo'],
                 Calciatore=p['nome'] + ('*' if p['fl'] else ''), Costo=str(p['costo']))
            for team, roster in data['rose'].items() for p in roster
        ],
        'svincolati': [
            dict(Nome=p['nome'], Squadra=p['sq'], Ruolo=p['ruolo'], PG=str(p['pg']),
                 MV=str(p['mv']), FM=str(p['fm']), FVM=str(p['fvm']), Quotazione=str(p['quot']))
            for p in data['giocatori'] if p.get('isSvincolato')
        ],
    }


def export_all(base_dir: Path):
    from site_data import validate, atomic_json
    folders = [p for p in base_dir.glob("giornata_*") if p.is_dir() and re.fullmatch(r"giornata_[1-9]\d*", p.name)]
    prepared = []
    for g_dir in sorted(folders, key=lambda p: int(p.name.split("_")[-1])):
        num = int(g_dir.name.split("_")[-1])
        if not (g_dir / f"quotazioni_{num}.csv").is_file():
            continue
        data = generate_giornata_json(g_dir, num)
        out_file = g_dir / f"data_{num}.json"
        validate(data, num)
        prepared.append((out_file, data))
    # Validate the entire archive before replacing any generated file.
    for out_file, data in prepared:
        atomic_json(out_file, data)
        size_kb = out_file.stat().st_size / 1024
        print(f"✓ Generato {out_file.name} ({len(data['giocatori'])} giocatori, {size_kb:.1f} KB)")

if __name__ == "__main__":
    repo_dir = Path(__file__).resolve().parent
    import argparse
    parser = argparse.ArgumentParser(description="Validate JSON and refresh the manifest; optionally rebuild from CSV.")
    parser.add_argument("--from-csv", action="store_true", help="Rebuild JSON from legacy CSV sources (overwrites JSON)")
    args = parser.parse_args()
    if args.from_csv:
        export_all(repo_dir)
    from site_data import atomic_json, manifest
    atomic_json(repo_dir / "manifest.json", manifest(repo_dir))
