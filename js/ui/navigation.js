// Kostentracker Test: js/ui/navigation.js
// Functions share the existing app state; initialize only in app/start.js.

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
            window.kostentrackerRememberView?.(id);

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
            verarbeiteFaelligeGeplanteAusgaben();
            show("home");
            renderHomeUebersicht();
        }

        function openUebersicht() {
            verarbeiteFaelligeGeplanteAusgaben();
            show("uebersichtView");
            renderUebersicht();
        }

        function openSparenInvestieren(direktHinzufuegen = false) {
            closeAddSheet();
            show("sparenInvestierenView");
            const datum = document.getElementById("sparenInvestierenDatum");
            if (datum && !datum.value) datum.value = heuteISO();
            renderSparenInvestieren();
            if (direktHinzufuegen) {
                document.getElementById("sparenInvestierenAddPanel")?.classList.remove("hidden");
                setTimeout(() => document.getElementById("sparenInvestierenBetrag")?.focus(), 80);
            }
        }

        function openGeplanteAusgaben(direktHinzufuegen = false) {
            closeAddSheet();
            verarbeiteFaelligeGeplanteAusgaben();
            show("geplanteAusgabenView");
            const datum = document.getElementById("geplantDatum");
            if (datum && !datum.value) datum.value = heuteISO();
            updateGeplantKategorieSelect();
            updateGeplantBereichUI(false);
            renderGeplanteAusgaben();
            if (direktHinzufuegen) {
                document.getElementById("geplantAddPanel")?.classList.remove("hidden");
                setTimeout(() => document.getElementById("geplantText")?.focus(), 80);
            }
        }

        function openGrafik() {
            show("grafikView");
            initGrafik();
            renderGrafik();
        }

        function openSettings() {
            show("settingsView");
            renderDesignMenuStatus();
            renderGestureSettings();
        }

        function openSettingsBudget() {
            show("settingsBudgetView");
            const z = getGehaltszeitraum();
            const startInput = document.getElementById("startgehaltInput");
            const tagInput = document.getElementById("gehaltstagInput");
            if (startInput) startInput.value = getStartgehalt(z) || "";
            if (tagInput) tagInput.value = getGehaltstag();
            renderNextSalarySettings();
        }

        function openSettingsQuickAdd() {
            show("settingsQuickAddView");
            renderQuickAddSettings();
            renderQuickAmountSettings();
        }

        function openSettingsWarnings() {
            show("settingsWarningsView");
            renderWarnSettings();
        }

        function openSettingsDesign() {
            show("settingsDesignView");
            renderDesignSettings();
        }

        function openReisen() {
            show("reisen");
            closeCategoryAddPanels();

            // 🔥 WICHTIG: alte Land-Ansicht komplett resetten
            document.getElementById("land")?.classList.add("hidden");

            state.editLandName = null;
            offeneVersicherung = null;

            renderLaender();
        }

        function openVersicherungen() {
            show("versicherungenView");
            closeCategoryAddPanels();
            state.editVersicherungId = null;

            const datum = document.getElementById("versDatum");
            const monat = document.getElementById("versMonat");

            if (datum && !datum.value) datum.value = heuteISO();
            if (monat) monat.value = String(getAktuellerMonat());

            renderVersicherungen();
        }

        function openHaushalt() {
            show("haushaltView");
            closeCategoryAddPanels();
            state.editHaushaltId = null;

            const datum = document.getElementById("hausDatum");
            if (datum && !datum.value) datum.value = heuteISO();
            applyLetzteAlltagsKategorie("haushalt");

            renderHaushalt();
        }

        function openFreizeit() {
            show("freizeitView");
            closeCategoryAddPanels();
            state.editFreizeitId = null;

            const datum = document.getElementById("freizeitDatum");
            if (datum && !datum.value) datum.value = heuteISO();
            applyLetzteAlltagsKategorie("freizeit");

            renderFreizeit();
            setupFreizeitEnterFlow();
        }

        function openAusgabenArchiv(typ) {
            state.ausgabenArchivTyp = typ === "freizeit" ? "freizeit" : "haushalt";
            state.editAusgabenArchivId = null;
            const suche = document.getElementById("ausgabenArchivSuche");
            if (suche) suche.value = "";
            show("ausgabenArchivView");
            renderAusgabenArchiv();
        }

        function closeAusgabenArchiv() {
            state.editAusgabenArchivId = null;
            if (state.ausgabenArchivTyp === "freizeit") openFreizeit();
            else openHaushalt();
        }

        function openEinnahmen() {
            show("einnahmenView");
            closeCategoryAddPanels();
            state.editEinnahmeId = null;

            const datum = document.getElementById("einnahmenDatum");
            if (datum && !datum.value) datum.value = heuteISO();

            renderEinnahmen();
        }

        function openKosten() {
            show("kostenView");
            closeCategoryAddPanels();

            const datum = document.getElementById("costDatum");
            if (datum && !datum.value) datum.value = heuteISO();

            renderLaufendeKosten();
        }

        function hideAllViews() {
            ["versicherungenView", "haushaltView", "freizeitView", "einnahmenView", "kostenView"].forEach(id => {
                document.getElementById(id)?.classList.add("hidden");
            });
        }

        function toggleKostenDetails() {
            state.homeKostenOffen = !state.homeKostenOffen;
            renderHomeUebersicht();
        }

        function toggleFaelligDetails() {
            state.homeFaelligOffen = !state.homeFaelligOffen;
            renderHomeUebersicht();
        }
