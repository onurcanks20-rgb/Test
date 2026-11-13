Kostentracker.module({
  "id": "js/budget/faelligkeiten.js",
  "dependencies": [
    "getGehaltszeitraum",
    "laufendeKostenImZeitraum",
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
// Kostentracker Test: js/budget/faelligkeiten.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        

        

        

        function berechneNochFaelligBisGehalt() {
            const zeitraum = dependencies.getGehaltszeitraum();

            const laufende = dependencies.laufendeKostenImZeitraum(zeitraum.heute, zeitraum.ende);
            const versicherungen = dependencies.versicherungsZahlungenImZeitraum(zeitraum.heute, zeitraum.ende);

            const alle = [...laufende, ...versicherungen].sort((a, b) => a.datum - b.datum);

            const summeLaufend = dependencies.summeBetraege(laufende);
            const summeVersicherungen = dependencies.summeBetraege(versicherungen);

            return {
                zeitraum,
                laufende,
                versicherungen,
                alle,
                summeLaufend,
                summeVersicherungen,
                gesamt: dependencies.rundeCent(summeLaufend + summeVersicherungen)
            };
        }

return { berechneNochFaelligBisGehalt };
});
