Kostentracker.module({
  "id": "js/ui/eintragsaktionen.js",
  "dependencies": [
    "beginUndoDelete",
    "findeAusgabeZumVerschieben",
    "finishUndoDelete",
    "generateId",
    "heuteISO",
    "parseISODate",
    "populateGlobalArchivJahre",
    "renderAusgabenArchiv",
    "renderEinnahmen",
    "renderFreizeit",
    "renderGlobalArchiv",
    "renderHaushalt",
    "renderLaufendeKosten",
    "renderListe",
    "renderVersicherungen",
    "show",
    "speichern",
    "speichernOhneHomeRender"
  ],
  "session": [],
  "read": [
    "Einstellungen",
    "Haushalt",
    "Freizeit",
    "Reisen"
  ],
  "write": [
    "Einstellungen",
    "Haushalt",
    "Freizeit",
    "Reisen"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/ui/eintragsaktionen.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function getRightSwipeAction() {
            context.repository.view.Einstellungen ??= {};
            const value = context.repository.view.Einstellungen.rechtsSwipeAktion;
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
            dependencies.show("settingsGesturesView");
            renderGestureSettings();
        }

        function setRightSwipeAction(value) {
            if (!["aus", "erneut", "ausblenden", "bearbeiten", "verschieben"].includes(value)) return;
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.rechtsSwipeAktion = value;
            if (dependencies.speichern() === false) return;
            renderGestureSettings();
            document.dispatchEvent(new CustomEvent("kostentracker:rightSwipeSettingChanged"));
        }

        function hiddenEntryKey(type, id) {
            return `${String(type || "")}:${String(id ?? "")}`;
        }

        function istEintragAusgeblendet(type, id) {
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.ausgeblendeteEintraege ??= {};
            return !!context.repository.view.Einstellungen.ausgeblendeteEintraege[hiddenEntryKey(type, id)];
        }

        function setEintragAusgeblendet(type, id, hidden) {
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.ausgeblendeteEintraege ??= {};
            const key = hiddenEntryKey(type, id);
            if (hidden) context.repository.view.Einstellungen.ausgeblendeteEintraege[key] = true;
            else delete context.repository.view.Einstellungen.ausgeblendeteEintraege[key];
        }

        function renderNachEintragsAktion(type) {
            if (!document.getElementById("globalArchivView")?.classList.contains("hidden")) { dependencies.populateGlobalArchivJahre(); dependencies.renderGlobalArchiv(); return; }
            if (!document.getElementById("ausgabenArchivView")?.classList.contains("hidden") && ["haushalt","freizeit"].includes(type)) { dependencies.renderAusgabenArchiv(); return; }
            if (type === "haushalt") dependencies.renderHaushalt();
            else if (type === "freizeit") dependencies.renderFreizeit();
            else if (type === "fixkosten") dependencies.renderLaufendeKosten();
            else if (type === "versicherungen") dependencies.renderVersicherungen();
            else if (type === "einnahmen") dependencies.renderEinnahmen();
            else if (type === "reisen") dependencies.renderListe();
        }

        function cloneEintragFuerSichtbarkeit(eintrag) {
            if (!eintrag || typeof eintrag !== "object") return null;
            try { return context.clone(eintrag); }
            catch (_) { return JSON.parse(JSON.stringify(eintrag)); }
        }

        function restoreEintragNachSichtbarkeit(type, id, snapshot) {
            if (!snapshot) return;
            const gefunden = dependencies.findeAusgabeZumVerschieben(type, id);
            const ziel = gefunden?.eintrag;
            if (!ziel || typeof ziel !== "object") return;

            // Aus-/Einblenden darf niemals Buchungsdaten veraendern.
            // Deshalb wird der komplette Eintrag exakt auf den Stand vor der
            // Sichtbarkeitsaenderung zurueckgesetzt.
            Object.keys(ziel).forEach(key => delete ziel[key]);
            Object.assign(ziel, cloneEintragFuerSichtbarkeit(snapshot));
        }

        function ausblendenEintrag(type, id) {
            const gefunden = dependencies.findeAusgabeZumVerschieben(type, id);
            if (!gefunden?.eintrag) return;
            const snapshot = cloneEintragFuerSichtbarkeit(gefunden.eintrag);
            dependencies.beginUndoDelete("Eintrag ausgeblendet");
            setEintragAusgeblendet(type, id, true);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!dependencies.speichernOhneHomeRender()) return;
            renderNachEintragsAktion(type);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!dependencies.speichernOhneHomeRender()) return;
            dependencies.finishUndoDelete("Eintrag ausgeblendet");
        }

        function eintragEinblenden(type, id) {
            const gefunden = dependencies.findeAusgabeZumVerschieben(type, id);
            if (!gefunden?.eintrag) return;
            const snapshot = cloneEintragFuerSichtbarkeit(gefunden.eintrag);
            dependencies.beginUndoDelete("Eintrag eingeblendet");
            setEintragAusgeblendet(type, id, false);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!dependencies.speichernOhneHomeRender()) return;
            renderNachEintragsAktion(type);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!dependencies.speichernOhneHomeRender()) return;
            dependencies.finishUndoDelete("Eintrag eingeblendet");
        }

        function erneutBuchenEintrag(type, id) {
            if (!["haushalt", "freizeit", "reisen"].includes(type)) return;
            const gefunden = dependencies.findeAusgabeZumVerschieben(type, id);
            if (!gefunden?.eintrag) return;
            dependencies.beginUndoDelete("Eintrag erneut gebucht");
            const copy = context.clone(gefunden.eintrag);
            copy.id = dependencies.generateId();
            copy.datum = dependencies.heuteISO();
            if (type === "haushalt" || type === "freizeit") {
                const store = type === "haushalt" ? context.repository.view.Haushalt : context.repository.view.Freizeit;
                const monat = dependencies.parseISODate(copy.datum).getMonth() + 1;
                store[monat] ??= [];
                store[monat].push(copy);
            } else if (type === "reisen" && gefunden.land && gefunden.kategorie) {
                context.repository.view.Reisen[gefunden.land][gefunden.kategorie] ??= [];
                context.repository.view.Reisen[gefunden.land][gefunden.kategorie].push(copy);
            }
            if (dependencies.speichern() === false) return;
            renderNachEintragsAktion(type);
            dependencies.finishUndoDelete("Eintrag erneut gebucht");
        }

        function openHiddenArchive() {
            dependencies.show("globalArchivView");
            dependencies.populateGlobalArchivJahre();
            const sichtbarkeit = document.getElementById("globalArchivSichtbarkeit");
            if (sichtbarkeit) sichtbarkeit.value = "ausgeblendet";
            dependencies.renderGlobalArchiv();
        }

return { getRightSwipeAction, rightSwipeActionLabel, renderGestureSettings, openSettingsGestures, setRightSwipeAction, hiddenEntryKey, istEintragAusgeblendet, setEintragAusgeblendet, renderNachEintragsAktion, cloneEintragFuerSichtbarkeit, restoreEintragNachSichtbarkeit, ausblendenEintrag, eintragEinblenden, erneutBuchenEintrag, openHiddenArchive };
});
