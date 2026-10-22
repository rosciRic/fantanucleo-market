import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import openpyxl
import organizza_fanta as importer
from export_json import generate_giornata_json
from site_data import ROOT, check, validate, manifest


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'giornata_7/data_7.json').read_text())

    def test_all_committed_days_are_consistent(self):
        self.assertTrue(check()['giornate'])

    def test_missing_roster_member_is_rejected(self):
        next(iter(self.data['rose'].values())).pop()
        with self.assertRaises(ValueError):
            validate(self.data, 7)

    def test_wrong_owner_is_rejected(self):
        self.data['giocatori'][0]['owners'] = ['Squadra inesistente']
        with self.assertRaises(ValueError):
            validate(self.data, 7)

    def test_manifest_is_deterministic(self):
        self.assertEqual(manifest(), manifest())

    def test_updated_listone_wins_over_old_free_agent_price(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'quotazioni_1.csv').write_text('Nome,Squadra,Ruolo,QtA,QtI,Diff\nMario,Roma,C,0,10,-10\n')
            (root / 'svincolati_1.csv').write_text('Nome,Squadra,Ruolo,Quotazione\nMario,Roma,C,15\n')
            self.assertEqual(generate_giornata_json(root, 1)['giocatori'][0]['quot'], 0)

    def test_day_does_not_use_season_as_matchday(self):
        wb = openpyxl.Workbook()
        self.assertEqual(importer.extract_giornata_number(Path('Risultati_7ª_2026_2027.xlsx'), wb), 7)
        with self.assertRaises(ValueError):
            importer.extract_giornata_number(Path('Risultati_2026_2027.xlsx'), wb)
        wb.close()

    def test_invalid_workbook_preserves_existing_data_and_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            results, quotes = root / 'Risultati_8.xlsx', root / 'Quotazioni.xlsx'
            wb = openpyxl.Workbook()
            wb.save(results)
            ws = wb.active
            ws.append(['header'])
            ws.append(['header'])
            ws.append([1, 'P', '', 'Mario', 'Roma', 10, 10, 0])
            wb.save(quotes)
            wb.close()
            (root / 'manifest.json').write_text('{"giornate":[]}')
            before = {p.name: p.read_bytes() for p in root.iterdir()}
            with patch.object(importer, 'FANTA_DIR', root):
                with self.assertRaises(ValueError):
                    importer.import_day(results, quotes, day=8)
            self.assertEqual(before, {p.name: p.read_bytes() for p in root.iterdir()})


if __name__ == '__main__':
    unittest.main()
