Kostentracker.module({
  "id": "js/kategorien/sparen-investieren.js",
  "dependencies": [
    "alltagImZeitraum",
    "beginUndoDelete",
    "einnahmenZahlungenImZeitraum",
    "escapeHtml",
    "finishUndoDelete",
    "formatBetrag",
    "formatDateGroupLabel",
    "formatDatum",
    "formatInputBetrag",
    "generateId",
    "geplanteReservierungenImZeitraum",
    "getGehaltszeitraum",
    "getStartgehalt",
    "heuteISO",
    "laufendeKostenImZeitraum",
    "parseBetrag",
    "parseISODate",
    "readReminderControl",
    "renderHomeUebersicht",
    "renderUebersicht",
    "speichern",
    "versicherungsZahlungenImZeitraum"
  ],
  "session": [
    "state"
  ],
  "read": [
    "Sparen & Investieren"
  ],
  "write": [
    "Sparen & Investieren"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/kategorien/sparen-investieren.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function sparenInvestierenAktivImZeitraum(von, bis) {
            return (context.repository.view["Sparen & Investieren"] || []).filter(e => {
                const d = dependencies.parseISODate(e.datum);
                return d && d <= bis;
            }).map(e => ({ ...e, betrag: dependencies.parseBetrag(e.betrag) || 0 }));
        }

        function sparenInvestierenSummen(zeitraum) {
            const aktiv = sparenInvestierenAktivImZeitraum(zeitraum.start, zeitraum.ende);
            const investieren = aktiv.filter(e => e.typ === "investieren").reduce((s,e)=>s+e.betrag,0);
            const sparenPlan = aktiv.filter(e => e.typ === "sparen").reduce((s,e)=>s+e.betrag,0);
            return { aktiv, investieren, sparenPlan, gesamt: investieren + sparenPlan };
        }

        function berechneSparBudgetStatus(zeitraum) {
            const start = dependencies.getStartgehalt(zeitraum);
            const einnahmen = dependencies.einnahmenZahlungenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const fix = dependencies.laufendeKostenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const vers = dependencies.versicherungsZahlungenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const geplant = dependencies.geplanteReservierungenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const alltag = dependencies.alltagImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const si = sparenInvestierenSummen(zeitraum);
            const rohFrei = start + einnahmen - fix - vers - geplant - si.investieren - si.sparenPlan - alltag;
            // Frei verfügbar zeigt die echte Über- oder Unterschreitung des Alltagsbudgets.
            // Die Rücklage läuft parallel dagegen: -100 € frei bedeutet bei 300 € Rücklage noch 200 € gespart.
            // Wird stärker überzogen als die Rücklage groß ist, darf auch "Gespart" negativ werden.
            const sparVerbrauch = Math.max(0, -rohFrei);
            const gespart = si.sparenPlan - sparVerbrauch;
            const frei = rohFrei;
            return { ...si, gespart, sparVerbrauch, frei, rohFrei };
        }

        function addSparenInvestieren() {
            const typ = document.getElementById("sparenInvestierenTyp")?.value === "sparen" ? "sparen" : "investieren";
            const betrag = dependencies.parseBetrag(document.getElementById("sparenInvestierenBetrag")?.value);
            const text = (document.getElementById("sparenInvestierenText")?.value || "").trim();
            const datum = document.getElementById("sparenInvestierenDatum")?.value || dependencies.heuteISO();
            if (isNaN(betrag) || betrag <= 0 || !dependencies.parseISODate(datum)) return;
            context.repository.view["Sparen & Investieren"] ??= [];
            context.repository.view["Sparen & Investieren"].push({ id: dependencies.generateId(), typ, text, betrag, datum, ...dependencies.readReminderControl("add:sparen") });
            if (dependencies.speichern() === false) return;
            document.getElementById("sparenInvestierenBetrag").value = "";
            document.getElementById("sparenInvestierenText").value = "";
            document.getElementById("sparenInvestierenAddPanel")?.classList.add("hidden");
            renderSparenInvestieren();
            dependencies.renderUebersicht();
        }

        function deleteSparenInvestieren(id) {
            const liste = context.repository.view["Sparen & Investieren"] || [];
            const idx = liste.findIndex(e => String(e.id) === String(id));
            if (idx < 0) return;
            dependencies.beginUndoDelete("Spar-/Investment-Eintrag gelöscht");
            liste.splice(idx, 1);
            if (dependencies.speichern() === false) return;
            renderSparenInvestieren();
            dependencies.renderUebersicht();
            dependencies.finishUndoDelete("Spar-/Investment-Eintrag gelöscht");
        }

        function deleteAlleSparenInvestieren() {
            const liste = context.repository.view["Sparen & Investieren"] || [];
            if (!liste.length) return;
            if (!confirm("Alle Spar- und Investment-Einträge wirklich löschen?")) return;
            dependencies.beginUndoDelete("Alle Spar- und Investment-Einträge gelöscht");
            context.repository.view["Sparen & Investieren"] = [];
            if (dependencies.speichern() === false) return;
            context.session.state.editSparenInvestierenId = null;
            renderSparenInvestieren();
            dependencies.renderUebersicht();
            dependencies.renderHomeUebersicht();
            dependencies.finishUndoDelete("Alle Spar- und Investment-Einträge gelöscht");
        }

        function startEditSparenInvestieren(id) {
            context.session.state.editSparenInvestierenId = id;
            renderSparenInvestieren();
            setTimeout(() => document.getElementById(`editSparenBetrag-${id}`)?.focus(), 40);
        }

        function cancelEditSparenInvestieren() {
            context.session.state.editSparenInvestierenId = null;
            renderSparenInvestieren();
        }

        function saveEditSparenInvestieren(id) {
            const e = (context.repository.view["Sparen & Investieren"] || []).find(x => String(x.id) === String(id));
            if (!e) return;
            const typ = document.getElementById(`editSparenTyp-${id}`)?.value === "sparen" ? "sparen" : "investieren";
            const betrag = dependencies.parseBetrag(document.getElementById(`editSparenBetrag-${id}`)?.value);
            const text = (document.getElementById(`editSparenText-${id}`)?.value || "").trim();
            const datum = document.getElementById(`editSparenDatum-${id}`)?.value || "";
            if (isNaN(betrag) || betrag <= 0 || !dependencies.parseISODate(datum)) return;
            e.typ = typ;
            e.text = text;
            e.betrag = betrag;
            e.datum = datum;
            Object.assign(e, dependencies.readReminderControl(`edit:sparen:${id}`));
            if (dependencies.speichern() === false) return;
            context.session.state.editSparenInvestierenId = null;
            renderSparenInvestieren();
            dependencies.renderUebersicht();
        }

        function editSparenInvestieren(id) { startEditSparenInvestieren(id); }

        function renderSparenInvestieren() {
            const listeEl = document.getElementById("sparenInvestierenListe");
            const sumEl = document.getElementById("sparenInvestierenZusammenfassung");
            if (!listeEl) return;
            const z = dependencies.getGehaltszeitraum();
            const status = berechneSparBudgetStatus(z);
            if (sumEl) sumEl.innerHTML = `
                <div class="bereich-week-info-top"><span class="bereich-week-info-label">Diese Gehaltsperiode</span><span class="bereich-week-info-amount">${dependencies.formatBetrag(status.investieren + status.gespart)}</span></div>
                <div class="bereich-week-info-breakdown">📈 Investiert: ${dependencies.formatBetrag(status.investieren)} · 💰 Gespart: ${dependencies.formatBetrag(status.gespart)} von ${dependencies.formatBetrag(status.sparenPlan)}${status.sparVerbrauch > 0 ? ` · ${dependencies.formatBetrag(status.sparVerbrauch)} als Puffer genutzt` : ""}</div>`;

            const items = [...(context.repository.view["Sparen & Investieren"] || [])].sort((a,b) => String(b.datum || "").localeCompare(String(a.datum || "")) || Number(b.id || 0) - Number(a.id || 0));
            document.getElementById("sparenInvestierenDeleteAllBtn")?.classList.toggle("hidden", !items.length);
            if (!items.length) {
                listeEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📈</div><div class="empty-state-title">Noch nichts festgelegt</div><div class="empty-state-text">Lege deinen festen Investitionsbetrag und deine Rücklage pro Gehaltsperiode fest.</div></div>`;
                return;
            }
            let letzteSparGruppe = null;
            listeEl.innerHTML = items.map(e => {
                let gruppenHeader = "";
                const gruppenKey = e.datum || "ohne-datum";
                if (gruppenKey !== letzteSparGruppe) {
                    gruppenHeader = `<div class="date-group-title${letzteSparGruppe === null ? " first" : ""}">${dependencies.formatDateGroupLabel(e.datum)}<small>Gültig ab</small></div>`;
                    letzteSparGruppe = gruppenKey;
                }
                const isEdit = String(context.session.state.editSparenInvestierenId) === String(e.id);
                if (isEdit) return gruppenHeader + `
                    <div class="item" style="align-items:stretch;">
                        <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
                            <select id="editSparenTyp-${e.id}">
                                <option value="investieren" ${e.typ === "investieren" ? "selected" : ""}>📈 Investieren</option>
                                <option value="sparen" ${e.typ === "sparen" ? "selected" : ""}>💰 Rücklage / Sparen</option>
                            </select>
                            <input id="editSparenBetrag-${e.id}" type="text" inputmode="decimal" value="${dependencies.formatInputBetrag(e.betrag)}" placeholder="Betrag pro Gehaltsperiode" enterkeyhint="next">
                            <input id="editSparenText-${e.id}" autocapitalize="words" value="${dependencies.escapeHtml(e.text || '')}" placeholder="Beschreibung (optional)" enterkeyhint="next">
                            <input id="editSparenDatum-${e.id}" type="date" value="${e.datum || ''}">
                            <div style="display:flex;gap:10px;">
                                <button onclick="saveEditSparenInvestieren('${e.id}')">💾 Speichern</button>
                                <button onclick="cancelEditSparenInvestieren()" style="background:#3a3a3c;">❌ Abbrechen</button>
                            </div>
                        </div>
                    </div>`;
                return gruppenHeader + `
                    <div class="item" style="align-items:center;">
                        <div style="min-width:0;flex:1;">
                            <div style="font-weight:750;">${e.typ === "sparen" ? "💰 Sparen" : "📈 Investieren"}</div>
                            <div class="info-text" style="margin-top:4px;">${e.typ === "sparen" ? "Rücklage · dient als Puffer" : "Investition · bleibt geschützt"} · ab ${dependencies.formatDatum(e.datum)}</div>
                            ${e.text ? `<div class="info-text" style="margin-top:3px;">${dependencies.escapeHtml(e.text)}</div>` : ""}
                            <div style="font-weight:800;margin-top:5px;">${dependencies.formatBetrag(e.betrag)} / Gehaltsperiode</div>
                        </div>
                        <div class="actions" style="display:flex;gap:5px;">
                            <button class="edit" onclick="event.stopPropagation();startEditSparenInvestieren('${String(e.id)}')">✏️</button>
                            <button class="delete" onclick="event.stopPropagation();deleteSparenInvestieren('${String(e.id)}')">🗑️</button>
                        </div>
                    </div>`;
            }).join("");
        }

return { sparenInvestierenAktivImZeitraum, sparenInvestierenSummen, berechneSparBudgetStatus, addSparenInvestieren, deleteSparenInvestieren, deleteAlleSparenInvestieren, startEditSparenInvestieren, cancelEditSparenInvestieren, saveEditSparenInvestieren, editSparenInvestieren, renderSparenInvestieren };
});
