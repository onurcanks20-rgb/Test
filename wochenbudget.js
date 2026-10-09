// Kostentracker Test: js/budget/wochenbudget.js
// Functions share the existing app state; initialize only in app/start.js.

        function verteileWochenBetraege(betrag, segmente) {
            const tage = segmente.map(seg => Math.max(1, Math.round((seg.ende - seg.start) / 86400000) + 1));
            const gesamtTage = tage.reduce((sum, wert) => sum + wert, 0);
            if (!gesamtTage) return [];
            const gesamtCent = Math.round(betrag * 100);
            let bisherTage = 0;
            let bisherCent = 0;
            return tage.map(wert => {
                bisherTage += wert;
                const bisHierCent = Math.round(gesamtCent * bisherTage / gesamtTage);
                const anteil = (bisHierCent - bisherCent) / 100;
                bisherCent = bisHierCent;
                return anteil;
            });
        }

        function openWeekPreview() {
            const sheet = document.getElementById("weekPreviewSheet");
            const list = document.getElementById("weekPreviewList");
            const totalEl = document.getElementById("weekPreviewTotal");
            if (!sheet || !list || !totalEl) return;

            const zeitraum = getGehaltszeitraum();
            const start = getStartgehalt(zeitraum);
            const laufendSum = laufendeKostenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const versSum = versicherungsZahlungenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const einnahmenSum = einnahmenZahlungenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const geplantSum = geplanteReservierungenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const sparStatus = berechneSparBudgetStatus(zeitraum);
            const sparenInvestierenGesamt = sparStatus.investieren + sparStatus.sparenPlan;
            const alltagGesamt = alltagImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const freiJetzt = sparStatus.frei;

            const heute = startOfToday();
            const kalenderMontag = montagDerWoche(heute);
            const kalenderSonntag = addDays(kalenderMontag, 6);
            const wochenStart = kalenderMontag < zeitraum.start ? new Date(zeitraum.start) : kalenderMontag;
            const wochenEnde = kalenderSonntag > zeitraum.ende ? new Date(zeitraum.ende) : kalenderSonntag;

            const alltagVorWoche = alltagImZeitraum(zeitraum.start, addDays(wochenStart, -1)).reduce((s,e)=>s+e.betrag,0);
            const verfuegbarZuWochenbeginn = start + einnahmenSum - laufendSum - versSum - alltagVorWoche - geplantSum - sparenInvestierenGesamt;
            const tageInAktuellerWoche = Math.max(1, Math.round((wochenEnde - wochenStart) / 86400000) + 1);
            const verbleibendeTageAbWochenstart = Math.max(1, Math.round((zeitraum.ende - wochenStart) / 86400000) + 1);
            const wochenBudgetStart = verfuegbarZuWochenbeginn * (tageInAktuellerWoche / verbleibendeTageAbWochenstart);
            const bisHeute = heute < wochenEnde ? heute : wochenEnde;
            const alltagDieseWoche = alltagImZeitraum(wochenStart, bisHeute).reduce((s,e)=>s+e.betrag,0);
            const dieseWocheUebrig = Math.round((wochenBudgetStart - alltagDieseWoche) * 100) / 100;

            const rows = [{
                label: dieseWocheUebrig < 0 ? "Diese Woche · überschritten" : "Diese Woche · fest",
                start: wochenStart,
                ende: wochenEnde,
                betrag: dieseWocheUebrig,
                hinweis: dieseWocheUebrig < 0 ? "Bereits im Gesamtbetrag verrechnet" : "",
                current: true
            }];

            // Ein positiver Wochenrest ist reserviert. Eine Überschreitung bleibt
            // als Information sichtbar, ist aber bereits im frei verfügbaren Rest
            // enthalten. Deshalb wird sie nicht ein zweites Mal verrechnet.
            let futureStart = addDays(kalenderSonntag, 1);
            if (futureStart < zeitraum.start) futureStart = new Date(zeitraum.start);
            if (futureStart <= zeitraum.ende) {
                const futureSegments = wochenSegmente(futureStart, zeitraum.ende);
                const fuerFolgewochenAktuell = Math.round(freiJetzt * 100) / 100 - Math.max(0, dieseWocheUebrig);
                const folgeBetraege = verteileWochenBetraege(fuerFolgewochenAktuell, futureSegments);

                futureSegments.forEach((seg, idx) => {
                    rows.push({
                        label: idx === 0 ? "Nächste Woche · Vorschau" : `Woche ${idx + 2} · Vorschau`,
                        start: seg.start,
                        ende: seg.ende,
                        betrag: folgeBetraege[idx],
                        current: false
                    });
                });
            }

            list.innerHTML = rows.map(r => `
                <div class="week-preview-row${r.current ? ' current' : ''}">
                    <div class="week-preview-left">
                        <div class="week-preview-label">${r.label}</div>
                        <div class="week-preview-dates">${formatKurzDatum(r.start)} – ${formatKurzDatum(r.ende)}</div>
                        ${r.hinweis ? `<div class="week-preview-dates">${r.hinweis}</div>` : ""}
                    </div>
                    <div class="week-preview-value">${formatBetrag(r.betrag)}</div>
                </div>`).join("");

            totalEl.innerHTML = formatBetrag(freiJetzt);
            sheet.classList.remove("hidden");
        }

        function closeWeekPreview() {
            document.getElementById("weekPreviewSheet")?.classList.add("hidden");
        }

        function alltagImZeitraum(von, bis) {
            return [...haushaltImZeitraum(von, bis), ...freizeitImZeitraum(von, bis)];
        }

        function montagDerWoche(datum) {
            const d = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
            const tag = d.getDay();
            d.setDate(d.getDate() - (tag === 0 ? 6 : tag - 1));
            return d;
        }

        function wochenSegmente(von, bis) {
            const result = [];
            let start = new Date(von);
            while (start <= bis) {
                const kalenderMontag = montagDerWoche(start);
                let ende = addDays(kalenderMontag, 6);
                if (ende > bis) ende = new Date(bis);
                result.push({ start: new Date(start), ende });
                start = addDays(ende, 1);
            }
            return result;
        }

        function renderBudgetUndWochen(zeitraum) {
            const start = getStartgehalt(zeitraum);
            const haushalt = haushaltImZeitraum(zeitraum.start, zeitraum.ende);
            const freizeit = freizeitImZeitraum(zeitraum.start, zeitraum.ende);
            const haushaltSum = haushalt.reduce((s,e)=>s+e.betrag,0);
            const freizeitSum = freizeit.reduce((s,e)=>s+e.betrag,0);
            const laufende = laufendeKostenImZeitraum(zeitraum.start, zeitraum.ende);
            const vers = versicherungsZahlungenImZeitraum(zeitraum.start, zeitraum.ende);
            const laufendSum = laufende.reduce((s,e)=>s+e.betrag,0);
            const versSum = vers.reduce((s,e)=>s+e.betrag,0);
            const einnahmenSum = einnahmenZahlungenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const geplantSum = geplanteReservierungenImZeitraum(zeitraum.start, zeitraum.ende).reduce((s,e)=>s+e.betrag,0);
            const sparStatus = berechneSparBudgetStatus(zeitraum);
            const investierenSum = sparStatus.investieren;
            const sparenPlanSum = sparStatus.sparenPlan;
            const gespartAktuell = sparStatus.gespart;
            const sparenInvestierenGesamt = investierenSum + sparenPlanSum;
            const verfuegbar = sparStatus.frei;

            const set = (id, val) => { const el=document.getElementById(id); if(el) el.innerHTML=formatBetrag(val); };
            set("homeBudgetStart", start);
            set("homeBudgetEinnahmen", einnahmenSum);
            const einnahmenDetail = document.getElementById("homeBudgetEinnahmen");
            if (einnahmenDetail) einnahmenDetail.innerHTML = "+" + formatBetrag(einnahmenSum);
            set("homeBudgetHaushalt", haushaltSum);
            set("homeBudgetFreizeit", freizeitSum);
            set("homeBudgetLaufend", laufendSum);
            set("homeBudgetVers", versSum);
            set("homeBudgetGeplant", geplantSum);
            set("homeBudgetInvestieren", investierenSum);
            set("homeBudgetSparenPlan", sparenPlanSum);
            set("homeBudgetGespart", gespartAktuell);
            set("homeGespart", gespartAktuell);
            set("homeBudgetVerfuegbar", verfuegbar);
            set("homeBudgetVerfuegbarDetail", verfuegbar);

            const heute = startOfToday();

            // Wochenbudget-Logik:
            // - Montag bis Sonntag bleibt das Startbudget der aktuellen Woche unveraendert.
            // - Ausgaben der aktuellen Woche werden vom Wochenbudget abgezogen.
            // - Sobald die aktuelle Woche ins Minus rutscht, wird dieses Minus in der Vorschau
            //   sofort auf die kommenden Wochen verteilt. Positive Reste werden erst Montag neu verteilt.
            // - Angebrochene Wochen bis zum Gehalt werden nach ihren tatsaechlichen Tagen gewichtet.
            const kalenderMontag = montagDerWoche(heute);
            const kalenderSonntag = addDays(kalenderMontag, 6);

            const wochenStart = kalenderMontag < zeitraum.start ? new Date(zeitraum.start) : kalenderMontag;
            const wochenEnde = kalenderSonntag > zeitraum.ende ? new Date(zeitraum.ende) : kalenderSonntag;

            const alltagVorWoche = alltagImZeitraum(zeitraum.start, addDays(wochenStart, -1))
                .reduce((s, e) => s + e.betrag, 0);

            // Das Geld, das zu Beginn dieser Woche noch fuer Alltag zur Verfuegung stand.
            const verfuegbarZuWochenbeginn = start + einnahmenSum - laufendSum - versSum - alltagVorWoche - geplantSum - sparenInvestierenGesamt;

            const tageInAktuellerWoche = Math.max(1, Math.round((wochenEnde - wochenStart) / 86400000) + 1);
            const verbleibendeTageAbWochenstart = Math.max(1, Math.round((zeitraum.ende - wochenStart) / 86400000) + 1);

            // Anteil fuer diese Woche. Dadurch werden Teilwochen vor dem Gehalt fair gewichtet.
            const wochenBudgetStart = verfuegbarZuWochenbeginn * (tageInAktuellerWoche / verbleibendeTageAbWochenstart);

            const bisHeute = heute < wochenEnde ? heute : wochenEnde;
            const alltagDieseWoche = alltagImZeitraum(wochenStart, bisHeute)
                .reduce((s, e) => s + e.betrag, 0);

            // Waehrend der Woche bleibt wochenBudgetStart gleich. Nur der Restbetrag sinkt mit neuen Ausgaben.
            const wochenBudgetUebrig = Math.round((wochenBudgetStart - alltagDieseWoche) * 100) / 100;
            set("homeWeekAmount", wochenBudgetUebrig);
            const weekPreview = document.getElementById("weekPreviewSheet");
            if (weekPreview && !weekPreview.classList.contains("hidden")) openWeekPreview();

            const weekDates = document.getElementById("homeWeekDates");
            if (weekDates) weekDates.innerText = `${formatKurzDatum(wochenStart)} – ${formatKurzDatum(wochenEnde)}`;

            const nextSalary = document.getElementById("homeNextSalary");
            if (nextSalary) {
                const plan = getNextSalaryPlan();
                const planDatum = parseISODate(plan.datum);
                const planBetrag = parseBetrag(plan.betrag);
                const anzeigeDatum = planDatum || zeitraum.geplantesGehalt || zeitraum.naechstesGehalt;
                nextSalary.innerText = `${formatDatum(isoAusDate(anzeigeDatum))}${planDatum && Number.isFinite(planBetrag) ? ` · ${formatBetragText(planBetrag)}` : ""}`;
            }

            const periodDates = document.getElementById("homePeriodDates");
            if (periodDates) periodDates.innerText = `${formatKurzDatum(zeitraum.start)} – ${formatKurzDatum(zeitraum.ende)}`;

            const details = document.getElementById("freiDetails");
            const toggle = document.getElementById("freiDetailsToggle");
            if (details) details.classList.toggle("hidden", !state.freiDetailsOffen);
            if (toggle) toggle.innerText = state.freiDetailsOffen ? "Details ausblenden ⌃" : "Details anzeigen ›";

            const input=document.getElementById("startgehaltInput");
            if(input && document.activeElement!==input) input.value = start === "" ? "" : formatInputBetrag(start);
        }
