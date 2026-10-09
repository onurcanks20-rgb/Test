// Kostentracker Test: js/kategorien/freizeit.js
// Functions share the existing app state; initialize only in app/start.js.

        function addFreizeit() {
            let text = formatText(document.getElementById("freizeitText").value);
            let betrag = parseBetrag(document.getElementById("freizeitBetrag").value);
            let datum = document.getElementById("freizeitDatum").value;
            let kategorie = document.getElementById("freizeitKategorie")?.value || "Sonstiges";

            if (isNaN(betrag) || !datum) return;
            if (!text) text = kategorie;

            let monat = new Date(datum).getMonth() + 1;
            daten.Freizeit[monat] ??= [];
            daten.Freizeit[monat].push({ id: generateId(), text, betrag, datum, kategorie, ...readReminderControl("add:freizeit") });
            merkeLetzteKategorie("freizeit", kategorie);
            if (speichern() === false) return;

            document.getElementById("freizeitText").value = "";
            document.getElementById("freizeitBetrag").value = "";
            document.getElementById("freizeitDatum").value = heuteISO();
            applyLetzteAlltagsKategorie("freizeit");
            document.getElementById("freizeitAddPanel")?.classList.add("hidden");
            renderFreizeit();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
        }

        function renderFreizeit() {
            const hatEintraege = Object.values(daten.Freizeit || {}).some(liste => Array.isArray(liste) && liste.length > 0);
            document.getElementById("freizeitDeleteAllBtn")?.classList.toggle("hidden", !hatEintraege);
            renderBereichWocheninfo("freizeit");
            renderRecentAusgaben("freizeit");
        }

        function gruppiereFreizeit() {
            const gruppiert = {};
            if (!daten.Freizeit) return gruppiert;
            Object.values(daten.Freizeit).forEach(liste => {
                if (!Array.isArray(liste)) return;
                liste.forEach(e => {
                    if (!e || !e.datum) return;
                    const d = new Date(e.datum); if (isNaN(d)) return;
                    const jahr=d.getFullYear(), monat=d.getMonth()+1;
                    gruppiert[jahr] ??= {}; gruppiert[jahr][monat] ??= []; gruppiert[jahr][monat].push(e);
                });
            });
            return gruppiert;
        }

        function toggleFreizeitJahr(jahr){ state.offeneFreizeitJahre[jahr]=!state.offeneFreizeitJahre[jahr]; renderFreizeit(); }

        function toggleFreizeitMonat(jahr,monat){ const key=jahr+'-'+monat; state.offeneFreizeitMonate[key]=!state.offeneFreizeitMonate[key]; renderFreizeit(); }

        function startEditFreizeit(id){ state.editFreizeitId=id; renderFreizeit(); }

        function cancelEditFreizeit(){ state.editFreizeitId=null; renderFreizeit(); }

        function saveEditFreizeit(id){
            const textEl=document.getElementById('editFreizeitText-'+id), betragEl=document.getElementById('editFreizeitBetrag-'+id), datumEl=document.getElementById('editFreizeitDatum-'+id);
            if(!textEl||!betragEl||!datumEl) return;
            const text=textEl.value, betrag=parseBetrag(betragEl.value), datum=datumEl.value;
            if(!text||isNaN(betrag)||!datum) return;
            let found=null, oldMonat=null, oldIndex=-1;
            for(const monat in daten.Freizeit){ const liste=daten.Freizeit[monat]; if(!Array.isArray(liste)) continue; const i=liste.findIndex(e=>String(e.id)===String(id)); if(i!==-1){found=liste[i];oldMonat=monat;oldIndex=i;break;} }
            if(!found) return;
            daten.Freizeit[oldMonat].splice(oldIndex,1);
            const neuerMonat=new Date(datum).getMonth()+1; daten.Freizeit[neuerMonat]??=[];
            daten.Freizeit[neuerMonat].push({...found,id:found.id,text:formatText(text),betrag,datum,kategorie:found.kategorie || "Sonstiges",...readReminderControl(`edit:freizeit:${id}`)});
            if (speichern() === false) return;
            state.editFreizeitId=null; renderFreizeit();
        }

        function deleteFreizeit(id){
            if(!confirm('Eintrag löschen?')) return;
            beginUndoDelete("Freizeit-Eintrag gelöscht");
            for(const monat in daten.Freizeit){ const liste=daten.Freizeit[monat]; if(!Array.isArray(liste)) continue; const i=liste.findIndex(e=>String(e.id)===String(id)); if(i!==-1){liste.splice(i,1);break;} }
            if (speichern() === false) return; renderFreizeit(); finishUndoDelete("Freizeit-Eintrag gelöscht");
        }

        function deleteAlleFreizeit(){
            if(!confirm('Alle Freizeit-Einträge wirklich löschen?')) return;
            beginUndoDelete("Alle Freizeit-Einträge gelöscht");
            daten.Freizeit ??= {};
            for(const monat in daten.Freizeit) if(Array.isArray(daten.Freizeit[monat])) daten.Freizeit[monat]=[];
            if (speichern() === false) return; renderFreizeit(); finishUndoDelete("Alle Freizeit-Einträge gelöscht");
        }
