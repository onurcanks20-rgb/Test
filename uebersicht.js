// Kostentracker Test: js/budget/uebersicht.js
// Functions share the existing app state; initialize only in app/start.js.

        function renderUebersicht() {
            const z = getGehaltszeitraum();
            const h = haushaltImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const fr = freizeitImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const f = laufendeKostenImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const v = versicherungsZahlungenImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const ei = einnahmenZahlungenImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const gp = geplanteAusgabenImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const sparStatus = berechneSparBudgetStatus(z);
            const set=(id,val)=>{const el=document.getElementById(id); if(el) el.innerHTML=formatBetrag(val);};
            set("overviewHaushalt",h); set("overviewFreizeit",fr); set("overviewFixkosten",f); set("overviewVersicherungen",v); set("overviewGeplant",gp); set("overviewReisen",reisenGesamt());
            set("overviewSparenInvestieren", sparStatus.investieren + sparStatus.gespart);
            const siSub = document.getElementById("overviewSparenInvestierenSub");
            if (siSub) siSub.innerHTML = `Investiert ${formatBetrag(sparStatus.investieren)} · Gespart ${formatBetrag(sparStatus.gespart)} von ${formatBetrag(sparStatus.sparenPlan)}`;
            const einnahmenEl = document.getElementById("overviewEinnahmen");
            if (einnahmenEl) einnahmenEl.innerHTML = "+" + formatBetrag(ei);
        }

        function renderHomeUebersicht() {

            const zeitraum = getGehaltszeitraum();
            renderBudgetUndWochen(zeitraum);
            renderHomeWarnings();

            // Kosten im aktuellen Gehaltsmonat:
            // Beispiel bei Gehaltstag 26: 26.04. bis 25.05.
            const laufendeImGehalt = laufendeKostenImZeitraum(zeitraum.start, zeitraum.ende);
            const versicherungenImGehalt = versicherungsZahlungenImZeitraum(zeitraum.start, zeitraum.ende);

            const laufend = laufendeImGehalt.reduce((sum, e) => sum + e.betrag, 0);
            const versicherungen = versicherungenImGehalt.reduce((sum, e) => sum + e.betrag, 0);
            const gesamt = laufend + versicherungen;

            const gesamtEl = document.getElementById("homeKostenGesamt");
            const laufendEl = document.getElementById("homeKostenLaufend");
            const versicherungenEl = document.getElementById("homeKostenVersicherungen");
            const monatEl = document.getElementById("homeKostenMonatLabel");
            const kostenDetailsEl = document.getElementById("homeKostenDetails");
            const kostenToggleEl = document.getElementById("homeKostenToggle");
            const laufendListeEl = document.getElementById("homeKostenLaufendListe");
            const versListeEl = document.getElementById("homeVersicherungenListe");

            if (gesamtEl) gesamtEl.innerHTML = formatBetrag(gesamt);
            if (laufendEl) laufendEl.innerHTML = formatBetrag(laufend);
            if (versicherungenEl) versicherungenEl.innerHTML = formatBetrag(versicherungen);

            if (kostenDetailsEl) {
                kostenDetailsEl.classList.toggle("hidden", !state.homeKostenOffen);
            }

            if (kostenToggleEl) {
                kostenToggleEl.innerText = state.homeKostenOffen ? "▲ Details ausblenden" : "▼ Details anzeigen";
            }

            if (laufendListeEl) {
                if (laufendeImGehalt.length === 0) {
                    laufendListeEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📌</div><div class="empty-state-title">Keine Fixkosten in dieser Periode</div><div class="empty-state-text">Für den aktuellen Gehaltszeitraum ist hier nichts eingeplant.</div></div>`;
                } else {
                    laufendListeEl.innerHTML = `
                    <small class="home-summary-small">Laufende Kosten</small>
                    ${laufendeImGehalt.map(e => `
                        <div class="home-mini-item">
                            <span>${formatKurzDatum(e.datum)} ${escapeHtml(e.name || "Laufende Kosten")}</span>
                            <span>${formatBetrag(e.betrag)}</span>
                        </div>
                    `).join("")}
                `;
                }
            }

            if (monatEl) {
                monatEl.innerText =
                    "Gehaltsmonat: " + formatDatum(isoAusDate(zeitraum.start)) +
                    " bis " + formatDatum(isoAusDate(zeitraum.ende));
            }

            if (versListeEl) {
                if (versicherungenImGehalt.length === 0) {
                    versListeEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛡️</div><div class="empty-state-title">Keine Versicherungen in dieser Periode</div><div class="empty-state-text">Im aktuellen Gehaltszeitraum ist keine Versicherungszahlung fällig.</div></div>`;
                } else {
                    versListeEl.innerHTML = `
                    <small class="home-summary-small">Versicherungen</small>
                    ${versicherungenImGehalt.map(e => `
                        <div class="home-mini-item">
                            <span>${formatKurzDatum(e.datum)} ${escapeHtml(e.name || "Versicherung")}</span>
                            <span>${formatBetrag(e.betrag)}</span>
                        </div>
                    `).join("")}
                `;
                }
            }

            const faellig = berechneNochFaelligBisGehalt();
            const gehaltstagInput = document.getElementById("gehaltstagInput");
            const faelligGesamtEl = document.getElementById("homeFaelligGesamt");
            const faelligLaufendEl = document.getElementById("homeFaelligLaufend");
            const faelligVersEl = document.getElementById("homeFaelligVersicherungen");
            const faelligZeitraumEl = document.getElementById("homeFaelligZeitraum");
            const faelligListeEl = document.getElementById("homeFaelligListe");
            const faelligDetailsEl = document.getElementById("homeFaelligDetails");
            const faelligToggleEl = document.getElementById("homeFaelligToggle");

            if (gehaltstagInput && document.activeElement !== gehaltstagInput) {
                gehaltstagInput.value = getGehaltstag();
            }

            if (faelligGesamtEl) faelligGesamtEl.innerHTML = formatBetrag(faellig.gesamt);
            if (faelligLaufendEl) faelligLaufendEl.innerHTML = formatBetrag(faellig.summeLaufend);
            if (faelligVersEl) faelligVersEl.innerHTML = formatBetrag(faellig.summeVersicherungen);

            if (faelligZeitraumEl) {
                faelligZeitraumEl.innerText =
                    "Von heute bis " + formatDatum(isoAusDate(faellig.zeitraum.ende)) +
                    " · nächstes Gehalt am " + formatDatum(isoAusDate(faellig.zeitraum.naechstesGehalt));
            }

            if (faelligToggleEl) {
                faelligToggleEl.innerText = state.homeFaelligOffen ? "▲ Details ausblenden" : "▼ Details anzeigen";
            }

            if (faelligDetailsEl) {
                faelligDetailsEl.classList.toggle("hidden", !state.homeFaelligOffen);
            }

            setTimeout(maybeOpenNextSalaryPrompt, 0);

            if (faelligListeEl) {
                if (faellig.alle.length === 0) {
                    faelligListeEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Alles berücksichtigt</div><div class="empty-state-text">Bis zum nächsten Gehalt ist aktuell nichts mehr fällig.</div></div>`;
                } else {
                    faelligListeEl.innerHTML = faellig.alle.map(e => `
                    <div class="home-due-item">
                        <span class="home-due-date">${formatKurzDatum(e.datum)}</span>
                        <span class="home-due-name">
                            <span>${escapeHtml(e.name)}</span>
                            <span class="home-due-type">${e.typLabel}</span>
                        </span>
                        <span class="home-due-amount">${formatBetrag(e.betrag)}</span>
                    </div>
                `).join("");
                }
            }
        }

        function kostenLaufend() {

            daten["Laufende Kosten"] ??= { fix: [] };
            daten["Laufende Kosten"].fix ??= [];

            return daten["Laufende Kosten"].fix.reduce((sum, e) => {
                let betrag = parseBetrag(e.betrag);
                return sum + (isNaN(betrag) ? 0 : betrag);
            }, 0);
        }

        function berechneGesamtFixkosten() {
            return berechneMonatGesamt();
        }

        function berechneLaufendeKosten(monatTag = new Date().getDate()) {

            return daten["Laufende Kosten"].fix.reduce((sum, e) => {
                return sum + e.betrag;
            }, 0);
        }

        function faelligeKostenHeute() {
            let tag = new Date().getDate();

            return daten["Laufende Kosten"].fix.filter(e => tagAusDatum(e.datum || datumAusTagAktuellerMonat(e.tag)) === tag);
        }
