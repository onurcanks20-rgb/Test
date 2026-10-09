// Kostentracker Test: js/budget/gehalt.js
// Functions share the existing app state; initialize only in app/start.js.

        function aktuellerTag() {
            return new Date().getDate();
        }

        function validiereGehaltstag(wert) {
            let tag = parseInt(wert, 10);
            if (isNaN(tag)) tag = 26;
            return Math.min(Math.max(tag, 1), 31);
        }

        function getGehaltstag() {
            daten.Einstellungen ??= {};
            daten.Einstellungen.gehaltstag = validiereGehaltstag(daten.Einstellungen.gehaltstag);
            return daten.Einstellungen.gehaltstag;
        }

        function saveGehaltstag() {
            const input = document.getElementById("gehaltstagInput");
            const tag = validiereGehaltstag(input?.value);

            daten.Einstellungen ??= {};
            daten.Einstellungen.gehaltstag = tag;

            if (input) input.value = tag;

            if (speichern() === false) return;
        }

        function datumMitSicheremTag(jahr, monatIndex, tag) {
            const letzterTag = new Date(jahr, monatIndex + 1, 0).getDate();
            const sichererTag = Math.min(Math.max(parseInt(tag, 10) || 1, 1), letzterTag);
            return new Date(jahr, monatIndex, sichererTag);
        }

        function berechneterGehaltstag(jahr, monatIndex, tag) {
            let d = datumMitSicheremTag(jahr, monatIndex, tag);
            if (d.getDay() === 6) d = addDays(d, 2); // Samstag -> Montag
            if (d.getDay() === 0) d = addDays(d, 1); // Sonntag -> Montag
            return d;
        }

        function standardGehaltszeitraumFuerDatum(referenz = startOfToday()) {
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
            daten.Einstellungen ??= {};
            const plan = daten.Einstellungen.naechstesGehaltPlan;
            if (!plan || typeof plan !== "object") return { datum: "", betrag: "", periodenStart: "" };
            return {
                datum: typeof plan.datum === "string" ? plan.datum : "",
                betrag: plan.betrag ?? "",
                periodenStart: typeof plan.periodenStart === "string" ? plan.periodenStart : ""
            };
        }

        function getGehaltszeitraum() {
            const heute = startOfToday();
            const gehaltstag = getGehaltstag();
            const plan = getNextSalaryPlan();
            const planDatum = parseISODate(plan.datum);
            const planPeriodenStart = parseISODate(plan.periodenStart);
            const gespeicherterStart = parseISODate(daten.Einstellungen?.aktuellerGehaltsstart);

            // Ein konkret vorgemerktes Gehalt hat Vorrang vor dem Standardtag.
            // Solange der Eingang nicht bestätigt wurde, bleibt die alte Periode aktiv.
            if (planDatum) {
                const standardVorPlan = standardGehaltszeitraumFuerDatum(addDays(planDatum, -1));
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
                const naechstesGehalt = planDatum > heute ? planDatum : addDays(heute, 1);
                const ende = addDays(naechstesGehalt, -1);
                return { heute, start, ende, naechstesGehalt, geplantesGehalt: planDatum, gehaltstag, wartetAufBestaetigung: heute >= planDatum };
            }

            // Nach einer manuellen Bestätigung darf der neue Zeitraum auch dann schon
            // beginnen, wenn der reguläre Standardtag erst ein oder zwei Tage später wäre.
            if (gespeicherterStart && gespeicherterStart <= heute) {
                const nextStandard = berechneterGehaltstag(gespeicherterStart.getFullYear(), gespeicherterStart.getMonth() + 1, gehaltstag);
                if (heute < nextStandard) {
                    return { heute, start: gespeicherterStart, ende: addDays(nextStandard, -1), naechstesGehalt: nextStandard, gehaltstag };
                }
            }

            const standard = standardGehaltszeitraumFuerDatum(heute);
            return { heute, start: standard.start, ende: addDays(standard.naechstesGehalt, -1), naechstesGehalt: standard.naechstesGehalt, gehaltstag };
        }

        function formatText(text) {
            if (!text) return "";
            return String(text).trim();
        }

        function formatDateGroupLabel(value) {
            const d = value instanceof Date ? new Date(value) : parseISODate(value);
            if (!d || isNaN(d)) return "Ohne Datum";
            const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            const heute = heuteISO();
            const gesternDate = addDays(startOfToday(), -1);
            const gestern = `${gesternDate.getFullYear()}-${String(gesternDate.getMonth()+1).padStart(2,"0")}-${String(gesternDate.getDate()).padStart(2,"0")}`;
            if (iso === heute) return "Heute";
            if (iso === gestern) return "Gestern";
            return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
        }

        function appendDateGroupHeader(container, value, options = {}) {
            if (!container) return;
            const el = document.createElement("div");
            const hasTotal = Number.isFinite(Number(options.total));
            el.className = `date-group-title${options.first ? " first" : ""}${options.inset ? " inset" : ""}${hasTotal ? " has-total" : ""}`;
            const left = document.createElement("span");
            left.textContent = options.label || formatDateGroupLabel(value);
            if (options.note) {
                const small = document.createElement("small");
                small.textContent = options.note;
                left.appendChild(small);
            }
            el.appendChild(left);
            if (hasTotal) {
                const total = document.createElement("span");
                total.className = "date-group-total";
                total.textContent = formatBetragText(Number(options.total));
                el.appendChild(total);
            }
            container.appendChild(el);
        }

        function gehaltsmonatKey(zeitraum = getGehaltszeitraum()) {
            return isoAusDate(zeitraum.start);
        }

        function getStartgehalt(zeitraum = getGehaltszeitraum()) {
            daten.Einstellungen ??= {};
            daten.Einstellungen.startgehaelter ??= {};
            const wert = parseBetrag(daten.Einstellungen.startgehaelter[gehaltsmonatKey(zeitraum)]);
            return isNaN(wert) ? 0 : wert;
        }

        function saveStartgehalt() {
            const input = document.getElementById("startgehaltInput");
            if (!input) return;
            const wert = parseBetrag(input.value);
            if (isNaN(wert) || wert < 0) return;
            daten.Einstellungen ??= {};
            daten.Einstellungen.startgehaelter ??= {};
            daten.Einstellungen.startgehaelter[gehaltsmonatKey()] = wert;
            if (speichern() === false) return;
        }

        function renderNextSalarySettings(message = "") {
            const plan = getNextSalaryPlan();
            const dateInput = document.getElementById("nextSalaryDateInput");
            const amountInput = document.getElementById("nextSalaryAmountInput");
            const status = document.getElementById("nextSalarySettingsStatus");
            if (dateInput && document.activeElement !== dateInput) dateInput.value = plan.datum || "";
            if (amountInput && document.activeElement !== amountInput) amountInput.value = plan.betrag === "" ? "" : formatInputBetrag(plan.betrag);
            if (status) {
                if (message) status.textContent = message;
                else if (plan.datum) {
                    const d = parseISODate(plan.datum);
                    const b = parseBetrag(plan.betrag);
                    status.textContent = `Vorgemerkt: ${d ? formatDatum(plan.datum) : plan.datum}${Number.isFinite(b) ? ` · ${formatBetragText(b)}` : ""}. Am Datum fragt die App, ob das Gehalt wirklich angekommen ist.`;
                } else {
                    status.textContent = "Noch kein konkretes nächstes Gehalt vorgemerkt. Bis dahin gilt der reguläre Gehaltstag als Standard.";
                }
            }
        }

        function saveNextSalaryPlan() {
            const dateInput = document.getElementById("nextSalaryDateInput");
            const amountInput = document.getElementById("nextSalaryAmountInput");
            const datum = dateInput?.value || "";
            const betrag = parseBetrag(amountInput?.value);
            const datumObj = parseISODate(datum);
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
            daten.Einstellungen ??= {};
            daten.Einstellungen.naechstesGehaltPlan = { datum, betrag, periodenStart: isoAusDate(aktuellerStart) };
            if (speichern() === false) return;
            state.nextSalaryPromptSnoozed = false;
            renderNextSalarySettings("Nächstes Gehalt gespeichert. Der neue Zeitraum startet erst nach deiner Bestätigung.");
        }

        function clearNextSalaryPlan() {
            const plan = getNextSalaryPlan();
            if (!plan.datum && plan.betrag === "") return renderNextSalarySettings();
            if (!confirm("Vorgemerktes nächstes Gehalt wirklich löschen?")) return;
            daten.Einstellungen.naechstesGehaltPlan = { datum: "", betrag: "", periodenStart: "" };
            state.nextSalaryPromptSnoozed = false;
            document.getElementById("nextSalaryPromptSheet")?.classList.add("hidden");
            if (speichern() === false) return;
            renderNextSalarySettings("Vormerkung gelöscht. Es gilt wieder der reguläre Gehaltstag.");
        }

        function maybeOpenNextSalaryPrompt() {
            if (state.nextSalaryPromptSnoozed) return;
            const plan = getNextSalaryPlan();
            const datum = parseISODate(plan.datum);
            if (!datum || startOfToday() < datum) return;
            if (document.getElementById("home")?.classList.contains("hidden")) return;
            const sheet = document.getElementById("nextSalaryPromptSheet");
            const text = document.getElementById("nextSalaryPromptText");
            if (!sheet || !sheet.classList.contains("hidden")) return;
            const betrag = parseBetrag(plan.betrag);
            if (text) text.textContent = `Vorgemerkt für ${formatDatum(plan.datum)}${Number.isFinite(betrag) ? ` mit ${formatBetragText(betrag)}` : ""}. Erst mit „Ja“ beginnt der neue Gehaltszeitraum.`;
            sheet.classList.remove("hidden");
        }

        function confirmNextSalaryArrival() {
            const plan = getNextSalaryPlan();
            const datum = parseISODate(plan.datum);
            const betrag = parseBetrag(plan.betrag);
            if (!datum || !Number.isFinite(betrag) || betrag < 0) return;
            daten.Einstellungen ??= {};
            daten.Einstellungen.startgehaelter ??= {};
            daten.Einstellungen.aktuellerGehaltsstart = plan.datum;
            daten.Einstellungen.startgehaelter[plan.datum] = betrag;
            daten.Einstellungen.naechstesGehaltPlan = { datum: "", betrag: "", periodenStart: "" };
            state.nextSalaryPromptSnoozed = false;
            document.getElementById("nextSalaryPromptSheet")?.classList.add("hidden");
            if (speichern() === false) return;
        }

        function editNextSalaryFromPrompt() {
            state.nextSalaryPromptSnoozed = true;
            document.getElementById("nextSalaryPromptSheet")?.classList.add("hidden");
            openSettingsBudget();
            setTimeout(() => document.getElementById("nextSalaryDateInput")?.focus(), 80);
        }

        function snoozeNextSalaryPrompt() {
            state.nextSalaryPromptSnoozed = true;
            document.getElementById("nextSalaryPromptSheet")?.classList.add("hidden");
        }
