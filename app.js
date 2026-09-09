/* Fantanucleo 26/27 — app.js */

const S = {
    gn: null,
    giornate: [],
    standings: [],   // classifica generale ordinata
    rose: {},        // { fantasquadra: [giocatori] }
    sv: [],
    cambi: [],
    quotMap: {},     // { nome_calciatore: { qta, qti, diff } }
    dbGiocatori: [], // listone unificato calciatori con possesso

    // Filtri Svincolati
    fR: '',
    fQ: '',
    sCol: 'Quotazione',
    sDir: 'desc',

    // Filtri Database Giocatori
    fR_gio: '',
    fS_gio: '',
    fQ_gio: '',
    sCol_gio: 'Quotazione',
    sDir_gio: 'desc',

    // Filtri Mercato / Crediti & Cambi
    sCol_mer: 'CambiRimasti',
    sDir_mer: 'desc'
};

const ROLE_ORDER = { P: 1, D: 2, C: 3, A: 4 };

// Helper per identificare ed escludere i calciatori "fuori lista" (contrassegnati da *)
function isAsterisk(str) {
    return !!(str && String(str).includes('*'));
}

// Helper Debounce per ricerca fluida a 60fps
function debounce(fn, delay = 120) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ── COMPONENTE POSSESSO (3 STATI COMPATTI) ──
function renderPossesso(owners = []) {
    const count = owners.length;
    if (count === 0) {
        return `<span class="pos-status free">Svincolato</span>`;
    }
    if (count === 1) {
        return `<span class="pos-status single"><span class="pos-badge">1x</span><span class="pos-team hide-sm">${owners[0]}</span></span>`;
    }
    return `<span class="pos-status multi"><span class="pos-badge">${count}x</span><span class="pos-team hide-sm">${owners[0]} +${count - 1}</span></span>`;
}

// ── MODAL DETTAGLIO CALCIATORE ──
function openPlayerModal(p) {
    const modal = $('playerModal');
    if (!modal || !p) return;

    $('pmRuolo').textContent = p.ruolo || '?';
    $('pmRuolo').className = `rb rb-${(p.ruolo || '').toLowerCase()}`;
    $('pmNome').textContent = p.nome;
    $('pmSq').textContent = p.sq ? `(${p.sq})` : '';

    const count = p.owners ? p.owners.length : 0;
    const isFree = count === 0;
    const infoGrid = $('pmInfoGrid');

    if (isFree) {
        // PER GLI SVINCOLATI: mostra la griglia con tutte le statistiche
        if (infoGrid) infoGrid.style.display = 'grid';
        $('pmQuot').textContent = `${p.quot || 0} cr`;
        if ($('pmFVM')) $('pmFVM').textContent = p.fvm || '—';
        if ($('pmFM')) $('pmFM').textContent = p.fm || '—';
        if ($('pmMV')) $('pmMV').textContent = p.mv || '—';
        if ($('pmPG')) $('pmPG').textContent = p.pg !== undefined ? p.pg : '—';
        if ($('pmCount')) $('pmCount').textContent = 'Svincolato';
        $('pmOwnersList').innerHTML = `<span class="pm-free-tag">🟢 Calciatore libero sul mercato</span>`;
    } else {
        // PER I POSSEDUTI: nascondi la griglia statistiche, mostra SOLTANTO l'elenco squadre
        if (infoGrid) infoGrid.style.display = 'none';
        $('pmOwnersList').innerHTML = p.owners.map(team =>
            `<div class="pm-owner-chip">⚽ ${team}</div>`
        ).join('');
    }

    modal.classList.add('show');
}

function closePlayerModal() {
    $('playerModal')?.classList.remove('show');
}

// ── CSV Parser ───────────────────────────────────────────────────────
function csv(t) {
    const lines = t.trim().split('\n');
    if (lines.length < 2) return [];
    const hdr = lines[0].split(',').map(s => s.trim());
    return lines.slice(1).map(row => {
        const v = row.split(',').map(s => s.trim());
        return Object.fromEntries(hdr.map((k, i) => [k, v[i] ?? '']));
    });
}

async function get(p) {
    try {
        const r = await fetch(p);
        return r.ok ? csv(await r.text()) : [];
    } catch {
        return [];
    }
}

const $ = id => document.getElementById(id);

// ── Abbreviazione Squadre Serie A ───────────────────────────────────
const TEAM_ABBR = {
    'Atalanta': 'ATA',
    'Bologna': 'BOL',
    'Cagliari': 'CAG',
    'Como': 'COM',
    'Empoli': 'EMP',
    'Fiorentina': 'FIO',
    'Frosinone': 'FRO',
    'Genoa': 'GEN',
    'Inter': 'INT',
    'Juventus': 'JUV',
    'Lazio': 'LAZ',
    'Lecce': 'LEC',
    'Milan': 'MIL',
    'Monza': 'MON',
    'Napoli': 'NAP',
    'Parma': 'PAR',
    'Roma': 'ROM',
    'Sassuolo': 'SAS',
    'Torino': 'TOR',
    'Udinese': 'UDI',
    'Venezia': 'VEN',
    'Verona': 'VER',
    'Hellas Verona': 'VER'
};

function getTeamAbbr(sq) {
    if (!sq) return '—';
    return TEAM_ABBR[sq] || sq.substring(0, 3).toUpperCase();
}

// ── Data Loader ──────────────────────────────────────────────────────
async function load(n) {
    S.gn = n;
    updateNav();
    const b = `giornata_${n}`;
    const [camp, rose, sv, cambi, quot] = await Promise.all([
        get(`${b}/classifiche_campionato_${n}.csv`),
        get(`${b}/rose_${n}.csv`),
        get(`${b}/svincolati_${n}.csv`),
        get(`${b}/cambi_${n}.csv`),
        get(`${b}/quotazioni_${n}.csv`)
    ]);

    // Classifica generale ordinata per posizione
    S.standings = camp
        .filter(r => r.Tipo === 'Generale')
        .map(r => ({ ...r, Punti: +r.Punti || 0, Posizione: +r.Posizione || 99 }))
        .sort((a, b) => a.Posizione - b.Posizione);

    // Mappa Quotazioni Attuali dal Listone Ufficiale (ESCLUDENDO fuori lista *)
    S.quotMap = {};
    for (const q of quot) {
        if (isAsterisk(q.Nome)) continue;
        const cleanName = (q.Nome || '').trim();
        const nomeKey = cleanName.toLowerCase();
        S.quotMap[nomeKey] = {
            nome: cleanName,
            sq: q.Squadra || '',
            ruolo: q.Ruolo || '',
            qta: +q.QtA || 0,
            qti: +q.QtI || 0,
            diff: +q.Diff || 0,
            fvm: +q.FVM || 0
        };
    }

    // Rose indicizzate per squadra (ESCLUDENDO fuori lista *)
    S.rose = {};
    for (const r of rose) {
        if (isAsterisk(r.Calciatore) || isAsterisk(r.Nome)) continue;
        (S.rose[r.Fantasquadra] ??= []).push(r);
    }

    // Svincolati con tipi numerici (ESCLUDENDO fuori lista *)
    S.sv = sv
        .filter(r => !isAsterisk(r.Nome) && !isAsterisk(r.Calciatore))
        .map(r => ({
            ...r,
            PG: +r.PG || 0,
            MV: +r.MV || 0,
            FM: +r.FM || 0,
            FVM: +r.FVM || 0,
            Quotazione: +r.Quotazione || 0
        }));

    // Cambi con tipi numerici
    S.cambi = cambi.map(r => ({
        ...r,
        CambiRimasti: +r.CambiRimasti || 0,
        CreditiRimasti: +r.CreditiRimasti || 0
    }));

    // ── Costruzione Database Unificato Calciatori e Possesso ──
    const dbMap = {};

    // 1. Inserisci tutti i calciatori dal listone ufficiale quotazioni (escludendo *)
    for (const q of quot) {
        if (isAsterisk(q.Nome)) continue;
        const cleanName = (q.Nome || '').trim();
        if (!cleanName) continue;
        const key = cleanName.toLowerCase();
        dbMap[key] = {
            nome: cleanName,
            ruolo: q.Ruolo || '',
            sq: q.Squadra || '',
            fvm: +q.FVM || 0,
            quot: +q.QtA || +q.Quotazione || 0,
            owners: [],
            isSvincolato: false
        };
    }

    // 2. Mappa i possessori dalle rose (escludendo *)
    for (const [fsq, giocatori] of Object.entries(S.rose)) {
        for (const g of giocatori) {
            const rawName = g.Calciatore || g.Nome || '';
            if (isAsterisk(rawName)) continue;
            const pName = rawName.trim();
            if (!pName) continue;
            const key = pName.toLowerCase();
            if (!dbMap[key]) {
                const qInfo = S.quotMap[key] || {};
                dbMap[key] = {
                    nome: pName,
                    ruolo: g.Ruolo || qInfo.ruolo || '',
                    sq: g.Squadra || qInfo.sq || '',
                    fvm: qInfo.fvm || 0,
                    quot: +g.Costo || qInfo.qta || 0,
                    owners: [],
                    isSvincolato: false
                };
            }
            if (!dbMap[key].owners.includes(fsq)) {
                dbMap[key].owners.push(fsq);
            }
        }
    }

    // 3. Marca gli svincolati (escludendo *)
    for (const svItem of S.sv) {
        const rawName = svItem.Nome || svItem.Calciatore || '';
        if (isAsterisk(rawName)) continue;
        const pName = rawName.trim();
        if (!pName) continue;
        const key = pName.toLowerCase();
        if (!dbMap[key]) {
            dbMap[key] = {
                nome: pName,
                ruolo: svItem.Ruolo || '',
                sq: svItem.Squadra || '',
                fvm: svItem.FVM || 0,
                quot: svItem.Quotazione || 0,
                fm: svItem.FM || 0,
                mv: svItem.MV || 0,
                pg: svItem.PG || 0,
                owners: [],
                isSvincolato: true
            };
        } else {
            dbMap[key].isSvincolato = true;
            if (svItem.FVM) dbMap[key].fvm = svItem.FVM;
            if (svItem.Quotazione) dbMap[key].quot = svItem.Quotazione;
            if (svItem.Squadra) dbMap[key].sq = svItem.Squadra;
            if (svItem.FM) dbMap[key].fm = svItem.FM;
            if (svItem.MV) dbMap[key].mv = svItem.MV;
            if (svItem.PG) dbMap[key].pg = svItem.PG;
        }
    }

    S.dbGiocatori = Object.values(dbMap);

    updateCounts();
    render();
}

// ── Giornata Navigator ───────────────────────────────────────────────
function updateNav() {
    $('gnLabel').textContent = `G${S.gn}`;
    $('gnPrev').disabled = S.gn <= S.giornate[0];
    $('gnNext').disabled = S.gn >= S.giornate[S.giornate.length - 1];
    document.querySelectorAll('.pk-btn').forEach(b =>
        b.classList.toggle('cur', +b.dataset.n === S.gn)
    );
}

function buildPicker() {
    const el = $('picker');
    el.innerHTML = S.giornate.map(n =>
        `<button class="pk-btn" data-n="${n}">G${n}</button>`
    ).join('');
    el.querySelectorAll('.pk-btn').forEach(b =>
        b.addEventListener('click', () => { load(+b.dataset.n); closePicker(); })
    );
}

let pickerOpen = false;
function openPicker(anchor) {
    const el = $('picker');
    const r = anchor.getBoundingClientRect();
    el.style.top = (r.bottom + 8) + 'px';
    el.style.left = Math.max(10, Math.min(window.innerWidth - 250, r.left - 80)) + 'px';
    el.classList.add('show');
    pickerOpen = true;
}
function closePicker() {
    $('picker').classList.remove('show');
    pickerOpen = false;
}

// ── Count badges update ──────────────────────────────────────────────
function updateCounts() {
    // Svincolati counts
    const countsSv = { '': S.sv.length, P: 0, D: 0, C: 0, A: 0 };
    for (const item of S.sv) {
        if (countsSv[item.Ruolo] !== undefined) countsSv[item.Ruolo]++;
    }

    if ($('cnt-all')) $('cnt-all').textContent = `(${countsSv['']})`;
    if ($('cnt-p')) $('cnt-p').textContent = `(${countsSv.P})`;
    if ($('cnt-d')) $('cnt-d').textContent = `(${countsSv.D})`;
    if ($('cnt-c')) $('cnt-c').textContent = `(${countsSv.C})`;
    if ($('cnt-a')) $('cnt-a').textContent = `(${countsSv.A})`;

    // Giocatori DB counts
    const countsGio = { '': S.dbGiocatori.length, P: 0, D: 0, C: 0, A: 0 };
    for (const item of S.dbGiocatori) {
        if (countsGio[item.ruolo] !== undefined) countsGio[item.ruolo]++;
    }

    if ($('cnt-gio-all')) $('cnt-gio-all').textContent = `(${countsGio['']})`;
    if ($('cnt-gio-p')) $('cnt-gio-p').textContent = `(${countsGio.P})`;
    if ($('cnt-gio-d')) $('cnt-gio-d').textContent = `(${countsGio.D})`;
    if ($('cnt-gio-c')) $('cnt-gio-c').textContent = `(${countsGio.C})`;
    if ($('cnt-gio-a')) $('cnt-gio-a').textContent = `(${countsGio.A})`;
}

// ── Render Giocatori & Possesso ──────────────────────────────────────
function rGiocatori() {
    let list = [...S.dbGiocatori];

    // Filtro Ruolo
    if (S.fR_gio) {
        list = list.filter(p => p.ruolo === S.fR_gio);
    }

    // Filtro Stato Possesso
    if (S.fS_gio === 'svincolato') {
        list = list.filter(p => p.isSvincolato || p.owners.length === 0);
    } else if (S.fS_gio === 'posseduto') {
        list = list.filter(p => p.owners.length > 0);
    }

    // Filtro Ricerca
    if (S.fQ_gio) {
        const q = S.fQ_gio;
        list = list.filter(p =>
            p.nome.toLowerCase().includes(q) ||
            p.sq.toLowerCase().includes(q)
        );
    }

    // Ordinamento principale
    list.sort((a, b) => {
        if (S.sCol_gio === 'Nome') {
            const res = a.nome.localeCompare(b.nome);
            return S.sDir_gio === 'asc' ? res : -res;
        }

        if (S.sCol_gio === 'Quotazione') {
            const qa = a.quot || 0;
            const qb = b.quot || 0;
            if (qa !== qb) {
                return S.sDir_gio === 'asc' ? qa - qb : qb - qa;
            }
        }

        if (S.sCol_gio === 'owners') {
            const oa = a.owners.length;
            const ob = b.owners.length;
            if (oa !== ob) {
                return S.sDir_gio === 'asc' ? oa - ob : ob - oa; // decrescente (più posseduti in alto)
            }
            // A parità di possessori: ordina per Quotazione decrescente
            return (b.quot || 0) - (a.quot || 0);
        }

        // Gruppo Ruolo P -> D -> C -> A
        const ra = ROLE_ORDER[a.ruolo] || 99;
        const rb = ROLE_ORDER[b.ruolo] || 99;
        if (ra !== rb) {
            return S.sDir_gio === 'asc' ? ra - rb : rb - ra;
        }

        // Dentro lo stesso ruolo: Crediti SEMPRE DECRESCENTI (dal più alto al più basso)
        const qa = a.quot || 0;
        const qb = b.quot || 0;
        if (qa !== qb) {
            return qb - qa;
        }

        return a.nome.localeCompare(b.nome);
    });

    if ($('cntGio')) $('cntGio').textContent = `${list.length} calciatori`;

    const emptyEl = $('gioEmpty');
    const tbody = document.querySelector('#tGiocatori tbody');
    if (!tbody) return;

    if (list.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        return;
    } else if (emptyEl) {
        emptyEl.style.display = 'none';
    }

    tbody.innerHTML = list.map(p => {
        const ownerHtml = renderPossesso(p.owners);

        return `<tr data-role="${p.ruolo}" data-player-name="${p.nome}">
            <td><span class="rb rb-${(p.ruolo || '').toLowerCase()}">${p.ruolo || '?'}</span></td>
            <td style="font-weight:600">${p.nome}</td>
            <td style="color:var(--tx2)">
                <span class="hide-sm">${p.sq || '—'}</span>
                <span class="show-sm sq-badge">${getTeamAbbr(p.sq)}</span>
            </td>
            <td class="n"><span class="qt">${p.quot || '—'}</span></td>
            <td>${ownerHtml}</td>
        </tr>`;
    }).join('');

    // Wire Click on rows to open Player Detail Modal
    tbody.querySelectorAll('tr[data-player-name]').forEach(tr => {
        tr.addEventListener('click', () => {
            const pName = tr.dataset.playerName;
            const p = S.dbGiocatori.find(x => x.nome === pName);
            if (p) openPlayerModal(p);
        });
    });

    // Update Header Sort Arrows
    document.querySelectorAll('#tGiocatori th[data-sg]').forEach(th => {
        th.classList.remove('sa', 'sd');
        const col = th.dataset.sg;
        const arrow = col === S.sCol_gio ? (S.sDir_gio === 'asc' ? '↑' : '↓') : '⇕';
        if (col === S.sCol_gio) {
            th.classList.add(S.sDir_gio === 'asc' ? 'sa' : 'sd');
        }

        let label = (th.dataset.label || th.textContent).replace(/[ ⇕↑↓]/g, '');
        th.dataset.label = label;
        th.innerHTML = `${label} ${arrow}`;
    });
}

// ── Render Svincolati ────────────────────────────────────────────────
function rSv() {
    let d = [...S.sv];

    if (S.fR) d = d.filter(r => r.Ruolo === S.fR);

    if (S.fQ) {
        const q = S.fQ;
        d = d.filter(r =>
            r.Nome.toLowerCase().includes(q) ||
            r.Squadra.toLowerCase().includes(q)
        );
    }

    d.sort((a, b) => {
        const av = a[S.sCol], bv = b[S.sCol];
        if (typeof av === 'number') return S.sDir === 'asc' ? av - bv : bv - av;
        return S.sDir === 'asc'
            ? String(av).localeCompare(String(bv))
            : String(bv).localeCompare(String(av));
    });

    if ($('cnt')) $('cnt').textContent = `${d.length} calciatori`;

    const emptyEl = $('svEmpty');
    const tbody = document.querySelector('#tSv tbody');
    if (!tbody) return;

    if (d.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        tbody.innerHTML = '';
        return;
    } else if (emptyEl) {
        emptyEl.style.display = 'none';
    }

    tbody.innerHTML = d.map(r => `<tr data-role="${r.Ruolo}" data-player-name="${r.Nome}">
        <td><span class="rb rb-${r.Ruolo.toLowerCase()}">${r.Ruolo}</span></td>
        <td>
            <div class="sv-name-wrap">
                <span class="sv-pname">${r.Nome}</span>
                <div class="show-sm sv-mobile-stats">
                    <span class="sv-mini-tag sq">${getTeamAbbr(r.Squadra)}</span>
                    <span class="sv-mini-tag fm">FM ${r.FM || '—'}</span>
                    <span class="sv-mini-tag mv">MV ${r.MV || '—'}</span>
                    <span class="sv-mini-tag pg">PG ${r.PG || '0'}</span>
                </div>
            </div>
        </td>
        <td class="hide-sm" style="color:var(--tx2)">${r.Squadra}</td>
        <td class="n fvm-val">
            <span class="hide-sm">${r.FVM}</span>
            <span class="show-sm fvm-badge">FVM ${r.FVM}</span>
        </td>
        <td class="n hide-sm">${r.FM || '—'}</td>
        <td class="n hide-sm">${r.MV || '—'}</td>
        <td class="n hide-sm">${r.PG}</td>
        <td class="n"><span class="qt">${r.Quotazione}</span></td>
    </tr>`).join('');

    // Wire Click on rows to open Player Detail Modal
    tbody.querySelectorAll('tr[data-player-name]').forEach(tr => {
        tr.addEventListener('click', () => {
            const pName = tr.dataset.playerName;
            const p = S.dbGiocatori.find(x => x.nome === pName);
            if (p) openPlayerModal(p);
        });
    });

    // Indicatori frecce ordini header
    document.querySelectorAll('#tSv th[data-s]').forEach(th => {
        th.classList.remove('sa', 'sd');
        const col = th.dataset.s;
        const arrow = col === S.sCol ? (S.sDir === 'asc' ? '↑' : '↓') : '⇕';
        if (col === S.sCol && !(window.innerWidth <= 768 && col === 'FVM')) {
            th.classList.add(S.sDir === 'asc' ? 'sa' : 'sd');
        }

        if (col === 'FVM') {
            th.innerHTML = `<span class="hide-sm">FVM ${arrow}</span><span class="show-sm">Sq.</span>`;
        } else {
            let label = (th.dataset.label || th.textContent).replace(/[ ⇕↑↓]/g, '');
            th.dataset.label = label;
            th.innerHTML = `${label} ${arrow}`;
        }
    });
}

// ── Render Mercato (Tabella pulita) ──────────────────────────────────
function rMercato() {
    if (!S.cambi || !S.cambi.length) return;

    // Nota speciale (se presente)
    const extraNote = S.cambi.find(c => c.CambiExtra && c.CambiExtra.trim())?.CambiExtra;
    const noteEl = $('mercatoNote');
    if (noteEl) {
        if (extraNote) {
            noteEl.style.display = 'block';
            let formattedNote = extraNote;
            if (extraNote.toLowerCase().includes('illimitat')) {
                formattedNote = 'Cambi illimitati fino alla quarta giornata';
            }
            noteEl.innerHTML = `<strong>ℹ️ Regola Mercato:</strong> ${formattedNote}`;
        } else {
            noteEl.style.display = 'none';
        }
    }

    // Ordinamento dinamico per CambiRimasti, CreditiRimasti o Fantasquadra
    const col = S.sCol_mer || 'CambiRimasti';
    const dir = S.sDir_mer || 'desc';

    const sortedCambi = [...S.cambi].sort((a, b) => {
        if (col === 'Fantasquadra') {
            const res = a.Fantasquadra.localeCompare(b.Fantasquadra);
            return dir === 'asc' ? res : -res;
        }

        if (col === 'CambiRimasti') {
            const ca = +a.CambiRimasti || 0;
            const cb = +b.CambiRimasti || 0;
            if (ca !== cb) {
                return dir === 'asc' ? ca - cb : cb - ca;
            }
            return (+b.CreditiRimasti || 0) - (+a.CreditiRimasti || 0);
        }

        if (col === 'CreditiRimasti') {
            const cra = +a.CreditiRimasti || 0;
            const crb = +b.CreditiRimasti || 0;
            if (cra !== crb) {
                return dir === 'asc' ? cra - crb : crb - cra;
            }
            return (+b.CambiRimasti || 0) - (+a.CambiRimasti || 0);
        }

        return 0;
    });

    const tbody = document.querySelector('#tCambi tbody');
    if (!tbody) return;

    tbody.innerHTML = sortedCambi.map(r => {
        const cred = r.CreditiRimasti;
        const credHtml = cred > 0
            ? `<span class="cred-tag pos">+${cred} cr</span>`
            : `<span class="cred-tag zero">0 cr</span>`;

        const cambiVal = r.CambiRimasti;
        const fillPct = Math.min(100, (cambiVal / 10) * 100);

        return `<tr>
            <td style="font-weight:600">${r.Fantasquadra}</td>
            <td class="n">
                <div class="cambi-bar-wrap">
                    <span class="cambi-val">${cambiVal}</span>
                    <div class="cambi-track"><div class="cambi-fill" style="width:${fillPct}%"></div></div>
                </div>
            </td>
            <td class="n">${credHtml}</td>
        </tr>`;
    }).join('');

    // Update Header Sort Arrows for Mercato
    document.querySelectorAll('#tCambi th[data-sm]').forEach(th => {
        th.classList.remove('sa', 'sd');
        const thCol = th.dataset.sm;
        const arrow = thCol === S.sCol_mer ? (S.sDir_mer === 'asc' ? '↑' : '↓') : '⇕';
        if (thCol === S.sCol_mer) {
            th.classList.add(S.sDir_mer === 'asc' ? 'sa' : 'sd');
        }

        let label = th.dataset.label || th.textContent.replace(/[ ⇕↑↓]/g, '').trim();
        th.dataset.label = label;
        th.innerHTML = `${label} &nbsp;${arrow}`;
    });
}

// ── Render All ───────────────────────────────────────────────────────
function render() {
    rGiocatori();
    rSv();
    rMercato();
}

// ── Events Setup ─────────────────────────────────────────────────────
function setup() {
    // Player Modal Close
    $('pmClose')?.addEventListener('click', closePlayerModal);
    $('playerModal')?.addEventListener('click', e => {
        if (e.target === $('playerModal')) closePlayerModal();
    });

    // Keyboard Shortcuts per Asta Live
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closePlayerModal();
            return;
        }
        if (e.target.matches('input, textarea')) return;

        if (e.key === '/') {
            e.preventDefault();
            const qInput = $('qGio') || $('q');
            if (qInput) qInput.focus();
        } else if (['1', '2', '3'].includes(e.key)) {
            const tabs = document.querySelectorAll('.t');
            const idx = Number(e.key) - 1;
            if (tabs[idx]) tabs[idx].click();
        } else if (['p', 'd', 'c', 'a'].includes(e.key.toLowerCase())) {
            const rKey = e.key.toUpperCase();
            const rBtn = document.querySelector(`.pill-gio-r[data-r="${rKey}"]`);
            if (rBtn) rBtn.click();
        } else if (e.key === 'ArrowLeft') {
            $('gnPrev')?.click();
        } else if (e.key === 'ArrowRight') {
            $('gnNext')?.click();
        }
    });

    // Tabs Navigation
    document.querySelectorAll('.t').forEach(b =>
        b.addEventListener('click', () => {
            document.querySelectorAll('.t').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.v').forEach(x => x.classList.remove('on'));
            b.classList.add('active');
            $(`v-${b.dataset.v}`).classList.add('on');
            closePicker();
        })
    );

    // Giornata Navigator
    $('gnPrev').addEventListener('click', () => {
        const i = S.giornate.indexOf(S.gn);
        if (i > 0) load(S.giornate[i - 1]);
    });
    $('gnNext').addEventListener('click', () => {
        const i = S.giornate.indexOf(S.gn);
        if (i < S.giornate.length - 1) load(S.giornate[i + 1]);
    });
    $('gnLabel').addEventListener('click', e => {
        e.stopPropagation();
        pickerOpen ? closePicker() : openPicker(e.currentTarget);
    });
    document.addEventListener('click', () => { if (pickerOpen) closePicker(); });

    // Database Giocatori — Ricerca con Debounce
    const qGioInput = $('qGio');
    const clearGioBtn = $('searchClearGio');

    const debouncedSearchGio = debounce(value => {
        S.fQ_gio = value.toLowerCase().trim();
        if (clearGioBtn) clearGioBtn.style.display = S.fQ_gio ? 'block' : 'none';
        rGiocatori();
    }, 120);

    if (qGioInput) {
        qGioInput.addEventListener('input', e => debouncedSearchGio(e.target.value));
    }

    if (clearGioBtn) {
        clearGioBtn.addEventListener('click', () => {
            if (qGioInput) qGioInput.value = '';
            S.fQ_gio = '';
            clearGioBtn.style.display = 'none';
            rGiocatori();
            if (qGioInput) qGioInput.focus();
        });
    }

    // Database Giocatori — Pills filtro ruolo
    document.querySelectorAll('.pill-gio-r').forEach(p =>
        p.addEventListener('click', () => {
            document.querySelectorAll('.pill-gio-r').forEach(x => x.classList.remove('on'));
            p.classList.add('on');
            S.fR_gio = p.dataset.r;
            S.sCol_gio = 'Quotazione';
            S.sDir_gio = 'desc';
            rGiocatori();
        })
    );

    // Database Giocatori — Pills filtro stato possesso
    document.querySelectorAll('.pill-gio-s').forEach(p =>
        p.addEventListener('click', () => {
            document.querySelectorAll('.pill-gio-s').forEach(x => x.classList.remove('on'));
            p.classList.add('on');
            S.fS_gio = p.dataset.st;
            rGiocatori();
        })
    );

    // Database Giocatori — Sort colonne
    document.querySelectorAll('#tGiocatori th[data-sg]').forEach(th =>
        th.addEventListener('click', () => {
            const c = th.dataset.sg;
            S.sDir_gio = (S.sCol_gio === c && S.sDir_gio === 'desc') ? 'asc' : 'desc';
            S.sCol_gio = c;
            rGiocatori();
        })
    );

    // Svincolati — Ricerca con Debounce
    const searchInput = $('q');
    const clearBtn = $('searchClear');

    const debouncedSearchSv = debounce(value => {
        S.fQ = value.toLowerCase().trim();
        if (clearBtn) clearBtn.style.display = S.fQ ? 'block' : 'none';
        rSv();
    }, 120);

    if (searchInput) {
        searchInput.addEventListener('input', e => debouncedSearchSv(e.target.value));
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            S.fQ = '';
            clearBtn.style.display = 'none';
            rSv();
            if (searchInput) searchInput.focus();
        });
    }

    // Svincolati — Pills filtro ruolo
    document.querySelectorAll('.pill').forEach(p => {
        if (p.classList.contains('pill-gio-r') || p.classList.contains('pill-gio-s')) return;
        p.addEventListener('click', () => {
            document.querySelectorAll('.pill:not(.pill-gio-r):not(.pill-gio-s)').forEach(x => x.classList.remove('on'));
            p.classList.add('on');
            S.fR = p.dataset.r;
            rSv();
        });
    });

    // Svincolati — Sort colonne
    document.querySelectorAll('#tSv th[data-s]').forEach(th =>
        th.addEventListener('click', () => {
            if (window.innerWidth <= 768 && th.dataset.s === 'FVM') return;
            const c = th.dataset.s;
            S.sDir = (S.sCol === c && S.sDir === 'desc') ? 'asc' : 'desc';
            S.sCol = c;
            rSv();
        })
    );

    // Mercato — Header Click Sort
    document.querySelectorAll('#tCambi th[data-sm]').forEach(th =>
        th.addEventListener('click', () => {
            const c = th.dataset.sm;
            S.sDir_mer = (S.sCol_mer === c && S.sDir_mer === 'desc') ? 'asc' : 'desc';
            S.sCol_mer = c;
            rMercato();
        })
    );
}

// ── Init App ─────────────────────────────────────────────────────────
async function init() {
    setup();
    let giornate = [];
    try {
        const r = await fetch('manifest.json');
        if (r.ok) giornate = (await r.json()).giornate || [];
    } catch {}
    if (!giornate.length) return;
    S.giornate = giornate;
    buildPicker();
    await load(giornate[giornate.length - 1]);
}

init();
