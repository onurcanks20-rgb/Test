// Kostentracker Test: js/budget/berechnungen.js
// Functions share the existing app state; initialize only in app/start.js.

        function berechneMonat(monatAktuell) {

            return versicherungenDiesenMonat(monatAktuell).reduce((summe, v) => {
                let betrag = parseBetrag(v.betrag);
                return summe + (isNaN(betrag) ? 0 : betrag);
            }, 0);
        }

        function berechneSimpleMonat(liste, monatAktuell) {

            if (!Array.isArray(liste)) return 0;

            let summe = 0;

            liste.forEach(e => {

                let betrag = parseBetrag(e.betrag);
                if (isNaN(betrag)) return;

                let monat = parseInt(e.monat);
                if (isNaN(monat)) monat = 1;

                if (e.intervall === "monatlich") {
                    summe += betrag;
                }

                else if (e.intervall === "jährlich") {
                    if (monat === monatAktuell) {
                        summe += betrag;
                    }
                }

            });

            return summe;
        }

        function berechneMonatGesamt() {
            const zeitraum = getGehaltszeitraum();

            const laufende = laufendeKostenImZeitraum(zeitraum.start, zeitraum.ende)
                .reduce((sum, e) => sum + e.betrag, 0);

            const versicherungen = versicherungsZahlungenImZeitraum(zeitraum.start, zeitraum.ende)
                .reduce((sum, e) => sum + e.betrag, 0);

            return laufende + versicherungen;
        }
