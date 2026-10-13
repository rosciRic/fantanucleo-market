/* Fantanucleo 26/27 — app.js (Architettura Semplificata JSON-First) */

const S = {
    gn: null,
    giornate: [],
    standings: [],
    rose: {},
    cambi: [],
    dbGiocatori: [],
    counts: {},

    // Filtri Database Giocatori
    fR_gio: '',
    fS_gio: '',
    fQ_gio: '',
    sortGio: 'default',

    // Stato righe espanse (Accordion inline)
    expandedPlayerName: null,
    expandedRoseTeam: null
};

const $ = id => document.getElementById(id);
const ROLE_ORDER = { P: 1, D: 2, C: 3, A: 4 };

// Abbreviazioni Squadre Serie A per Mobile
const TEAM_ABBR = {
    'Atalanta': 'ATA', 'Bologna': 'BOL', 'Cagliari': 'CAG', 'Como': 'COM',
    'Empoli': 'EMP', 'Fiorentina': 'FIO', 'Genoa': 'GEN', 'Inter': 'INT',
    'Juventus': 'JUV', 'Lazio': 'LAZ', 'Lecce': 'LEC', 'Milan': 'MIL',
    'Monza': 'MON', 'Napoli': 'NAP', 'Parma': 'PAR', 'Roma': 'ROM',
    'Torino': 'TOR', 'Udinese': 'UDI', 'Venezia': 'VEN', 'Verona': 'VER'
};

function getTeamAbbr(sq) {
    if (!sq || sq === '—') return '—';
    return TEAM_ABBR[sq] || sq.slice(0, 3).toUpperCase();
}

function debounce(fn, delay = 120) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ── COMPONENTE POSSESSO (3 Stati compatti) ───────────────────────────
function renderPossesso(owners = []) {
    const count = owners.length;
    if (count === 0) {
        return `<span class="pos-status free"><span class="pos-dot">🟢</span> Libero</span>`;
    }
    if (count === 1) {
        return `<span class="pos-status single"><span class="pos-team">${owners[0]}</span></span>`;
    }
    return `<span class="pos-status multi"><span class="pos-team">${owners[0]} <small class="pos-badge">+${count - 1}</small></span></span>`;
}

// ── RENDER ACCORDION DETTAGLIO CALCIATORE INLINE ──────────────────────
function renderExpandedRow(p) {
    const count = p.owners ? p.owners.length : 0;
    const isFree = count === 0;

    if (isFree) {
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
        const ownersHtml = p.owners.map(team => `<div class="pm-owner-chip">⚽ ${team}</div>`).join('');
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
                            <span class="pm-stat-lbl">Partite (PG)</span>
                            <span class="pm-stat-val">${p.pg !== undefined && p.pg !== null ? p.pg : '—'}</span>
                        </div>
                        <div class="pm-stat">
                            <span class="pm-stat-lbl">Possessori</span>
                            <span class="pm-stat-val">${count} fantasquadre</span>
                        </div>
                        <div class="pm-stat">
                            <span class="pm-stat-lbl">Stato</span>
                            <span class="pm-stat-val">In Rosa</span>
                        </div>
                    </div>
                    <div class="pm-owners-section">
                        <div class="pm-section-title">Fantasquadre proprietarie (${count}):</div>
                        <div class="pm-owners-list">${ownersHtml}</div>
                    </div>
                </div>
            </td>
        </tr>`;
    }
}

// ── CARICAMENTO DATI GIORNATA (Singolo JSON) ──────────────────────────
async function load(n) {
    S.gn = n;
    S.expandedPlayerName = null;
    updateNav();

    try {
        const res = await fetch(`giornata_${n}/data_${n}.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        S.standings = data.standings || [];
        S.cambi = data.cambi || [];
        S.rose = data.rose || {};
        S.dbGiocatori = data.giocatori || [];
        S.counts = data.counts || {};

        updateCounts();
        render();
    } catch (err) {
        console.error(`Errore caricamento Giornata ${n}:`, err);
    }
}

// ── NAVIGATORE GIORNATE & PICKER ─────────────────────────────────────
function updateNav() {
    const cur = S.giornate[S.giornate.length - 1];
    const isCur = S.gn === cur;
    const isFirst = S.gn === S.giornate[0];
    const isLast = S.gn === cur;

    const label = $('gnLabel');
    if (label) {
        label.innerHTML = `G${S.gn} ${isCur ? '<span class="gn-cur-badge">●</span>' : ''}<span class="gn-arrow">▾</span>`;
        if (isCur) {
            label.classList.remove('gn-historic');
        } else {
            label.classList.add('gn-historic');
        }
    }

    const prev = $('gnPrev');
    const next = $('gnNext');
    if (prev) prev.disabled = isFirst;
    if (next) next.disabled = isLast;

    document.querySelectorAll('.pk-btn').forEach(b => {
        b.classList.toggle('cur', +b.dataset.n === S.gn);
        b.classList.toggle('latest', +b.dataset.n === cur);
    });

    const banner = $('historicBanner');
    if (banner) {
        if (!isCur) {
            banner.style.display = 'flex';
            banner.innerHTML = `⏳ Stai visualizzando la <strong>Giornata ${S.gn}</strong> — <button class="go-current-btn" id="goCurrentBtn">Vai alla corrente (G${cur})</button>`;
            $('goCurrentBtn')?.addEventListener('click', () => load(cur));
        } else {
            banner.style.display = 'none';
        }
    }
}

function buildPicker() {
    const el = $('picker');
    if (!el) return;
    const cur = S.giornate[S.giornate.length - 1];
    el.innerHTML = S.giornate.map(n => {
        const isCurrent = n === cur;
        const isSelected = n === S.gn;
        let cls = 'pk-btn';
        if (isSelected) cls += ' cur';
        if (isCurrent) cls += ' latest';
        return `<button class="${cls}" data-n="${n}">G${n}</button>`;
    }).join('');

    el.querySelectorAll('.pk-btn').forEach(b => {
        b.addEventListener('click', () => {
            load(+b.dataset.n);
            closePicker();
        });
    });
}

let pickerOpen = false;
function openPicker(anchor) {
    const el = $('picker');
    if (!el) return;
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    
    el.classList.add('show');
    pickerOpen = true;

    // Calculate dimensions safely
    const pickerWidth = el.offsetWidth || 280;
    const rightMargin = Math.max(10, vw - r.right);

    // If aligning to right edge pushes picker off the left screen edge, anchor to left
    if (vw - rightMargin - pickerWidth < 10) {
        el.style.left = '10px';
        el.style.right = 'auto';
    } else {
        el.style.left = 'auto';
        el.style.right = `${rightMargin}px`;
    }
    el.style.top = `${Math.round(r.bottom + 6)}px`;
}

function closePicker() {
    $('picker')?.classList.remove('show');
    pickerOpen = false;
}

function updateCounts() {
    const c = S.counts || {};
    if ($('cnt-gio-all')) $('cnt-gio-all').textContent = `(${c[''] ?? S.dbGiocatori.length})`;
    if ($('cnt-gio-p')) $('cnt-gio-p').textContent = `(${c.P ?? 0})`;
    if ($('cnt-gio-d')) $('cnt-gio-d').textContent = `(${c.D ?? 0})`;
    if ($('cnt-gio-c')) $('cnt-gio-c').textContent = `(${c.C ?? 0})`;
    if ($('cnt-gio-a')) $('cnt-gio-a').textContent = `(${c.A ?? 0})`;
}

// ── RENDER GIOCATORI & POSSESSO ──────────────────────────────────────
function rGiocatori() {
    let list = [...S.dbGiocatori];

    // Filtro Ruolo
    if (S.fR_gio) {
        list = list.filter(p => (p.ruolo || '').toUpperCase() === S.fR_gio);
    }

    // Filtro Stato Possesso
    if (S.fS_gio === 'svincolato') {
        list = list.filter(p => p.isSvincolato || !p.owners || p.owners.length === 0);
    } else if (S.fS_gio === 'posseduto') {
        list = list.filter(p => p.owners && p.owners.length > 0);
    }

    // Filtro Ricerca
    if (S.fQ_gio) {
        const q = S.fQ_gio;
        list = list.filter(p =>
            (p.nome || '').toLowerCase().includes(q) ||
            (p.sq || '').toLowerCase().includes(q)
        );
    }

    // Ordinamento Dinamico
    list.sort((a, b) => {
        if (S.sortGio === 'quot_desc') {
            const qa = a.quot || 0;
            const qb = b.quot || 0;
            if (qa !== qb) return qb - qa;
            return a.nome.localeCompare(b.nome);
        }
        if (S.sortGio === 'nome_asc') {
            return a.nome.localeCompare(b.nome);
        }
        // Default: Ruolo (P → D → C → A), poi Quotazione ↓, poi Nome A-Z
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
        const isOwned = p.owners && p.owners.length > 0;
        const qtClass = isOwned ? 'qt-badge qt-owned' : 'qt-badge';
        const unitClass = isOwned ? 'qt-unit qt-unit-owned' : 'qt-unit';

        html += `<tr class="${rowClass}" data-role="${p.ruolo}" data-player-name="${p.nome}" aria-expanded="${isExpanded}" role="button" tabindex="0">
            <td class="col-role"><span class="rb rb-${(p.ruolo || '').toLowerCase()}">${p.ruolo || '?'}</span></td>
            <td class="col-nome"><span class="pname-text">${p.nome}</span></td>
            <td class="col-squadra">
                <span class="hide-sm sq-text">${sqText}</span>
                <span class="show-sm sq-badge">${getTeamAbbr(p.sq)}</span>
            </td>
            <td class="n col-quot"><span class="${qtClass}">${quotVal} <small class="${unitClass}">cr</small></span></td>
            <td class="col-possesso">${ownerHtml}</td>
            <td class="col-chevron"><span class="row-chevron">${chevron}</span></td>
        </tr>`;

        if (isExpanded) {
            html += renderExpandedRow(p);
        }
    }

    tbody.innerHTML = html;

    // Toggle accordion inline al click
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

// ── RENDER ROSE (Accordion Tattico per Reparto) ──────────────────────
function rRose() {
    const container = $('roseAccordion');
    const summaryEl = $('roseSummary');
    if (!container) return;

    const standingsMap = {};
    for (const s of S.standings) {
        standingsMap[s.team] = { pos: s.pos, pts: s.pts };
    }

    const cambiMap = {};
    for (const c of S.cambi) {
        cambiMap[c.team] = { cambi: c.cambi, crediti: c.crediti };
    }

    const teamNames = Object.keys(S.rose);
    teamNames.sort((a, b) => {
        const sa = standingsMap[a];
        const sb = standingsMap[b];
        if (sa && sb) return sa.pos - sb.pos;
        if (sa) return -1;
        if (sb) return 1;
        return a.localeCompare(b);
    });

    if (summaryEl) {
        summaryEl.innerHTML = `<span class="rose-summary-text">📋 ${teamNames.length} squadre · Giornata ${S.gn}</span>`;
    }

    const DEPTS = [
        { role: 'P', name: 'Portieri', emoji: '🧤', cls: 'dept-p' },
        { role: 'D', name: 'Difensori', emoji: '🛡️', cls: 'dept-d' },
        { role: 'C', name: 'Centrocampisti', emoji: '⚙️', cls: 'dept-c' },
        { role: 'A', name: 'Attaccanti', emoji: '⚡', cls: 'dept-a' }
    ];

    let html = '';
    for (const team of teamNames) {
        const players = S.rose[team] || [];
        const info = standingsMap[team];
        const ci = cambiMap[team];
        const pos = info ? info.pos : '—';
        const pts = info ? info.pts : '—';
        const cambiVal = ci ? ci.cambi : '—';
        const creditiVal = ci ? ci.crediti : '—';
        const isExpanded = S.expandedRoseTeam === team;

        let totalQta = 0;
        for (const p of players) {
            totalQta += (p.qta || p.costo || 0);
        }

        let posClass = 'rose-pos';
        if (pos === 1) posClass += ' rose-pos-1';
        else if (pos === 2) posClass += ' rose-pos-2';
        else if (pos === 3) posClass += ' rose-pos-3';

        html += `<div class="rose-card ${isExpanded ? 'rose-card-open' : ''}" data-team="${team}">
            <div class="rose-card-header" data-team="${team}" role="button" tabindex="0" aria-expanded="${isExpanded}">
                <div class="rose-header-left">
                    <span class="${posClass}">${pos}</span>
                    <span class="rose-team-name">${team}</span>
                    <span class="rose-badge-count">${players.length}</span>
                </div>
                <div class="rose-header-right">
                    <span class="rose-pts">${totalQta} <small>cr</small> · ${pts} <small>pt</small></span>
                    <span class="rose-chevron">${isExpanded ? '▾' : '▸'}</span>
                </div>
            </div>`;

        if (isExpanded) {
            html += `<div class="rose-card-body">
                <div class="rose-meta-row">
                    <span class="rose-meta-item">Valore rosa: <strong>${totalQta} cr</strong></span>`;
            if (pts !== '—') html += `<span class="rose-meta-item">Punti in classifica: <strong>${pts} pt</strong></span>`;
            if (cambiVal !== '—') {
                html += `<span class="rose-meta-item">Cambi: <strong>${cambiVal}</strong></span>
                    <span class="rose-meta-item">Crediti: <strong>${creditiVal} cr</strong></span>`;
            }
            html += `</div>`;

            for (const dept of DEPTS) {
                const deptPlayers = players.filter(p => (p.ruolo || '').toUpperCase() === dept.role);
                if (deptPlayers.length === 0) continue;

                deptPlayers.sort((a, b) => {
                    const qa = a.qta || a.costo || 0;
                    const qb = b.qta || b.costo || 0;
                    if (qa !== qb) return qb - qa;
                    return a.nome.localeCompare(b.nome);
                });

                html += `<div class="rose-dept-section">
                    <div class="rose-dept-header ${dept.cls}">
                        <span class="rose-dept-title">${dept.emoji} ${dept.name}</span>
                        <span class="rose-dept-count">${deptPlayers.length}</span>
                    </div>
                    <table class="rose-table">
                        <thead><tr>
                            <th>R</th>
                            <th>Calciatore</th>
                            <th>Squadra</th>
                            <th class="n">Valore</th>
                        </tr></thead>
                        <tbody>`;

                for (const p of deptPlayers) {
                    const isFuoriLista = p.fl;
                    const squadra = p.sq || '—';
                    const ruolo = p.ruolo || '?';
                    const qta = p.qta || p.costo || 0;

                    const nameHtml = isFuoriLista
                        ? `<span class="rose-pname-fl">${p.nome} <span class="fl-tag">FL</span></span>`
                        : p.nome;

                    html += `<tr class="${isFuoriLista ? 'rose-row-fl' : ''}">
                        <td><span class="rb rb-${ruolo.toLowerCase()}">${ruolo}</span></td>
                        <td class="rose-pname">${nameHtml}</td>
                        <td class="rose-sq">
                            <span class="hide-sm">${squadra}</span>
                            <span class="show-sm">${getTeamAbbr(squadra)}</span>
                        </td>
                        <td class="n">${qta} <small class="qt-unit">cr</small></td>
                    </tr>`;
                }

                html += `</tbody></table></div>`;
            }

            html += `</div>`;
        }

        html += `</div>`;
    }

    container.innerHTML = html;

    // Toggle squadra accordion al click
    container.querySelectorAll('.rose-card-header[data-team]').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const team = hdr.dataset.team;
            S.expandedRoseTeam = (S.expandedRoseTeam === team) ? null : team;
            rRose();
        });
    });
}

// ── RENDER MERCATO (Cambi & Crediti) ─────────────────────────────────
function rMercato() {
    if (!S.cambi || !S.cambi.length) return;

    const extraNote = S.cambi.find(c => c.extra && c.extra.trim())?.extra;
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

    const sortedCambi = [...S.cambi].sort((a, b) => {
        const cra = +a.crediti || 0;
        const crb = +b.crediti || 0;
        if (cra !== crb) return crb - cra;

        const ca = +a.cambi || 0;
        const cb = +b.cambi || 0;
        if (ca !== cb) return cb - ca;

        return a.team.localeCompare(b.team);
    });

    const tbody = document.querySelector('#tCambi tbody');
    if (!tbody) return;

    tbody.innerHTML = sortedCambi.map(r => {
        const cred = r.crediti;
        const credHtml = cred > 0
            ? `<span class="cred-tag pos">+${cred} cr</span>`
            : `<span class="cred-tag zero">0 cr</span>`;

        const cambiVal = r.cambi;
        const fillPct = Math.min(100, (cambiVal / 10) * 100);

        let cambiColor = 'cambi-green';
        if (cambiVal < 2) cambiColor = 'cambi-red';
        else if (cambiVal <= 5) cambiColor = 'cambi-yellow';

        return `<tr>
            <td class="col-fantasquadra"><span class="fsq-name">⚽ ${r.team}</span></td>
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

function render() {
    rGiocatori();
    rRose();
    rMercato();
}

// ── SETUP EVENT LISTENERS & INIZIALIZZAZIONE ─────────────────────────
function setup() {
    // Tabs Navigation
    document.querySelectorAll('.tabs .t').forEach(b =>
        b.addEventListener('click', () => {
            document.querySelectorAll('.tabs .t').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.v').forEach(x => x.classList.remove('on'));
            b.classList.add('active');
            $(`v-${b.dataset.v}`)?.classList.add('on');
        })
    );

    // Database Giocatori — Filtri Ruolo
    document.querySelectorAll('.pill-gio-r').forEach(btn =>
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pill-gio-r').forEach(x => x.classList.remove('on'));
            btn.classList.add('on');
            S.fR_gio = btn.dataset.r;
            rGiocatori();
        })
    );

    // Database Giocatori — Filtri Stato Possesso
    document.querySelectorAll('.pill-gio-s').forEach(btn =>
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pill-gio-s').forEach(x => x.classList.remove('on'));
            btn.classList.add('on');
            S.fS_gio = btn.dataset.st;
            rGiocatori();
        })
    );

    // Database Giocatori — Ricerca Instantanea
    const searchInput = $('qGio');
    const searchClear = $('searchClearGio');

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            S.fQ_gio = searchInput.value.trim().toLowerCase();
            if (searchClear) searchClear.style.display = S.fQ_gio ? 'block' : 'none';
            rGiocatori();
        }, 100));
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchClear.style.display = 'none';
            S.fQ_gio = '';
            rGiocatori();
        });
    }

    // Database Giocatori — Ordinamento Desktop Pills
    document.querySelectorAll('.pill-sort').forEach(btn =>
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pill-sort').forEach(x => x.classList.remove('on'));
            btn.classList.add('on');
            S.sortGio = btn.dataset.sort;
            if ($('sortSelectMobile')) $('sortSelectMobile').value = btn.dataset.sort;
            rGiocatori();
        })
    );

    // Database Giocatori — Ordinamento Mobile Select
    const sortSelectMobile = $('sortSelectMobile');
    if (sortSelectMobile) {
        sortSelectMobile.addEventListener('change', () => {
            S.sortGio = sortSelectMobile.value;
            document.querySelectorAll('.pill-sort').forEach(x =>
                x.classList.toggle('on', x.dataset.sort === S.sortGio)
            );
            rGiocatori();
        });
    }

    // Pulsante Flottante Torna Su
    const backToTopBtn = $('btnBackToTop');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 280) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }, { passive: true });
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Database Giocatori — Reset Filtri
    $('btnResetGio')?.addEventListener('click', () => {
        S.fR_gio = '';
        S.fS_gio = '';
        S.fQ_gio = '';
        S.sortGio = 'default';
        if (searchInput) searchInput.value = '';
        if (searchClear) searchClear.style.display = 'none';
        if (sortSelectMobile) sortSelectMobile.value = 'default';
        document.querySelectorAll('.pill-gio-r').forEach(x => x.classList.toggle('on', x.dataset.r === ''));
        document.querySelectorAll('.pill-gio-s').forEach(x => x.classList.toggle('on', x.dataset.st === ''));
        document.querySelectorAll('.pill-sort').forEach(x => x.classList.toggle('on', x.dataset.sort === 'default'));
        rGiocatori();
    });

    // Selettore Giornate Nav
    const lbl = $('gnLabel');
    if (lbl) {
        lbl.addEventListener('click', e => {
            e.stopPropagation();
            if (pickerOpen) closePicker();
            else openPicker(lbl);
        });
    }

    $('gnPrev')?.addEventListener('click', () => {
        const i = S.giornate.indexOf(S.gn);
        if (i > 0) load(S.giornate[i - 1]);
    });

    $('gnNext')?.addEventListener('click', () => {
        const i = S.giornate.indexOf(S.gn);
        if (i < S.giornate.length - 1) load(S.giornate[i + 1]);
    });

    document.addEventListener('click', e => {
        if (pickerOpen && !$('picker')?.contains(e.target) && !$('gnLabel')?.contains(e.target)) {
            closePicker();
        }
    });
}

// Inizializzazione Applicazione
async function init() {
    setup();

    try {
        const r = await fetch('manifest.json?t=' + Date.now(), { cache: 'no-store' });
        const m = await r.json();
        const giornate = (m.giornate || []).sort((a, b) => a - b);
        if (!giornate.length) return;
        S.giornate = giornate;
        buildPicker();
        await load(giornate[giornate.length - 1]);
    } catch (e) {
        console.error('Errore inizializzazione:', e);
    }
}

document.addEventListener('DOMContentLoaded', init);
