Kostentracker.module({
  "id": "js/ui/navigation.js",
  "dependencies": [
    "applyLetzteAlltagsKategorie",
    "closeAddSheet",
    "closeCategoryAddPanels",
    "getAktuellerMonat",
    "getGehaltstag",
    "getGehaltszeitraum",
    "getStartgehalt",
    "heuteISO",
    "initGrafik",
    "renderAusgabenArchiv",
    "renderDesignMenuStatus",
    "renderDesignSettings",
    "renderEinnahmen",
    "renderFreizeit",
    "renderGeplanteAusgaben",
    "renderGestureSettings",
    "renderGrafik",
    "renderHaushalt",
    "renderHomeUebersicht",
    "renderLaender",
    "renderLaufendeKosten",
    "renderNextSalarySettings",
    "renderQuickAddSettings",
    "renderQuickAmountSettings",
    "renderSparenInvestieren",
    "renderUebersicht",
    "renderVersicherungen",
    "renderWarnSettings",
    "setupFreizeitEnterFlow",
    "updateGeplantBereichUI",
    "updateGeplantKategorieSelect",
    "verarbeiteFaelligeGeplanteAusgaben"
  ],
  "session": [
    "kostentrackerRememberView",
    "offeneVersicherung",
    "state"
  ],
  "read": [],
  "write": [],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/ui/navigation.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function monatZuZahl(name) {
            const monate = [
                "januar", "februar", "märz", "april", "mai", "juni",
                "juli", "august", "september", "oktober", "november", "dezember"
            ];

            let index = monate.indexOf(name.toLowerCase());
            return index !== -1 ? index + 1 : 1;
        }

        function safeId(text) {
            return Array.from(String(text), char => Array.from({ length: char.length }, (_, i) => char.charCodeAt(i).toString(16).padStart(4, '0')).join('')).join('');
        }

        function show(id) {
            context.session.kostentrackerRememberView?.(id);

            const views = [
                "home",
                "reisen",
                "land",
                "haushaltView",
                "freizeitView",
                "ausgabenArchivView",
                "globalArchivView",
                "geplanteAusgabenView",
                "sparenInvestierenView",
                "einnahmenView",
                "kostenView",
                "versicherungenView",
                "uebersichtView",
                "grafikView",
                "settingsView",
                "settingsBudgetView",
                "settingsQuickAddView",
                "settingsWarningsView",
                "settingsDesignView",
                "settingsGesturesView",
                "settingsBackupView",
                "serverSettingsView"
            ];

            // Alle Views verstecken
            views.forEach(x => {
                document.getElementById(x)?.classList.add("hidden");
            });

            // Gewünschte View anzeigen
            document.getElementById(id)?.classList.remove("hidden");

            // Kleine Resets, aber nur wenn die Elemente existieren
            if (id !== "reisen") {
                document.getElementById("laenderListe")?.replaceChildren();
            }

            if (id !== "land") {
                document.getElementById("kategorienUebersicht")?.replaceChildren();

                const datum = document.getElementById("datum");
                if (datum) datum.value = "";
            }
        }

        function goHome() {
            dependencies.verarbeiteFaelligeGeplanteAusgaben();
            show("home");
            dependencies.renderHomeUebersicht();
        }

        function openUebersicht() {
            dependencies.verarbeiteFaelligeGeplanteAusgaben();
            show("uebersichtView");
            dependencies.renderUebersicht();
        }

        function openSparenInvestieren(direktHinzufuegen = false) {
            dependencies.closeAddSheet();
            show("sparenInvestierenView");
            const datum = document.getElementById("sparenInvestierenDatum");
            if (datum && !datum.value) datum.value = dependencies.heuteISO();
            dependencies.renderSparenInvestieren();
            if (direktHinzufuegen) {
                document.getElementById("sparenInvestierenAddPanel")?.classList.remove("hidden");
                setTimeout(() => document.getElementById("sparenInvestierenBetrag")?.focus(), 80);
            }
        }

        function openGeplanteAusgaben(direktHinzufuegen = false) {
            dependencies.closeAddSheet();
            dependencies.verarbeiteFaelligeGeplanteAusgaben();
            show("geplanteAusgabenView");
            const datum = document.getElementById("geplantDatum");
            if (datum && !datum.value) datum.value = dependencies.heuteISO();
            dependencies.updateGeplantKategorieSelect();
            dependencies.updateGeplantBereichUI(false);
            dependencies.renderGeplanteAusgaben();
            if (direktHinzufuegen) {
                document.getElementById("geplantAddPanel")?.classList.remove("hidden");
                setTimeout(() => document.getElementById("geplantText")?.focus(), 80);
            }
        }

        function openGrafik() {
            show("grafikView");
            dependencies.initGrafik();
            dependencies.renderGrafik();
        }

        function openSettings() {
            show("settingsView");
            dependencies.renderDesignMenuStatus();
            dependencies.renderGestureSettings();
        }

        function openSettingsBudget() {
            show("settingsBudgetView");
            const z = dependencies.getGehaltszeitraum();
            const startInput = document.getElementById("startgehaltInput");
            const tagInput = document.getElementById("gehaltstagInput");
            if (startInput) startInput.value = dependencies.getStartgehalt(z) || "";
            if (tagInput) tagInput.value = dependencies.getGehaltstag();
            dependencies.renderNextSalarySettings();
        }

        function openSettingsQuickAdd() {
            show("settingsQuickAddView");
            dependencies.renderQuickAddSettings();
            dependencies.renderQuickAmountSettings();
        }

        function openSettingsWarnings() {
            show("settingsWarningsView");
            dependencies.renderWarnSettings();
        }

        function openSettingsDesign() {
            show("settingsDesignView");
            dependencies.renderDesignSettings();
        }

        function openReisen() {
            show("reisen");
            dependencies.closeCategoryAddPanels();

            // 🔥 WICHTIG: alte Land-Ansicht komplett resetten
            document.getElementById("land")?.classList.add("hidden");

            context.session.state.editLandName = null;
            context.session.offeneVersicherung = null;

            dependencies.renderLaender();
        }

        function openVersicherungen() {
            show("versicherungenView");
            dependencies.closeCategoryAddPanels();
            context.session.state.editVersicherungId = null;

            const datum = document.getElementById("versDatum");
            const monat = document.getElementById("versMonat");

            if (datum && !datum.value) datum.value = dependencies.heuteISO();
            if (monat) monat.value = String(dependencies.getAktuellerMonat());

            dependencies.renderVersicherungen();
        }

        function openHaushalt() {
            show("haushaltView");
            dependencies.closeCategoryAddPanels();
            context.session.state.editHaushaltId = null;

            const datum = document.getElementById("hausDatum");
            if (datum && !datum.value) datum.value = dependencies.heuteISO();
            dependencies.applyLetzteAlltagsKategorie("haushalt");

            dependencies.renderHaushalt();
        }

        function openFreizeit() {
            show("freizeitView");
            dependencies.closeCategoryAddPanels();
            context.session.state.editFreizeitId = null;

            const datum = document.getElementById("freizeitDatum");
            if (datum && !datum.value) datum.value = dependencies.heuteISO();
            dependencies.applyLetzteAlltagsKategorie("freizeit");

            dependencies.renderFreizeit();
            dependencies.setupFreizeitEnterFlow();
        }

        function openAusgabenArchiv(typ) {
            context.session.state.ausgabenArchivTyp = typ === "freizeit" ? "freizeit" : "haushalt";
            context.session.state.editAusgabenArchivId = null;
            const suche = document.getElementById("ausgabenArchivSuche");
            if (suche) suche.value = "";
            show("ausgabenArchivView");
            dependencies.renderAusgabenArchiv();
        }

        function closeAusgabenArchiv() {
            context.session.state.editAusgabenArchivId = null;
            if (context.session.state.ausgabenArchivTyp === "freizeit") openFreizeit();
            else openHaushalt();
        }

        function openEinnahmen() {
            show("einnahmenView");
            dependencies.closeCategoryAddPanels();
            context.session.state.editEinnahmeId = null;

            const datum = document.getElementById("einnahmenDatum");
            if (datum && !datum.value) datum.value = dependencies.heuteISO();

            dependencies.renderEinnahmen();
        }

        function openKosten() {
            show("kostenView");
            dependencies.closeCategoryAddPanels();

            const datum = document.getElementById("costDatum");
            if (datum && !datum.value) datum.value = dependencies.heuteISO();

            dependencies.renderLaufendeKosten();
        }

        function hideAllViews() {
            ["versicherungenView", "haushaltView", "freizeitView", "einnahmenView", "kostenView"].forEach(id => {
                document.getElementById(id)?.classList.add("hidden");
            });
        }

        function toggleKostenDetails() {
            context.session.state.homeKostenOffen = !context.session.state.homeKostenOffen;
            dependencies.renderHomeUebersicht();
        }

        function toggleFaelligDetails() {
            context.session.state.homeFaelligOffen = !context.session.state.homeFaelligOffen;
            dependencies.renderHomeUebersicht();
        }

return { monatZuZahl, safeId, show, goHome, openUebersicht, openSparenInvestieren, openGeplanteAusgaben, openGrafik, openSettings, openSettingsBudget, openSettingsQuickAdd, openSettingsWarnings, openSettingsDesign, openReisen, openVersicherungen, openHaushalt, openFreizeit, openAusgabenArchiv, closeAusgabenArchiv, openEinnahmen, openKosten, hideAllViews, toggleKostenDetails, toggleFaelligDetails };
});
