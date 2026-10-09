// Kostentracker Test: js/budget/faelligkeiten.js
// Functions share the existing app state; initialize only in app/start.js.

        function intervallInMonaten(intervall) {
            if (intervall === "vierteljährlich") return 3;
            if (intervall === "halbjährlich") return 6;
            if (intervall === "jährlich") return 12;
            return 1;
        }

        function laufendeKostenImZeitraum(von, bis) {
            daten["Laufende Kosten"] ??= { fix: [] };
            daten["Laufende Kosten"].fix ??= [];

            const faellig = [];

            daten["Laufende Kosten"].fix.forEach(k => {
                const betrag = parseBetrag(k.betrag);
                if (isNaN(betrag)) return;

                const startDatum = parseISODate(k.datum || datumAusTagAktuellerMonat(k.tag));
                if (!startDatum) return;

                const tag = tagAusDatum(k.datum || datumAusTagAktuellerMonat(k.tag));

                // Wichtig:
                // Das eingegebene Datum ist der erste mögliche Abbuchungstermin.
                // Beispiel: 28.05. darf NICHT schon als 28.04. im Gehaltsmonat 26.04.-25.05. auftauchen.
                let datum = datumMitSicheremTag(von.getFullYear(), von.getMonth(), tag);

                while (datum < von || datum < startDatum) {
                    datum = datumMitSicheremTag(datum.getFullYear(), datum.getMonth() + 1, tag);
                }

                while (datum <= bis) {
                    faellig.push({
                        typ: "laufend",
                        typLabel: "Fixkosten",
                        sourceId: k.id,
                        name: k.text || k.name || "Fixkosten",
                        betrag,
                        datum: new Date(datum)
                    });

                    datum = datumMitSicheremTag(datum.getFullYear(), datum.getMonth() + 1, tag);
                }
            });

            return faellig;
        }

        function versicherungsZahlungenImZeitraum(von, bis) {
            if (!Array.isArray(daten.Versicherungen)) return [];

            const faellig = [];

            daten.Versicherungen.forEach(v => {
                const betrag = parseBetrag(v.betrag);
                if (isNaN(betrag)) return;

                let start = parseISODate(v.datum);

                if (!start) {
                    const monat = getStartMonatVersicherung(v);
                    start = datumMitSicheremTag(von.getFullYear(), monat - 1, 1);
                }

                const tag = start.getDate();
                const intervallMonate = intervallInMonaten(v.intervall);
                let datum = new Date(start);

                while (datum < von) {
                    datum = datumMitSicheremTag(datum.getFullYear(), datum.getMonth() + intervallMonate, tag);
                }

                while (datum <= bis) {
                    faellig.push({
                        typ: "versicherung",
                        typLabel: "Versicherung",
                        sourceId: v.id,
                        name: v.name || "Versicherung",
                        betrag,
                        datum: new Date(datum)
                    });

                    datum = datumMitSicheremTag(datum.getFullYear(), datum.getMonth() + intervallMonate, tag);
                }
            });

            return faellig;
        }

        function berechneNochFaelligBisGehalt() {
            const zeitraum = getGehaltszeitraum();

            const laufende = laufendeKostenImZeitraum(zeitraum.heute, zeitraum.ende);
            const versicherungen = versicherungsZahlungenImZeitraum(zeitraum.heute, zeitraum.ende);

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
