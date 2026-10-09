Kostentracker.module({
  "id": "js/kategorien/haushalt.js",
  "dependencies": [
    "applyLetzteAlltagsKategorie",
    "beginUndoDelete",
    "closeStartQuickAdd",
    "finishUndoDelete",
    "formatText",
    "generateId",
    "heuteISO",
    "merkeLetzteKategorie",
    "parseBetrag",
    "parseISODate",
    "readReminderControl",
    "renderBereichWocheninfo",
    "renderHomeUebersicht",
    "renderRecentAusgaben",
    "speichern"
  ],
  "session": [
    "state"
  ],
  "read": [
    "Haushalt"
  ],
  "write": [
    "Haushalt"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/kategorien/haushalt.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function addHaushalt() {

            let text = dependencies.formatText(document.getElementById("hausText").value);
            let betrag = dependencies.parseBetrag(document.getElementById("hausBetrag").value);
            let datum = document.getElementById("hausDatum").value;
            let kategorie = document.getElementById("hausKategorie")?.value || "Sonstiges";

            if (isNaN(betrag) || !datum) return;
            if (!text) text = kategorie;

            let monat = new Date(datum).getMonth() + 1;

            if (!context.repository.view.Haushalt[monat]) {
                context.repository.view.Haushalt[monat] = [];
            }

            context.repository.view.Haushalt[monat].push({
                id: dependencies.generateId(),
                text,
                betrag,
                datum,
                kategorie,
                ...dependencies.readReminderControl("add:haushalt")
            });
            dependencies.merkeLetzteKategorie("haushalt", kategorie);

            if (dependencies.speichern() === false) return;

            // reset
            document.getElementById("hausText").value = "";
            document.getElementById("hausBetrag").value = "";
            document.getElementById("hausDatum").value = dependencies.heuteISO();
            dependencies.applyLetzteAlltagsKategorie("haushalt");
            document.getElementById("hausAddPanel")?.classList.add("hidden");

            renderHaushalt();
            dependencies.renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) dependencies.closeStartQuickAdd();
        }

        function renderHaushalt() {
            const hatEintraege = Object.values(context.repository.view.Haushalt || {}).some(liste => Array.isArray(liste) && liste.length > 0);
            document.getElementById("haushaltDeleteAllBtn")?.classList.toggle("hidden", !hatEintraege);
            dependencies.renderBereichWocheninfo("haushalt");
            dependencies.renderRecentAusgaben("haushalt");
        }

        function deleteAlleHaushalt() {

            if (!confirm("Alle Haushalt-Einträge wirklich löschen?")) return;
            dependencies.beginUndoDelete("Alle Haushalt-Einträge gelöscht");

            if (!context.repository.view.Haushalt) {
                context.repository.view.Haushalt = {};
            }

            for (let monat in context.repository.view.Haushalt) {
                if (Array.isArray(context.repository.view.Haushalt[monat])) {
                    context.repository.view.Haushalt[monat] = [];
                }
            }

            if (dependencies.speichern() === false) return;
            renderHaushalt();
            dependencies.finishUndoDelete("Alle Haushalt-Einträge gelöscht");
        }

        function gruppiereHaushalt() {

            let gruppiert = {};

            if (!context.repository.view.Haushalt) return gruppiert;

            for (let monat in context.repository.view.Haushalt) {

                let liste = context.repository.view.Haushalt[monat];

                if (!Array.isArray(liste)) continue;

                liste.forEach(e => {

                    if (!e || !e.datum) return;

                    let d = new Date(e.datum);
                    if (isNaN(d)) return;

                    let jahr = d.getFullYear();
                    let monatNum = d.getMonth() + 1;

                    if (!gruppiert[jahr]) {
                        gruppiert[jahr] = {};
                    }

                    if (!gruppiert[jahr][monatNum]) {
                        gruppiert[jahr][monatNum] = [];
                    }

                    gruppiert[jahr][monatNum].push(e);
                });
            }

            return gruppiert;
        }

        function toggleHaushaltJahr(jahr) {

            if (!context.session.state.offeneHaushaltJahre) {
                context.session.state.offeneHaushaltJahre = {};
            }

            context.session.state.offeneHaushaltJahre[jahr] = !context.session.state.offeneHaushaltJahre[jahr];

            renderHaushalt();
        }

        function toggleHaushaltMonat(jahr, monat) {

            if (!context.session.state.offeneHaushaltMonate) {
                context.session.state.offeneHaushaltMonate = {};
            }

            let key = jahr + "-" + monat;

            context.session.state.offeneHaushaltMonate[key] = !context.session.state.offeneHaushaltMonate[key];

            renderHaushalt();
        }

        function editHaushalt(jahr, monat, index) {

            let liste = gruppiereHaushalt()[jahr]?.[monat];
            if (!liste) return;

            let eintrag = liste[index];
            if (!eintrag) return;

            let neuerName = prompt("Beschreibung:", eintrag.text || eintrag.name || "");
            if (neuerName === null) return;

            let neuerBetrag = prompt("Betrag:", eintrag.betrag);
            if (neuerBetrag === null) return;

            let neuesDatum = prompt("Datum (YYYY-MM-DD):", eintrag.datum);
            if (neuesDatum === null) return;

            let originalMonat = new Date(eintrag.datum).getMonth() + 1;

            let originalListe = context.repository.view.Haushalt[originalMonat];
            if (!Array.isArray(originalListe)) return;

            let originalIndex = originalListe.findIndex(e => e.id === eintrag.id);
            if (originalIndex === -1) return;

            let updated = {
                id: eintrag.id,
                text: dependencies.formatText(neuerName),
                betrag: dependencies.parseBetrag(neuerBetrag),
                datum: neuesDatum
            };

            let neuerMonat = new Date(neuesDatum).getMonth() + 1;

            if (neuerMonat === originalMonat) {

                originalListe[originalIndex] = updated;

            } else {

                originalListe.splice(originalIndex, 1);

                if (!context.repository.view.Haushalt[neuerMonat]) {
                    context.repository.view.Haushalt[neuerMonat] = [];
                }

                context.repository.view.Haushalt[neuerMonat].push(updated);
            }

            if (dependencies.speichern() === false) return;
            renderHaushalt();
        }

        function deleteHaushalt(id) {

            if (!confirm("Eintrag löschen?")) return;
            dependencies.beginUndoDelete("Haushalt-Eintrag gelöscht");

            if (!context.repository.view.Haushalt) return;

            for (let monat in context.repository.view.Haushalt) {

                let liste = context.repository.view.Haushalt[monat];

                if (!Array.isArray(liste)) continue;

                let index = liste.findIndex(e => String(e.id) === String(id));

                if (index !== -1) {
                    liste.splice(index, 1);
                    break;
                }
            }

            if (dependencies.speichern() === false) return;
            renderHaushalt();
            dependencies.finishUndoDelete("Haushalt-Eintrag gelöscht");
        }

        function startEditHaushalt(id) {
            context.session.state.editHaushaltId = id;
            renderHaushalt();
        }

        function saveEditHaushalt(id) {

            let textEl = document.getElementById("editText-" + id);
            let betragEl = document.getElementById("editBetrag-" + id);
            let datumEl = document.getElementById("editDatum-" + id);

            if (!textEl || !betragEl || !datumEl) return;

            let text = textEl.value;
            let betrag = dependencies.parseBetrag(betragEl.value);
            let datum = datumEl.value;

            if (!text || isNaN(betrag) || !datum) return;

            let neuerMonat = new Date(datum).getMonth() + 1;

            let existingKategorie = "Sonstiges";
            for (let monat in context.repository.view.Haushalt) {
                const found = Array.isArray(context.repository.view.Haushalt[monat]) ? context.repository.view.Haushalt[monat].find(e => String(e.id) === String(id)) : null;
                if (found) { existingKategorie = found.kategorie || "Sonstiges"; break; }
            }

            let updated = {
                id,
                text: dependencies.formatText(text),
                betrag,
                datum,
                kategorie: existingKategorie,
                ...dependencies.readReminderControl(`edit:haushalt:${id}`)
            };

            for (let monat in context.repository.view.Haushalt) {

                let liste = context.repository.view.Haushalt[monat];

                if (!Array.isArray(liste)) continue;

                let index = liste.findIndex(e => String(e.id) === String(id));

                if (index !== -1) {

                    liste.splice(index, 1);

                    if (!context.repository.view.Haushalt[neuerMonat]) {
                        context.repository.view.Haushalt[neuerMonat] = [];
                    }

                    context.repository.view.Haushalt[neuerMonat].push(updated);

                    break;
                }
            }

            if (dependencies.speichern() === false) return;
            context.session.state.editHaushaltId = null;
            renderHaushalt();
        }

        function cancelEditHaushalt() {
            context.session.state.editHaushaltId = null;
            renderHaushalt();
        }

function bookHaushaltPlannedOccurrence(entry, datum, occurrenceKey, wiederholung) {
    const month = dependencies.parseISODate(datum).getMonth() + 1;
    context.repository.view.Haushalt[month] ??= [];
    const exists = context.repository.view.Haushalt[month].some(x => String(x.geplantOccurrenceKey || "") === occurrenceKey || (wiederholung === "einmalig" && String(x.geplantId || "") === String(entry.id)));
    if (!exists) context.repository.view.Haushalt[month].push({id:dependencies.generateId(), geplantId:entry.id, geplantOccurrenceKey:occurrenceKey, ausGeplant:true,
        text:entry.text || entry.kategorie || "Geplante Ausgabe", betrag:dependencies.parseBetrag(entry.betrag)||0, datum, kategorie:entry.kategorie||"Sonstiges"});
    return true;
}
function appendHaushaltExternalExpense(entry, month) { context.repository.view.Haushalt ??= {}; context.repository.view.Haushalt[month] ??= []; context.repository.view.Haushalt[month].push(entry); }

function haushaltImZeitraum(von, bis) {
            const liste = [];
            if (!context.repository.view.Haushalt) return liste;
            Object.values(context.repository.view.Haushalt).forEach(monatsListe => {
                if (!Array.isArray(monatsListe)) return;
                monatsListe.forEach(e => {
                    const d = dependencies.parseISODate(e.datum);
                    const betrag = dependencies.parseBetrag(e.betrag);
                    if (!d || isNaN(betrag)) return;
                    if (d >= von && d <= bis) liste.push({ ...e, betrag, datumObj: d });
                });
            });
            return liste;
        }

return { addHaushalt, renderHaushalt, deleteAlleHaushalt, gruppiereHaushalt, toggleHaushaltJahr, toggleHaushaltMonat, editHaushalt, deleteHaushalt, startEditHaushalt, saveEditHaushalt, cancelEditHaushalt, bookHaushaltPlannedOccurrence, appendHaushaltExternalExpense, haushaltImZeitraum };
});
