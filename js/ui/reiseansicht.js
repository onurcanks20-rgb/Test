Kostentracker.module({
  "id": "js/ui/reiseansicht.js",
  "dependencies": ["activeHomeTrips", "heuteISO", "formatBetragText", "formatDatum", "parseBetrag", "reiseGesamtAusgegeben", "openLand", "openHomeTravelExpense", "goHome", "show", "renderGrafik"],
  "session": ["aktuellesLand"],
  "read": ["Reisen", "ReisenMeta"], "write": [], "replace": false
}, (context, dependencies) => {
"use strict";
// Ein reiner Ansichtsmodus: keine Buchungen, Budgets oder Zuordnungen verändern.
const preferenceKey = 'kostenApp_test_reiseansicht';
let enabled = false;
try {
    const saved = localStorage.getItem(preferenceKey);
    enabled = saved === null ? sessionStorage.getItem(preferenceKey) === '1' : saved === '1';
    if (saved === null && enabled) localStorage.setItem(preferenceKey, '1');
} catch (_) {}
let signature = '', selectedCountries = new Set(), refreshing = false, lastMode = false;
const el = id => document.getElementById(id);
const visible = id => el(id) && !el(id).classList.contains('hidden');
function rememberMode() {
    try { localStorage.setItem(preferenceKey, enabled ? '1' : '0'); } catch (_) {}
}
function isTravelMode() {
    if (enabled && dependencies.activeHomeTrips().length === 0) {
        enabled = false; rememberMode();
    }
    return enabled;
}
function travelModeTrips() {
    return dependencies.activeHomeTrips();
}
function travelModeEntries(countries) {
    const result = [];
    for (const country of countries) {
        const meta = context.repository.view.ReisenMeta?.[country];
        for (const [category, rows] of Object.entries(context.repository.view.Reisen?.[country] || {})) {
            if (!Array.isArray(rows)) continue;
            for (const row of rows) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(row.datum || '') || row.datum < meta.von || row.datum > meta.bis) continue;
                const amount = dependencies.parseBetrag(row.betrag);
                if (!Number.isFinite(amount)) continue;
                result.push({country, category, amount, date: row.datum});
            }
        }
    }
    return result;
}
function travelModeStats(country) {
    const meta = context.repository.view.ReisenMeta?.[country] || {};
    const budget = dependencies.parseBetrag(meta.budget) || 0;
    const spent = dependencies.reiseGesamtAusgegeben(country);
    const today = travelModeEntries([country]).filter(row => row.date === dependencies.heuteISO()).reduce((sum, row) => sum + row.amount, 0);
    return {budget, spent, remaining: budget - spent, today};
}
function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
}
function button(text, fn, className = 'travel-mode-action') {
    const b = node('button', className, text); b.type = 'button'; b.addEventListener('click', fn); return b;
}
function money(value) { return dependencies.formatBetragText(value); }
function renderTravelHome() {
    const host = el('travelModeHome'); if (!host) return;
    host.replaceChildren();
    for (const country of travelModeTrips()) {
        const meta = context.repository.view.ReisenMeta[country];
        const stats = travelModeStats(country);
        const card = node('article', 'travel-mode-card');
        card.appendChild(node('span', 'travel-mode-eyebrow', 'DEINE REISE'));
        card.appendChild(node('h2', '', country));
        card.appendChild(node('p', 'travel-mode-muted', `${dependencies.formatDatum(meta.von)} – ${dependencies.formatDatum(meta.bis)}`));
        card.appendChild(node('span', 'travel-mode-muted', stats.budget > 0 ? 'Reisebudget übrig · EUR' : 'Ausgegeben · EUR'));
        card.appendChild(node('strong', 'travel-mode-remaining', money(stats.budget > 0 ? stats.remaining : stats.spent)));
        const facts = node('div', 'travel-mode-facts');
        for (const [label, amount] of [['Budget',stats.budget],['Ausgegeben',stats.spent],['Heute',stats.today]]) {
            const fact = node('div'); fact.append(node('span','travel-mode-muted',label),node('strong','',money(amount))); facts.appendChild(fact);
        }
        card.appendChild(facts);
        card.appendChild(button('＋ Ausgabe hinzufügen', () => dependencies.openHomeTravelExpense(country)));
        card.appendChild(button('Buchungen ansehen ›', () => openTravelCountry(country), 'travel-mode-link'));
        host.appendChild(card);
    }
}
function renderTravelCountries() {
    const host = el('travelOverviewCountries'); if (!host) return;
    host.replaceChildren();
    host.appendChild(node('p','travel-mode-muted','Für welches Land möchtest du die Buchungen sehen?'));
    for (const country of travelModeTrips()) {
        const stats = travelModeStats(country);
        const b = button('', () => openTravelCountry(country), 'travel-mode-country');
        b.append(node('strong','',country),node('span','travel-mode-muted',`${money(stats.spent)} ausgegeben  ›`));
        host.appendChild(b);
    }
}
function openTravelCountry(country) {
    if (!isTravelMode() || !travelModeTrips().includes(country)) { openTravelOverview(); return; }
    dependencies.openLand(country);
}
function openTravelOverview() {
    if (!isTravelMode()) { dependencies.goHome(); return; }
    const trips = travelModeTrips();
    if (trips.length === 1) { dependencies.openLand(trips[0]); return; }
    renderTravelCountries(); dependencies.show('travelOverviewView');
}
function setTravelMode(value) {
    enabled = !!value && travelModeTrips().length > 0;
    signature = ''; rememberMode(); refreshTravelMode(); dependencies.goHome();
    window.scrollTo?.({top:0, behavior:'auto'});
}
function travelModeRoute(id) {
    if (!isTravelMode()) return id;
    if (id === 'home' || id === 'grafikView' || id === 'travelOverviewView' || id.startsWith('settings') || id === 'serverSettingsView') return id;
    if (id === 'land' && travelModeTrips().includes(context.session.aktuellesLand)) return id;
    return 'travelOverviewView';
}
function toggleTravelGraphicCountry(country) {
    if (!travelModeTrips().includes(country)) return;
    if (selectedCountries.has(country)) selectedCountries.delete(country); else selectedCountries.add(country);
    renderTravelGraphic();
}
function renderTravelGraphic() {
    const active = isTravelMode();
    el('travelModeGraphic')?.classList.toggle('hidden', !active);
    if (!active) return false;
    const host = el('travelModeGraphic'); if (!host) return true;
    host.replaceChildren();
    host.appendChild(node('h2','','Deine Reiseausgaben'));
    host.appendChild(node('p','travel-mode-muted','Gesamte Reisedauer · Beträge in EUR'));
    const chips = node('div','travel-mode-chips');
    for (const country of travelModeTrips()) {
        const chip = button(country, () => toggleTravelGraphicCountry(country), 'travel-mode-chip');
        chip.setAttribute('aria-pressed', String(selectedCountries.has(country))); chips.appendChild(chip);
    }
    host.appendChild(chips);
    const countries = travelModeTrips().filter(country => selectedCountries.has(country));
    if (!countries.length) { host.appendChild(node('p','travel-mode-empty','Wähle mindestens ein Land aus.')); return true; }
    const entries = travelModeEntries(countries);
    const total = entries.reduce((sum,row) => sum + row.amount,0);
    host.appendChild(node('span','travel-mode-muted','Gesamt ausgegeben'));
    host.appendChild(node('strong','travel-mode-remaining',money(total)));
    const grouped = new Map();
    for (const row of entries) grouped.set(row.category,(grouped.get(row.category)||0)+row.amount);
    if (!entries.length) host.appendChild(node('p','travel-mode-empty','Für diese Reise gibt es noch keine Ausgaben.'));
    const rows = [...grouped].sort((a,b) => b[1]-a[1]);
    const maximum = Math.max(1,...rows.map(row=>Math.abs(row[1])));
    for (const [category, amount] of rows) {
        const row = node('div','travel-mode-chart-row');
        const line = node('div','travel-mode-chart-label'); line.append(node('span','',category),node('strong','',money(amount)));
        const track = node('div','travel-mode-chart-track'); const fill = node('div','travel-mode-chart-fill');
        fill.style.width = `${Math.abs(amount)/maximum*100}%`; track.appendChild(fill); row.append(line,track); host.appendChild(row);
    }
    if (countries.length > 1) {
        host.appendChild(node('h3','','Nach Ländern'));
        for (const country of countries) {
            const row = node('div','travel-mode-chart-label'); row.append(node('span','',country),node('strong','',money(entries.filter(e=>e.country===country).reduce((sum,e)=>sum+e.amount,0)))); host.appendChild(row);
        }
    }
    return true;
}
function travelModeHasDraft() {
    if (document.querySelector('dialog[open],.sheet-backdrop:not(.hidden),.category-add-panel:not(.hidden)')) return true;
    return [...document.querySelectorAll('#land input,#land select,#land textarea')].some(field => (field.getClientRects?.().length || 0) > 0);
}
function refreshTravelMode() {
    if (refreshing) return;
    refreshing = true;
    try {
        const trips = travelModeTrips(), active = isTravelMode();
        const nextSignature = JSON.stringify(trips.map(country=>[country,context.repository.view.ReisenMeta[country].von,context.repository.view.ReisenMeta[country].bis]));
        if (signature !== nextSignature) { selectedCountries = new Set(trips); signature = nextSignature; }
        document.body.classList.toggle('travel-mode',active);
        el('home')?.classList.toggle('travel-mode',active);
        el('grafikView')?.classList.toggle('travel-mode',active);
        if (lastMode !== active) {
            lastMode = active;
            document.dispatchEvent(new CustomEvent('kostentracker:travelModeChanged'));
        }
        el('travelModeBar')?.classList.toggle('hidden',!active);
        el('travelModeToggle')?.classList.toggle('hidden',active || trips.length === 0);
        el('travelModeHome')?.classList.toggle('hidden',!active);
        el('travelModeGraphic')?.classList.toggle('hidden',!active);
        if (active) {
            renderTravelHome(); renderTravelCountries();
            if (visible('grafikView')) renderTravelGraphic();
            if (visible('land') && !trips.includes(context.session.aktuellesLand) && !travelModeHasDraft()) openTravelOverview();
        } else if (visible('travelOverviewView') && !travelModeHasDraft()) dependencies.goHome();
    } finally { refreshing = false; }
}
// Vorhandener Tageswechsel-/Fokus-Refresh ruft refreshTravelMode über renderHomeTrips auf.
return { isTravelMode, travelModeTrips, travelModeEntries, travelModeStats, renderTravelHome, renderTravelCountries, openTravelCountry, openTravelOverview, setTravelMode, travelModeRoute, toggleTravelGraphicCountry, renderTravelGraphic, refreshTravelMode };
});
