// Kostentracker Test: js/kategorien/versicherungen.js
// Functions share the existing app state; initialize only in app/start.js.

        function addVersicherung() {

            let name = formatText(document.getElementById("versName").value);
            let betrag = parseBetrag(document.getElementById("versBetrag").value);
            let datum = document.getElementById("versDatum").value;

            let anbieter = formatText(document.getElementById("versAnbieter").value);
            let versicherungsnummer = document.getElementById("versNummer").value;
            let intervall = document.getElementById("versIntervall").value;
            let monat = parseInt(document.getElementById("versMonat").value);

            if (!name || isNaN(betrag)) return;

            // 🛡️ Sicherheit
            if (!Array.isArray(daten.Versicherungen)) {
                daten.Versicherungen = [];
            }

            if (isNaN(monat)) monat = 1;

            if (addItem(daten.Versicherungen, {
                id: generateId(),
                name,
                betrag,
                datum,
                anbieter,
                versicherungsnummer,
                intervall,
                monat,
                ...readReminderControl("add:versicherungen")
            }) === false) return;


            // Reset
            document.getElementById("versName").value = "";
            document.getElementById("versBetrag").value = "";
            document.getElementById("versDatum").value = heuteISO();

            document.getElementById("versAnbieter").value = "";
            document.getElementById("versNummer").value = "";

            document.getElementById("versIntervall").value = "monatlich";
            document.getElementById("versMonat").value = String(getAktuellerMonat());
            document.getElementById("versAddPanel")?.classList.add("hidden");

            renderVersicherungen();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
        }

        function renderVersicherungen() {

            const div = document.getElementById("versicherungenListe");
            const footer = document.getElementById("versicherungenFooter");
            const total = document.getElementById("versicherungenGesamt");

            if (!div || !footer) return;

            div.innerHTML = "";
            footer.innerHTML = "";

            if (!Array.isArray(daten.Versicherungen)) {
                daten.Versicherungen = [];
            }
            document.getElementById("versicherungenDeleteAllBtn")?.classList.toggle("hidden", daten.Versicherungen.length === 0);

            if (!state.offeneVersicherungen) {
                state.offeneVersicherungen = {};
            }

            if (daten.Versicherungen.length === 0) {
                div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛡️</div><div class="empty-state-title">Noch keine Versicherungen</div><div class="empty-state-text">Neue Versicherungen und ihre Zahlungsintervalle werden hier gesammelt.</div></div>`;
            }

            const suche = getSearchTerm("versicherungenSuche");
            const versicherungenSortiert = [...daten.Versicherungen]
                .filter(v => !istEintragAusgeblendet("versicherungen", v.id))
                .filter(v => matchesSearch(suche, v.name, v.anbieter, v.versicherungsnummer, v.intervall, v.datum, v.betrag))
                .sort((a,b) => {
                    const da = naechsteZahlungDatum(a);
                    const db = naechsteZahlungDatum(b);
                    return (da?.getTime() || Number.MAX_SAFE_INTEGER) - (db?.getTime() || Number.MAX_SAFE_INTEGER);
                });

            if (!versicherungenSortiert.length && daten.Versicherungen.length > 0 && !suche) {
                div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👁️‍🗨️</div><div class="empty-state-title">Alle Versicherungen sind ausgeblendet</div><div class="empty-state-text">Unter Einstellungen → Gesten → Ausgeblendete verwalten kannst du sie wieder einblenden.</div></div>`;
            }

            let letzteVersicherungsGruppe = null;
            versicherungenSortiert.forEach((v) => {

                const naechsteDatum = naechsteZahlungDatum(v);
                const gruppenKey = naechsteDatum ? naechsteDatum.toISOString().slice(0,10) : (v.datum || "ohne-datum");
                if (gruppenKey !== letzteVersicherungsGruppe) {
                    appendDateGroupHeader(div, naechsteDatum || v.datum, { first: letzteVersicherungsGruppe === null, note: "Nächste Zahlung" });
                    letzteVersicherungsGruppe = gruppenKey;
                }
                const naechste = naechsteZahlung(v);
                const isEdit = String(state.editVersicherungId) === String(v.id);
                const istOffen = !!state.offeneVersicherungen[String(v.id)];

                const item = document.createElement("div");
                item.className = "item";

                if (!isEdit) {
                    item.classList.add("compact-alltag-card");
                    item.innerHTML = `
                <div style="display:flex; flex-direction:column; width:100%; gap:10px;">

                    <div class="compact-alltag-content">
                        <div class="compact-alltag-main" onclick="toggleVersicherungDetails('${v.id}')" style="cursor:pointer;">
                            <span class="compact-alltag-title">${escapeHtml(v.name || "Versicherung")}</span>
                            ${v.anbieter ? `<span class="compact-alltag-sub">${escapeHtml(v.anbieter)}</span>` : ''}
                        </div>
                        <strong class="compact-alltag-amount">${formatBetrag(v.betrag)}</strong>
                        <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                            <button onclick="event.stopPropagation(); moveAusgabe('versicherungen','${v.id}')" title="Verschieben">↪️</button>
                            <button class="edit" onclick="event.stopPropagation(); startEditVersicherung('${v.id}')">✏️</button>
                            <button class="delete" onclick="event.stopPropagation(); deleteVersicherung('${v.id}')">🗑️</button>
                        </div>
                    </div>

                    ${istOffen ? `
                        <div style="
                            background:#3a3a3c;
                            border-radius:14px;
                            padding:12px;
                            display:flex;
                            flex-direction:column;
                            gap:8px;
                            font-size:14px;
                        ">
                            <div style="display:flex; justify-content:space-between; gap:10px;">
                                <span style="opacity:0.7;">Nächste Zahlung</span>
                                <span style="font-weight:600; text-align:right;">${naechste}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; gap:10px;">
                                <span style="opacity:0.7;">Anbieter</span>
                                <span style="font-weight:600; text-align:right;">${escapeHtml(v.anbieter || "-")}</span>
                            </div>

                            <div style="display:flex; justify-content:space-between; gap:10px;">
                                <span style="opacity:0.7;">Kunden-/Versicherungsnummer</span>
                                <span style="font-weight:600; text-align:right;">${escapeHtml(v.versicherungsnummer || "-")}</span>
                            </div>

                            <div style="display:flex; justify-content:space-between; gap:10px;">
                                <span style="opacity:0.7;">Intervall</span>
                                <span style="font-weight:600;">${escapeHtml(v.intervall || "-")}</span>
                            </div>

                            <div style="display:flex; justify-content:space-between; gap:10px;">
                                <span style="opacity:0.7;">Startdatum</span>
                                <span style="font-weight:600;">${v.datum ? formatDatum(v.datum) : "-"}</span>
                            </div>

                            <div style="display:flex; justify-content:space-between; gap:10px;">
                                <span style="opacity:0.7;">Startmonat</span>
                                <span style="font-weight:600;">${getMonatName(getStartMonatVersicherung(v))}</span>
                            </div>
                        </div>
                    ` : ""}

                </div>
            `;
                }

                else {

                    item.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:6px; width:100%;">

                    <input id="editName-${v.id}" value="${escapeHtml(v.name || "")}" autocapitalize="words">
                    <input id="editBetrag-${v.id}" type="text" inputmode="decimal" value="${formatInputBetrag(v.betrag)}">
                    <input id="editDatum-${v.id}" type="date" value="${v.datum || ""}">

                    <input id="editAnbieter-${v.id}" value="${escapeHtml(v.anbieter || "")}" autocapitalize="words">
                    <input id="editNummer-${v.id}" value="${escapeHtml(v.versicherungsnummer || "")}" autocapitalize="words">

                    <select id="editIntervall-${v.id}">
                        <option value="monatlich" ${v.intervall === "monatlich" ? "selected" : ""}>monatlich</option>
                        <option value="vierteljährlich" ${v.intervall === "vierteljährlich" ? "selected" : ""}>vierteljährlich</option>
                        <option value="halbjährlich" ${v.intervall === "halbjährlich" ? "selected" : ""}>halbjährlich</option>
                        <option value="jährlich" ${v.intervall === "jährlich" ? "selected" : ""}>jährlich</option>
                    </select>

                    <select id="editMonat-${v.id}">
                        <option value="1" ${parseInt(v.monat) === 1 ? "selected" : ""}>Januar</option>
                        <option value="2" ${parseInt(v.monat) === 2 ? "selected" : ""}>Februar</option>
                        <option value="3" ${parseInt(v.monat) === 3 ? "selected" : ""}>März</option>
                        <option value="4" ${parseInt(v.monat) === 4 ? "selected" : ""}>April</option>
                        <option value="5" ${parseInt(v.monat) === 5 ? "selected" : ""}>Mai</option>
                        <option value="6" ${parseInt(v.monat) === 6 ? "selected" : ""}>Juni</option>
                        <option value="7" ${parseInt(v.monat) === 7 ? "selected" : ""}>Juli</option>
                        <option value="8" ${parseInt(v.monat) === 8 ? "selected" : ""}>August</option>
                        <option value="9" ${parseInt(v.monat) === 9 ? "selected" : ""}>September</option>
                        <option value="10" ${parseInt(v.monat) === 10 ? "selected" : ""}>Oktober</option>
                        <option value="11" ${parseInt(v.monat) === 11 ? "selected" : ""}>November</option>
                        <option value="12" ${parseInt(v.monat) === 12 ? "selected" : ""}>Dezember</option>
                    </select>

                    <div style="display:flex; gap:10px; margin-top:6px;">
                        <button onclick="saveEditVersicherung('${v.id}')">💾 Speichern</button>
                        <button onclick="cancelEditVersicherung()">❌ Abbrechen</button>
                    </div>

                </div>
            `;

                    setTimeout(() => setupVersicherungEditEnterFlow(v.id), 0);
                }

                div.appendChild(item);
            });


            if (total) {
                total.innerHTML = "Fixkosten pro aktuellem Gehaltsmonat: " + formatBetrag(berechneGesamtFixkosten());
            }
        }

        function toggleVersicherungDetails(id) {
            if (!state.offeneVersicherungen) {
                state.offeneVersicherungen = {};
            }

            const key = String(id);
            state.offeneVersicherungen[key] = !state.offeneVersicherungen[key];

            renderVersicherungen();
        }

        function naechsteZahlungDatum(v) {
            if (!v.datum) return null;
            const heute = new Date();
            heute.setHours(0,0,0,0);
            const start = parseISODate(v.datum) || new Date(v.datum);
            if (!start || isNaN(start)) return null;
            const tag = start.getDate();
            let datum = new Date(start);
            function addInterval(months = 0, years = 0) {
                if (months) datum.setMonth(datum.getMonth() + months);
                if (years) datum.setFullYear(datum.getFullYear() + years);
                datum.setDate(tag);
            }
            if (v.intervall === "monatlich") while (datum <= heute) addInterval(1);
            else if (v.intervall === "vierteljährlich") while (datum <= heute) addInterval(3);
            else if (v.intervall === "halbjährlich") while (datum <= heute) addInterval(6);
            else if (v.intervall === "jährlich") while (datum <= heute) addInterval(0, 1);
            else return null;
            return datum;
        }

        function naechsteZahlung(v) {
            const datum = naechsteZahlungDatum(v);
            if (!datum) return "-";
            return formatDatum(datum.toISOString().split("T")[0]);
        }

        function deleteVersicherung(id) {

            if (!confirm("Versicherung löschen?")) return;
            beginUndoDelete("Versicherung gelöscht");

            if (!Array.isArray(daten.Versicherungen)) {
                daten.Versicherungen = [];
                return;
            }

            let index = daten.Versicherungen.findIndex(v => String(v.id) === String(id));

            if (index !== -1) {
                daten.Versicherungen.splice(index, 1);
            }

            if (speichern() === false) return;
            renderVersicherungen();
            finishUndoDelete("Versicherung gelöscht");
        }

        function toggleVersicherung(id) {
            toggleVersicherungDetails(id);
        }

        function getStartMonatVersicherung(v) {

            let monat = parseInt(v.monat);

            if (!isNaN(monat) && monat >= 1 && monat <= 12) {
                return monat;
            }

            if (v.datum) {
                let d = new Date(v.datum);
                if (!isNaN(d)) return d.getMonth() + 1;
            }

            return 1;
        }

        function istVersicherungFaelligInMonat(v, monatAktuell) {

            let intervall = v.intervall || "monatlich";
            let monat = getStartMonatVersicherung(v);

            if (intervall === "monatlich") {
                return true;
            }

            if (intervall === "jährlich") {
                return monat === monatAktuell;
            }

            if (intervall === "halbjährlich") {
                let zweiterMonat = ((monat + 6 - 1) % 12) + 1;
                return monat === monatAktuell || zweiterMonat === monatAktuell;
            }

            if (intervall === "vierteljährlich") {
                for (let i = 0; i < 4; i++) {
                    let m = ((monat + i * 3 - 1) % 12) + 1;
                    if (m === monatAktuell) return true;
                }
            }

            return false;
        }

        function versicherungenDiesenMonat(monatAktuell = getAktuellerMonat()) {

            if (!Array.isArray(daten.Versicherungen)) return [];

            return daten.Versicherungen.filter(v => {
                let betrag = parseBetrag(v.betrag);
                if (isNaN(betrag)) return false;

                return istVersicherungFaelligInMonat(v, monatAktuell);
            });
        }

        function deleteAlleVersicherungen() {

            if (!confirm("Alle Versicherungen wirklich löschen?")) return;
            beginUndoDelete("Alle Versicherungen gelöscht");

            if (!Array.isArray(daten.Versicherungen)) {
                daten.Versicherungen = [];
            } else {
                daten.Versicherungen.length = 0;
            }

            if (speichern() === false) return;
            renderVersicherungen();
            finishUndoDelete("Alle Versicherungen gelöscht");
        }

        function startEditVersicherung(id) {

            state.editHaushaltId = null; // optional reset
            state.editVersicherungId = id;

            renderVersicherungen();
        }

        function cancelEditVersicherung() {
            state.editVersicherungId = null;
            renderVersicherungen();
        }

        function saveEditVersicherung(id) {

            let v = daten.Versicherungen.find(e => String(e.id) === String(id));
            if (!v) return;

            let datumEl = document.getElementById("editDatum-" + id);
            let nameEl = document.getElementById("editName-" + id);
            let betragEl = document.getElementById("editBetrag-" + id);
            let anbieterEl = document.getElementById("editAnbieter-" + id);
            let nummerEl = document.getElementById("editNummer-" + id);
            let intervallEl = document.getElementById("editIntervall-" + id);
            let monatEl = document.getElementById("editMonat-" + id);

            if (!datumEl || !nameEl || !betragEl || !anbieterEl || !nummerEl || !intervallEl || !monatEl) return;

            let datum = datumEl.value;
            let name = nameEl.value;
            let betrag = parseBetrag(betragEl.value);
            let anbieter = anbieterEl.value;
            let nummer = nummerEl.value;
            let intervall = intervallEl.value;
            let monat = parseInt(monatEl.value);

            if (!name || isNaN(betrag) || !datum || isNaN(monat)) return;

            v.datum = datum;
            v.name = formatText(name);
            v.betrag = betrag;
            v.anbieter = formatText(anbieter || "");
            v.versicherungsnummer = nummer || "";
            v.intervall = intervall;
            v.monat = monat;
            Object.assign(v, readReminderControl(`edit:versicherungen:${id}`));

            if (speichern() === false) return;

            state.editVersicherungId = null;
            renderVersicherungen();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
        }
