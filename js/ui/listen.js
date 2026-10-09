// Kostentracker Test: js/ui/listen.js
// Functions share the existing app state; initialize only in app/start.js.

        function renderSimple() {

            if (!aktuelleSimple) return;

            console.log("AKTUELLE KATEGORIE:", aktuelleSimple);

            if (aktuelleSimple === "Versicherungen") {
                renderVersicherungen();
            }
            else if (aktuelleSimple === "Laufende Kosten") {
                renderLaufendeKosten();
            }
            else if (aktuelleSimple === "Haushalt") {
                renderHaushalt();
            }
            else if (aktuelleSimple === "Freizeit") {
                renderFreizeit();
            }
        }

        function editEintrag(k, i) {

            if (!aktuellesLand || !daten.Reisen[aktuellesLand]) return;

            let eintrag = daten.Reisen[aktuellesLand][k][i];
            if (!eintrag) return;

            let neuerText = prompt("Beschreibung:", eintrag.text);
            if (neuerText === null) return;

            let neuerBetrag = prompt("Betrag:", eintrag.betrag);
            if (neuerBetrag === null) return;

            let neuesDatum = prompt("Datum (YYYY-MM-DD):", eintrag.datum);
            if (neuesDatum === null) return;

            daten.Reisen[aktuellesLand][k][i] = {
                ...eintrag,
                text: neuerText,
                betrag: parseBetrag(neuerBetrag),
                datum: neuesDatum
            };

            if (speichern() === false) return;
            renderListe();
        }

        function deleteEintrag(k, i) {

            if (!confirm("Eintrag wirklich löschen?")) return;
            beginUndoDelete("Reiseausgabe gelöscht");

            if (!aktuellesLand || !daten.Reisen[aktuellesLand]) return;
            if (!daten.Reisen[aktuellesLand][k]) return;

            daten.Reisen[aktuellesLand][k].splice(i, 1);

            if (speichern() === false) return;
            renderListe();
            finishUndoDelete("Reiseausgabe gelöscht");
        }
