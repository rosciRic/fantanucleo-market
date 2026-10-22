"""Validation, deterministic manifest and static Pages artifact (standard library)."""
import hashlib
import json
import math
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ROLES = {'P', 'D', 'C', 'A'}


def validate(data, day):
    if data.get('giornata') != day:
        raise ValueError(f'G{day}: numero giornata incoerente')
    standings, balances, rosters, players = (data[k] for k in ('standings', 'cambi', 'rose', 'giocatori'))
    teams = {r['team'] for r in standings}
    if len(standings) != 18 or len(teams) != 18 or len(balances) != 18 or {r['team'] for r in balances} != teams or set(rosters) != teams:
        raise ValueError(f'G{day}: classifica, rose e cambi devono contenere le stesse 18 squadre')
    if sorted(r['pos'] for r in standings) != list(range(1, 19)):
        raise ValueError(f'G{day}: posizioni classifica non valide')
    for row in standings:
        if not row['team'].strip() or not isinstance(row['pts'], (int, float)) or not math.isfinite(row['pts']):
            raise ValueError(f'G{day}: squadra o punteggio non valido')
    expected = {}
    for team, roster in rosters.items():
        names = [p['nome'].casefold() for p in roster]
        if len(roster) != 23 or len(set(names)) != 23:
            raise ValueError(f'G{day}: rosa incompleta o duplicata: {team}')
        for p in roster:
            if p['ruolo'] not in ROLES:
                raise ValueError(f"Ruolo non valido: {p['nome']}")
            for field in ('qta', 'costo'):
                if not isinstance(p[field], (int, float)) or not math.isfinite(p[field]) or p[field] < 0:
                    raise ValueError(f"Valore rosa non valido: {p['nome']} / {field}")
            if not p['fl']:
                expected.setdefault(p['nome'].casefold(), set()).add(team)
    seen = set()
    for p in players:
        key = p['nome'].casefold()
        if not key or key in seen or p['ruolo'] not in ROLES:
            raise ValueError(f"Giocatore duplicato o non valido: {p['nome']}")
        seen.add(key)
        if len(p['owners']) != len(set(p['owners'])) or set(p['owners']) != expected.get(key, set()):
            raise ValueError(f"Possessori incoerenti: {p['nome']}")
        for field in ('quot', 'fm', 'mv', 'pg', 'fvm'):
            if not isinstance(p[field], (int, float)) or not math.isfinite(p[field]):
                raise ValueError(f"Valore non numerico: {p['nome']} / {field}")
    if not players or not set(expected).issubset(seen):
        raise ValueError(f'G{day}: database incompleto')
    counts = {'': len(players), **{r: sum(p['ruolo'] == r for p in players) for r in ROLES}}
    if counts != data['counts']:
        raise ValueError(f'G{day}: contatori incoerenti')


def atomic_json(path, data):
    path = Path(path)
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)


def days(root=ROOT):
    return sorted(int(p.name.split('_')[1]) for p in root.iterdir() if p.is_dir() and re.fullmatch(r'giornata_[1-9]\d*', p.name) and (p / f'data_{p.name.split("_")[1]}.json').is_file())


def manifest(root=ROOT):
    numbers = days(root)
    digest = hashlib.sha256()
    for day in numbers:
        path = root / f'giornata_{day}/data_{day}.json'
        validate(json.loads(path.read_text()), day)
        digest.update(path.read_bytes())
    return {'giornate': numbers, 'version': digest.hexdigest()[:20]}


def check(root=ROOT):
    current = json.loads((root / 'manifest.json').read_text())
    if not current['giornate'] or current['giornate'] != days(root):
        raise ValueError('Manifest e giornate disponibili non corrispondono')
    if current.get('version') != manifest(root)['version']:
        raise ValueError('Versione manifest obsoleta: esegui python3 export_json.py')
    return current


def build(root=ROOT):
    current = check(root)
    output = root / '_site'
    if output.exists():
        shutil.rmtree(output)
    output.mkdir()
    for name in ('index.html', 'app.js', 'style.css', 'manifest.json'):
        shutil.copy2(root / name, output / name)
    (output / '.nojekyll').touch()
    for day in current['giornate']:
        folder = output / f'giornata_{day}'
        folder.mkdir()
        shutil.copy2(root / folder.name / f'data_{day}.json', folder)
    print(f'Build completata: {len(current["giornate"])} giornate in {output}')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', action='store_true')
    args = parser.parse_args()
    if args.build:
        build()
    else:
        check()
        print('Dati e manifest validi.')
