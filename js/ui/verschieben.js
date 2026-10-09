// Kostentracker Test: js/ui/verschieben.js
// Functions share the existing app state; initialize only in app/start.js.

        function findeAusgabeZumVerschieben(quelle, id) {
            const sid = String(id);
            if (quelle === "fixkosten") {
                const liste = daten["Laufende Kosten"]?.fix || [];
                const index = liste.findIndex(e => String(e.id) === sid);
                return index >= 0 ? { eintrag: liste[index], entfernen: () => liste.splice(index, 1) } : null;
            }
            if (quelle === "versicherungen") {
                const liste = Array.isArray(daten.Versicherungen) ? daten.Versicherungen : [];
                const index = liste.findIndex(e => String(e.id) === sid);
                return index >= 0 ? { eintrag: liste[index], entfernen: () => liste.splice(index, 1) } : null;
            }
            if (quelle === "einnahmen") {
                const liste = Array.isArray(daten.Einnahmen) ? daten.Einnahmen : [];
                const index = liste.findIndex(e => String(e.id) === sid);
                return index >= 0 ? { eintrag: liste[index], entfernen: () => liste.splice(index, 1) } : null;
            }
            if (quelle === "reisen") {
                for (const land of Object.keys(daten.Reisen || {})) {
                    for (const kategorie of Object.keys(daten.Reisen?.[land] || {})) {
                        const liste = daten.Reisen[land][kategorie];
                        if (!Array.isArray(liste)) continue;
                        const index = liste.findIndex(e => String(e.id) === sid);
                        if (index >= 0) return { eintrag: liste[index], land, kategorie, entfernen: () => liste.splice(index, 1) };
                    }
                }
                return null;
            }
            const bereich = quelle === "haushalt" ? daten.Haushalt : quelle === "freizeit" ? daten.Freizeit : null;
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
            moveContext = null;
        }

        function moveAusgabe(quelle, id) {
            const gefunden = findeAusgabeZumVerschieben(quelle, id);
            if (!gefunden) return;
            moveContext = { quelle, id, gefunden };
            renderMoveBereiche();
            document.getElementById("moveSheet")?.classList.remove("hidden");
        }

        function renderMoveBereiche() {
            if (!moveContext) return;
            const e = moveContext.gefunden.eintrag;
            document.getElementById("moveSheetTitle").textContent = `„${e.text || e.name || "Eintrag"}“ verschieben nach …`;
            const ziele = ["haushalt","freizeit","fixkosten","versicherungen","einnahmen","reisen"]
                .filter(z => z !== moveContext.quelle || z === "reisen");
            document.getElementById("moveSheetChoices").innerHTML = ziele.map(z => `<button class="add-choice" onclick="selectMoveBereich('${z}')">${moveLabel(z)}</button>`).join("");
        }

        function selectMoveBereich(ziel) {
            if (!moveContext) return;
            if (ziel === "reisen") return renderMoveReisen();
            moveEintragJetzt(ziel);
        }

        function renderMoveReisen() {
            const laender = Object.keys(daten.Reisen || {}).sort((a,b)=>a.localeCompare(b,"de"));
            document.getElementById("moveSheetTitle").textContent = "In welche Reise?";
            const box = document.getElementById("moveSheetChoices");
            if (!laender.length) {
                box.innerHTML = `<div style="padding:8px 2px 16px;opacity:.75;">Es gibt noch keine Reise.</div><button class="add-choice" onclick="renderMoveBereiche()">← Zurück</button>`;
                return;
            }
            moveContext.reiseOptionen = laender;
            box.innerHTML = laender.map((land,i)=>`<button class="add-choice" onclick="renderMoveReiseKategorien(${i})">✈️ ${escapeHtml(land)}</button>`).join("") + `<button class="add-choice" onclick="renderMoveBereiche()">← Zurück</button>`;
        }

        function renderMoveReiseKategorien(index) {
            const land = moveContext?.reiseOptionen?.[index];
            if (!land) return;
            moveContext.zielLand = land;
            const gruppen = daten.Reisen?.[land] || {};
            const kategorien = Object.keys(gruppen).filter(k=>Array.isArray(gruppen[k])).sort((a,b)=>a.localeCompare(b,"de"));
            document.getElementById("moveSheetTitle").textContent = `${land}: Kategorie wählen`;
            const box = document.getElementById("moveSheetChoices");
            if (!kategorien.length) {
                gruppen.Sonstiges = [];
                return moveEintragJetzt("reisen", {land,kategorie:"Sonstiges"});
            }
            moveContext.reiseKategorien = kategorien;
            box.innerHTML = kategorien.map((k,i)=>`<button class="add-choice" onclick="moveEintragInReiseKategorie(${i})">📂 ${escapeHtml(k)}</button>`).join("") + `<button class="add-choice" onclick="renderMoveReisen()">← Zurück</button>`;
        }

        function moveEintragInReiseKategorie(index) {
            const land = moveContext?.zielLand;
            const kategorie = moveContext?.reiseKategorien?.[index];
            if (!land || !kategorie) return;
            moveEintragJetzt("reisen", {land,kategorie});
        }

        function moveEintragJetzt(ziel, extra={}) {
            if (!moveContext) return;
            const { quelle, gefunden } = moveContext;
            const e = gefunden.eintrag;
            const datum = e.datum || heuteISO();
            const betrag = parseBetrag(e.betrag) || 0;
            const text = e.text || e.name || "Eintrag";
            const neueId = e.id || generateId();

            if (ziel === "haushalt") {
                daten.Haushalt ??= {};
                const monat = (parseISODate(datum)?.getMonth() ?? new Date().getMonth()) + 1;
                daten.Haushalt[monat] ??= [];
                daten.Haushalt[monat].push({id:neueId,text,betrag,datum,kategorie:e.kategorie || "Sonstiges"});
            } else if (ziel === "freizeit") {
                daten.Freizeit ??= {};
                const monat = (parseISODate(datum)?.getMonth() ?? new Date().getMonth()) + 1;
                daten.Freizeit[monat] ??= [];
                daten.Freizeit[monat].push({id:neueId,text,betrag,datum,kategorie:e.kategorie || "Sonstiges"});
            } else if (ziel === "fixkosten") {
                daten["Laufende Kosten"] ??= {fix:[]};
                daten["Laufende Kosten"].fix ??= [];
                const infos=[];
                if(e.info) infos.push(e.info); if(e.anbieter) infos.push(e.anbieter); if(e.versicherungsnummer) infos.push(e.versicherungsnummer); if(e.von) infos.push("von "+e.von);
                daten["Laufende Kosten"].fix.push({id:neueId,text,betrag,datum,tag:tagAusDatum(datum),info:infos.join(" · ")});
            } else if (ziel === "versicherungen") {
                daten.Versicherungen ??= [];
                const d=parseISODate(datum)||new Date();
                daten.Versicherungen.push({id:neueId,name:text,betrag,datum,anbieter:e.anbieter||"",versicherungsnummer:e.versicherungsnummer||e.info||"",intervall:e.intervall||"monatlich",monat:e.monat||(d.getMonth()+1)});
            } else if (ziel === "einnahmen") {
                daten.Einnahmen ??= [];
                const wiederholung=e.wiederholung || ((quelle==="fixkosten" || (quelle==="versicherungen" && e.intervall==="monatlich")) ? "monatlich" : "einmalig");
                daten.Einnahmen.push({id:neueId,text,betrag,von:e.von||"",datum,wiederholung});
            } else if (ziel === "reisen") {
                const {land,kategorie="Sonstiges"}=extra;
                if(!land || !daten.Reisen?.[land]) return;
                daten.Reisen[land][kategorie] ??= [];
                daten.Reisen[land][kategorie].push({id:neueId,text,betrag,datum});
            }

            gefunden.entfernen();
            if (speichern() === false) return;
            closeMoveSheet();
            renderHomeUebersicht(); renderHaushalt(); renderFreizeit(); renderLaufendeKosten(); renderVersicherungen(); renderEinnahmen(); renderLaender();
            if (aktuellesLand) renderListe();
            if (!document.getElementById("ausgabenArchivView")?.classList.contains("hidden")) renderAusgabenArchiv();
        }
