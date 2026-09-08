/* Fantanucleo 26/27 — app.js */

const S = {
    gn: null,
    giornate: [],
    standings: [],   // classifica generale ordinata
    rose: {},        // { fantasquadra: [giocatori] }
    sv: [],
    cambi: [],
    quotMap: {},     // { nome_calciatore: { qta, qti, diff } }
    fR: '',
    fQ: '',
    sCol: 'FVM',
    sDir: 'desc'
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
            diff: +q.Diff || 0
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
    const counts = { '': S.sv.length, P: 0, D: 0, C: 0, A: 0 };
    for (const item of S.sv) {
        if (counts[item.Ruolo] !== undefined) counts[item.Ruolo]++;
    }

    if ($('cnt-all')) $('cnt-all').textContent = `(${counts['']})`;
    if ($('cnt-p')) $('cnt-p').textContent = `(${counts.P})`;
    if ($('cnt-d')) $('cnt-d').textContent = `(${counts.D})`;
    if ($('cnt-c')) $('cnt-c').textContent = `(${counts.C})`;
    if ($('cnt-a')) $('cnt-a').textContent = `(${counts.A})`;
}

// ── Render Rose (con quotazioni attuali per calciatore) ───────────────
function posC(p) { return p === 1 ? 'g' : p === 2 ? 's' : p === 3 ? 'b' : ''; }

const ROLE_NAMES = {
    P: 'Portieri',
    D: 'Difensori',
    C: 'Centrocampisti',
    A: 'Attaccanti'
};

function getPlayerVal(p) {
    if (S.gn === 1) {
        return +p.Costo || 0;
    }
    const key = (p.Calciatore || '').replace(/\*/g, '').trim().toLowerCase();
    return S.quotMap[key]?.qta ?? (+p.Costo || 0);
}

function rRose() {
    const defs = ['P', 'D', 'C', 'A'];

    const html = S.standings.map(team => {
        const pos = team.Posizione;
        const name = team.Fantasquadra;
        const pts = team.Punti;
        const players = S.rose[name] || [];
        const byRole = { P: [], D: [], C: [], A: [] };
        let teamTotalVal = 0;

        for (const p of players) {
            byRole[p.Ruolo]?.push(p);
            teamTotalVal += getPlayerVal(p);
        }

        const rolesHtml = defs.map(k => {
            const list = [...(byRole[k] || [])];

            // Ordina dal valore in cr più alto a quello più basso
            list.sort((a, b) => getPlayerVal(b) - getPlayerVal(a));

            const chips = list
                .map(p => {
                    const val = getPlayerVal(p);
                    const qHtml = `<span class="ac-qt">${val} cr</span>`;
                    return `<span class="ac-player">
                        <span class="ac-pname">${p.Calciatore}</span>
                        ${qHtml}
                    </span>`;
                })
                .join('');

            return `<div class="ac-role">
                <div class="ac-role-header">
                    <div class="ac-role-badge ${k.toLowerCase()}">${k}</div>
                    <span class="ac-role-title">${ROLE_NAMES[k]} (${list.length})</span>
                </div>
                <div class="ac-players">${chips || '<span style="color:var(--tx3);font-size:12px;">Nessuno</span>'}</div>
            </div>`;
        }).join('');

        const rankClass = pos === 1 ? 'rank-1' : pos === 2 ? 'rank-2' : pos === 3 ? 'rank-3' : '';
        const teamValHtml = teamTotalVal > 0 ? `<div class="ac-val-tag" title="Valore totale rosa">${teamTotalVal} cr</div>` : '';

        return `<div class="ac-item ${rankClass}">
            <button class="ac-trigger" data-team="${name}">
                <div class="ac-pos ${posC(pos)}">${pos}</div>
                <div class="ac-name">${name}</div>
                ${teamValHtml}
                <div class="ac-pts">${pts} pt</div>
                <span class="ac-arrow">⌄</span>
            </button>
            <div class="ac-body">
                <div class="ac-inner">
                    <div class="ac-roles">${rolesHtml}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    $('accordion').innerHTML = html;

    // Toggle click logic
    $('accordion').querySelectorAll('.ac-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            const body = btn.nextElementSibling;
            const isOpen = btn.classList.contains('open');

            if (isOpen) {
                btn.classList.remove('open');
                body.classList.remove('open');
            } else {
                btn.classList.add('open');
                body.classList.add('open');
                setTimeout(() => btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
            }
        });
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

    $('cnt').textContent = `${d.length} calciatori`;

    const emptyEl = $('svEmpty');
    if (d.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        document.querySelector('#tSv tbody').innerHTML = '';
        return;
    } else if (emptyEl) {
        emptyEl.style.display = 'none';
    }

    document.querySelector('#tSv tbody').innerHTML = d.map(r => `<tr>
        <td><span class="rb rb-${r.Ruolo.toLowerCase()}">${r.Ruolo}</span></td>
        <td style="font-weight:600">${r.Nome}</td>
        <td class="hide-sm" style="color:var(--tx2)">${r.Squadra}</td>
        <td class="n fvm-val">${r.FVM}</td>
        <td class="n">${r.FM || '—'}</td>
        <td class="n hide-sm">${r.MV || '—'}</td>
        <td class="n hide-sm">${r.PG}</td>
        <td class="n"><span class="qt">${r.Quotazione}</span></td>
    </tr>`).join('');

    // Indicatori frecce ordini header
    document.querySelectorAll('#tSv th[data-s]').forEach(th => {
        th.classList.remove('sa', 'sd');
        const col = th.dataset.s;
        let label = th.textContent.replace(/[ ⇕↑↓]/g, '');
        if (col === S.sCol) {
            th.classList.add(S.sDir === 'asc' ? 'sa' : 'sd');
            th.innerHTML = `${label} ${S.sDir === 'asc' ? '↑' : '↓'}`;
        } else {
            th.innerHTML = `${label} ⇕`;
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

    // Ordina i cambi secondo la classifica attuale
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
    rRose();
    rSv();
    rMercato();
}

// ── Global Search ───────────────────────────────────────────────────
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

        let playerMap = {};

        // Helper per cercare o registrare calciatore
        function getOrAdd(rawName, sq, ruolo) {
            const cleanName = (rawName || '').replace(/\*/g, '').trim();
            if (!cleanName) return null;
            const key = cleanName.toLowerCase();
            const qInfo = S.quotMap[key] || {};

            if (!playerMap[key]) {
                playerMap[key] = {
                    nome: cleanName,
                    sq: sq || qInfo.sq || '',
                    ruolo: ruolo || qInfo.ruolo || '',
                    owners: [],
                    isSvincolato: false
                };
            }
            return playerMap[key];
        }

        // Cerca in rose
        for (const [fsq, giocatori] of Object.entries(S.rose)) {
            for (const g of giocatori) {
                const pName = g.Calciatore || g.Nome || '';
                if (pName.toLowerCase().includes(q)) {
                    const item = getOrAdd(pName, g.Squadra, g.Ruolo);
                    if (item && !item.owners.includes(fsq)) {
                        item.owners.push(fsq);
                    }
                }
            }
        }

        // Cerca in svincolati
        for (const sv of S.sv) {
            const pName = sv.Nome || sv.Calciatore || '';
            if (pName.toLowerCase().includes(q)) {
                const item = getOrAdd(pName, sv.Squadra, sv.Ruolo);
                if (item) item.isSvincolato = true;
            }
        }

        let matches = Object.values(playerMap);
        matches.sort((a, b) => a.nome.localeCompare(b.nome));

        if (matches.length === 0) {
            res.innerHTML = '<div style="padding:10px; color:var(--tx3); text-align:center;">Nessun giocatore trovato.</div>';
            return;
        }

        res.innerHTML = matches.map(m => {
            const rCol = { P: '#fbbf24', D: '#4ade80', C: '#38bdf8', A: '#f87171' }[m.ruolo] || '#fff';
            const rBg = { P: 'rgba(251,191,36,0.15)', D: 'rgba(74,222,128,0.15)', C: 'rgba(56,189,248,0.15)', A: 'rgba(248,113,113,0.15)' }[m.ruolo] || 'rgba(255,255,255,0.1)';
            
            let badges = '';
            if (m.isSvincolato && m.owners.length === 0) {
                badges = `<span class="gs-owner svinc">Svincolato</span>`;
            } else {
                badges = m.owners.map(o => `<span class="gs-owner rosa">${o}</span>`).join('');
                if (m.isSvincolato) badges += `<span class="gs-owner svinc">Svincolato</span>`;
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

    // Expand / Collapse all rose
    $('btnExpandAll')?.addEventListener('click', () => {
        $('accordion').querySelectorAll('.ac-trigger').forEach(b => b.classList.add('open'));
        $('accordion').querySelectorAll('.ac-body').forEach(b => b.classList.add('open'));
    });

    $('btnCollapseAll')?.addEventListener('click', () => {
        $('accordion').querySelectorAll('.ac-trigger').forEach(b => b.classList.remove('open'));
        $('accordion').querySelectorAll('.ac-body').forEach(b => b.classList.remove('open'));
    });

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

    // Svincolati — Ricerca
    const searchInput = $('q');
    const clearBtn = $('searchClear');

    searchInput.addEventListener('input', e => {
        S.fQ = e.target.value.toLowerCase().trim();
        if (clearBtn) clearBtn.style.display = S.fQ ? 'block' : 'none';
        rSv();
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            S.fQ = '';
            clearBtn.style.display = 'none';
            rSv();
            searchInput.focus();
        });
    }

    // Svincolati — Pills filtro ruolo
    document.querySelectorAll('.pill').forEach(p =>
        p.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(x => x.classList.remove('on'));
            p.classList.add('on');
            S.fR = p.dataset.r;
            rSv();
        })
    );

    // Svincolati — Sort colonne
    document.querySelectorAll('#tSv th[data-s]').forEach(th =>
        th.addEventListener('click', () => {
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
