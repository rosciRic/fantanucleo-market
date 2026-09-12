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

    // Filtri Database Giocatori
    fR_gio: '',
    fS_gio: '',
    fQ_gio: '',

    // Stato riga espansa (Accordion inline)
    expandedPlayerName: null,
    expandedRoseTeam: null
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
        return `<span class="pos-status free"><span class="pos-dot">🟢</span> Libero</span>`;
    }
    if (count === 1) {
        return `<span class="pos-status single"><span class="pos-badge">1x</span><span class="pos-team hide-sm">${owners[0]}</span></span>`;
    }
    return `<span class="pos-status multi"><span class="pos-badge">${count}x</span><span class="pos-team hide-sm">${owners[0]} <span class="pos-more">+${count - 1}</span></span></span>`;
}

// ── RENDER ACCORDION DETTAGLIO CALCIATORE INLINE ──
function renderExpandedRow(p) {
    const count = p.owners ? p.owners.length : 0;
    const isFree = count === 0;

    if (isFree) {
        // PER GLI SVINCOLATI: mostra la griglia con tutte le statistiche ed il tag libero
        return `<tr class="expand-row">
            <td colspan="6">
                <div class="inline-player-detail">
                    <div class="pm-info-grid">
                        <div class="pm-stat">
                            <span class="pm-stat-lbl">Quotazione</span>
                            <span class="pm-stat-val">${p.quot || 0} cr</span>
                        </div>
                        <div class="pm-stat">
                            <span class="pm-stat-lbl">FVM</span>
                            <span class="pm-stat-val">${p.fvm || '—'}</span>
                        </div>
                        <div class="pm-stat">
                            <span class="pm-stat-lbl">Fantamedia</span>
                            <span class="pm-stat-val">${p.fm || '—'}</span>
                        </div>
                        <div class="pm-stat">
                            <span class="pm-stat-lbl">Media Voto</span>
                            <span class="pm-stat-val">${p.mv || '—'}</span>
                        </div>
                        <div class="pm-stat">
                            <span class="pm-stat-lbl">Partite (PG)</span>
                            <span class="pm-stat-val">${p.pg !== undefined && p.pg !== null ? p.pg : '—'}</span>
                        </div>
                        <div class="pm-stat">
                            <span class="pm-stat-lbl">Stato</span>
                            <span class="pm-stat-val">Svincolato</span>
                        </div>
                    </div>
                    <div class="pm-owners-section">
                        <div class="pm-owners-list">
                            <span class="pm-free-tag">🟢 Calciatore libero sul mercato</span>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
    } else {
        // PER I POSSEDUTI: mostra elenco squadre possessori + nota esplicativa
        const ownersHtml = p.owners.map(team => `<div class="pm-owner-chip">⚽ ${team}</div>`).join('');
        return `<tr class="expand-row">
            <td colspan="6">
                <div class="inline-player-detail">
                    <div class="pm-owners-section">
                        <span class="pm-section-lbl">Posseduto da ${count} ${count === 1 ? 'squadra' : 'squadre'}:</span>
                        <div class="pm-owners-list">${ownersHtml}</div>
                    </div>
                    <div class="pm-info-note">ℹ️ Statistiche dettagliate (FVM, FM, MV, PG) disponibili solo per i calciatori svincolati.</div>
                </div>
            </td>
        </tr>`;
    }
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
    S.roseAll = {};  // Include anche fuori lista per tab Rose
    for (const r of rose) {
        (S.roseAll[r.Fantasquadra] ??= []).push(r);
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

// ── Giornata Navigator & Picker ──────────────────────────────────────
function updateNav() {
    const label = $('gnLabel');
    const isCurrent = S.gn === S.giornate[S.giornate.length - 1];
    if (label) {
        label.innerHTML = `G${S.gn} ${isCurrent ? '<span class="gn-cur-badge">LIVE</span>' : ''}<span class="gn-arrow">▾</span>`;
    }

    // Show/hide historic banner
    const banner = $('historicBanner');
    if (banner) {
        if (isCurrent) {
            banner.style.display = 'none';
        } else {
            banner.style.display = 'flex';
            banner.innerHTML = `⏳ Stai visualizzando la <strong>Giornata ${S.gn}</strong> — <button class="go-current-btn" id="goCurrentBtn">Vai alla corrente (G${S.giornate[S.giornate.length - 1]})</button>`;
            $('goCurrentBtn')?.addEventListener('click', () => load(S.giornate[S.giornate.length - 1]));
        }
    }

    const prevBtn = $('gnPrev');
    if (prevBtn) prevBtn.disabled = S.gn <= S.giornate[0];

    const nextBtn = $('gnNext');
    if (nextBtn) nextBtn.disabled = S.gn >= S.giornate[S.giornate.length - 1];

    document.querySelectorAll('.pk-btn').forEach(b => {
        b.classList.toggle('cur', +b.dataset.n === S.gn);
        // Mark the latest matchday in picker
        b.classList.toggle('latest', +b.dataset.n === S.giornate[S.giornate.length - 1]);
    });
}

function buildPicker() {
    const el = $('picker');
    if (!el) return;
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
    if (!el) return;
    const r = anchor.getBoundingClientRect();
    el.style.top = (r.bottom + 8) + 'px';
    el.style.left = Math.max(10, Math.min(window.innerWidth - 250, r.left - 80)) + 'px';
    el.classList.add('show');
    pickerOpen = true;
}
function closePicker() {
    const el = $('picker');
    if (el) el.classList.remove('show');
    pickerOpen = false;
}

// ── Count badges update ──────────────────────────────────────────────
function updateCounts() {
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

    // Ordinamento fisso di default: Ruolo (P → D → C → A), poi Quotazione (decrescente), poi Nome (A-Z)
    list.sort((a, b) => {
        const ra = ROLE_ORDER[a.ruolo] || 99;
        const rb = ROLE_ORDER[b.ruolo] || 99;
        if (ra !== rb) return ra - rb;

        const qa = a.quot || 0;
        const qb = b.quot || 0;
        if (qa !== qb) return qb - qa;

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

    let html = '';
    for (const p of list) {
        const isExpanded = S.expandedPlayerName === p.nome;
        const ownerHtml = renderPossesso(p.owners);
        const rowClass = isExpanded ? 'player-row active-expanded' : 'player-row';
        const quotVal = p.quot || 0;
        const sqText = p.sq ? p.sq : '—';
        const chevron = isExpanded ? '▾' : '▸';

        html += `<tr class="${rowClass}" data-role="${p.ruolo}" data-player-name="${p.nome}" aria-expanded="${isExpanded}" role="button" tabindex="0">
            <td class="col-role"><span class="rb rb-${(p.ruolo || '').toLowerCase()}">${p.ruolo || '?'}</span></td>
            <td class="col-nome"><span class="pname-text">${p.nome}</span></td>
            <td class="col-squadra">
                <span class="hide-sm sq-text">${sqText}</span>
                <span class="show-sm sq-badge">${getTeamAbbr(p.sq)}</span>
            </td>
            <td class="n col-quot"><span class="qt-badge">${quotVal} <small class="qt-unit">cr</small></span></td>
            <td class="col-possesso">${ownerHtml}</td>
            <td class="col-chevron"><span class="row-chevron">${chevron}</span></td>
        </tr>`;

        if (isExpanded) {
            html += renderExpandedRow(p);
        }
    }

    tbody.innerHTML = html;

    // Wire Click sulle righe per espandere/comprimere accordion inline
    tbody.querySelectorAll('tr.player-row[data-player-name]').forEach(tr => {
        tr.addEventListener('click', (e) => {
            e.stopPropagation();
            const pName = tr.dataset.playerName;
            S.expandedPlayerName = (S.expandedPlayerName === pName) ? null : pName;
            rGiocatori();
        });
    });

    const isFilteredGio = !!(S.fR_gio || S.fS_gio || S.fQ_gio);
    if ($('btnResetGio')) $('btnResetGio').style.display = isFilteredGio ? 'inline-flex' : 'none';
}

// ── Render Rose (Accordion per squadra, ordinate per classifica) ─────
function rRose() {
    const container = $('roseAccordion');
    const summaryEl = $('roseSummary');
    if (!container) return;

    // Build standings lookup { Fantasquadra: { pos, pts } }
    const standingsMap = {};
    for (const s of S.standings) {
        standingsMap[s.Fantasquadra] = { pos: s.Posizione, pts: s.Punti };
    }

    // Build cambi/crediti lookup
    const cambiMap = {};
    for (const c of S.cambi) {
        cambiMap[c.Fantasquadra] = { cambi: c.CambiRimasti, crediti: c.CreditiRimasti };
    }

    // Get all team names from rose
    const teamNames = Object.keys(S.roseAll);

    // Sort by standings: teams in classifica first (by position), then others alphabetically
    teamNames.sort((a, b) => {
        const sa = standingsMap[a];
        const sb = standingsMap[b];
        if (sa && sb) return sa.pos - sb.pos;
        if (sa) return -1;
        if (sb) return 1;
        return a.localeCompare(b);
    });

    // Summary bar
    if (summaryEl) {
        summaryEl.innerHTML = `<span class="rose-summary-text">📋 ${teamNames.length} squadre · Giornata ${S.gn}</span>`;
    }

    let html = '';
    for (const team of teamNames) {
        const players = S.roseAll[team] || [];
        const info = standingsMap[team];
        const ci = cambiMap[team];
        const pos = info ? info.pos : '—';
        const pts = info ? info.pts : '—';
        const cambiVal = ci ? ci.cambi : '—';
        const creditiVal = ci ? ci.crediti : '—';
        const isExpanded = S.expandedRoseTeam === team;


        // Total squad value (sum of Costo d'acquisto)
        const totalCosto = players.reduce((sum, p) => sum + (+p.Costo || 0), 0);

        // Total current quotazione
        let totalQta = 0;
        for (const p of players) {
            const rawName = (p.Calciatore || p.Nome || '').trim();
            const cleanName = rawName.replace(/\s*\*\s*$/, '');
            const qInfo = S.quotMap[cleanName.toLowerCase()];
            if (qInfo) {
                totalQta += qInfo.qta;
            } else {
                // Fuori lista: use purchase cost as value
                totalQta += (+p.Costo || 0);
            }
        }
        const totalDelta = totalQta - totalCosto;
        const deltaClass = totalDelta > 0 ? 'delta-pos' : (totalDelta < 0 ? 'delta-neg' : '');
        const deltaSign = totalDelta > 0 ? '+' : '';

        // Position badge class
        let posClass = 'rose-pos';
        if (pos === 1) posClass += ' rose-pos-1';
        else if (pos === 2) posClass += ' rose-pos-2';
        else if (pos === 3) posClass += ' rose-pos-3';

        html += `<div class="rose-card ${isExpanded ? 'rose-card-open' : ''}" data-team="${team}">
            <div class="rose-card-header" data-team="${team}" role="button" tabindex="0" aria-expanded="${isExpanded}">
                <div class="rose-header-left">
                    <span class="${posClass}">${pos}</span>
                    <span class="rose-team-name">⚽ ${team}</span>
                    <span class="rose-pts">${pts} <small>pt</small></span>
                </div>
                <div class="rose-header-right">
                    <span class="rose-total">Val. ${totalQta} <small>cr</small></span>
                    <span class="rose-chevron">${isExpanded ? '▾' : '▸'}</span>
                </div>
            </div>`;

        if (isExpanded) {
            // Sort players: by role order, then by quotazione desc
            const sortedPlayers = [...players].sort((a, b) => {
                const ra = ROLE_ORDER[a.Ruolo] || 99;
                const rb = ROLE_ORDER[b.Ruolo] || 99;
                if (ra !== rb) return ra - rb;
                const ca = +a.Costo || 0;
                const cb = +b.Costo || 0;
                return cb - ca;
            });

            html += `<div class="rose-card-body">
                <div class="rose-meta-row">
                    <span class="rose-meta-item">Costo rosa: <strong>${totalCosto} cr</strong></span>
                    <span class="rose-meta-item">Quotazione: <strong>${totalQta} cr</strong></span>
                    <span class="rose-meta-item ${deltaClass}">Δ: <strong>${deltaSign}${totalDelta} cr</strong></span>`;
            if (ci) {
                html += `
                    <span class="rose-meta-item">Cambi: <strong>${cambiVal}</strong></span>
                    <span class="rose-meta-item">Crediti: <strong>${creditiVal} cr</strong></span>`;
            }
            html += `
                </div>
                <table class="rose-table">
                    <thead><tr>
                        <th>R</th>
                        <th>Calciatore</th>
                        <th>Squadra</th>
                        <th class="n">Costo</th>
                        <th class="n">QtA</th>
                        <th class="n">Δ</th>
                    </tr></thead>
                    <tbody>`;

            for (const p of sortedPlayers) {
                const rawName = (p.Calciatore || p.Nome || '').trim();
                const isFuoriLista = isAsterisk(rawName);
                const pName = rawName.replace(/\s*\*\s*$/, '');
                const pKey = pName.toLowerCase();
                const qInfo = S.quotMap[pKey];
                const costo = +p.Costo || 0;
                const squadra = qInfo ? qInfo.sq : (p.Squadra || '—');
                const ruolo = p.Ruolo || '?';

                let qta, deltaHtml;
                if (qInfo) {
                    qta = qInfo.qta;
                    const d = qInfo.qta - costo;
                    const dc = d > 0 ? 'delta-pos' : (d < 0 ? 'delta-neg' : '');
                    const ds = d > 0 ? '+' : '';
                    deltaHtml = `<span class="${dc}">${ds}${d}</span>`;
                } else {
                    // Fuori lista or unknown: use purchase cost
                    qta = costo;
                    deltaHtml = '—';
                }

                const nameHtml = isFuoriLista
                    ? `<span class="rose-pname-fl">${pName} <span class="fl-tag">FL</span></span>`
                    : pName;

                html += `<tr class="${isFuoriLista ? 'rose-row-fl' : ''}">
                    <td><span class="rb rb-${ruolo.toLowerCase()}">${ruolo}</span></td>
                    <td class="rose-pname">${nameHtml}</td>
                    <td class="rose-sq">
                        <span class="hide-sm">${squadra}</span>
                        <span class="show-sm">${getTeamAbbr(squadra)}</span>
                    </td>
                    <td class="n">${costo} <small class="qt-unit">cr</small></td>
                    <td class="n">${qta} <small class="qt-unit">cr</small></td>
                    <td class="n">${deltaHtml}</td>
                </tr>`;
            }

            html += `</tbody></table></div>`;
        }

        html += `</div>`;
    }

    container.innerHTML = html;

    // Wire accordion click
    container.querySelectorAll('.rose-card-header').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const t = hdr.dataset.team;
            S.expandedRoseTeam = (S.expandedRoseTeam === t) ? null : t;
            rRose();
        });
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

    // Ordinamento fisso di default: Crediti residui (decrescente), Cambi rimasti (decrescente), Fantasquadra (A-Z)
    const sortedCambi = [...S.cambi].sort((a, b) => {
        const cra = +a.CreditiRimasti || 0;
        const crb = +b.CreditiRimasti || 0;
        if (cra !== crb) return crb - cra;

        const ca = +a.CambiRimasti || 0;
        const cb = +b.CambiRimasti || 0;
        if (ca !== cb) return cb - ca;

        return a.Fantasquadra.localeCompare(b.Fantasquadra);
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

        // Cambi bar color: green > 5, yellow 2-5, red < 2
        let cambiColor = 'cambi-green';
        if (cambiVal < 2) cambiColor = 'cambi-red';
        else if (cambiVal <= 5) cambiColor = 'cambi-yellow';

        return `<tr>
            <td class="col-fantasquadra"><span class="fsq-name">⚽ ${r.Fantasquadra}</span></td>
            <td class="n col-cambi">
                <div class="cambi-bar-wrap">
                    <span class="cambi-val">${cambiVal}</span>
                    <div class="cambi-track ${cambiColor}" title="${cambiVal} cambi rimasti"><div class="cambi-fill" style="width:${fillPct}%"></div></div>
                </div>
            </td>
            <td class="n col-crediti">${credHtml}</td>
        </tr>`;
    }).join('');
}

// ── Render All ───────────────────────────────────────────────────────
function render() {
    rGiocatori();
    rRose();
    rMercato();
}

// ── Events Setup ─────────────────────────────────────────────────────
function setup() {
    // Keyboard Shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (S.expandedPlayerName) {
                S.expandedPlayerName = null;
                rGiocatori();
            }
            return;
        }
        if (e.target.matches('input, textarea')) return;

        if (e.key === '/') {
            e.preventDefault();
            const qInput = $('qGio');
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
        })
    );

    // Giornata Navigator
    $('gnPrev')?.addEventListener('click', () => {
        const i = S.giornate.indexOf(S.gn);
        if (i > 0) load(S.giornate[i - 1]);
    });
    $('gnNext')?.addEventListener('click', () => {
        const i = S.giornate.indexOf(S.gn);
        if (i < S.giornate.length - 1) load(S.giornate[i + 1]);
    });
    $('gnLabel')?.addEventListener('click', e => {
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

    // Database Giocatori — Reset filtri
    $('btnResetGio')?.addEventListener('click', () => {
        S.fR_gio = '';
        S.fS_gio = '';
        S.fQ_gio = '';
        if ($('qGio')) $('qGio').value = '';
        if ($('searchClearGio')) $('searchClearGio').style.display = 'none';
        document.querySelectorAll('.pill-gio-r').forEach(x => x.classList.toggle('on', x.dataset.r === ''));
        document.querySelectorAll('.pill-gio-s').forEach(x => x.classList.toggle('on', x.dataset.st === ''));
        rGiocatori();
    });
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
