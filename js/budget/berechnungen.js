Kostentracker.module({
  "id": "js/budget/berechnungen.js",
  "dependencies": [
    "getGehaltszeitraum",
    "laufendeKostenImZeitraum",
    "parseBetrag",
    "versicherungenDiesenMonat",
    "versicherungsZahlungenImZeitraum"
  ],
  "session": [],
  "read": [],
  "write": [],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/budget/berechnungen.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function berechneMonat(monatAktuell) {

            return dependencies.versicherungenDiesenMonat(monatAktuell).reduce((summe, v) => {
                let betrag = dependencies.parseBetrag(v.betrag);
                return summe + (isNaN(betrag) ? 0 : betrag);
            }, 0);
        }

        function berechneSimpleMonat(liste, monatAktuell) {

            if (!Array.isArray(liste)) return 0;

            let summe = 0;

            liste.forEach(e => {

                let betrag = dependencies.parseBetrag(e.betrag);
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
            const zeitraum = dependencies.getGehaltszeitraum();

            const laufende = dependencies.laufendeKostenImZeitraum(zeitraum.start, zeitraum.ende)
                .reduce((sum, e) => sum + e.betrag, 0);

            const versicherungen = dependencies.versicherungsZahlungenImZeitraum(zeitraum.start, zeitraum.ende)
                .reduce((sum, e) => sum + e.betrag, 0);

            return laufende + versicherungen;
        }

return { berechneMonat, berechneSimpleMonat, berechneMonatGesamt };
});
