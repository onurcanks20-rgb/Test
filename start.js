// Ordered state initialization, migrations, listeners and first render.


        // PWA / Offline-Unterstützung
        if ("serviceWorker" in navigator && window.isSecureContext && /^https?:$/.test(location.protocol)) {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("./service-worker.js")
                    .catch(error => console.warn("Service Worker konnte nicht registriert werden:", error));
            });
        }

        /* DATEN */
        const STANDARD_DATEN = {
            Reisen: {},
            ReisenMeta: {},
            Versicherungen: [],
            Haushalt: {},
            Freizeit: {},
            Einnahmen: [],
            "Geplante Ausgaben": [],
            "Sparen & Investieren": [],
            "Laufende Kosten": {
                fix: []
            },
            Einstellungen: {
                gehaltstag: 26,
                startgehaelter: {},
                naechstesGehaltPlan: { datum: "", betrag: "", periodenStart: "" },
                aktuellerGehaltsstart: "",
                quickAddFavoriten: ["haushalt", "freizeit", "einnahmen", "fixkosten", "versicherungen", "geplant", "sparen", "reisen"],
                schnellbetraege: [5, 10, 20, 50],
                letzteKategorien: { haushalt: "Einkauf", freizeit: "Essen / Trinken", reisen: {} },
                designModus: "system",
                rechtsSwipeAktion: "aus",
                ausgeblendeteEintraege: {},
                warnungen: { aktiv:true, schwelle:100, tage:14, kategorien:{ haushalt:false, freizeit:false, fixkosten:true, versicherungen:true, reisen:true, geplant:true, sparen:true } }
            },
            geloeschteKategorien: {}
        };

        let daten = ladeDaten();

        // 🔥 WICHTIGER MIGRATIONS-FIX:
        // Falls "Laufende Kosten" früher als Array gespeichert wurde, wird es jetzt sauber
        // in { fix: [...] } umgewandelt. Sonst würde JSON.stringify die fix-Einträge verlieren.
        if (!daten || typeof daten !== "object" || Array.isArray(daten)) {
            daten = structuredClone(STANDARD_DATEN);
        }

        if (!daten.Reisen || typeof daten.Reisen !== "object" || Array.isArray(daten.Reisen)) {
            daten.Reisen = {};
        }
        if (!daten.ReisenMeta || typeof daten.ReisenMeta !== "object" || Array.isArray(daten.ReisenMeta)) {
            daten.ReisenMeta = {};
        }
        Object.keys(daten.Reisen).forEach(land => {
            if (!daten.ReisenMeta[land] || typeof daten.ReisenMeta[land] !== "object") {
                daten.ReisenMeta[land] = { budget: 0, von: "", bis: "" };
            } else {
                daten.ReisenMeta[land].budget = parseBetrag(daten.ReisenMeta[land].budget) || 0;
                daten.ReisenMeta[land].von ||= "";
                daten.ReisenMeta[land].bis ||= "";
            }
        });

        if (!Array.isArray(daten.Versicherungen)) {
            daten.Versicherungen = [];
        }

        if (!daten.Haushalt || typeof daten.Haushalt !== "object" || Array.isArray(daten.Haushalt)) {
            daten.Haushalt = {};
        }

        if (!daten.Freizeit || typeof daten.Freizeit !== "object" || Array.isArray(daten.Freizeit)) {
            daten.Freizeit = {};
        }

        if (!Array.isArray(daten.Einnahmen)) {
            daten.Einnahmen = [];
        }

        if (!Array.isArray(daten["Geplante Ausgaben"])) {
            daten["Geplante Ausgaben"] = [];
        }
        daten["Geplante Ausgaben"] = daten["Geplante Ausgaben"].map(e => {
            const bereich = ["haushalt", "freizeit", "reisen"].includes(e.bereich) ? e.bereich : "haushalt";
            return {
                ...e,
                id: e.id || generateId(),
                text: e.text || "Geplante Ausgabe",
                betrag: parseBetrag(e.betrag) || 0,
                datum: e.datum || heuteISO(),
                wiederholung: ["monatlich", "jaehrlich"].includes(e.wiederholung) ? e.wiederholung : "einmalig",
                wiederholungStart: e.wiederholungStart || e.datum || heuteISO(),
                bereich,
                land: bereich === "reisen" ? (e.land || "") : "",
                kategorie: e.kategorie || "Sonstiges",
                // Bestehende geplante Haushalt/Freizeit-Ausgaben waren immer budgetwirksam.
                budgetWirksam: typeof e.budgetWirksam === "boolean" ? e.budgetWirksam : bereich !== "reisen",
                warnung: !!e.warnung, warnTage: normalizeWarnTage(e.warnTage)
            };
        });

        if (!Array.isArray(daten["Sparen & Investieren"])) {
            daten["Sparen & Investieren"] = [];
        }
        daten["Sparen & Investieren"] = daten["Sparen & Investieren"].map(e => ({
            ...e,
            id: e.id || generateId(),
            typ: e.typ === "sparen" ? "sparen" : "investieren",
            text: (e.text && !["Sparen", "Investieren"].includes(String(e.text).trim())) ? String(e.text).trim() : "",
            betrag: parseBetrag(e.betrag) || 0,
            datum: e.datum || heuteISO(),
            warnung: !!e.warnung, warnTage: normalizeWarnTage(e.warnTage)
        }));

        daten.Einnahmen = daten.Einnahmen.map(e => ({
            ...e,
            id: e.id || generateId(),
            text: e.text || e.name || "Einnahme",
            betrag: parseBetrag(e.betrag) || 0,
            datum: e.datum || heuteISO(),
            wiederholung: e.wiederholung === "monatlich" ? "monatlich" : "einmalig",
            von: e.von || "", warnung: !!e.warnung, warnTage: normalizeWarnTage(e.warnTage)
        }));

        if (!daten.geloeschteKategorien || typeof daten.geloeschteKategorien !== "object" || Array.isArray(daten.geloeschteKategorien)) {
            daten.geloeschteKategorien = {};
        }

        if (!daten.Einstellungen || typeof daten.Einstellungen !== "object" || Array.isArray(daten.Einstellungen)) {
            daten.Einstellungen = {};
        }
        if (!["dunkel", "hell", "system"].includes(daten.Einstellungen.designModus)) daten.Einstellungen.designModus = "system";
        if (!["aus", "erneut", "ausblenden", "bearbeiten", "verschieben"].includes(daten.Einstellungen.rechtsSwipeAktion)) daten.Einstellungen.rechtsSwipeAktion = "aus";
        if (!daten.Einstellungen.ausgeblendeteEintraege || typeof daten.Einstellungen.ausgeblendeteEintraege !== "object" || Array.isArray(daten.Einstellungen.ausgeblendeteEintraege)) {
            daten.Einstellungen.ausgeblendeteEintraege = {};
        }
        const standardWarnungen = structuredClone(STANDARD_DATEN.Einstellungen.warnungen);
        if (!daten.Einstellungen.warnungen || typeof daten.Einstellungen.warnungen !== "object") daten.Einstellungen.warnungen = standardWarnungen;
        daten.Einstellungen.warnungen = { ...standardWarnungen, ...daten.Einstellungen.warnungen, kategorien:{...standardWarnungen.kategorien,...(daten.Einstellungen.warnungen.kategorien||{})} };

        daten.Einstellungen.gehaltstag = validiereGehaltstag(daten.Einstellungen.gehaltstag);
        if (!daten.Einstellungen.startgehaelter || typeof daten.Einstellungen.startgehaelter !== "object" || Array.isArray(daten.Einstellungen.startgehaelter)) {
            daten.Einstellungen.startgehaelter = {};
        }
        if (!daten.Einstellungen.naechstesGehaltPlan || typeof daten.Einstellungen.naechstesGehaltPlan !== "object" || Array.isArray(daten.Einstellungen.naechstesGehaltPlan)) {
            daten.Einstellungen.naechstesGehaltPlan = { datum: "", betrag: "", periodenStart: "" };
        } else {
            daten.Einstellungen.naechstesGehaltPlan = {
                datum: typeof daten.Einstellungen.naechstesGehaltPlan.datum === "string" ? daten.Einstellungen.naechstesGehaltPlan.datum : "",
                betrag: daten.Einstellungen.naechstesGehaltPlan.betrag ?? "",
                periodenStart: typeof daten.Einstellungen.naechstesGehaltPlan.periodenStart === "string" ? daten.Einstellungen.naechstesGehaltPlan.periodenStart : ""
            };
        }
        if (typeof daten.Einstellungen.aktuellerGehaltsstart !== "string") daten.Einstellungen.aktuellerGehaltsstart = "";
        const QUICK_ADD_DEFAULT = ["haushalt", "freizeit", "einnahmen", "fixkosten", "versicherungen", "geplant", "sparen", "reisen"];
        if (!Array.isArray(daten.Einstellungen.quickAddFavoriten)) {
            daten.Einstellungen.quickAddFavoriten = [...QUICK_ADD_DEFAULT];
        } else {
            const gueltig = new Set(QUICK_ADD_DEFAULT);
            daten.Einstellungen.quickAddFavoriten = daten.Einstellungen.quickAddFavoriten.filter((key, index, arr) => gueltig.has(key) && arr.indexOf(key) === index);
        }

        const standardSchnellbetraege = [5, 10, 20, 50];
        if (!Array.isArray(daten.Einstellungen.schnellbetraege) || daten.Einstellungen.schnellbetraege.length !== 4) {
            daten.Einstellungen.schnellbetraege = [...standardSchnellbetraege];
        } else {
            daten.Einstellungen.schnellbetraege = daten.Einstellungen.schnellbetraege.map((wert, index) => {
                const n = parseBetrag(wert);
                return Number.isFinite(n) && n > 0 ? n : standardSchnellbetraege[index];
            });
        }

        if (!daten.Einstellungen.letzteKategorien || typeof daten.Einstellungen.letzteKategorien !== "object" || Array.isArray(daten.Einstellungen.letzteKategorien)) {
            daten.Einstellungen.letzteKategorien = { haushalt: "Einkauf", freizeit: "Essen / Trinken", reisen: {} };
        }
        daten.Einstellungen.letzteKategorien.haushalt ||= "Einkauf";
        daten.Einstellungen.letzteKategorien.freizeit ||= "Essen / Trinken";
        if (["Essen", "Trinken", "Essen gehen", "Café", "Snacks"].includes(daten.Einstellungen.letzteKategorien.freizeit)) daten.Einstellungen.letzteKategorien.freizeit = "Essen / Trinken";
        if (!daten.Einstellungen.letzteKategorien.reisen || typeof daten.Einstellungen.letzteKategorien.reisen !== "object" || Array.isArray(daten.Einstellungen.letzteKategorien.reisen)) {
            daten.Einstellungen.letzteKategorien.reisen = {};
        }

        const alteLaufendeKosten = daten["Laufende Kosten"];

        if (Array.isArray(alteLaufendeKosten)) {
            daten["Laufende Kosten"] = { fix: alteLaufendeKosten };
        } else if (!alteLaufendeKosten || typeof alteLaufendeKosten !== "object") {
            daten["Laufende Kosten"] = { fix: [] };
        } else if (!Array.isArray(alteLaufendeKosten.fix)) {
            daten["Laufende Kosten"].fix = [];
        }

        // Alte Einträge hatten nur einen Tag (z. B. 15).
        // Neue Einträge speichern zusätzlich ein echtes Datum (z. B. 2026-05-15).
        daten["Laufende Kosten"].fix = daten["Laufende Kosten"].fix.map(k => {
            const datum = k.datum || datumAusTagAktuellerMonat(k.tag);
            return {
                ...k,
                text: k.text || k.name || "",
                datum,
                tag: tagAusDatum(datum),
                haendler: String(k.haendler || "").trim(),
                zuordnungTage: normalizeFixkostenZuordnungTage(k.zuordnungTage)
            };
        });

        // Migration direkt speichern, damit alte kaputte Strukturen nicht wiederkommen.
        try {
            localStorage.setItem("kostenApp_test", JSON.stringify(daten));
        } catch (error) {
            console.error("Migration konnte nicht gespeichert werden:", error);
        }

        const DEFAULT_ACTION_COLOR = "#3498db";
        const DEFAULT_ACTION_COLORS = {
            hinzufuegen: DEFAULT_ACTION_COLOR,
            bearbeiten: DEFAULT_ACTION_COLOR,
            verschieben: DEFAULT_ACTION_COLOR,
            schalter: DEFAULT_ACTION_COLOR
        };

        applyDesignTheme();
        if (window.matchMedia) {
            const designMedia = window.matchMedia("(prefers-color-scheme: dark)");
            const onSystemDesignChange = () => { if (getDesignMode() === "system") applyDesignTheme(); };
            if (designMedia.addEventListener) designMedia.addEventListener("change", onSystemDesignChange);
            else if (designMedia.addListener) designMedia.addListener(onSystemDesignChange);
        }

        for (let i = 1; i <= 12; i++) {
            daten.Haushalt[i] ??= [];
            daten.Freizeit[i] ??= [];
        }

        // Unterkategorien für bestehende Einträge ergänzen.
        Object.values(daten.Haushalt).forEach(liste => {
            if (!Array.isArray(liste)) return;
            liste.forEach(e => { if (e && !e.kategorie) e.kategorie = "Sonstiges"; });
        });
        Object.values(daten.Freizeit).forEach(liste => {
            if (!Array.isArray(liste)) return;
            liste.forEach(e => { if (e && !e.kategorie) e.kategorie = "Sonstiges"; });
        });

        // Alte Unterkategorien auf die vereinfachte Struktur umstellen.
        Object.values(daten.Haushalt).forEach(liste => {
            if (!Array.isArray(liste)) return;
            liste.forEach(e => {
                if (!e) return;
                if (e.kategorie === "Lebensmittel") e.kategorie = "Einkauf";
                if (e.kategorie === "Sonstiger Haushalt") e.kategorie = "Sonstiges";
            });
        });
        Object.values(daten.Freizeit).forEach(liste => {
            if (!Array.isArray(liste)) return;
            liste.forEach(e => {
                if (!e) return;
                if (["Essen", "Trinken", "Essen gehen", "Café", "Snacks"].includes(e.kategorie)) e.kategorie = "Essen / Trinken";
                if (e.kategorie === "Kino/Event" || e.kategorie === "Kino / Event") e.kategorie = "Aktivität";
            });
        });
        const normalizeReminder = e => { if (!e || typeof e !== "object") return; e.warnung=!!e.warnung; e.warnTage=normalizeWarnTage(e.warnTage); };
        Object.values(daten.Haushalt).forEach(l=>Array.isArray(l)&&l.forEach(normalizeReminder));
        Object.values(daten.Freizeit).forEach(l=>Array.isArray(l)&&l.forEach(normalizeReminder));
        daten.Versicherungen.forEach(normalizeReminder);
        daten["Laufende Kosten"].fix.forEach(normalizeReminder);
        Object.values(daten.Reisen).forEach(r=>Object.values(r||{}).forEach(l=>Array.isArray(l)&&l.forEach(normalizeReminder)));

        for (const land of Object.keys(daten.Reisen || {})) {
            const reise = daten.Reisen[land];
            if (!reise || typeof reise !== "object") continue;
            const mergeKat = (alt, neu) => {
                if (!Array.isArray(reise[alt])) return;
                reise[neu] ??= [];
                reise[neu].push(...reise[alt]);
                delete reise[alt];
            };
            mergeKat("Flug", "Transport");
            mergeKat("Aktivitäten", "Aktivität");
            mergeKat("Verpflegung", "Essen");
            mergeKat("Snacks", "Essen");
            ["Essen", "Trinken", "Transport", "Unterkunft", "Aktivität", "Einkauf", "Sonstiges"].forEach(k => reise[k] ??= []);
        }

        for (let land in daten.Reisen) {
            for (let k in daten.Reisen[land]) {

                daten.Reisen[land][k] = daten.Reisen[land][k].map(e => ({
                    id: e.id ?? generateId(),
                    betrag: e.betrag ?? 0,
                    text: e.text ?? "",
                    datum: e.datum ?? ""
                }));
            }
        }

        const state = {
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

        if (!daten.geloeschteKategorien) {
            daten.geloeschteKategorien = {};
        }

        const standardKategorien = [
            "Essen",
            "Trinken",
            "Transport",
            "Unterkunft",
            "Aktivität",
            "Einkauf",
            "Sonstiges"
        ];

        for (let land in daten.Reisen) {

            let geloescht = daten.geloeschteKategorien[land] || [];

            standardKategorien.forEach(k => {

                if (!daten.Reisen[land][k] && !geloescht.includes(k)) {
                    daten.Reisen[land][k] = [];
                }

            });
        }

        daten.Versicherungen = daten.Versicherungen.map(v => ({
            id: v.id || generateId(),
            name: v.name || "",
            betrag: v.betrag ?? 0,
            anbieter: v.anbieter || "",
            versicherungsnummer: v.versicherungsnummer || "",
            intervall: v.intervall || "monatlich",
            monat: v.monat ?? 1,
            datum: v.datum || ""
        }));

        let undoDeleteState = null;
        let undoDeleteTimer = null;

        const WARN_KATEGORIEN = [["haushalt","Haushalt"],["freizeit","Freizeit"],["fixkosten","Fixkosten"],["versicherungen","Versicherungen"],["reisen","Reisen"],["geplant","Geplante Ausgaben"],["sparen","Sparen & Investieren"]];

        document.addEventListener('DOMContentLoaded', () => {
            decorateReminderControls();
            renderWarnSettings();
            renderHomeWarnings();
            const relevantSelector = 'input[type="date"][id^="edit"], #sparenInvestierenAddPanel, #geplantAddPanel, #reiseAddPanel, #versAddPanel, #hausAddPanel, #freizeitAddPanel, #einnahmenAddPanel, #kostenAddPanel';
            new MutationObserver(mutations => {
                const roots = new Set();
                mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                    if (node instanceof Element && node.isConnected &&
                        (node.matches(relevantSelector) || node.querySelector(relevantSelector))) roots.add(node);
                }));
                roots.forEach(root => decorateReminderControls(root));
            }).observe(document.body, { childList: true, subtree: true });
        });

        let zuletztGespeicherteDaten = JSON.stringify(daten);

        let offeneKategorie = null;
        let aktuellesLand = null;
        let aktuelleSimple = null;
        let offeneVersicherung = null;
        let quickKategorie = null;

        /* NAV */

        // Alte Aufrufe bleiben kompatibel, speichern aber nur noch ueber den zentralen Speichern-Button.

        const QUICK_ADD_OPTIONEN = {
            haushalt: { label: "🛒 Haushalt", action: () => openStartQuickAdd("hausAddPanel", "hausBetrag") },
            freizeit: { label: "🎉 Freizeit", action: () => openStartQuickAdd("freizeitAddPanel", "freizeitBetrag") },
            einnahmen: { label: "💰 Einnahme", action: () => openStartQuickAdd("einnahmenAddPanel", "einnahmenText") },
            fixkosten: { label: "📌 Fixkosten", action: () => openStartQuickAdd("kostenAddPanel", "costText") },
            versicherungen: { label: "🛡️ Versicherung", action: () => openStartQuickAdd("versAddPanel", "versName") },
            geplant: { label: "🗓️ Geplante Ausgabe", action: () => openGeplanteAusgaben(true) },
            sparen: { label: "📈 Sparen & Investieren", action: () => openSparenInvestieren(true) },
            reisen: { label: "✈️ Reise", action: () => openReiseAuswahlFromHome() }
        };

        let startQuickAddContext = null;

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
        let moveContext = null;

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

        verarbeiteFaelligeGeplanteAusgaben();
        renderHomeUebersicht();

        let grafikRangeType = "month";
        let grafikCompareMode = false;
        const grafikCompareSelection = new Set(["haushalt|all","freizeit|all","fixkosten|all","versicherungen|all","einnahmen|all","reisen|all","geplant|all","sparen|all"]);
        const GRAFIK_COLORS = ["#0a84ff", "#64d2ff", "#ff9f0a", "#bf5af2", "#30d158", "#ff453a", "#ffd60a", "#5e5ce6", "#ff375f"];
        const GRAFIK_LABELS = {
            all:"Alle Kategorien", haushalt:"Haushalt", freizeit:"Freizeit", fixkosten:"Fixkosten",
            versicherungen:"Versicherungen", einnahmen:"Einnahmen", reisen:"Reisen",
            geplant:"Geplante Ausgaben", sparen:"Sparen & Investieren"
        };

