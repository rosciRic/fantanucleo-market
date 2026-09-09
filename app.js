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
    sCol: 'FVM',
    sDir: 'desc',

    // Filtri Database Giocatori
    fR_gio: '',
    fS_gio: '',
    fQ_gio: '',
    sCol_gio: 'FVM',
    sDir_gio: 'desc'
};

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

    // Mappa Quotazioni Attuali dal Listone Ufficiale
    S.quotMap = {};
    for (const q of quot) {
        const nomeKey = (q.Nome || '').replace(/\*/g, '').trim().toLowerCase();
        S.quotMap[nomeKey] = {
            sq: q.Squadra || '',
            ruolo: q.Ruolo || '',
            qta: +q.QtA || 0,
            qti: +q.QtI || 0,
            diff: +q.Diff || 0,
            fvm: +q.FVM || 0
        };
    }

    // Rose indicizzate per squadra
    S.rose = {};
    for (const r of rose) {
        (S.rose[r.Fantasquadra] ??= []).push(r);
    }

    // Svincolati con tipi numerici
    S.sv = sv.map(r => ({
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

    // 1. Inserisci tutti i calciatori dal listone ufficiale quotazioni
    for (const q of quot) {
        const cleanName = (q.Nome || '').replace(/\*/g, '').trim();
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

    // 2. Mappa i possessori dalle rose
    for (const [fsq, giocatori] of Object.entries(S.rose)) {
        for (const g of giocatori) {
            const pName = (g.Calciatore || g.Nome || '').replace(/\*/g, '').trim();
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

    // 3. Marca gli svincolati
    for (const svItem of S.sv) {
        const pName = (svItem.Nome || svItem.Calciatore || '').replace(/\*/g, '').trim();
        if (!pName) continue;
        const key = pName.toLowerCase();
        if (!dbMap[key]) {
            dbMap[key] = {
                nome: pName,
                ruolo: svItem.Ruolo || '',
                sq: svItem.Squadra || '',
                fvm: svItem.FVM || 0,
                quot: svItem.Quotazione || 0,
                owners: [],
                isSvincolato: true
            };
        } else {
            dbMap[key].isSvincolato = true;
            if (svItem.FVM) dbMap[key].fvm = svItem.FVM;
            if (svItem.Quotazione) dbMap[key].quot = svItem.Quotazione;
            if (svItem.Squadra) dbMap[key].sq = svItem.Squadra;
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
    } else if (S.fS_gio === 'multi') {
        list = list.filter(p => p.owners.length > 1);
    }

    // Filtro Ricerca
    if (S.fQ_gio) {
        const q = S.fQ_gio;
        list = list.filter(p =>
            p.nome.toLowerCase().includes(q) ||
            p.sq.toLowerCase().includes(q)
        );
    }

    // Ordinamento
    list.sort((a, b) => {
        let av = a[S.sCol_gio], bv = b[S.sCol_gio];
        if (S.sCol_gio === 'FVM') { av = a.fvm; bv = b.fvm; }
        else if (S.sCol_gio === 'Quotazione') { av = a.quot; bv = b.quot; }
        else if (S.sCol_gio === 'Nome') { av = a.nome; bv = b.nome; }
        else if (S.sCol_gio === 'Ruolo') { av = a.ruolo; bv = b.ruolo; }

        if (typeof av === 'number' && typeof bv === 'number') {
            return S.sDir_gio === 'asc' ? av - bv : bv - av;
        }
        return S.sDir_gio === 'asc'
            ? String(av).localeCompare(String(bv))
            : String(bv).localeCompare(String(av));
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
        let ownerHtml = '';
        if (p.owners.length === 0) {
            ownerHtml = `<span class="owner-tag svinc">🟢 Svincolato</span>`;
        } else if (p.owners.length === 1) {
            ownerHtml = `<span class="owner-tag single">🔴 ${p.owners[0]}</span>`;
        } else {
            ownerHtml = `<span class="owner-tag multi">🟣 <strong>${p.owners.length} squadre</strong>: ${p.owners.join(', ')}</span>`;
        }

        return `<tr>
            <td><span class="rb rb-${(p.ruolo || '').toLowerCase()}">${p.ruolo || '?'}</span></td>
            <td style="font-weight:600">${p.nome}</td>
            <td class="hide-sm" style="color:var(--tx2)">${p.sq || '—'}</td>
            <td class="n fvm-val">
                <span class="hide-sm">${p.fvm || '—'}</span>
                <span class="show-sm sq-badge">${getTeamAbbr(p.sq)}</span>
            </td>
            <td class="n"><span class="qt">${p.quot || '—'}</span></td>
            <td>${ownerHtml}</td>
        </tr>`;
    }).join('');

    // Update Header Sort Arrows
    document.querySelectorAll('#tGiocatori th[data-sg]').forEach(th => {
        th.classList.remove('sa', 'sd');
        const col = th.dataset.sg;
        const arrow = col === S.sCol_gio ? (S.sDir_gio === 'asc' ? '↑' : '↓') : '⇕';
        if (col === S.sCol_gio && !(window.innerWidth <= 768 && col === 'FVM')) {
            th.classList.add(S.sDir_gio === 'asc' ? 'sa' : 'sd');
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

    tbody.innerHTML = d.map(r => `<tr>
        <td><span class="rb rb-${r.Ruolo.toLowerCase()}">${r.Ruolo}</span></td>
        <td style="font-weight:600">${r.Nome}</td>
        <td class="hide-sm" style="color:var(--tx2)">${r.Squadra}</td>
        <td class="n fvm-val">
            <span class="hide-sm">${r.FVM}</span>
            <span class="show-sm sq-badge">${getTeamAbbr(r.Squadra)}</span>
        </td>
        <td class="n">${r.FM || '—'}</td>
        <td class="n hide-sm">${r.MV || '—'}</td>
        <td class="n hide-sm">${r.PG}</td>
        <td class="n"><span class="qt">${r.Quotazione}</span></td>
    </tr>`).join('');

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

    // Ordina i cambi secondo la classifica generale
    const teamOrder = S.standings.map(t => t.Fantasquadra);
    const sortedCambi = [...S.cambi].sort((a, b) => {
        const ia = teamOrder.indexOf(a.Fantasquadra);
        const ib = teamOrder.indexOf(b.Fantasquadra);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
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
}

// ── Render All ───────────────────────────────────────────────────────
function render() {
    rGiocatori();
    rSv();
    rMercato();
}

// ── Global Search Modal ──────────────────────────────────────────────
function initGlobalSearch() {
    const modal = $('gsModal');
    const btn = $('btnGlobalSearch');
    const close = $('gsClose');
    const input = $('gsInput');
    const res = $('gsResults');
    if (!modal || !btn) return;

    function openGS() {
        modal.classList.add('show');
        if ($('gsTitle')) $('gsTitle').textContent = `🔍 Cerca Giocatore (Giornata ${S.gn})`;
        input.value = '';
        res.innerHTML = '';
        input.focus();
    }
    function closeGS() {
        modal.classList.remove('show');
    }

    btn.addEventListener('click', openGS);
    close.addEventListener('click', closeGS);
    modal.addEventListener('click', e => { if (e.target === modal) closeGS(); });

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            modal.classList.contains('show') ? closeGS() : openGS();
        }
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeGS();
        }
    });

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) { res.innerHTML = ''; return; }

        let matches = S.dbGiocatori.filter(p =>
            p.nome.toLowerCase().includes(q) ||
            p.sq.toLowerCase().includes(q)
        );

        matches.sort((a, b) => a.nome.localeCompare(b.nome));

        if (matches.length === 0) {
            res.innerHTML = '<div style="padding:10px; color:var(--tx3); text-align:center;">Nessun giocatore trovato.</div>';
            return;
        }

        res.innerHTML = matches.map(m => {
            const rCol = { P: '#fbbf24', D: '#4ade80', C: '#38bdf8', A: '#f87171' }[m.ruolo] || '#fff';
            const rBg = { P: 'rgba(251,191,36,0.15)', D: 'rgba(74,222,128,0.15)', C: 'rgba(56,189,248,0.15)', A: 'rgba(248,113,113,0.15)' }[m.ruolo] || 'rgba(255,255,255,0.1)';
            
            let badges = '';
            if (m.owners.length === 0) {
                badges = `<span class="gs-owner svinc">Svincolato</span>`;
            } else {
                badges = m.owners.map(o => `<span class="gs-owner rosa">${o}</span>`).join('');
            }

            const sqStr = m.sq ? `(${m.sq})` : '';

            return `
                <div class="gs-item" style="align-items: flex-start;">
                    <div style="flex-shrink:0; margin-right:10px; padding-top:2px;">
                        <span class="gs-ruolo" style="color:${rCol}; background:${rBg};">${m.ruolo || '?'}</span>
                        <span class="gs-nome">${m.nome}</span>
                        <span class="gs-sq">${sqStr}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
                        ${badges}
                    </div>
                </div>
            `;
        }).join('');
    });
}

// ── Events Setup ─────────────────────────────────────────────────────
function setup() {
    initGlobalSearch();

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

    // Database Giocatori — Ricerca
    const qGioInput = $('qGio');
    const clearGioBtn = $('searchClearGio');

    if (qGioInput) {
        qGioInput.addEventListener('input', e => {
            S.fQ_gio = e.target.value.toLowerCase().trim();
            if (clearGioBtn) clearGioBtn.style.display = S.fQ_gio ? 'block' : 'none';
            rGiocatori();
        });
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
            if (window.innerWidth <= 768 && th.dataset.sg === 'FVM') return;
            const c = th.dataset.sg;
            S.sDir_gio = (S.sCol_gio === c && S.sDir_gio === 'desc') ? 'asc' : 'desc';
            S.sCol_gio = c;
            rGiocatori();
        })
    );

    // Svincolati — Ricerca
    const searchInput = $('q');
    const clearBtn = $('searchClear');

    if (searchInput) {
        searchInput.addEventListener('input', e => {
            S.fQ = e.target.value.toLowerCase().trim();
            if (clearBtn) clearBtn.style.display = S.fQ ? 'block' : 'none';
            rSv();
        });
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
