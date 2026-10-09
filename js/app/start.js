Kostentracker.module({
  "id": "js/app/start.js",
  "dependencies": [
    "applyDesignTheme",
    "decorateReminderControls",
    "getDesignMode",
    "initialisiereTestdaten",
    "migriereKategorienDaten",
    "migriereVersicherungsUndReisestruktur",
    "openGeplanteAusgaben",
    "openReiseAuswahlFromHome",
    "openSparenInvestieren",
    "openStartQuickAdd",
    "renderHomeUebersicht",
    "renderHomeWarnings",
    "renderWarnSettings",
    "verarbeiteFaelligeGeplanteAusgaben"
  ],
  "session": [
    "DEFAULT_ACTION_COLOR",
    "DEFAULT_ACTION_COLORS",
    "GRAFIK_COLORS",
    "GRAFIK_LABELS",
    "QUICK_ADD_OPTIONEN",
    "WARN_KATEGORIEN",
    "aktuelleSimple",
    "aktuellesLand",
    "grafikCompareMode",
    "grafikCompareSelection",
    "grafikRangeType",
    "moveContext",
    "offeneVersicherung",
    "quickKategorie",
    "startQuickAddContext",
    "state"
  ],
  "read": [
    "*"
  ],
  "write": [],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Ordered state initialization, migrations, listeners and first render.


        // PWA / Offline-Unterstützung
        if ("serviceWorker" in navigator && window.isSecureContext && /^https?:$/.test(location.protocol)) {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("./service-worker.js")
                    .catch(error => console.warn("Service Worker konnte nicht registriert werden:", error));
            });
        }

        /* DATEN */
        dependencies.initialisiereTestdaten();

        context.session.DEFAULT_ACTION_COLOR = "#3498db";
        context.session.DEFAULT_ACTION_COLORS = {
            hinzufuegen: context.session.DEFAULT_ACTION_COLOR,
            bearbeiten: context.session.DEFAULT_ACTION_COLOR,
            verschieben: context.session.DEFAULT_ACTION_COLOR,
            schalter: context.session.DEFAULT_ACTION_COLOR
        };

        dependencies.applyDesignTheme();
        if (window.matchMedia) {
            const designMedia = window.matchMedia("(prefers-color-scheme: dark)");
            const onSystemDesignChange = () => { if (dependencies.getDesignMode() === "system") dependencies.applyDesignTheme(); };
            if (designMedia.addEventListener) designMedia.addEventListener("change", onSystemDesignChange);
            else if (designMedia.addListener) designMedia.addListener(onSystemDesignChange);
        }

        dependencies.migriereKategorienDaten();

        context.session.state = {
            offeneHaushaltJahre: {},
            offeneHaushaltMonate: {},
            editHaushaltId: null,
            offeneFreizeitJahre: {},
            offeneFreizeitMonate: {},
            editFreizeitId: null,
            ausgabenArchivTyp: "haushalt",
            editAusgabenArchivId: null,
            editEinnahmeId: null,
            editVersicherungId: null,
            editKategorieName: null,
            editLandName: null,
            editReiseId: null,
            reiseBudgetEdit: false,
            editKostenId: null,
            editGeplanteAusgabeId: null,
            editSparenInvestierenId: null,
            homeKostenOffen: false,
            homeFaelligOffen: false,
            freiDetailsOffen: false,
            offeneVersicherungen: {},
            offeneFixkosten: {},
            offeneEinnahmen: {},
            einnahmenMonatlichOffen: false,
            offeneHaushaltEintraege: {},
            offeneFreizeitEintraege: {},
            offeneReiseEintraege: {},
            offeneArchivMonate: {},
            nextSalaryPromptSnoozed: false,
        };

        dependencies.migriereVersicherungsUndReisestruktur();

        context.session.WARN_KATEGORIEN = [["haushalt","Haushalt"],["freizeit","Freizeit"],["fixkosten","Fixkosten"],["versicherungen","Versicherungen"],["reisen","Reisen"],["geplant","Geplante Ausgaben"],["sparen","Sparen & Investieren"]];

        document.addEventListener('DOMContentLoaded', () => {
            dependencies.decorateReminderControls();
            dependencies.renderWarnSettings();
            dependencies.renderHomeWarnings();
            const relevantSelector = 'input[type="date"][id^="edit"], #sparenInvestierenAddPanel, #geplantAddPanel, #reiseAddPanel, #versAddPanel, #hausAddPanel, #freizeitAddPanel, #einnahmenAddPanel, #kostenAddPanel';
            new MutationObserver(mutations => {
                const roots = new Set();
                mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                    if (node instanceof Element && node.isConnected &&
                        (node.matches(relevantSelector) || node.querySelector(relevantSelector))) roots.add(node);
                }));
                roots.forEach(root => dependencies.decorateReminderControls(root));
            }).observe(document.body, { childList: true, subtree: true });
        });

        context.storage.lastSaved = JSON.stringify(context.repository.view);

        let offeneKategorie = null;
        context.session.aktuellesLand = null;
        context.session.aktuelleSimple = null;
        context.session.offeneVersicherung = null;
        context.session.quickKategorie = null;

        /* NAV */

        // Alte Aufrufe bleiben kompatibel, speichern aber nur noch ueber den zentralen Speichern-Button.

        context.session.QUICK_ADD_OPTIONEN = {
            haushalt: { label: "🛒 Haushalt", action: () => dependencies.openStartQuickAdd("hausAddPanel", "hausBetrag") },
            freizeit: { label: "🎉 Freizeit", action: () => dependencies.openStartQuickAdd("freizeitAddPanel", "freizeitBetrag") },
            einnahmen: { label: "💰 Einnahme", action: () => dependencies.openStartQuickAdd("einnahmenAddPanel", "einnahmenText") },
            fixkosten: { label: "📌 Fixkosten", action: () => dependencies.openStartQuickAdd("kostenAddPanel", "costText") },
            versicherungen: { label: "🛡️ Versicherung", action: () => dependencies.openStartQuickAdd("versAddPanel", "versName") },
            geplant: { label: "🗓️ Geplante Ausgabe", action: () => dependencies.openGeplanteAusgaben(true) },
            sparen: { label: "📈 Sparen & Investieren", action: () => dependencies.openSparenInvestieren(true) },
            reisen: { label: "✈️ Reise", action: () => dependencies.openReiseAuswahlFromHome() }
        };

        context.session.startQuickAddContext = null;

        /* REISEN */

        /* LAND */

        /* Dropdown */

        /* Kategorie */

        /* Eintrag */

        /* Toggle */

        /* LISTE */

        /* EDIT */

        /* DELETE */

        // Versicherung hinzufügen ➕

                        //Versicherung löschen 🗑️

        // ===================== Ausgaben verschieben =====================
        context.session.moveContext = null;

        // Betragsfelder: vorhandenen Wert beim erneuten Antippen direkt markieren.
        document.addEventListener("focusin", (event) => {
            const el = event.target;
            if (!(el instanceof HTMLInputElement)) return;
            const id = el.id || "";
            const istBetrag = /betrag/i.test(id) && el.inputMode === "decimal";
            if (!istBetrag || !el.value) return;
            setTimeout(() => {
                try { el.select(); } catch (_) {}
            }, 0);
        });

        //<!-- ===================== Enter Funktion ===================== -->

        // Einheitlicher Enter-Ablauf in allen Hinzufügen-Formularen.

        //<!-- ===================== Enter Reisen ===================== -->

        //<!-- ===================== Enter Versicherungen ===================== -->

        //<!-- ===================== Enter Haushalt ===================== -->

        //<!-- ===================== Enter Laufende Kosten ===================== -->

        dependencies.verarbeiteFaelligeGeplanteAusgaben();
        dependencies.renderHomeUebersicht();

        context.session.grafikRangeType = "month";
        context.session.grafikCompareMode = false;
        context.session.grafikCompareSelection = new Set(["haushalt|all","freizeit|all","fixkosten|all","versicherungen|all","einnahmen|all","reisen|all","geplant|all","sparen|all"]);
        context.session.GRAFIK_COLORS = ["#0a84ff", "#64d2ff", "#ff9f0a", "#bf5af2", "#30d158", "#ff453a", "#ffd60a", "#5e5ce6", "#ff375f"];
        context.session.GRAFIK_LABELS = {
            all:"Alle Kategorien", haushalt:"Haushalt", freizeit:"Freizeit", fixkosten:"Fixkosten",
            versicherungen:"Versicherungen", einnahmen:"Einnahmen", reisen:"Reisen",
            geplant:"Geplante Ausgaben", sparen:"Sparen & Investieren"
        };


return {  };
});
