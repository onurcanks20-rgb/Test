// Kostentracker Test: js/budget/zeitraeume.js
// Functions share the existing app state; initialize only in app/start.js.

        function haushaltImZeitraum(von, bis) {
            const liste = [];
            if (!daten.Haushalt) return liste;
            Object.values(daten.Haushalt).forEach(monatsListe => {
                if (!Array.isArray(monatsListe)) return;
                monatsListe.forEach(e => {
                    const d = parseISODate(e.datum);
                    const betrag = parseBetrag(e.betrag);
                    if (!d || isNaN(betrag)) return;
                    if (d >= von && d <= bis) liste.push({ ...e, betrag, datumObj: d });
                });
            });
            return liste;
        }

        function freizeitImZeitraum(von, bis) {
            const liste = [];
            if (!daten.Freizeit) return liste;
            Object.values(daten.Freizeit).forEach(monatsListe => {
                if (!Array.isArray(monatsListe)) return;
                monatsListe.forEach(e => {
                    const d = parseISODate(e.datum);
                    const betrag = parseBetrag(e.betrag);
                    if (!d || isNaN(betrag)) return;
                    if (d >= von && d <= bis) liste.push({ ...e, betrag, datumObj: d });
                });
            });
            return liste;
        }

        function einnahmenZahlungenImZeitraum(von, bis) {
            const result = [];
            if (!Array.isArray(daten.Einnahmen)) return result;

            daten.Einnahmen.forEach(e => {
                const betrag = parseBetrag(e.betrag);
                const start = parseISODate(e.datum);
                if (!start || isNaN(betrag) || betrag <= 0) return;

                if (e.wiederholung !== "monatlich") {
                    if (start >= von && start <= bis) result.push({ ...e, betrag, datumObj: start });
                    return;
                }

                let jahr = von.getFullYear();
                let monat = von.getMonth();
                const startTag = start.getDate();
                let kandidat = new Date(jahr, monat, Math.min(startTag, new Date(jahr, monat + 1, 0).getDate()));
                if (kandidat < start) {
                    monat += 1;
                    if (monat > 11) { monat = 0; jahr += 1; }
                }

                while (true) {
                    const letzterTag = new Date(jahr, monat + 1, 0).getDate();
                    const zahlung = new Date(jahr, monat, Math.min(startTag, letzterTag));
                    if (zahlung > bis) break;
                    if (zahlung >= von && zahlung >= start) {
                        result.push({ ...e, betrag, datumObj: zahlung, datumVorkommen: isoAusDate(zahlung) });
                    }
                    monat += 1;
                    if (monat > 11) { monat = 0; jahr += 1; }
                }
            });

            return result;
        }
