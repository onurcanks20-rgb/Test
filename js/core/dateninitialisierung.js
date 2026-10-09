Kostentracker.module({
  "id": "js/core/dateninitialisierung.js",
  "dependencies": [
    "datumAusTagAktuellerMonat",
    "generateId",
    "heuteISO",
    "ladeDaten",
    "normalizeFixkostenZuordnungTage",
    "normalizeWarnTage",
    "parseBetrag",
    "tagAusDatum",
    "validiereGehaltstag"
  ],
  "session": [
    "QUICK_ADD_DEFAULT",
    "STANDARD_DATEN"
  ],
  "read": [
    "*"
  ],
  "write": [
    "*"
  ],
  "replace": true
}, (context, dependencies) => {
"use strict";
        context.session.STANDARD_DATEN = {
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


        context.session.QUICK_ADD_DEFAULT = ["haushalt", "freizeit", "einnahmen", "fixkosten", "versicherungen", "geplant", "sparen", "reisen"];

function initialisiereTestdaten() {
        context.repository.view = dependencies.ladeDaten();

        // 🔥 WICHTIGER MIGRATIONS-FIX:
        // Falls "Laufende Kosten" früher als Array gespeichert wurde, wird es jetzt sauber
        // in { fix: [...] } umgewandelt. Sonst würde JSON.stringify die fix-Einträge verlieren.
        if (!context.repository.view || typeof context.repository.view !== "object" || Array.isArray(context.repository.view)) {
            context.repository.view = context.clone(context.session.STANDARD_DATEN);
        }

        if (!context.repository.view.Reisen || typeof context.repository.view.Reisen !== "object" || Array.isArray(context.repository.view.Reisen)) {
            context.repository.view.Reisen = {};
        }
        if (!context.repository.view.ReisenMeta || typeof context.repository.view.ReisenMeta !== "object" || Array.isArray(context.repository.view.ReisenMeta)) {
            context.repository.view.ReisenMeta = {};
        }
        Object.keys(context.repository.view.Reisen).forEach(land => {
            if (!context.repository.view.ReisenMeta[land] || typeof context.repository.view.ReisenMeta[land] !== "object") {
                context.repository.view.ReisenMeta[land] = { budget: 0, von: "", bis: "" };
            } else {
                context.repository.view.ReisenMeta[land].budget = dependencies.parseBetrag(context.repository.view.ReisenMeta[land].budget) || 0;
                context.repository.view.ReisenMeta[land].von ||= "";
                context.repository.view.ReisenMeta[land].bis ||= "";
            }
        });

        if (!Array.isArray(context.repository.view.Versicherungen)) {
            context.repository.view.Versicherungen = [];
        }

        if (!context.repository.view.Haushalt || typeof context.repository.view.Haushalt !== "object" || Array.isArray(context.repository.view.Haushalt)) {
            context.repository.view.Haushalt = {};
        }

        if (!context.repository.view.Freizeit || typeof context.repository.view.Freizeit !== "object" || Array.isArray(context.repository.view.Freizeit)) {
            context.repository.view.Freizeit = {};
        }

        if (!Array.isArray(context.repository.view.Einnahmen)) {
            context.repository.view.Einnahmen = [];
        }

        if (!Array.isArray(context.repository.view["Geplante Ausgaben"])) {
            context.repository.view["Geplante Ausgaben"] = [];
        }
        context.repository.view["Geplante Ausgaben"] = context.repository.view["Geplante Ausgaben"].map(e => {
            const bereich = ["haushalt", "freizeit", "reisen"].includes(e.bereich) ? e.bereich : "haushalt";
            return {
                ...e,
                id: e.id || dependencies.generateId(),
                text: e.text || "Geplante Ausgabe",
                betrag: dependencies.parseBetrag(e.betrag) || 0,
                datum: e.datum || dependencies.heuteISO(),
                wiederholung: ["monatlich", "jaehrlich"].includes(e.wiederholung) ? e.wiederholung : "einmalig",
                wiederholungStart: e.wiederholungStart || e.datum || dependencies.heuteISO(),
                bereich,
                land: bereich === "reisen" ? (e.land || "") : "",
                kategorie: e.kategorie || "Sonstiges",
                // Bestehende geplante Haushalt/Freizeit-Ausgaben waren immer budgetwirksam.
                budgetWirksam: typeof e.budgetWirksam === "boolean" ? e.budgetWirksam : bereich !== "reisen",
                warnung: !!e.warnung, warnTage: dependencies.normalizeWarnTage(e.warnTage)
            };
        });

        if (!Array.isArray(context.repository.view["Sparen & Investieren"])) {
            context.repository.view["Sparen & Investieren"] = [];
        }
        context.repository.view["Sparen & Investieren"] = context.repository.view["Sparen & Investieren"].map(e => ({
            ...e,
            id: e.id || dependencies.generateId(),
            typ: e.typ === "sparen" ? "sparen" : "investieren",
            text: (e.text && !["Sparen", "Investieren"].includes(String(e.text).trim())) ? String(e.text).trim() : "",
            betrag: dependencies.parseBetrag(e.betrag) || 0,
            datum: e.datum || dependencies.heuteISO(),
            warnung: !!e.warnung, warnTage: dependencies.normalizeWarnTage(e.warnTage)
        }));

        context.repository.view.Einnahmen = context.repository.view.Einnahmen.map(e => ({
            ...e,
            id: e.id || dependencies.generateId(),
            text: e.text || e.name || "Einnahme",
            betrag: dependencies.parseBetrag(e.betrag) || 0,
            datum: e.datum || dependencies.heuteISO(),
            wiederholung: e.wiederholung === "monatlich" ? "monatlich" : "einmalig",
            von: e.von || "", warnung: !!e.warnung, warnTage: dependencies.normalizeWarnTage(e.warnTage)
        }));

        if (!context.repository.view.geloeschteKategorien || typeof context.repository.view.geloeschteKategorien !== "object" || Array.isArray(context.repository.view.geloeschteKategorien)) {
            context.repository.view.geloeschteKategorien = {};
        }

        if (!context.repository.view.Einstellungen || typeof context.repository.view.Einstellungen !== "object" || Array.isArray(context.repository.view.Einstellungen)) {
            context.repository.view.Einstellungen = {};
        }
        if (!["dunkel", "hell", "system"].includes(context.repository.view.Einstellungen.designModus)) context.repository.view.Einstellungen.designModus = "system";
        if (!["aus", "erneut", "ausblenden", "bearbeiten", "verschieben"].includes(context.repository.view.Einstellungen.rechtsSwipeAktion)) context.repository.view.Einstellungen.rechtsSwipeAktion = "aus";
        if (!context.repository.view.Einstellungen.ausgeblendeteEintraege || typeof context.repository.view.Einstellungen.ausgeblendeteEintraege !== "object" || Array.isArray(context.repository.view.Einstellungen.ausgeblendeteEintraege)) {
            context.repository.view.Einstellungen.ausgeblendeteEintraege = {};
        }
        const standardWarnungen = context.clone(context.session.STANDARD_DATEN.Einstellungen.warnungen);
        if (!context.repository.view.Einstellungen.warnungen || typeof context.repository.view.Einstellungen.warnungen !== "object") context.repository.view.Einstellungen.warnungen = standardWarnungen;
        context.repository.view.Einstellungen.warnungen = { ...standardWarnungen, ...context.repository.view.Einstellungen.warnungen, kategorien:{...standardWarnungen.kategorien,...(context.repository.view.Einstellungen.warnungen.kategorien||{})} };

        context.repository.view.Einstellungen.gehaltstag = dependencies.validiereGehaltstag(context.repository.view.Einstellungen.gehaltstag);
        if (!context.repository.view.Einstellungen.startgehaelter || typeof context.repository.view.Einstellungen.startgehaelter !== "object" || Array.isArray(context.repository.view.Einstellungen.startgehaelter)) {
            context.repository.view.Einstellungen.startgehaelter = {};
        }
        if (!context.repository.view.Einstellungen.naechstesGehaltPlan || typeof context.repository.view.Einstellungen.naechstesGehaltPlan !== "object" || Array.isArray(context.repository.view.Einstellungen.naechstesGehaltPlan)) {
            context.repository.view.Einstellungen.naechstesGehaltPlan = { datum: "", betrag: "", periodenStart: "" };
        } else {
            context.repository.view.Einstellungen.naechstesGehaltPlan = {
                datum: typeof context.repository.view.Einstellungen.naechstesGehaltPlan.datum === "string" ? context.repository.view.Einstellungen.naechstesGehaltPlan.datum : "",
                betrag: context.repository.view.Einstellungen.naechstesGehaltPlan.betrag ?? "",
                periodenStart: typeof context.repository.view.Einstellungen.naechstesGehaltPlan.periodenStart === "string" ? context.repository.view.Einstellungen.naechstesGehaltPlan.periodenStart : ""
            };
        }
        if (typeof context.repository.view.Einstellungen.aktuellerGehaltsstart !== "string") context.repository.view.Einstellungen.aktuellerGehaltsstart = "";

        if (!Array.isArray(context.repository.view.Einstellungen.quickAddFavoriten)) {
            context.repository.view.Einstellungen.quickAddFavoriten = [...context.session.QUICK_ADD_DEFAULT];
        } else {
            const gueltig = new Set(context.session.QUICK_ADD_DEFAULT);
            context.repository.view.Einstellungen.quickAddFavoriten = context.repository.view.Einstellungen.quickAddFavoriten.filter((key, index, arr) => gueltig.has(key) && arr.indexOf(key) === index);
        }

        const standardSchnellbetraege = [5, 10, 20, 50];
        if (!Array.isArray(context.repository.view.Einstellungen.schnellbetraege) || context.repository.view.Einstellungen.schnellbetraege.length !== 4) {
            context.repository.view.Einstellungen.schnellbetraege = [...standardSchnellbetraege];
        } else {
            context.repository.view.Einstellungen.schnellbetraege = context.repository.view.Einstellungen.schnellbetraege.map((wert, index) => {
                const n = dependencies.parseBetrag(wert);
                return Number.isFinite(n) && n > 0 ? n : standardSchnellbetraege[index];
            });
        }

        if (!context.repository.view.Einstellungen.letzteKategorien || typeof context.repository.view.Einstellungen.letzteKategorien !== "object" || Array.isArray(context.repository.view.Einstellungen.letzteKategorien)) {
            context.repository.view.Einstellungen.letzteKategorien = { haushalt: "Einkauf", freizeit: "Essen / Trinken", reisen: {} };
        }
        context.repository.view.Einstellungen.letzteKategorien.haushalt ||= "Einkauf";
        context.repository.view.Einstellungen.letzteKategorien.freizeit ||= "Essen / Trinken";
        if (["Essen", "Trinken", "Essen gehen", "Café", "Snacks"].includes(context.repository.view.Einstellungen.letzteKategorien.freizeit)) context.repository.view.Einstellungen.letzteKategorien.freizeit = "Essen / Trinken";
        if (!context.repository.view.Einstellungen.letzteKategorien.reisen || typeof context.repository.view.Einstellungen.letzteKategorien.reisen !== "object" || Array.isArray(context.repository.view.Einstellungen.letzteKategorien.reisen)) {
            context.repository.view.Einstellungen.letzteKategorien.reisen = {};
        }

        const alteLaufendeKosten = context.repository.view["Laufende Kosten"];

        if (Array.isArray(alteLaufendeKosten)) {
            context.repository.view["Laufende Kosten"] = { fix: alteLaufendeKosten };
        } else if (!alteLaufendeKosten || typeof alteLaufendeKosten !== "object") {
            context.repository.view["Laufende Kosten"] = { fix: [] };
        } else if (!Array.isArray(alteLaufendeKosten.fix)) {
            context.repository.view["Laufende Kosten"].fix = [];
        }

        // Alte Einträge hatten nur einen Tag (z. B. 15).
        // Neue Einträge speichern zusätzlich ein echtes Datum (z. B. 2026-05-15).
        context.repository.view["Laufende Kosten"].fix = context.repository.view["Laufende Kosten"].fix.map(k => {
            const datum = k.datum || dependencies.datumAusTagAktuellerMonat(k.tag);
            return {
                ...k,
                text: k.text || k.name || "",
                datum,
                tag: dependencies.tagAusDatum(datum),
                haendler: String(k.haendler || "").trim(),
                zuordnungTage: dependencies.normalizeFixkostenZuordnungTage(k.zuordnungTage)
            };
        });

        // Migration direkt speichern, damit alte kaputte Strukturen nicht wiederkommen.
        try {
            context.storage.setItem(context.storage.key, JSON.stringify(context.repository.view));
        } catch (error) {
            console.error("Migration konnte nicht gespeichert werden:", error);
        }

}
function migriereKategorienDaten() {
        for (let i = 1; i <= 12; i++) {
            context.repository.view.Haushalt[i] ??= [];
            context.repository.view.Freizeit[i] ??= [];
        }

        // Unterkategorien für bestehende Einträge ergänzen.
        Object.values(context.repository.view.Haushalt).forEach(liste => {
            if (!Array.isArray(liste)) return;
            liste.forEach(e => { if (e && !e.kategorie) e.kategorie = "Sonstiges"; });
        });
        Object.values(context.repository.view.Freizeit).forEach(liste => {
            if (!Array.isArray(liste)) return;
            liste.forEach(e => { if (e && !e.kategorie) e.kategorie = "Sonstiges"; });
        });

        // Alte Unterkategorien auf die vereinfachte Struktur umstellen.
        Object.values(context.repository.view.Haushalt).forEach(liste => {
            if (!Array.isArray(liste)) return;
            liste.forEach(e => {
                if (!e) return;
                if (e.kategorie === "Lebensmittel") e.kategorie = "Einkauf";
                if (e.kategorie === "Sonstiger Haushalt") e.kategorie = "Sonstiges";
            });
        });
        Object.values(context.repository.view.Freizeit).forEach(liste => {
            if (!Array.isArray(liste)) return;
            liste.forEach(e => {
                if (!e) return;
                if (["Essen", "Trinken", "Essen gehen", "Café", "Snacks"].includes(e.kategorie)) e.kategorie = "Essen / Trinken";
                if (e.kategorie === "Kino/Event" || e.kategorie === "Kino / Event") e.kategorie = "Aktivität";
            });
        });
        const normalizeReminder = e => { if (!e || typeof e !== "object") return; e.warnung=!!e.warnung; e.warnTage=dependencies.normalizeWarnTage(e.warnTage); };
        Object.values(context.repository.view.Haushalt).forEach(l=>Array.isArray(l)&&l.forEach(normalizeReminder));
        Object.values(context.repository.view.Freizeit).forEach(l=>Array.isArray(l)&&l.forEach(normalizeReminder));
        context.repository.view.Versicherungen.forEach(normalizeReminder);
        context.repository.view["Laufende Kosten"].fix.forEach(normalizeReminder);
        Object.values(context.repository.view.Reisen).forEach(r=>Object.values(r||{}).forEach(l=>Array.isArray(l)&&l.forEach(normalizeReminder)));

        for (const land of Object.keys(context.repository.view.Reisen || {})) {
            const reise = context.repository.view.Reisen[land];
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

        for (let land in context.repository.view.Reisen) {
            for (let k in context.repository.view.Reisen[land]) {

                context.repository.view.Reisen[land][k] = context.repository.view.Reisen[land][k].map(e => ({
                    id: e.id ?? dependencies.generateId(),
                    betrag: e.betrag ?? 0,
                    text: e.text ?? "",
                    datum: e.datum ?? ""
                }));
            }
        }

}
function migriereVersicherungsUndReisestruktur() {
        if (!context.repository.view.geloeschteKategorien) {
            context.repository.view.geloeschteKategorien = {};
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

        for (let land in context.repository.view.Reisen) {

            let geloescht = context.repository.view.geloeschteKategorien[land] || [];

            standardKategorien.forEach(k => {

                if (!context.repository.view.Reisen[land][k] && !geloescht.includes(k)) {
                    context.repository.view.Reisen[land][k] = [];
                }

            });
        }

        context.repository.view.Versicherungen = context.repository.view.Versicherungen.map(v => ({
            id: v.id || dependencies.generateId(),
            name: v.name || "",
            betrag: v.betrag ?? 0,
            anbieter: v.anbieter || "",
            versicherungsnummer: v.versicherungsnummer || "",
            intervall: v.intervall || "monatlich",
            monat: v.monat ?? 1,
            datum: v.datum || ""
        }));

        

}

return { initialisiereTestdaten, migriereKategorienDaten, migriereVersicherungsUndReisestruktur };
});
