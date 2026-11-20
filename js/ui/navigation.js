Kostentracker.module({
  "id": "js/ui/navigation.js",
  "dependencies": [
    "applyLetzteAlltagsKategorie",
    "travelModeRoute", "isTravelMode", "openTravelOverview", "refreshTravelMode",
    "closeAddSheet",
    "closeCategoryAddPanels",
    "toggleCategoryAdd",
    "getAktuellerMonat",
    "getGehaltstag",
    "getGehaltszeitraum",
    "getStartgehalt",
    "heuteISO",
    "renderAusgabenArchiv",
    "renderDesignMenuStatus",
    "renderDesignSettings",
    "renderEinnahmen",
    "renderFreizeit",
    "renderGeplanteAusgaben",
    "renderGestureSettings",
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
            dependencies.refreshTravelMode?.();
            id = dependencies.travelModeRoute?.(id) || id;
            const changingView = document.getElementById(id)?.classList.contains("hidden");
            context.session.kostentrackerRememberView?.(id);

            const views = [
                "home",
                "travelOverviewView",
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
                "statistikView",
                "settingsView",
                "settingsBudgetView",
                "settingsQuickAddView",
                "settingsWarningsView",
                "settingsDesignView",
                "settingsGesturesView",
                "settingsMerchantView",
                "settingsBackupView",
                "serverSettingsView"
            ];

            // Alle Views verstecken
            views.forEach(x => {
                document.getElementById(x)?.classList.add("hidden");
            });

            // Gewünschte View anzeigen
            document.getElementById(id)?.classList.remove("hidden");

            // Kategorien behalten die Übersicht-Navigation; Einstellungen bleiben unverändert.
            const categoryViews = [
                "travelOverviewView", "reisen", "land", "haushaltView", "freizeitView",
                "ausgabenArchivView", "globalArchivView", "geplanteAusgabenView",
                "sparenInvestierenView", "einnahmenView", "kostenView",
                "versicherungenView"
            ];
            const categoryNav = document.getElementById("categoryBottomNav");
            const isCategory = categoryViews.includes(id);
            const activeTab = {
                home: "home", uebersichtView: "overview", statistikView: "statistics",
                reisen: "reisen", travelOverviewView: "reisen", land: "reisen"
            }[id] || (isCategory ? "overview" : "");
            categoryNav?.classList.toggle("hidden", !activeTab);
            categoryNav?.querySelectorAll("[data-main-tab]").forEach(button => {
                const active = button.dataset.mainTab === activeTab;
                button.classList.toggle("active", active);
                if (active) button.setAttribute("aria-current", "page");
                else button.removeAttribute("aria-current");
            });
            document.body?.classList.toggle("category-nav-visible", isCategory);

            // Kleine Resets, aber nur wenn die Elemente existieren
            if (id !== "reisen") {
                document.getElementById("laenderListe")?.replaceChildren();
            }

            if (id !== "land") {
                document.getElementById("kategorienUebersicht")?.replaceChildren();

                const datum = document.getElementById("datum");
                if (datum) datum.value = "";
            }
            // Ausgangsposition vorher für die Zurückwisch-Geste sichern.
            if (changingView) window.scrollTo(0, 0);
        }

        function goHome() {
            dependencies.verarbeiteFaelligeGeplanteAusgaben();
            show("home");
            dependencies.renderHomeUebersicht();
        }

        function openUebersicht() {
            if (dependencies.isTravelMode?.()) { dependencies.openTravelOverview(); return; }
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
            if (direktHinzufuegen) dependencies.toggleCategoryAdd("sparenInvestierenAddPanel", "sparenInvestierenBetrag");
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
            if (direktHinzufuegen) dependencies.toggleCategoryAdd("geplantAddPanel", "geplantText");
        }

        function openStatistik() {
            show("statistikView");
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
            if (dependencies.isTravelMode?.()) { dependencies.openTravelOverview(); return; }
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

        // Swipe only on the tab landing pages. Reuse the same actions as a
        // tap on the bottom bar so routing and unsaved-input checks still apply.
        const tabSwipePages = {
            home: "home", uebersichtView: "overview", statistikView: "statistics",
            reisen: "reisen", travelOverviewView: "reisen"
        };
        const tabSwipeBlocked = "dialog[open], .sheet-backdrop:not(.hidden), .swipe-selection-mode";
        const tabSwipeIgnore = "input, textarea, select, [contenteditable], .category-add-panel, .swipe-entry-shell, .item, .home-booking-row, [data-horizontal-scroll]";

        for (const [id, tab] of Object.entries(tabSwipePages)) {
            const page = document.getElementById(id);
            if (!page) continue;
            let swipe = null;

            page.addEventListener("touchstart", event => {
                swipe = null;
                if (event.touches.length !== 1 || event.defaultPrevented ||
                    event.target.closest?.(tabSwipeIgnore) ||
                    document.querySelector(tabSwipeBlocked) ||
                    page.querySelector(".category-add-panel:not(.hidden), .alltag-overflow[open]")) return;
                const {clientX: x, clientY: y, identifier} = event.touches[0];
                // Leave the screen edges to the browser and the existing back gesture.
                if (x <= 28 || x >= window.innerWidth - 28) return;
                swipe = {x, y, identifier, horizontal: false};
            }, {passive: true});

            page.addEventListener("touchmove", event => {
                if (!swipe) return;
                const touch = event.touches[0];
                if (event.touches.length !== 1 || touch.identifier !== swipe.identifier ||
                    event.defaultPrevented || !event.cancelable) {
                    swipe = null;
                    return;
                }
                const dx = Math.abs(touch.clientX - swipe.x);
                const dy = Math.abs(touch.clientY - swipe.y);
                if (!swipe.horizontal) {
                    if (Math.max(dx, dy) < 12) return;
                    if (dx < dy * 1.5) { swipe = null; return; }
                    swipe.horizontal = true;
                }
                event.preventDefault();
            }, {passive: false});

            page.addEventListener("touchend", event => {
                const start = swipe;
                swipe = null;
                if (!start?.horizontal || event.defaultPrevented || page.classList.contains("hidden") ||
                    document.querySelector(tabSwipeBlocked)) return;
                if (event.cancelable) event.preventDefault();
                const touch = event.changedTouches[0];
                if (event.changedTouches.length !== 1 || touch.identifier !== start.identifier) return;
                const dx = touch.clientX - start.x;
                if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(touch.clientY - start.y) * 1.5) return;

                const nav = document.getElementById("categoryBottomNav");
                if (!nav || nav.classList.contains("hidden")) return;
                // In Reiseansicht the Übersicht button routes to Reisen too.
                const travelMode = dependencies.isTravelMode?.();
                const buttons = [...nav.querySelectorAll("[data-main-tab]")]
                    .filter(button => !travelMode || button.dataset.mainTab !== "overview");
                const index = buttons.findIndex(button => button.dataset.mainTab === tab);
                if (index >= 0) buttons[index + (dx < 0 ? 1 : -1)]?.click();
            }, {passive: false});

            page.addEventListener("touchcancel", () => { swipe = null; }, {passive: true});
        }

return { monatZuZahl, safeId, show, goHome, openUebersicht, openSparenInvestieren, openGeplanteAusgaben, openStatistik, openSettings, openSettingsBudget, openSettingsQuickAdd, openSettingsWarnings, openSettingsDesign, openReisen, openVersicherungen, openHaushalt, openFreizeit, openAusgabenArchiv, closeAusgabenArchiv, openEinnahmen, openKosten, hideAllViews, toggleKostenDetails, toggleFaelligDetails };
});
