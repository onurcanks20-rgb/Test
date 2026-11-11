Kostentracker.module({
  "id": "js/budget/gehalt.js",
  "dependencies": [
    "addDays",
    "formatBetragText",
    "formatDatum",
    "formatInputBetrag",
    "isoAusDate",
    "openSettingsBudget",
    "parseBetrag",
    "parseISODate",
    "speichern",
    "startOfToday"
  ],
  "session": [
    "state"
  ],
  "read": [
    "Einstellungen"
  ],
  "write": [
    "Einstellungen"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/budget/gehalt.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function aktuellerTag() {
            return new Date().getDate();
        }

        function validiereGehaltstag(wert) {
            let tag = parseInt(wert, 10);
            if (isNaN(tag)) tag = 26;
            return Math.min(Math.max(tag, 1), 31);
        }

        function getGehaltstag() {
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.gehaltstag = validiereGehaltstag(context.repository.view.Einstellungen.gehaltstag);
            return context.repository.view.Einstellungen.gehaltstag;
        }

        function saveGehaltstag() {
            const input = document.getElementById("gehaltstagInput");
            const tag = validiereGehaltstag(input?.value);

            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.gehaltstag = tag;

            if (input) input.value = tag;

            if (dependencies.speichern() === false) return;
        }

        function datumMitSicheremTag(jahr, monatIndex, tag) {
            const letzterTag = new Date(jahr, monatIndex + 1, 0).getDate();
            const sichererTag = Math.min(Math.max(parseInt(tag, 10) || 1, 1), letzterTag);
            return new Date(jahr, monatIndex, sichererTag);
        }

        function berechneterGehaltstag(jahr, monatIndex, tag) {
            let d = datumMitSicheremTag(jahr, monatIndex, tag);
            if (d.getDay() === 6) d = dependencies.addDays(d, 2); // Samstag -> Montag
            if (d.getDay() === 0) d = dependencies.addDays(d, 1); // Sonntag -> Montag
            return d;
        }

        function standardGehaltszeitraumFuerDatum(referenz = dependencies.startOfToday()) {
            const ref = new Date(referenz.getFullYear(), referenz.getMonth(), referenz.getDate());
            const gehaltstag = getGehaltstag();
            const gehaltDieserMonat = berechneterGehaltstag(ref.getFullYear(), ref.getMonth(), gehaltstag);

            let start;
            let naechstesGehalt;
            if (ref >= gehaltDieserMonat) {
                start = gehaltDieserMonat;
                naechstesGehalt = berechneterGehaltstag(ref.getFullYear(), ref.getMonth() + 1, gehaltstag);
            } else {
                start = berechneterGehaltstag(ref.getFullYear(), ref.getMonth() - 1, gehaltstag);
                naechstesGehalt = gehaltDieserMonat;
            }
            return { start, naechstesGehalt, gehaltstag };
        }

        function getNextSalaryPlan() {
            context.repository.view.Einstellungen ??= {};
            const plan = context.repository.view.Einstellungen.naechstesGehaltPlan;
            if (!plan || typeof plan !== "object") return { datum: "", betrag: "", periodenStart: "" };
            return {
                datum: typeof plan.datum === "string" ? plan.datum : "",
                betrag: plan.betrag ?? "",
                periodenStart: typeof plan.periodenStart === "string" ? plan.periodenStart : ""
            };
        }

        function getGehaltszeitraum() {
            const heute = dependencies.startOfToday();
            const gehaltstag = getGehaltstag();
            const plan = getNextSalaryPlan();
            const planDatum = dependencies.parseISODate(plan.datum);
            const planPeriodenStart = dependencies.parseISODate(plan.periodenStart);
            const gespeicherterStart = dependencies.parseISODate(context.repository.view.Einstellungen?.aktuellerGehaltsstart);

            // Ein konkret vorgemerktes Gehalt hat Vorrang vor dem Standardtag.
            // Solange der Eingang nicht bestätigt wurde, bleibt die alte Periode aktiv.
            if (planDatum) {
                const standardVorPlan = standardGehaltszeitraumFuerDatum(dependencies.addDays(planDatum, -1));
                let start = standardVorPlan.start;
                if (planPeriodenStart && planPeriodenStart < planDatum) {
                    start = planPeriodenStart;
                } else if (gespeicherterStart && gespeicherterStart < planDatum) {
                    const abstand = Math.round((planDatum - gespeicherterStart) / 86400000);
                    if (abstand > 0 && abstand <= 45) start = gespeicherterStart;
                }

                // Ist das erwartete Datum schon erreicht/überschritten, verlängern wir die
                // laufende Periode bis heute. So landen neue Ausgaben nicht versehentlich
                // in einer noch gar nicht bestätigten neuen Gehaltsperiode.
                const naechstesGehalt = planDatum > heute ? planDatum : dependencies.addDays(heute, 1);
                const ende = dependencies.addDays(naechstesGehalt, -1);
                return { heute, start, ende, naechstesGehalt, geplantesGehalt: planDatum, gehaltstag, wartetAufBestaetigung: heute >= planDatum };
            }

            // Nach einer manuellen Bestätigung darf der neue Zeitraum auch dann schon
            // beginnen, wenn der reguläre Standardtag erst ein oder zwei Tage später wäre.
            if (gespeicherterStart && gespeicherterStart <= heute) {
                const nextStandard = berechneterGehaltstag(gespeicherterStart.getFullYear(), gespeicherterStart.getMonth() + 1, gehaltstag);
                if (heute < nextStandard) {
                    return { heute, start: gespeicherterStart, ende: dependencies.addDays(nextStandard, -1), naechstesGehalt: nextStandard, gehaltstag };
                }
            }

            const standard = standardGehaltszeitraumFuerDatum(heute);
            return { heute, start: standard.start, ende: dependencies.addDays(standard.naechstesGehalt, -1), naechstesGehalt: standard.naechstesGehalt, gehaltstag };
        }

        

        

        

        function gehaltsmonatKey(zeitraum = getGehaltszeitraum()) {
            return dependencies.isoAusDate(zeitraum.start);
        }

        function getStartgehalt(zeitraum = getGehaltszeitraum()) {
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.startgehaelter ??= {};
            const wert = dependencies.parseBetrag(context.repository.view.Einstellungen.startgehaelter[gehaltsmonatKey(zeitraum)]);
            return isNaN(wert) ? 0 : wert;
        }

        function saveStartgehalt() {
            const input = document.getElementById("startgehaltInput");
            if (!input) return;
            const wert = dependencies.parseBetrag(input.value);
            if (isNaN(wert) || wert < 0) return;
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.startgehaelter ??= {};
            context.repository.view.Einstellungen.startgehaelter[gehaltsmonatKey()] = wert;
            if (dependencies.speichern() === false) return;
        }

        function renderNextSalarySettings(message = "") {
            const plan = getNextSalaryPlan();
            const dateInput = document.getElementById("nextSalaryDateInput");
            const amountInput = document.getElementById("nextSalaryAmountInput");
            const status = document.getElementById("nextSalarySettingsStatus");
            if (dateInput && document.activeElement !== dateInput) dateInput.value = plan.datum || "";
            if (amountInput && document.activeElement !== amountInput) amountInput.value = plan.betrag === "" ? "" : dependencies.formatInputBetrag(plan.betrag);
            if (status) {
                if (message) status.textContent = message;
                else if (plan.datum) {
                    const d = dependencies.parseISODate(plan.datum);
                    const b = dependencies.parseBetrag(plan.betrag);
                    status.textContent = `Vorgemerkt: ${d ? dependencies.formatDatum(plan.datum) : plan.datum}${Number.isFinite(b) ? ` · ${dependencies.formatBetragText(b)}` : ""}. Am Datum fragt die App, ob das Gehalt wirklich angekommen ist.`;
                } else {
                    status.textContent = "Noch kein konkretes nächstes Gehalt vorgemerkt. Bis dahin gilt der reguläre Gehaltstag als Standard.";
                }
            }
        }

        function saveNextSalaryPlan() {
            const dateInput = document.getElementById("nextSalaryDateInput");
            const amountInput = document.getElementById("nextSalaryAmountInput");
            const datum = dateInput?.value || "";
            const betrag = dependencies.parseBetrag(amountInput?.value);
            const datumObj = dependencies.parseISODate(datum);
            const aktuellerStart = getGehaltszeitraum().start;
            if (!datumObj) {
                renderNextSalarySettings("Bitte ein gültiges Datum für das nächste Gehalt auswählen.");
                return;
            }
            if (datumObj <= aktuellerStart) {
                renderNextSalarySettings("Das nächste Gehalt muss nach dem Beginn der aktuellen Gehaltsperiode liegen.");
                return;
            }
            if (!Number.isFinite(betrag) || betrag < 0) {
                renderNextSalarySettings("Bitte einen gültigen Gehaltsbetrag eingeben.");
                return;
            }
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.naechstesGehaltPlan = { datum, betrag, periodenStart: dependencies.isoAusDate(aktuellerStart) };
            if (dependencies.speichern() === false) return;
            context.session.state.nextSalaryPromptSnoozed = false;
            renderNextSalarySettings("Nächstes Gehalt gespeichert. Der neue Zeitraum startet erst nach deiner Bestätigung.");
        }

        function clearNextSalaryPlan() {
            const plan = getNextSalaryPlan();
            if (!plan.datum && plan.betrag === "") return renderNextSalarySettings();
            if (!confirm("Vorgemerktes nächstes Gehalt wirklich löschen?")) return;
            context.repository.view.Einstellungen.naechstesGehaltPlan = { datum: "", betrag: "", periodenStart: "" };
            context.session.state.nextSalaryPromptSnoozed = false;
            document.getElementById("nextSalaryPromptSheet")?.classList.add("hidden");
            if (dependencies.speichern() === false) return;
            renderNextSalarySettings("Vormerkung gelöscht. Es gilt wieder der reguläre Gehaltstag.");
        }

        function maybeOpenNextSalaryPrompt() {
            if (context.session.state.nextSalaryPromptSnoozed) return;
            const plan = getNextSalaryPlan();
            const datum = dependencies.parseISODate(plan.datum);
            if (!datum || dependencies.startOfToday() < datum) return;
            if (document.getElementById("home")?.classList.contains("hidden")) return;
            const sheet = document.getElementById("nextSalaryPromptSheet");
            const text = document.getElementById("nextSalaryPromptText");
            if (!sheet || !sheet.classList.contains("hidden")) return;
            const betrag = dependencies.parseBetrag(plan.betrag);
            if (text) text.textContent = `Vorgemerkt für ${dependencies.formatDatum(plan.datum)}${Number.isFinite(betrag) ? ` mit ${dependencies.formatBetragText(betrag)}` : ""}. Erst mit „Ja“ beginnt der neue Gehaltszeitraum.`;
            sheet.classList.remove("hidden");
        }

        function confirmNextSalaryArrival() {
            const plan = getNextSalaryPlan();
            const datum = dependencies.parseISODate(plan.datum);
            const betrag = dependencies.parseBetrag(plan.betrag);
            if (!datum || !Number.isFinite(betrag) || betrag < 0) return;
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.startgehaelter ??= {};
            context.repository.view.Einstellungen.aktuellerGehaltsstart = plan.datum;
            context.repository.view.Einstellungen.startgehaelter[plan.datum] = betrag;
            context.repository.view.Einstellungen.naechstesGehaltPlan = { datum: "", betrag: "", periodenStart: "" };
            context.session.state.nextSalaryPromptSnoozed = false;
            document.getElementById("nextSalaryPromptSheet")?.classList.add("hidden");
            if (dependencies.speichern() === false) return;
        }

        function editNextSalaryFromPrompt() {
            context.session.state.nextSalaryPromptSnoozed = true;
            document.getElementById("nextSalaryPromptSheet")?.classList.add("hidden");
            dependencies.openSettingsBudget();
            setTimeout(() => document.getElementById("nextSalaryDateInput")?.focus(), 80);
        }

        function snoozeNextSalaryPrompt() {
            context.session.state.nextSalaryPromptSnoozed = true;
            document.getElementById("nextSalaryPromptSheet")?.classList.add("hidden");
        }

return { aktuellerTag, validiereGehaltstag, getGehaltstag, saveGehaltstag, datumMitSicheremTag, berechneterGehaltstag, standardGehaltszeitraumFuerDatum, getNextSalaryPlan, getGehaltszeitraum, gehaltsmonatKey, getStartgehalt, saveStartgehalt, renderNextSalarySettings, saveNextSalaryPlan, clearNextSalaryPlan, maybeOpenNextSalaryPrompt, confirmNextSalaryArrival, editNextSalaryFromPrompt, snoozeNextSalaryPrompt };
});
