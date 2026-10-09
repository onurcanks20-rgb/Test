// Kostentracker Test: js/kategorien/haushalt.js
// Functions share the existing app state; initialize only in app/start.js.

        function addHaushalt() {

            let text = formatText(document.getElementById("hausText").value);
            let betrag = parseBetrag(document.getElementById("hausBetrag").value);
            let datum = document.getElementById("hausDatum").value;
            let kategorie = document.getElementById("hausKategorie")?.value || "Sonstiges";

            if (isNaN(betrag) || !datum) return;
            if (!text) text = kategorie;

            let monat = new Date(datum).getMonth() + 1;

            if (!daten.Haushalt[monat]) {
                daten.Haushalt[monat] = [];
            }

            daten.Haushalt[monat].push({
                id: generateId(),
                text,
                betrag,
                datum,
                kategorie,
                ...readReminderControl("add:haushalt")
            });
            merkeLetzteKategorie("haushalt", kategorie);

            if (speichern() === false) return;

            // reset
            document.getElementById("hausText").value = "";
            document.getElementById("hausBetrag").value = "";
            document.getElementById("hausDatum").value = heuteISO();
            applyLetzteAlltagsKategorie("haushalt");
            document.getElementById("hausAddPanel")?.classList.add("hidden");

            renderHaushalt();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
        }

        function renderHaushalt() {
            const hatEintraege = Object.values(daten.Haushalt || {}).some(liste => Array.isArray(liste) && liste.length > 0);
            document.getElementById("haushaltDeleteAllBtn")?.classList.toggle("hidden", !hatEintraege);
            renderBereichWocheninfo("haushalt");
            renderRecentAusgaben("haushalt");
        }

        function deleteAlleHaushalt() {

            if (!confirm("Alle Haushalt-Einträge wirklich löschen?")) return;
            beginUndoDelete("Alle Haushalt-Einträge gelöscht");

            if (!daten.Haushalt) {
                daten.Haushalt = {};
            }

            for (let monat in daten.Haushalt) {
                if (Array.isArray(daten.Haushalt[monat])) {
                    daten.Haushalt[monat] = [];
                }
            }

            if (speichern() === false) return;
            renderHaushalt();
            finishUndoDelete("Alle Haushalt-Einträge gelöscht");
        }

        function gruppiereHaushalt() {

            let gruppiert = {};

            if (!daten.Haushalt) return gruppiert;

            for (let monat in daten.Haushalt) {

                let liste = daten.Haushalt[monat];

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

            if (!state.offeneHaushaltJahre) {
                state.offeneHaushaltJahre = {};
            }

            state.offeneHaushaltJahre[jahr] = !state.offeneHaushaltJahre[jahr];

            renderHaushalt();
        }

        function toggleHaushaltMonat(jahr, monat) {

            if (!state.offeneHaushaltMonate) {
                state.offeneHaushaltMonate = {};
            }

            let key = jahr + "-" + monat;

            state.offeneHaushaltMonate[key] = !state.offeneHaushaltMonate[key];

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

            let originalListe = daten.Haushalt[originalMonat];
            if (!Array.isArray(originalListe)) return;

            let originalIndex = originalListe.findIndex(e => e.id === eintrag.id);
            if (originalIndex === -1) return;

            let updated = {
                id: eintrag.id,
                text: formatText(neuerName),
                betrag: parseBetrag(neuerBetrag),
                datum: neuesDatum
            };

            let neuerMonat = new Date(neuesDatum).getMonth() + 1;

            if (neuerMonat === originalMonat) {

                originalListe[originalIndex] = updated;

            } else {

                originalListe.splice(originalIndex, 1);

                if (!daten.Haushalt[neuerMonat]) {
                    daten.Haushalt[neuerMonat] = [];
                }

                daten.Haushalt[neuerMonat].push(updated);
            }

            if (speichern() === false) return;
            renderHaushalt();
        }

        function deleteHaushalt(id) {

            if (!confirm("Eintrag löschen?")) return;
            beginUndoDelete("Haushalt-Eintrag gelöscht");

            if (!daten.Haushalt) return;

            for (let monat in daten.Haushalt) {

                let liste = daten.Haushalt[monat];

                if (!Array.isArray(liste)) continue;

                let index = liste.findIndex(e => String(e.id) === String(id));

                if (index !== -1) {
                    liste.splice(index, 1);
                    break;
                }
            }

            if (speichern() === false) return;
            renderHaushalt();
            finishUndoDelete("Haushalt-Eintrag gelöscht");
        }

        function startEditHaushalt(id) {
            state.editHaushaltId = id;
            renderHaushalt();
        }

        function saveEditHaushalt(id) {

            let textEl = document.getElementById("editText-" + id);
            let betragEl = document.getElementById("editBetrag-" + id);
            let datumEl = document.getElementById("editDatum-" + id);

            if (!textEl || !betragEl || !datumEl) return;

            let text = textEl.value;
            let betrag = parseBetrag(betragEl.value);
            let datum = datumEl.value;

            if (!text || isNaN(betrag) || !datum) return;

            let neuerMonat = new Date(datum).getMonth() + 1;

            let existingKategorie = "Sonstiges";
            for (let monat in daten.Haushalt) {
                const found = Array.isArray(daten.Haushalt[monat]) ? daten.Haushalt[monat].find(e => String(e.id) === String(id)) : null;
                if (found) { existingKategorie = found.kategorie || "Sonstiges"; break; }
            }

            let updated = {
                id,
                text: formatText(text),
                betrag,
                datum,
                kategorie: existingKategorie,
                ...readReminderControl(`edit:haushalt:${id}`)
            };

            for (let monat in daten.Haushalt) {

                let liste = daten.Haushalt[monat];

                if (!Array.isArray(liste)) continue;

                let index = liste.findIndex(e => String(e.id) === String(id));

                if (index !== -1) {

                    liste.splice(index, 1);

                    if (!daten.Haushalt[neuerMonat]) {
                        daten.Haushalt[neuerMonat] = [];
                    }

                    daten.Haushalt[neuerMonat].push(updated);

                    break;
                }
            }

            if (speichern() === false) return;
            state.editHaushaltId = null;
            renderHaushalt();
        }

        function cancelEditHaushalt() {
            state.editHaushaltId = null;
            renderHaushalt();
        }
