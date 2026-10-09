// Kostentracker Test: js/ui/eintragsaktionen.js
// Functions share the existing app state; initialize only in app/start.js.

        function getRightSwipeAction() {
            daten.Einstellungen ??= {};
            const value = daten.Einstellungen.rechtsSwipeAktion;
            return ["aus", "erneut", "ausblenden", "bearbeiten", "verschieben"].includes(value) ? value : "aus";
        }

        function rightSwipeActionLabel(value = getRightSwipeAction()) {
            return ({ aus:"Aus", erneut:"Erneut buchen", ausblenden:"Ausblenden", bearbeiten:"Bearbeiten", verschieben:"Verschieben" })[value] || "Aus";
        }

        function renderGestureSettings() {
            const select = document.getElementById("rightSwipeAction");
            if (select) select.value = getRightSwipeAction();
            const sub = document.getElementById("settingsGesturesMenuSub");
            if (sub) sub.textContent = `Rechts-Swipe: ${rightSwipeActionLabel()}`;
        }

        function openSettingsGestures() {
            show("settingsGesturesView");
            renderGestureSettings();
        }

        function setRightSwipeAction(value) {
            if (!["aus", "erneut", "ausblenden", "bearbeiten", "verschieben"].includes(value)) return;
            daten.Einstellungen ??= {};
            daten.Einstellungen.rechtsSwipeAktion = value;
            if (speichern() === false) return;
            renderGestureSettings();
            document.dispatchEvent(new CustomEvent("kostentracker:rightSwipeSettingChanged"));
        }

        function hiddenEntryKey(type, id) {
            return `${String(type || "")}:${String(id ?? "")}`;
        }

        function istEintragAusgeblendet(type, id) {
            daten.Einstellungen ??= {};
            daten.Einstellungen.ausgeblendeteEintraege ??= {};
            return !!daten.Einstellungen.ausgeblendeteEintraege[hiddenEntryKey(type, id)];
        }

        function setEintragAusgeblendet(type, id, hidden) {
            daten.Einstellungen ??= {};
            daten.Einstellungen.ausgeblendeteEintraege ??= {};
            const key = hiddenEntryKey(type, id);
            if (hidden) daten.Einstellungen.ausgeblendeteEintraege[key] = true;
            else delete daten.Einstellungen.ausgeblendeteEintraege[key];
        }

        function renderNachEintragsAktion(type) {
            if (!document.getElementById("globalArchivView")?.classList.contains("hidden")) { populateGlobalArchivJahre(); renderGlobalArchiv(); return; }
            if (!document.getElementById("ausgabenArchivView")?.classList.contains("hidden") && ["haushalt","freizeit"].includes(type)) { renderAusgabenArchiv(); return; }
            if (type === "haushalt") renderHaushalt();
            else if (type === "freizeit") renderFreizeit();
            else if (type === "fixkosten") renderLaufendeKosten();
            else if (type === "versicherungen") renderVersicherungen();
            else if (type === "einnahmen") renderEinnahmen();
            else if (type === "reisen") renderListe();
        }

        function cloneEintragFuerSichtbarkeit(eintrag) {
            if (!eintrag || typeof eintrag !== "object") return null;
            try { return structuredClone(eintrag); }
            catch (_) { return JSON.parse(JSON.stringify(eintrag)); }
        }

        function restoreEintragNachSichtbarkeit(type, id, snapshot) {
            if (!snapshot) return;
            const gefunden = findeAusgabeZumVerschieben(type, id);
            const ziel = gefunden?.eintrag;
            if (!ziel || typeof ziel !== "object") return;

            // Aus-/Einblenden darf niemals Buchungsdaten veraendern.
            // Deshalb wird der komplette Eintrag exakt auf den Stand vor der
            // Sichtbarkeitsaenderung zurueckgesetzt.
            Object.keys(ziel).forEach(key => delete ziel[key]);
            Object.assign(ziel, cloneEintragFuerSichtbarkeit(snapshot));
        }

        function ausblendenEintrag(type, id) {
            const gefunden = findeAusgabeZumVerschieben(type, id);
            if (!gefunden?.eintrag) return;
            const snapshot = cloneEintragFuerSichtbarkeit(gefunden.eintrag);
            beginUndoDelete("Eintrag ausgeblendet");
            setEintragAusgeblendet(type, id, true);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!speichernOhneHomeRender()) return;
            renderNachEintragsAktion(type);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!speichernOhneHomeRender()) return;
            finishUndoDelete("Eintrag ausgeblendet");
        }

        function eintragEinblenden(type, id) {
            const gefunden = findeAusgabeZumVerschieben(type, id);
            if (!gefunden?.eintrag) return;
            const snapshot = cloneEintragFuerSichtbarkeit(gefunden.eintrag);
            beginUndoDelete("Eintrag eingeblendet");
            setEintragAusgeblendet(type, id, false);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!speichernOhneHomeRender()) return;
            renderNachEintragsAktion(type);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!speichernOhneHomeRender()) return;
            finishUndoDelete("Eintrag eingeblendet");
        }

        function erneutBuchenEintrag(type, id) {
            if (!["haushalt", "freizeit", "reisen"].includes(type)) return;
            const gefunden = findeAusgabeZumVerschieben(type, id);
            if (!gefunden?.eintrag) return;
            beginUndoDelete("Eintrag erneut gebucht");
            const copy = structuredClone(gefunden.eintrag);
            copy.id = generateId();
            copy.datum = heuteISO();
            if (type === "haushalt" || type === "freizeit") {
                const store = type === "haushalt" ? daten.Haushalt : daten.Freizeit;
                const monat = parseISODate(copy.datum).getMonth() + 1;
                store[monat] ??= [];
                store[monat].push(copy);
            } else if (type === "reisen" && gefunden.land && gefunden.kategorie) {
                daten.Reisen[gefunden.land][gefunden.kategorie] ??= [];
                daten.Reisen[gefunden.land][gefunden.kategorie].push(copy);
            }
            if (speichern() === false) return;
            renderNachEintragsAktion(type);
            finishUndoDelete("Eintrag erneut gebucht");
        }

        function openHiddenArchive() {
            show("globalArchivView");
            populateGlobalArchivJahre();
            const sichtbarkeit = document.getElementById("globalArchivSichtbarkeit");
            if (sichtbarkeit) sichtbarkeit.value = "ausgeblendet";
            renderGlobalArchiv();
        }
