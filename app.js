'use strict';
const $ = id => document.getElementById(id);
const roles = {P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti'};
const order = {P: 0, D: 1, C: 2, A: 3};
const fmt = new Intl.NumberFormat('it-IT', {maximumFractionDigits: 2});
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => typeof value === 'number' && Number.isFinite(value) ? fmt.format(value) : esc(value || '—');
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it');
const state = {data: null, days: [], version: '', versions: {}, rendered: new Map(), cache: new Map(), view: 'players', role: '', ownership: '', request: 0, controller: null, target: null};
function roleBadge(role) { return `<span class="role role-${esc(role)}" title="${esc(roles[role] || role)}">${esc(role)}</span>`; }
function feedback(message, error = false) {
    $('feedback').textContent = message;
    $('feedback').classList.toggle('error', error);
    $('retry').hidden = !error;
}
async function json(url, signal, cache = 'no-cache') {
    const response = await fetch(url, {signal, cache});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}
function validate(data, day) {
    if (data.giornata !== day || !Array.isArray(data.giocatori) || !Array.isArray(data.standings) || !Array.isArray(data.cambi) || !data.rose) throw new Error('Formato dati non valido');
    if (data.cambi.some(t => !Number.isFinite(t.cambi) || !Number.isFinite(t.crediti))) throw new Error('Cambi o crediti non validi');
    if (data.giocatori.some(p => typeof p.nome !== 'string' || !Array.isArray(p.owners) || !(p.ruolo in roles))) throw new Error('Elenco giocatori non valido');
}
async function load(day) {
    state.target = day;
    $('current-day').textContent = day;
    document.querySelectorAll('[data-day]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.day) === day)));
    const request = ++state.request;
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    $('content').setAttribute('aria-busy', 'true');
    $('content').hidden = true;
    feedback(`Caricamento giornata ${day}…`);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        let data = state.cache.get(day);
        if (!data) {
            const version = state.versions[day] || state.version;
            data = await json(`giornata_${day}/data_${day}.json?v=${encodeURIComponent(version)}`, controller.signal, 'force-cache');
            validate(data, day);
            data.giocatori.sort((a,b) => order[a.ruolo] - order[b.ruolo] || b.quot - a.quot || a.nome.localeCompare(b.nome, 'it'));
            data.giocatori.forEach((p, index) => {
                p.index = index;
                p.search = normalize([p.nome, p.sq, ...p.owners].join(' '));
            });
            state.cache.set(day, data);
            if (state.cache.size > 3) state.cache.delete(state.cache.keys().next().value);
        }
        if (request !== state.request) return;
        state.data = data;
        $('edition').textContent = `Giornata ${day} · ${day === state.days.at(-1) ? 'Ultimi dati disponibili' : 'Archivio storico'}`;
        render();
        feedback();
        $('content').hidden = false;
    } catch (error) {
        if (request !== state.request) return;
        feedback(`Giornata ${day} non caricata. Controlla la connessione e riprova.`, true);
        console.error(error);
    } finally {
        clearTimeout(timeout);
        if (request === state.request) $('content').setAttribute('aria-busy', 'false');
    }
}
function playerCard(p) {
    const owners = p.owners;
    const ownership = owners.length
        ? `<span class="owner-name">${esc(owners[0])}</span>${owners.length > 1 ? ` <span class="owner-more" title="Apri per vedere le altre ${owners.length - 1} fantasquadre">+${owners.length - 1}</span>` : ''}`
        : '<span class="free">Svincolato</span>';
    return `<details class="player" data-player="${p.index}">
        <summary>
            <span class="identity">${roleBadge(p.ruolo)}<span><strong>${esc(p.nome)}</strong><small>${esc(p.sq || 'Squadra non disponibile')}</small></span></span>
            <span class="value">${num(p.quot)} <small>cr</small></span>
            <span class="owner">${ownership}</span>
            <span class="chevron" aria-hidden="true">⌄</span>
        </summary>
    </details>`;
}
function playerDetails(p) {
    const owners = p.owners;
    const metrics = [['Quotazione', `${num(p.quot)} cr`], ['FVM', num(p.fvm)], ['Fantamedia', num(p.fm)], ['Media voto', num(p.mv)], ['Partite', num(p.pg)]];
    const ownerDetails = owners.length
        ? `<div class="owner-details"><p class="owner-label">Fantasquadre che lo possiedono</p><ul class="owner-list">${owners.map(team => `<li class="owner-team">${esc(team)}</li>`).join('')}</ul></div>`
        : '';
    return `<div class="detail"><dl>${metrics.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>${ownerDetails}</div>`;
}
$('player-list').addEventListener('toggle', event => {
    const card = event.target;
    if (!card.matches('details[data-player]') || !card.open || card.querySelector('.detail')) return;
    const player = state.data?.giocatori[Number(card.dataset.player)];
    if (player) card.insertAdjacentHTML('beforeend', playerDetails(player));
}, true);
function renderPlayers() {
    const query = normalize($('query').value.trim());
    const role = state.role;
    const ownership = state.ownership;
    const sorted = state.data.giocatori.filter(p => (!query || p.search.includes(query)) && (!role || p.ruolo === role) && (!ownership || (ownership === 'free' ? !p.owners.length : p.owners.length)));
    $('count').textContent = `${sorted.length} ${sorted.length === 1 ? 'risultato' : 'risultati'} su ${state.data.giocatori.length}`;
    $('player-list').innerHTML = sorted.map(playerCard).join('') || '<p class="empty">Nessun risultato. Prova un altro nome o azzera i filtri.</p>';
}
function renderTeams() {
    const balances = new Map(state.data.cambi.map(item => [item.team, item]));
    $('team-list').innerHTML = state.data.standings.map(team => {
        const players = state.data.rose[team.team] || [];
        const balance = balances.get(team.team) || {};
        const value = players.reduce((sum, p) => sum + (p.qta || 0), 0);
        const roster = [...players].sort((a,b) => order[a.ruolo] - order[b.ruolo] || b.qta - a.qta || a.nome.localeCompare(b.nome, 'it'));
        return `<details class="team">
            <summary><span class="position">${num(team.pos)}</span><strong>${esc(team.team)}</strong><span class="team-score">${num(team.pts)} <small>pt</small></span><span class="chevron" aria-hidden="true">⌄</span></summary>
            <div class="detail">
                <p class="muted team-resources">Valore rosa: ${num(value)} cr · Crediti: ${num(balance.crediti)} cr · Cambi: ${num(balance.cambi)}</p>
                <table class="roster-table" aria-label="Rosa ${esc(team.team)}">
                    <thead><tr><th scope="col">Calciatore</th><th scope="col">Quota <small>cr</small></th><th scope="col">Costo <small>cr</small></th></tr></thead>
                    <tbody>${roster.map(p => `<tr><th scope="row"><span class="identity">${roleBadge(p.ruolo)}<span>${esc(p.nome)} ${p.fl ? '<span class="out">Fuori lista</span>' : ''}<small>${esc(p.sq || '—')}</small></span></span></th><td>${num(p.qta)}</td><td>${num(p.costo)}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </details>`;
    }).join('');
}
function renderMarket() {
    $('market-list').innerHTML = [...state.data.cambi].sort((a,b) => b.cambi - a.cambi || b.crediti - a.crediti || a.team.localeCompare(b.team, 'it')).map(t => `<tr><th scope="row">${esc(t.team)}</th><td>${num(t.cambi)}</td><td>${num(t.crediti)} <small>cr</small></td><td>${esc(t.extra || '—')}</td></tr>`).join('');
}
function render() {
    if (!state.data) return;
    const key = state.view === 'players' ? JSON.stringify([$('query').value.trim(), state.role, state.ownership]) : '';
    const previous = state.rendered.get(state.view);
    if (previous?.data === state.data && previous.key === key) return;
    ({players: renderPlayers, teams: renderTeams, market: renderMarket})[state.view]();
    state.rendered.set(state.view, {data: state.data, key});
}
document.querySelector('.tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    state.view = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-current', b === button ? 'page' : 'false'));
    ['players','teams','market'].forEach(id => { $(id).hidden = id !== state.view; });
    render();
});
let timer;
$('filters').addEventListener('submit', e => e.preventDefault());
$('filters').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 100);
});
$('filters').addEventListener('reset', () => {
    clearTimeout(timer);
    selectRole('');
    selectOwnership('');
    setTimeout(render, 0);
});
function selectRole(role) {
    state.role = role;
    document.querySelectorAll('[data-role]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.role === role)));
}
$('role-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-role]');
    if (!button) return;
    selectRole(button.dataset.role);
    render();
});
function selectOwnership(ownership) {
    state.ownership = ownership;
    document.querySelectorAll('[data-ownership]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ownership === ownership)));
}
$('ownership-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-ownership]');
    if (!button) return;
    selectOwnership(button.dataset.ownership);
    render();
});
$('days').addEventListener('click', event => {
    const button = event.target.closest('[data-day]');
    if (!button) return;
    closeDayPicker(true);
    load(Number(button.dataset.day));
});
function closeDayPicker(restoreFocus = false) {
    $('day-picker').open = false;
    if (restoreFocus) $('day-toggle').focus({preventScroll: true});
}
document.addEventListener('click', event => {
    if (!$('day-picker').contains(event.target)) closeDayPicker();
});
$('day-picker').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeDayPicker(true);
    }
});
$('day-picker').addEventListener('toggle', () => {
    if (!$('day-picker').open) return;
    const selected = $('days').querySelector('[aria-pressed=true]');
    selected?.scrollIntoView({block: 'nearest', inline: 'nearest'});
});
$('retry').addEventListener('click', () => state.days.length ? load(state.target) : init());
async function init() {
    feedback('Caricamento delle giornate…');
    try {
        const manifest = await json('manifest.json', AbortSignal.timeout(15000));
        if (!Array.isArray(manifest.giornate) || !manifest.giornate.length || manifest.giornate.some(n => !Number.isInteger(n) || n < 1)) throw new Error('Manifest non valido');
        state.days = [...new Set(manifest.giornate)].sort((a,b) => a-b);
        state.version = manifest.version || '';
        state.versions = manifest.versions || {};
        $('days').innerHTML = state.days.map(n => `<button type="button" data-day="${n}" aria-label="Giornata ${n}" aria-pressed="false">G${n}</button>`).join('');
        await load(state.days.at(-1));
    } catch (error) {
        feedback('Non riesco a caricare le giornate. Controlla la connessione e riprova.', true);
        $('content').hidden = true;
        $('content').setAttribute('aria-busy', 'false');
        console.error(error);
    }
}
init();
