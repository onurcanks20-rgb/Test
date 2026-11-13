Kostentracker.module({
  "id": "js/budget/berechnungen.js",
  "dependencies": [
    "getGehaltszeitraum",
    "laufendeKostenImZeitraum",
    "parseBetrag",
    "versicherungenDiesenMonat",
    "versicherungsZahlungenImZeitraum",
    "rundeCent",
    "summeBetraege"
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

            return dependencies.summeBetraege(dependencies.versicherungenDiesenMonat(monatAktuell));
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

            return dependencies.rundeCent(summe);
        }

        function berechneMonatGesamt() {
            const zeitraum = dependencies.getGehaltszeitraum();

            const laufende = dependencies.summeBetraege(dependencies.laufendeKostenImZeitraum(zeitraum.start, zeitraum.ende));

            const versicherungen = dependencies.summeBetraege(dependencies.versicherungsZahlungenImZeitraum(zeitraum.start, zeitraum.ende));

            return dependencies.rundeCent(laufende + versicherungen);
        }

return { berechneMonat, berechneSimpleMonat, berechneMonatGesamt };
});
