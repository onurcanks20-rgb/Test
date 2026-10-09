Kostentracker.module({
  "id": "js/kategorien/fixkosten.js",
  "dependencies": [
    "addItem",
    "appendDateGroupHeader",
    "beginUndoDelete",
    "berechneMonatGesamt",
    "closeStartQuickAdd",
    "createItem",
    "datumAusTagAktuellerMonat",
    "datumMitSicheremTag",
    "escapeHtml",
    "finishUndoDelete",
    "formatBetrag",
    "formatDatum",
    "formatInputBetrag",
    "formatText",
    "generateId",
    "getGehaltszeitraum",
    "getSearchTerm",
    "heuteISO",
    "istEintragAusgeblendet",
    "matchesSearch",
    "parseBetrag",
    "parseISODate",
    "readReminderControl",
    "renderHomeUebersicht",
    "setupKostenEditEnterFlow",
    "speichern",
    "tagAusDatum"
  ],
  "session": [
    "state"
  ],
  "read": [
    "Laufende Kosten"
  ],
  "write": [
    "Laufende Kosten"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/kategorien/fixkosten.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function renderLaufendeKosten() {

            const div = document.getElementById("kostenListe");
            const total = document.getElementById("kostenGesamt");
            if (!div) return;

            div.innerHTML = "";

            context.repository.view["Laufende Kosten"] ??= { fix: [] };
            context.repository.view["Laufende Kosten"].fix ??= [];
            document.getElementById("fixkostenDeleteAllBtn")?.classList.toggle("hidden", context.repository.view["Laufende Kosten"].fix.length === 0);

            if (context.repository.view["Laufende Kosten"].fix.length === 0) {
                div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📌</div><div class="empty-state-title">Noch keine Fixkosten</div><div class="empty-state-text">Regelmäßige monatliche Kosten erscheinen hier, sobald du sie anlegst.</div></div>`;
            }

            let summe = 0;

            const suche = dependencies.getSearchTerm("fixkostenSuche");
            const gehaltszeitraum = dependencies.getGehaltszeitraum();

            // Fixkosten werden in der Reihenfolge ihres Abbuchungstermins innerhalb
            // des aktuellen Gehaltszeitraums sortiert. Beispiel bei Gehalt am 28.:
            // 28. -> 01. -> 04. -> 14. -> 27.
            const terminImGehaltszeitraum = (k) => {
                const basisDatum = k.datum || dependencies.datumAusTagAktuellerMonat(k.tag);
                const tag = dependencies.tagAusDatum(basisDatum);
                const startDatum = dependencies.parseISODate(basisDatum);

                let termin = dependencies.datumMitSicheremTag(
                    gehaltszeitraum.start.getFullYear(),
                    gehaltszeitraum.start.getMonth(),
                    tag
                );

                if (termin < gehaltszeitraum.start) {
                    termin = dependencies.datumMitSicheremTag(termin.getFullYear(), termin.getMonth() + 1, tag);
                }

                // Bei neuen Fixkosten darf die Sortierung keinen Termin vor der
                // ersten tatsächlichen Abbuchung vortäuschen.
                if (startDatum && termin < startDatum) {
                    termin = new Date(startDatum);
                }

                return termin;
            };

            summe = [...context.repository.view["Laufende Kosten"].fix]
                .filter(k => dependencies.matchesSearch(suche, k.text, k.name, k.info, k.haendler, k.datum, k.tag, k.betrag))
                .reduce((acc, k) => acc + (dependencies.parseBetrag(k.betrag) || 0), 0);

            const sortierteFixkosten = [...context.repository.view["Laufende Kosten"].fix]
                .filter(k => !dependencies.istEintragAusgeblendet("fixkosten", k.id))
                .filter(k => dependencies.matchesSearch(suche, k.text, k.name, k.info, k.haendler, k.datum, k.tag, k.betrag))
                .sort((a, b) => {
                    const terminA = terminImGehaltszeitraum(a);
                    const terminB = terminImGehaltszeitraum(b);
                    const diff = terminA - terminB;
                    if (diff !== 0) return diff;
                    return String(a.datum || '').localeCompare(String(b.datum || ''));
                });

            if (!sortierteFixkosten.length && context.repository.view["Laufende Kosten"].fix.length > 0 && !suche) {
                div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👁️‍🗨️</div><div class="empty-state-title">Alle Fixkosten sind ausgeblendet</div><div class="empty-state-text">Unter Einstellungen → Gesten → Ausgeblendete verwalten kannst du sie wieder einblenden.</div></div>`;
            }

            let letzteFixkostenGruppe = null;
            sortierteFixkosten.forEach(k => {

                const datum = k.datum || dependencies.datumAusTagAktuellerMonat(k.tag);
                const gruppenTermin = terminImGehaltszeitraum(k);
                const gruppenKey = gruppenTermin ? gruppenTermin.toISOString().slice(0,10) : datum;
                if (gruppenKey !== letzteFixkostenGruppe) {
                    dependencies.appendDateGroupHeader(div, gruppenTermin || datum, { first: letzteFixkostenGruppe === null, note: "Abbuchung" });
                    letzteFixkostenGruppe = gruppenKey;
                }
                const tag = dependencies.tagAusDatum(datum);

                // Für alte gespeicherte Einträge: Tag und Datum im Speicherobjekt ergänzen.
                k.datum = datum;
                k.tag = tag;
                k.info = k.info || "";

                const isEdit = String(context.session.state.editKostenId) === String(k.id);
                let item;

                if (isEdit) {
                    item = dependencies.createItem(`
                    <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                        <input id="editKostenText-${k.id}" value="${dependencies.escapeHtml(k.text || k.name || "")}" placeholder="Beschreibung" autocapitalize="words">
                        <input id="editKostenBetrag-${k.id}" type="text" inputmode="decimal" value="${dependencies.formatInputBetrag(k.betrag)}" placeholder="Betrag">
                        <input id="editKostenInfo-${k.id}" value="${dependencies.escapeHtml(k.info || "")}" placeholder="Info (z. B. Kundennummer, Vertragsnummer)" autocapitalize="words">
                        <label for="editKostenHaendler-${k.id}" style="opacity:0.7; font-size:13px; margin-top:4px;">Anbieter (optional)</label>
                        <input id="editKostenHaendler-${k.id}" value="${dependencies.escapeHtml(k.haendler || "")}" placeholder="z. B. Telekom oder Netflix" autocapitalize="off">
                        <div class="info-text">Mehrere Namen mit einem Semikolon trennen.</div>
                        <label for="editKostenZuordnungTage-${k.id}" style="opacity:0.7; font-size:13px; margin-top:4px;">Zeitfenster zur Fälligkeit (± Tage)</label>
                        <input id="editKostenZuordnungTage-${k.id}" type="number" inputmode="numeric" min="0" max="31" step="1" value="${normalizeFixkostenZuordnungTage(k.zuordnungTage)}">
                        <div class="info-text">Vorbereitung für die Push-Erfassung: Tage vor oder nach der Fälligkeit.</div>
                        <label for="editKostenDatum-${k.id}" style="opacity:0.7; font-size:13px; margin-top:4px;">Erste Abbuchung · danach monatlich</label>
                        <input id="editKostenDatum-${k.id}" type="date" value="${datum}">

                        <div style="display:flex; gap:10px; margin-top:6px;">
                            <button onclick="saveEditKosten('${k.id}')">💾 Speichern</button>
                            <button onclick="cancelEditKosten()" style="background:#607d8b;">❌ Abbrechen</button>
                        </div>
                    </div>
                `);

                    setTimeout(() => dependencies.setupKostenEditEnterFlow(k.id), 0);
                } else {

                    const istOffen = !!context.session.state.offeneFixkosten[String(k.id)];
                    item = dependencies.createItem(`
                    <div style="display:flex; flex-direction:column; width:100%; gap:10px;">
                        <div class="compact-alltag-content">
                            <div class="compact-alltag-main" onclick="toggleFixkostenDetails('${k.id}')" style="cursor:pointer;">
                                <span class="compact-alltag-title">${dependencies.escapeHtml(k.text || k.name || "-")}</span>
                                ${k.haendler ? `<span class="compact-alltag-sub">${dependencies.escapeHtml(k.haendler)}</span>` : ''}
                                <span class="compact-alltag-sub">Monatlich am ${String(tag).padStart(2, "0")}.</span>
                            </div>
                            <strong class="compact-alltag-amount">${dependencies.formatBetrag(k.betrag)}</strong>
                            <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                                <button onclick="event.stopPropagation(); moveAusgabe('fixkosten','${k.id}')" title="Verschieben">↪️</button>
                                <button class="edit" onclick="event.stopPropagation(); startEditKosten('${k.id}')">✏️</button>
                                <button class="delete" onclick="event.stopPropagation(); deleteLaufendeKosten('${k.id}')">🗑️</button>
                            </div>
                        </div>
                        ${istOffen ? `
                            <div onclick="toggleFixkostenDetails('${k.id}')" style="background:#3a3a3c;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:14px;cursor:pointer;">
                                <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Wiederholung</span><span style="font-weight:600;text-align:right;">Monatlich am ${tag}.</span></div>
                                <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Startdatum</span><span style="font-weight:600;text-align:right;">${dependencies.formatDatum(datum)}</span></div>
                                ${k.info ? `<div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Info</span><span style="font-weight:600;text-align:right;overflow-wrap:anywhere;">${dependencies.escapeHtml(k.info)}</span></div>` : ''}
                                ${k.haendler ? `<div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Anbieter</span><span style="font-weight:600;text-align:right;overflow-wrap:anywhere;">${dependencies.escapeHtml(k.haendler)}</span></div>
                                <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Zeitfenster zur Fälligkeit</span><span style="font-weight:600;text-align:right;">±${normalizeFixkostenZuordnungTage(k.zuordnungTage)} Tage</span></div>` : ''}
                            </div>
                        ` : ''}
                    </div>
                `);
                }

                if (!isEdit) item.classList.add("compact-alltag-card");
                div.appendChild(item);
            });

            if (total) {
                total.innerHTML = "Gesamt: " + dependencies.formatBetrag(summe);
            }
        }

        function toggleFixkostenDetails(id) {
            context.session.state.offeneFixkosten ??= {};
            const key = String(id);
            context.session.state.offeneFixkosten[key] = !context.session.state.offeneFixkosten[key];
            renderLaufendeKosten();
        }

        function normalizeFixkostenZuordnungTage(value) {
            if (value === undefined || value === null || String(value).trim() === "") return 5;
            const days = Number(value);
            return Number.isFinite(days) ? Math.min(31, Math.max(0, Math.floor(days))) : 5;
        }

        function addKosten() {

            let text = dependencies.formatText(document.getElementById("costText").value);
            let betrag = dependencies.parseBetrag(document.getElementById("costBetrag").value);
            let info = document.getElementById("costInfo")?.value.trim() || "";
            let datum = document.getElementById("costDatum").value;
            const haendler = (document.getElementById("costHaendler")?.value || "").trim();
            const zuordnungTage = normalizeFixkostenZuordnungTage(document.getElementById("costZuordnungTage")?.value);

            if (!text || isNaN(betrag)) return;
            if (!datum) datum = dependencies.heuteISO();

            const tag = dependencies.tagAusDatum(datum);

            // 🛡️ Struktur absichern
            if (!context.repository.view["Laufende Kosten"]) {
                context.repository.view["Laufende Kosten"] = { fix: [] };
            }
            if (!Array.isArray(context.repository.view["Laufende Kosten"].fix)) {
                context.repository.view["Laufende Kosten"].fix = [];
            }

            if (dependencies.addItem(context.repository.view["Laufende Kosten"].fix, {
                id: dependencies.generateId(),
                text,
                betrag,
                info,
                haendler,
                zuordnungTage,
                datum,
                tag,
                ...dependencies.readReminderControl("add:fixkosten")
            }) === false) return;


            // reset
            document.getElementById("costText").value = "";
            document.getElementById("costBetrag").value = "";
            document.getElementById("costInfo").value = "";
            const haendlerInput = document.getElementById("costHaendler");
            if (haendlerInput) haendlerInput.value = "";
            const tageInput = document.getElementById("costZuordnungTage");
            if (tageInput) tageInput.value = "5";
            document.getElementById("costDatum").value = dependencies.heuteISO();
            document.getElementById("kostenAddPanel")?.classList.add("hidden");

            renderLaufendeKosten();
            dependencies.renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) dependencies.closeStartQuickAdd();
        }

        function deleteLaufendeKosten(id) {

            if (!confirm("Wirklich löschen?")) return;
            dependencies.beginUndoDelete("Fixkosten-Eintrag gelöscht");

            if (!context.repository.view["Laufende Kosten"] || !Array.isArray(context.repository.view["Laufende Kosten"].fix)) return;

            let liste = context.repository.view["Laufende Kosten"].fix;
            let index = liste.findIndex(e => String(e.id) === String(id));

            if (index !== -1) {
                liste.splice(index, 1);
            }

            if (dependencies.speichern() === false) return;
            renderLaufendeKosten();
            dependencies.renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) dependencies.closeStartQuickAdd();
            dependencies.finishUndoDelete("Fixkosten-Eintrag gelöscht");
        }

        function startEditKosten(id) {
            context.session.state.editKostenId = id;
            renderLaufendeKosten();
        }

        function cancelEditKosten() {
            context.session.state.editKostenId = null;
            renderLaufendeKosten();
        }

        function saveEditKosten(id) {

            let item = context.repository.view["Laufende Kosten"].fix.find(e => String(e.id) === String(id));
            if (!item) return;

            const textEl = document.getElementById("editKostenText-" + id);
            const betragEl = document.getElementById("editKostenBetrag-" + id);
            const infoEl = document.getElementById("editKostenInfo-" + id);
            const datumEl = document.getElementById("editKostenDatum-" + id);

            if (!textEl || !betragEl || !datumEl) return;

            let text = textEl.value;
            let betrag = dependencies.parseBetrag(betragEl.value);
            let info = infoEl?.value.trim() || "";
            let datum = datumEl.value || dependencies.heuteISO();

            if (!text || isNaN(betrag)) return;

            item.text = dependencies.formatText(text);
            item.betrag = betrag;
            item.info = info;
            const haendlerEl = document.getElementById("editKostenHaendler-" + id);
            const tageEl = document.getElementById("editKostenZuordnungTage-" + id);
            item.haendler = (haendlerEl ? haendlerEl.value : item.haendler || "").trim();
            item.zuordnungTage = normalizeFixkostenZuordnungTage(tageEl ? tageEl.value : item.zuordnungTage);
            item.datum = datum;
            item.tag = dependencies.tagAusDatum(datum);
            Object.assign(item, dependencies.readReminderControl(`edit:fixkosten:${id}`));

            if (dependencies.speichern() === false) return;
            context.session.state.editKostenId = null;
            renderLaufendeKosten();
            dependencies.renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) dependencies.closeStartQuickAdd();
        }

        function editLaufendeKosten(id) {
            startEditKosten(id);
        }

        function deleteAlleLaufendeKosten() {

            if (!confirm("Alle Fixkosten wirklich löschen?")) return;
            dependencies.beginUndoDelete("Alle Fixkosten gelöscht");

            // 🛡️ Struktur absichern
            if (!context.repository.view["Laufende Kosten"]) {
                context.repository.view["Laufende Kosten"] = { fix: [] };
            } else {
                context.repository.view["Laufende Kosten"].fix = [];
            }

            if (dependencies.speichern() === false) return;
            context.session.state.editKostenId = null;
            renderLaufendeKosten();
            dependencies.renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) dependencies.closeStartQuickAdd();
            dependencies.finishUndoDelete("Alle Fixkosten gelöscht");
        }

function laufendeKostenImZeitraum(von, bis) {
            context.repository.view["Laufende Kosten"] ??= { fix: [] };
            context.repository.view["Laufende Kosten"].fix ??= [];

            const faellig = [];

            context.repository.view["Laufende Kosten"].fix.forEach(k => {
                const betrag = dependencies.parseBetrag(k.betrag);
                if (isNaN(betrag)) return;

                const startDatum = dependencies.parseISODate(k.datum || dependencies.datumAusTagAktuellerMonat(k.tag));
                if (!startDatum) return;

                const tag = dependencies.tagAusDatum(k.datum || dependencies.datumAusTagAktuellerMonat(k.tag));

                // Wichtig:
                // Das eingegebene Datum ist der erste mögliche Abbuchungstermin.
                // Beispiel: 28.05. darf NICHT schon als 28.04. im Gehaltsmonat 26.04.-25.05. auftauchen.
                let datum = dependencies.datumMitSicheremTag(von.getFullYear(), von.getMonth(), tag);

                while (datum < von || datum < startDatum) {
                    datum = dependencies.datumMitSicheremTag(datum.getFullYear(), datum.getMonth() + 1, tag);
                }

                while (datum <= bis) {
                    faellig.push({
                        typ: "laufend",
                        typLabel: "Fixkosten",
                        sourceId: k.id,
                        name: k.text || k.name || "Fixkosten",
                        betrag,
                        datum: new Date(datum)
                    });

                    datum = dependencies.datumMitSicheremTag(datum.getFullYear(), datum.getMonth() + 1, tag);
                }
            });

            return faellig;
        }

function kostenLaufend() {

            context.repository.view["Laufende Kosten"] ??= { fix: [] };
            context.repository.view["Laufende Kosten"].fix ??= [];

            return context.repository.view["Laufende Kosten"].fix.reduce((sum, e) => {
                let betrag = dependencies.parseBetrag(e.betrag);
                return sum + (isNaN(betrag) ? 0 : betrag);
            }, 0);
        }

function berechneGesamtFixkosten() {
            return dependencies.berechneMonatGesamt();
        }

function berechneLaufendeKosten(monatTag = new Date().getDate()) {

            return context.repository.view["Laufende Kosten"].fix.reduce((sum, e) => {
                return sum + e.betrag;
            }, 0);
        }

function faelligeKostenHeute() {
            let tag = new Date().getDate();

            return context.repository.view["Laufende Kosten"].fix.filter(e => dependencies.tagAusDatum(e.datum || dependencies.datumAusTagAktuellerMonat(e.tag)) === tag);
        }

return { renderLaufendeKosten, toggleFixkostenDetails, normalizeFixkostenZuordnungTage, addKosten, deleteLaufendeKosten, startEditKosten, cancelEditKosten, saveEditKosten, editLaufendeKosten, deleteAlleLaufendeKosten, laufendeKostenImZeitraum, kostenLaufend, berechneGesamtFixkosten, berechneLaufendeKosten, faelligeKostenHeute };
});
