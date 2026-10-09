Kostentracker.module({
  "id": "js/budget/uebersicht.js",
  "dependencies": [
    "berechneNochFaelligBisGehalt",
    "berechneSparBudgetStatus",
    "einnahmenZahlungenImZeitraum",
    "escapeHtml",
    "formatBetrag",
    "formatDatum",
    "formatKurzDatum",
    "freizeitImZeitraum",
    "geplanteAusgabenImZeitraum",
    "getGehaltstag",
    "getGehaltszeitraum",
    "haushaltImZeitraum",
    "isoAusDate",
    "laufendeKostenImZeitraum",
    "maybeOpenNextSalaryPrompt",
    "reisenGesamt",
    "renderBudgetUndWochen",
    "renderHomeWarnings",
    "versicherungsZahlungenImZeitraum"
  ],
  "session": [
    "state"
  ],
  "read": [],
  "write": [],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/budget/uebersicht.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function renderUebersicht() {
            const z = dependencies.getGehaltszeitraum();
            const h = dependencies.haushaltImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const fr = dependencies.freizeitImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const f = dependencies.laufendeKostenImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const v = dependencies.versicherungsZahlungenImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const ei = dependencies.einnahmenZahlungenImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const gp = dependencies.geplanteAusgabenImZeitraum(z.start, z.ende).reduce((s,e)=>s+e.betrag,0);
            const sparStatus = dependencies.berechneSparBudgetStatus(z);
            const set=(id,val)=>{const el=document.getElementById(id); if(el) el.innerHTML=dependencies.formatBetrag(val);};
            set("overviewHaushalt",h); set("overviewFreizeit",fr); set("overviewFixkosten",f); set("overviewVersicherungen",v); set("overviewGeplant",gp); set("overviewReisen",dependencies.reisenGesamt());
            set("overviewSparenInvestieren", sparStatus.investieren + sparStatus.gespart);
            const siSub = document.getElementById("overviewSparenInvestierenSub");
            if (siSub) siSub.innerHTML = `Investiert ${dependencies.formatBetrag(sparStatus.investieren)} · Gespart ${dependencies.formatBetrag(sparStatus.gespart)} von ${dependencies.formatBetrag(sparStatus.sparenPlan)}`;
            const einnahmenEl = document.getElementById("overviewEinnahmen");
            if (einnahmenEl) einnahmenEl.innerHTML = "+" + dependencies.formatBetrag(ei);
        }

        function renderHomeUebersicht() {

            const zeitraum = dependencies.getGehaltszeitraum();
            dependencies.renderBudgetUndWochen(zeitraum);
            dependencies.renderHomeWarnings();

            // Kosten im aktuellen Gehaltsmonat:
            // Beispiel bei Gehaltstag 26: 26.04. bis 25.05.
            const laufendeImGehalt = dependencies.laufendeKostenImZeitraum(zeitraum.start, zeitraum.ende);
            const versicherungenImGehalt = dependencies.versicherungsZahlungenImZeitraum(zeitraum.start, zeitraum.ende);

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

            if (gesamtEl) gesamtEl.innerHTML = dependencies.formatBetrag(gesamt);
            if (laufendEl) laufendEl.innerHTML = dependencies.formatBetrag(laufend);
            if (versicherungenEl) versicherungenEl.innerHTML = dependencies.formatBetrag(versicherungen);

            if (kostenDetailsEl) {
                kostenDetailsEl.classList.toggle("hidden", !context.session.state.homeKostenOffen);
            }

            if (kostenToggleEl) {
                kostenToggleEl.innerText = context.session.state.homeKostenOffen ? "▲ Details ausblenden" : "▼ Details anzeigen";
            }

            if (laufendListeEl) {
                if (laufendeImGehalt.length === 0) {
                    laufendListeEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📌</div><div class="empty-state-title">Keine Fixkosten in dieser Periode</div><div class="empty-state-text">Für den aktuellen Gehaltszeitraum ist hier nichts eingeplant.</div></div>`;
                } else {
                    laufendListeEl.innerHTML = `
                    <small class="home-summary-small">Laufende Kosten</small>
                    ${laufendeImGehalt.map(e => `
                        <div class="home-mini-item">
                            <span>${dependencies.formatKurzDatum(e.datum)} ${dependencies.escapeHtml(e.name || "Laufende Kosten")}</span>
                            <span>${dependencies.formatBetrag(e.betrag)}</span>
                        </div>
                    `).join("")}
                `;
                }
            }

            if (monatEl) {
                monatEl.innerText =
                    "Gehaltsmonat: " + dependencies.formatDatum(dependencies.isoAusDate(zeitraum.start)) +
                    " bis " + dependencies.formatDatum(dependencies.isoAusDate(zeitraum.ende));
            }

            if (versListeEl) {
                if (versicherungenImGehalt.length === 0) {
                    versListeEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛡️</div><div class="empty-state-title">Keine Versicherungen in dieser Periode</div><div class="empty-state-text">Im aktuellen Gehaltszeitraum ist keine Versicherungszahlung fällig.</div></div>`;
                } else {
                    versListeEl.innerHTML = `
                    <small class="home-summary-small">Versicherungen</small>
                    ${versicherungenImGehalt.map(e => `
                        <div class="home-mini-item">
                            <span>${dependencies.formatKurzDatum(e.datum)} ${dependencies.escapeHtml(e.name || "Versicherung")}</span>
                            <span>${dependencies.formatBetrag(e.betrag)}</span>
                        </div>
                    `).join("")}
                `;
                }
            }

            const faellig = dependencies.berechneNochFaelligBisGehalt();
            const gehaltstagInput = document.getElementById("gehaltstagInput");
            const faelligGesamtEl = document.getElementById("homeFaelligGesamt");
            const faelligLaufendEl = document.getElementById("homeFaelligLaufend");
            const faelligVersEl = document.getElementById("homeFaelligVersicherungen");
            const faelligZeitraumEl = document.getElementById("homeFaelligZeitraum");
            const faelligListeEl = document.getElementById("homeFaelligListe");
            const faelligDetailsEl = document.getElementById("homeFaelligDetails");
            const faelligToggleEl = document.getElementById("homeFaelligToggle");

            if (gehaltstagInput && document.activeElement !== gehaltstagInput) {
                gehaltstagInput.value = dependencies.getGehaltstag();
            }

            if (faelligGesamtEl) faelligGesamtEl.innerHTML = dependencies.formatBetrag(faellig.gesamt);
            if (faelligLaufendEl) faelligLaufendEl.innerHTML = dependencies.formatBetrag(faellig.summeLaufend);
            if (faelligVersEl) faelligVersEl.innerHTML = dependencies.formatBetrag(faellig.summeVersicherungen);

            if (faelligZeitraumEl) {
                faelligZeitraumEl.innerText =
                    "Von heute bis " + dependencies.formatDatum(dependencies.isoAusDate(faellig.zeitraum.ende)) +
                    " · nächstes Gehalt am " + dependencies.formatDatum(dependencies.isoAusDate(faellig.zeitraum.naechstesGehalt));
            }

            if (faelligToggleEl) {
                faelligToggleEl.innerText = context.session.state.homeFaelligOffen ? "▲ Details ausblenden" : "▼ Details anzeigen";
            }

            if (faelligDetailsEl) {
                faelligDetailsEl.classList.toggle("hidden", !context.session.state.homeFaelligOffen);
            }

            setTimeout(dependencies.maybeOpenNextSalaryPrompt, 0);

            if (faelligListeEl) {
                if (faellig.alle.length === 0) {
                    faelligListeEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Alles berücksichtigt</div><div class="empty-state-text">Bis zum nächsten Gehalt ist aktuell nichts mehr fällig.</div></div>`;
                } else {
                    faelligListeEl.innerHTML = faellig.alle.map(e => `
                    <div class="home-due-item">
                        <span class="home-due-date">${dependencies.formatKurzDatum(e.datum)}</span>
                        <span class="home-due-name">
                            <span>${dependencies.escapeHtml(e.name)}</span>
                            <span class="home-due-type">${e.typLabel}</span>
                        </span>
                        <span class="home-due-amount">${dependencies.formatBetrag(e.betrag)}</span>
                    </div>
                `).join("");
                }
            }
        }

        

        

        

        

return { renderUebersicht, renderHomeUebersicht };
});
