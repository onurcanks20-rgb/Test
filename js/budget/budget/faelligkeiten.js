Kostentracker.module({
  "id": "js/budget/faelligkeiten.js",
  "dependencies": [
    "getGehaltszeitraum",
    "laufendeKostenImZeitraum",
    "versicherungsZahlungenImZeitraum"
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

            const summeLaufend = laufende.reduce((sum, e) => sum + e.betrag, 0);
            const summeVersicherungen = versicherungen.reduce((sum, e) => sum + e.betrag, 0);

            return {
                zeitraum,
                laufende,
                versicherungen,
                alle,
                summeLaufend,
                summeVersicherungen,
                gesamt: summeLaufend + summeVersicherungen
            };
        }

return { berechneNochFaelligBisGehalt };
});
