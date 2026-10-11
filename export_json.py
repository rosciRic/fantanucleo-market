#!/usr/bin/env python3
"""
export_json.py — Genera data_{num}.json per Fantanucleo Market unificando:
1. Classifica generale
2. Crediti e Cambi residui
3. Rose indicizzate per squadra con quotazioni attuali
4. Database globale calciatori (530+) con indicatori di possesso e statistiche
"""
import csv
import json
from pathlib import Path

def is_asterisk(s):
    return bool(s and '*' in str(s))

def generate_giornata_json(giornata_dir: Path, num: int) -> dict:
    # 1. Classifiche
    standings = []
    p_classifica = giornata_dir / f"classifiche_campionato_{num}.csv"
    if p_classifica.exists():
        with open(p_classifica, encoding="utf-8") as f:
            for r in csv.DictReader(f):
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
    p_cambi = giornata_dir / f"cambi_{num}.csv"
    if p_cambi.exists():
        with open(p_cambi, encoding="utf-8") as f:
            for r in csv.DictReader(f):
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
    p_quot = giornata_dir / f"quotazioni_{num}.csv"
    if p_quot.exists():
        with open(p_quot, encoding="utf-8") as f:
            for r in csv.DictReader(f):
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
    p_rose = giornata_dir / f"rose_{num}.csv"
    if p_rose.exists():
        with open(p_rose, encoding="utf-8") as f:
            for r in csv.DictReader(f):
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
                    "fl": is_fl
                })

    # 5. Svincolati
    sv_list = []
    p_sv = giornata_dir / f"svincolati_{num}.csv"
    if p_sv.exists():
        with open(p_sv, encoding="utf-8") as f:
            for r in csv.DictReader(f):
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
                    "quot": p["qta"] or p["costo"],
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
            if sv["quot"]: db_map[key]["quot"] = sv["quot"]
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

def export_all(base_dir: Path):
    for num in range(1, 100):
        g_dir = base_dir / f"giornata_{num}"
        if not g_dir.exists():
            break
        data = generate_giornata_json(g_dir, num)
        out_file = g_dir / f"data_{num}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        size_kb = out_file.stat().st_size / 1024
        print(f"✓ Generato {out_file.name} ({len(data['giocatori'])} giocatori, {size_kb:.1f} KB)")

if __name__ == "__main__":
    repo_dir = Path(__file__).resolve().parent
    export_all(repo_dir)
