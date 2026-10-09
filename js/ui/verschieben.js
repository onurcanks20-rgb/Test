Kostentracker.module({
  "id": "js/ui/verschieben.js",
  "dependencies": [
    "escapeHtml",
    "generateId",
    "heuteISO",
    "parseBetrag",
    "parseISODate",
    "renderAusgabenArchiv",
    "renderEinnahmen",
    "renderFreizeit",
    "renderHaushalt",
    "renderHomeUebersicht",
    "renderLaender",
    "renderLaufendeKosten",
    "renderListe",
    "renderVersicherungen",
    "speichern",
    "tagAusDatum"
  ],
  "session": [
    "aktuellesLand",
    "moveContext"
  ],
  "read": [
    "Laufende Kosten",
    "Versicherungen",
    "Einnahmen",
    "Reisen",
    "Haushalt",
    "Freizeit"
  ],
  "write": [
    "Laufende Kosten",
    "Versicherungen",
    "Einnahmen",
    "Reisen",
    "Haushalt",
    "Freizeit"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/ui/verschieben.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function findeAusgabeZumVerschieben(quelle, id) {
            const sid = String(id);
            if (quelle === "fixkosten") {
                const liste = context.repository.view["Laufende Kosten"]?.fix || [];
                const index = liste.findIndex(e => String(e.id) === sid);
                return index >= 0 ? { eintrag: liste[index], entfernen: () => liste.splice(index, 1) } : null;
            }
            if (quelle === "versicherungen") {
                const liste = Array.isArray(context.repository.view.Versicherungen) ? context.repository.view.Versicherungen : [];
                const index = liste.findIndex(e => String(e.id) === sid);
                return index >= 0 ? { eintrag: liste[index], entfernen: () => liste.splice(index, 1) } : null;
            }
            if (quelle === "einnahmen") {
                const liste = Array.isArray(context.repository.view.Einnahmen) ? context.repository.view.Einnahmen : [];
                const index = liste.findIndex(e => String(e.id) === sid);
                return index >= 0 ? { eintrag: liste[index], entfernen: () => liste.splice(index, 1) } : null;
            }
            if (quelle === "reisen") {
                for (const land of Object.keys(context.repository.view.Reisen || {})) {
                    for (const kategorie of Object.keys(context.repository.view.Reisen?.[land] || {})) {
                        const liste = context.repository.view.Reisen[land][kategorie];
                        if (!Array.isArray(liste)) continue;
                        const index = liste.findIndex(e => String(e.id) === sid);
                        if (index >= 0) return { eintrag: liste[index], land, kategorie, entfernen: () => liste.splice(index, 1) };
                    }
                }
                return null;
            }
            const bereich = quelle === "haushalt" ? context.repository.view.Haushalt : quelle === "freizeit" ? context.repository.view.Freizeit : null;
            if (!bereich) return null;
            for (const key of Object.keys(bereich)) {
                const liste = bereich[key];
                if (!Array.isArray(liste)) continue;
                const index = liste.findIndex(e => String(e.id) === sid);
                if (index >= 0) return { eintrag: liste[index], entfernen: () => liste.splice(index, 1) };
            }
            return null;
        }

        function moveLabel(key) {
            return ({haushalt:"🛒 Haushalt",freizeit:"🎉 Freizeit",fixkosten:"📌 Fixkosten",versicherungen:"🛡️ Versicherungen",einnahmen:"💰 Einnahmen",reisen:"✈️ Reisen"})[key] || key;
        }

        function closeMoveSheet() {
            document.getElementById("moveSheet")?.classList.add("hidden");
            context.session.moveContext = null;
        }

        function moveAusgabe(quelle, id) {
            const gefunden = findeAusgabeZumVerschieben(quelle, id);
            if (!gefunden) return;
            context.session.moveContext = { quelle, id, gefunden };
            renderMoveBereiche();
            document.getElementById("moveSheet")?.classList.remove("hidden");
        }

        function renderMoveBereiche() {
            if (!context.session.moveContext) return;
            const e = context.session.moveContext.gefunden.eintrag;
            document.getElementById("moveSheetTitle").textContent = `„${e.text || e.name || "Eintrag"}“ verschieben nach …`;
            const ziele = ["haushalt","freizeit","fixkosten","versicherungen","einnahmen","reisen"]
                .filter(z => z !== context.session.moveContext.quelle || z === "reisen");
            document.getElementById("moveSheetChoices").innerHTML = ziele.map(z => `<button class="add-choice" onclick="selectMoveBereich('${z}')">${moveLabel(z)}</button>`).join("");
        }

        function selectMoveBereich(ziel) {
            if (!context.session.moveContext) return;
            if (ziel === "reisen") return renderMoveReisen();
            moveEintragJetzt(ziel);
        }

        function renderMoveReisen() {
            const laender = Object.keys(context.repository.view.Reisen || {}).sort((a,b)=>a.localeCompare(b,"de"));
            document.getElementById("moveSheetTitle").textContent = "In welche Reise?";
            const box = document.getElementById("moveSheetChoices");
            if (!laender.length) {
                box.innerHTML = `<div style="padding:8px 2px 16px;opacity:.75;">Es gibt noch keine Reise.</div><button class="add-choice" onclick="renderMoveBereiche()">← Zurück</button>`;
                return;
            }
            context.session.moveContext.reiseOptionen = laender;
            box.innerHTML = laender.map((land,i)=>`<button class="add-choice" onclick="renderMoveReiseKategorien(${i})">✈️ ${dependencies.escapeHtml(land)}</button>`).join("") + `<button class="add-choice" onclick="renderMoveBereiche()">← Zurück</button>`;
        }

        function renderMoveReiseKategorien(index) {
            const land = context.session.moveContext?.reiseOptionen?.[index];
            if (!land) return;
            context.session.moveContext.zielLand = land;
            const gruppen = context.repository.view.Reisen?.[land] || {};
            const kategorien = Object.keys(gruppen).filter(k=>Array.isArray(gruppen[k])).sort((a,b)=>a.localeCompare(b,"de"));
            document.getElementById("moveSheetTitle").textContent = `${land}: Kategorie wählen`;
            const box = document.getElementById("moveSheetChoices");
            if (!kategorien.length) {
                gruppen.Sonstiges = [];
                return moveEintragJetzt("reisen", {land,kategorie:"Sonstiges"});
            }
            context.session.moveContext.reiseKategorien = kategorien;
            box.innerHTML = kategorien.map((k,i)=>`<button class="add-choice" onclick="moveEintragInReiseKategorie(${i})">📂 ${dependencies.escapeHtml(k)}</button>`).join("") + `<button class="add-choice" onclick="renderMoveReisen()">← Zurück</button>`;
        }

        function moveEintragInReiseKategorie(index) {
            const land = context.session.moveContext?.zielLand;
            const kategorie = context.session.moveContext?.reiseKategorien?.[index];
            if (!land || !kategorie) return;
            moveEintragJetzt("reisen", {land,kategorie});
        }

        function moveEintragJetzt(ziel, extra={}) {
            if (!context.session.moveContext) return;
            const { quelle, gefunden } = context.session.moveContext;
            const e = gefunden.eintrag;
            const datum = e.datum || dependencies.heuteISO();
            const betrag = dependencies.parseBetrag(e.betrag) || 0;
            const text = e.text || e.name || "Eintrag";
            const neueId = e.id || dependencies.generateId();

            if (ziel === "haushalt") {
                context.repository.view.Haushalt ??= {};
                const monat = (dependencies.parseISODate(datum)?.getMonth() ?? new Date().getMonth()) + 1;
                context.repository.view.Haushalt[monat] ??= [];
                context.repository.view.Haushalt[monat].push({id:neueId,text,betrag,datum,kategorie:e.kategorie || "Sonstiges"});
            } else if (ziel === "freizeit") {
                context.repository.view.Freizeit ??= {};
                const monat = (dependencies.parseISODate(datum)?.getMonth() ?? new Date().getMonth()) + 1;
                context.repository.view.Freizeit[monat] ??= [];
                context.repository.view.Freizeit[monat].push({id:neueId,text,betrag,datum,kategorie:e.kategorie || "Sonstiges"});
            } else if (ziel === "fixkosten") {
                context.repository.view["Laufende Kosten"] ??= {fix:[]};
                context.repository.view["Laufende Kosten"].fix ??= [];
                const infos=[];
                if(e.info) infos.push(e.info); if(e.anbieter) infos.push(e.anbieter); if(e.versicherungsnummer) infos.push(e.versicherungsnummer); if(e.von) infos.push("von "+e.von);
                context.repository.view["Laufende Kosten"].fix.push({id:neueId,text,betrag,datum,tag:dependencies.tagAusDatum(datum),info:infos.join(" · ")});
            } else if (ziel === "versicherungen") {
                context.repository.view.Versicherungen ??= [];
                const d=dependencies.parseISODate(datum)||new Date();
                context.repository.view.Versicherungen.push({id:neueId,name:text,betrag,datum,anbieter:e.anbieter||"",versicherungsnummer:e.versicherungsnummer||e.info||"",intervall:e.intervall||"monatlich",monat:e.monat||(d.getMonth()+1)});
            } else if (ziel === "einnahmen") {
                context.repository.view.Einnahmen ??= [];
                const wiederholung=e.wiederholung || ((quelle==="fixkosten" || (quelle==="versicherungen" && e.intervall==="monatlich")) ? "monatlich" : "einmalig");
                context.repository.view.Einnahmen.push({id:neueId,text,betrag,von:e.von||"",datum,wiederholung});
            } else if (ziel === "reisen") {
                const {land,kategorie="Sonstiges"}=extra;
                if(!land || !context.repository.view.Reisen?.[land]) return;
                context.repository.view.Reisen[land][kategorie] ??= [];
                context.repository.view.Reisen[land][kategorie].push({id:neueId,text,betrag,datum});
            }

            gefunden.entfernen();
            if (dependencies.speichern() === false) return;
            closeMoveSheet();
            dependencies.renderHomeUebersicht(); dependencies.renderHaushalt(); dependencies.renderFreizeit(); dependencies.renderLaufendeKosten(); dependencies.renderVersicherungen(); dependencies.renderEinnahmen(); dependencies.renderLaender();
            if (context.session.aktuellesLand) dependencies.renderListe();
            if (!document.getElementById("ausgabenArchivView")?.classList.contains("hidden")) dependencies.renderAusgabenArchiv();
        }

return { findeAusgabeZumVerschieben, moveLabel, closeMoveSheet, moveAusgabe, renderMoveBereiche, selectMoveBereich, renderMoveReisen, renderMoveReiseKategorien, moveEintragInReiseKategorie, moveEintragJetzt };
});
