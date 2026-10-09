Kostentracker.module({
  "id": "js/kategorien/alltag-gemeinsam.js",
  "dependencies": [
    "appendDateGroupHeader",
    "createItem",
    "datumAlsLokalenTag",
    "datumZeitwert",
    "escapeHtml",
    "formatBetrag",
    "formatInputBetrag",
    "getSearchTerm",
    "istEintragAusgeblendet",
    "istInLetztenTagen",
    "matchesSearch",
    "montagDerWoche",
    "setupFreizeitEditEnterFlow",
    "setupHaushaltEditEnterFlow",
    "startOfToday"
  ],
  "session": [
    "state"
  ],
  "read": [
    "Freizeit",
    "Haushalt"
  ],
  "write": [],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/kategorien/alltag-gemeinsam.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        

        

        function alleAusgabenAusBereich(typ) {
            const quelle = typ === "freizeit" ? context.repository.view.Freizeit : context.repository.view.Haushalt;
            const liste = [];
            Object.values(quelle || {}).forEach(arr => {
                if (Array.isArray(arr)) arr.forEach(e => { if (e) liste.push(e); });
            });
            return liste;
        }

        function renderBereichWocheninfo(typ) {
            const istFreizeit = typ === "freizeit";
            const totalEl = document.getElementById(istFreizeit ? "freizeitWeekTotal" : "haushaltWeekTotal");
            const breakdownEl = document.getElementById(istFreizeit ? "freizeitWeekBreakdown" : "haushaltWeekBreakdown");
            if (!totalEl || !breakdownEl) return;

            const heute = dependencies.startOfToday();
            const montag = dependencies.montagDerWoche(heute);
            const liste = alleAusgabenAusBereich(typ).filter(e => {
                const d = dependencies.datumAlsLokalenTag(e.datum);
                return d && d >= montag && d <= heute;
            });

            const gesamt = liste.reduce((sum, e) => sum + (Number(e.betrag) || 0), 0);
            totalEl.innerHTML = dependencies.formatBetrag(gesamt);

            if (!liste.length) {
                breakdownEl.textContent = "Noch keine Ausgaben diese Woche.";
                return;
            }

            const gruppen = {};
            liste.forEach(e => {
                const kat = e.kategorie || "Sonstiges";
                gruppen[kat] = (gruppen[kat] || 0) + (Number(e.betrag) || 0);
            });
            const teile = Object.entries(gruppen)
                .sort((a,b) => b[1] - a[1])
                .map(([kat, betrag]) => `${kat}: ${dependencies.formatBetrag(betrag)}`);
            breakdownEl.innerHTML = teile.join(" · ");
        }

        function alltagZusatztext(e) {
            const text = String(e?.text || e?.name || '').trim();
            const kategorie = String(e?.kategorie || 'Sonstiges').trim();
            if (!text) return '';
            return text.toLocaleLowerCase('de-DE') === kategorie.toLocaleLowerCase('de-DE') ? '' : text;
        }

        function renderRecentAusgaben(typ) {
            const istFreizeit = typ === "freizeit";
            const container = document.getElementById(istFreizeit ? "freizeitListe" : "haushaltListe");
            if (!container) return;
            container.innerHTML = "";
            const suche = dependencies.getSearchTerm(istFreizeit ? "freizeitSuche" : "haushaltSuche");
            const liste = alleAusgabenAusBereich(typ)
                .filter(e => dependencies.istInLetztenTagen(e.datum, 7))
                .filter(e => !dependencies.istEintragAusgeblendet(typ, e.id))
                .filter(e => dependencies.matchesSearch(suche, e.text, e.name, e.kategorie, e.datum, e.betrag))
                .sort((a,b) => dependencies.datumZeitwert(b.datum) - dependencies.datumZeitwert(a.datum));

            if (!liste.length) {
                container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${istFreizeit ? '🎉' : '🛒'}</div><div class="empty-state-title">Keine Ausgaben in den letzten 7 Tagen</div><div class="empty-state-text">${istFreizeit ? 'Deine neuen Freizeit-Ausgaben erscheinen hier.' : 'Deine neuen Haushalts-Ausgaben erscheinen hier.'}</div></div>`;
                return;
            }

            const offenMap = istFreizeit ? context.session.state.offeneFreizeitEintraege : context.session.state.offeneHaushaltEintraege;
            const tagesSummen = {};
            liste.forEach(e => {
                const key = e.datum || "ohne-datum";
                tagesSummen[key] = (tagesSummen[key] || 0) + (Number(e.betrag) || 0);
            });
            let letzterTag = null;

            liste.forEach(e => {
                const tagKey = e.datum || "ohne-datum";
                if (tagKey !== letzterTag) {
                    dependencies.appendDateGroupHeader(container, e.datum, { first: letzterTag === null, total: tagesSummen[tagKey] || 0 });
                    letzterTag = tagKey;
                }
                const isEdit = istFreizeit ? String(context.session.state.editFreizeitId) === String(e.id) : String(context.session.state.editHaushaltId) === String(e.id);
                let html;
                if (isEdit) {
                    html = istFreizeit ? `
                        <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                            <input id="editFreizeitBetrag-${e.id}" type="text" inputmode="decimal" value="${dependencies.formatInputBetrag(e.betrag)}" placeholder="Betrag" enterkeyhint="next">
                            <input id="editFreizeitText-${e.id}" value="${dependencies.escapeHtml(e.text || e.name || '')}" autocapitalize="words" placeholder="Genauere Beschreibung (optional)" enterkeyhint="next">
                            <input id="editFreizeitDatum-${e.id}" type="date" value="${e.datum || ''}">
                            <div style="display:flex; gap:10px;"><button onclick="saveEditFreizeit('${e.id}')">💾 Speichern</button><button onclick="cancelEditFreizeit()">❌ Abbrechen</button></div>
                        </div>` : `
                        <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                            <input id="editBetrag-${e.id}" type="text" inputmode="decimal" value="${dependencies.formatInputBetrag(e.betrag)}" placeholder="Betrag" enterkeyhint="next">
                            <input id="editText-${e.id}" value="${dependencies.escapeHtml(e.text || e.name || '')}" autocapitalize="words" placeholder="Genauere Beschreibung (optional)" enterkeyhint="next">
                            <input id="editDatum-${e.id}" type="date" value="${e.datum || ''}">
                            <div style="display:flex; gap:10px;"><button onclick="saveEditHaushalt('${e.id}')">💾 Speichern</button><button onclick="cancelEditHaushalt()">❌ Abbrechen</button></div>
                        </div>`;
                } else {
                    const zusatz = alltagZusatztext(e);
                    html = `<div class="compact-alltag-content">
                        <div class="compact-alltag-main">
                            <span class="compact-alltag-title">${dependencies.escapeHtml(e.kategorie || 'Sonstiges')}</span>
                            ${zusatz ? `<span class="compact-alltag-sub">${dependencies.escapeHtml(zusatz)}</span>` : ''}
                        </div>
                        <strong class="compact-alltag-amount">${dependencies.formatBetrag(e.betrag)}</strong>
                        <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                            <button onclick="event.stopPropagation(); moveAusgabe('${typ}','${e.id}')" title="Verschieben">↪️</button>
                            <button class="edit" onclick="event.stopPropagation(); ${istFreizeit ? `startEditFreizeit('${e.id}')` : `startEditHaushalt('${e.id}')`}">✏️</button>
                            <button class="delete" onclick="event.stopPropagation(); ${istFreizeit ? `deleteFreizeit('${e.id}')` : `deleteHaushalt('${e.id}')`}">🗑️</button>
                        </div>
                    </div>`;
                }
                const item = dependencies.createItem(html);
                if (!isEdit) item.classList.add("compact-alltag-card");
                item.style.background = "#3a3a3c";
                container.appendChild(item);
                if (isEdit) setTimeout(() => istFreizeit ? dependencies.setupFreizeitEditEnterFlow(e.id) : dependencies.setupHaushaltEditEnterFlow(e.id), 0);
            });
        }

        function toggleAlltagsDetails(typ, id) {
            const map = typ === 'freizeit' ? context.session.state.offeneFreizeitEintraege : context.session.state.offeneHaushaltEintraege;
            const key = String(id);
            map[key] = !map[key];
            renderRecentAusgaben(typ);
        }

return { alleAusgabenAusBereich, renderBereichWocheninfo, alltagZusatztext, renderRecentAusgaben, toggleAlltagsDetails };
});
