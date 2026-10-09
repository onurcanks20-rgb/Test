Kostentracker.module({
  "id": "js/kategorien/freizeit.js",
  "dependencies": [
    "applyLetzteAlltagsKategorie",
    "beginUndoDelete",
    "closeStartQuickAdd",
    "finishUndoDelete",
    "formatText",
    "generateId",
    "heuteISO",
    "merkeLetzteKategorie",
    "parseBetrag",
    "parseISODate",
    "readReminderControl",
    "renderBereichWocheninfo",
    "renderHomeUebersicht",
    "renderRecentAusgaben",
    "speichern"
  ],
  "session": [
    "state"
  ],
  "read": [
    "Freizeit"
  ],
  "write": [
    "Freizeit"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/kategorien/freizeit.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function addFreizeit() {
            let text = dependencies.formatText(document.getElementById("freizeitText").value);
            let betrag = dependencies.parseBetrag(document.getElementById("freizeitBetrag").value);
            let datum = document.getElementById("freizeitDatum").value;
            let kategorie = document.getElementById("freizeitKategorie")?.value || "Sonstiges";

            if (isNaN(betrag) || !datum) return;
            if (!text) text = kategorie;

            let monat = new Date(datum).getMonth() + 1;
            context.repository.view.Freizeit[monat] ??= [];
            context.repository.view.Freizeit[monat].push({ id: dependencies.generateId(), text, betrag, datum, kategorie, ...dependencies.readReminderControl("add:freizeit") });
            dependencies.merkeLetzteKategorie("freizeit", kategorie);
            if (dependencies.speichern() === false) return;

            document.getElementById("freizeitText").value = "";
            document.getElementById("freizeitBetrag").value = "";
            document.getElementById("freizeitDatum").value = dependencies.heuteISO();
            dependencies.applyLetzteAlltagsKategorie("freizeit");
            document.getElementById("freizeitAddPanel")?.classList.add("hidden");
            renderFreizeit();
            dependencies.renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) dependencies.closeStartQuickAdd();
        }

        function renderFreizeit() {
            const hatEintraege = Object.values(context.repository.view.Freizeit || {}).some(liste => Array.isArray(liste) && liste.length > 0);
            document.getElementById("freizeitDeleteAllBtn")?.classList.toggle("hidden", !hatEintraege);
            dependencies.renderBereichWocheninfo("freizeit");
            dependencies.renderRecentAusgaben("freizeit");
        }

        function gruppiereFreizeit() {
            const gruppiert = {};
            if (!context.repository.view.Freizeit) return gruppiert;
            Object.values(context.repository.view.Freizeit).forEach(liste => {
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

        function toggleFreizeitJahr(jahr){ context.session.state.offeneFreizeitJahre[jahr]=!context.session.state.offeneFreizeitJahre[jahr]; renderFreizeit(); }

        function toggleFreizeitMonat(jahr,monat){ const key=jahr+'-'+monat; context.session.state.offeneFreizeitMonate[key]=!context.session.state.offeneFreizeitMonate[key]; renderFreizeit(); }

        function startEditFreizeit(id){ context.session.state.editFreizeitId=id; renderFreizeit(); }

        function cancelEditFreizeit(){ context.session.state.editFreizeitId=null; renderFreizeit(); }

        function saveEditFreizeit(id){
            const textEl=document.getElementById('editFreizeitText-'+id), betragEl=document.getElementById('editFreizeitBetrag-'+id), datumEl=document.getElementById('editFreizeitDatum-'+id);
            if(!textEl||!betragEl||!datumEl) return;
            const text=textEl.value, betrag=dependencies.parseBetrag(betragEl.value), datum=datumEl.value;
            if(!text||isNaN(betrag)||!datum) return;
            let found=null, oldMonat=null, oldIndex=-1;
            for(const monat in context.repository.view.Freizeit){ const liste=context.repository.view.Freizeit[monat]; if(!Array.isArray(liste)) continue; const i=liste.findIndex(e=>String(e.id)===String(id)); if(i!==-1){found=liste[i];oldMonat=monat;oldIndex=i;break;} }
            if(!found) return;
            context.repository.view.Freizeit[oldMonat].splice(oldIndex,1);
            const neuerMonat=new Date(datum).getMonth()+1; context.repository.view.Freizeit[neuerMonat]??=[];
            context.repository.view.Freizeit[neuerMonat].push({...found,id:found.id,text:dependencies.formatText(text),betrag,datum,kategorie:found.kategorie || "Sonstiges",...dependencies.readReminderControl(`edit:freizeit:${id}`)});
            if (dependencies.speichern() === false) return;
            context.session.state.editFreizeitId=null; renderFreizeit();
        }

        function deleteFreizeit(id){
            if(!confirm('Eintrag löschen?')) return;
            dependencies.beginUndoDelete("Freizeit-Eintrag gelöscht");
            for(const monat in context.repository.view.Freizeit){ const liste=context.repository.view.Freizeit[monat]; if(!Array.isArray(liste)) continue; const i=liste.findIndex(e=>String(e.id)===String(id)); if(i!==-1){liste.splice(i,1);break;} }
            if (dependencies.speichern() === false) return; renderFreizeit(); dependencies.finishUndoDelete("Freizeit-Eintrag gelöscht");
        }

        function deleteAlleFreizeit(){
            if(!confirm('Alle Freizeit-Einträge wirklich löschen?')) return;
            dependencies.beginUndoDelete("Alle Freizeit-Einträge gelöscht");
            context.repository.view.Freizeit ??= {};
            for(const monat in context.repository.view.Freizeit) if(Array.isArray(context.repository.view.Freizeit[monat])) context.repository.view.Freizeit[monat]=[];
            if (dependencies.speichern() === false) return; renderFreizeit(); dependencies.finishUndoDelete("Alle Freizeit-Einträge gelöscht");
        }

function bookFreizeitPlannedOccurrence(entry, datum, occurrenceKey, wiederholung) {
    const month = dependencies.parseISODate(datum).getMonth() + 1;
    context.repository.view.Freizeit[month] ??= [];
    const exists = context.repository.view.Freizeit[month].some(x => String(x.geplantOccurrenceKey || "") === occurrenceKey || (wiederholung === "einmalig" && String(x.geplantId || "") === String(entry.id)));
    if (!exists) context.repository.view.Freizeit[month].push({id:dependencies.generateId(), geplantId:entry.id, geplantOccurrenceKey:occurrenceKey, ausGeplant:true,
        text:entry.text || entry.kategorie || "Geplante Ausgabe", betrag:dependencies.parseBetrag(entry.betrag)||0, datum, kategorie:entry.kategorie||"Sonstiges"});
    return true;
}
function appendFreizeitExternalExpense(entry, month) { context.repository.view.Freizeit ??= {}; context.repository.view.Freizeit[month] ??= []; context.repository.view.Freizeit[month].push(entry); }

function freizeitImZeitraum(von, bis) {
            const liste = [];
            if (!context.repository.view.Freizeit) return liste;
            Object.values(context.repository.view.Freizeit).forEach(monatsListe => {
                if (!Array.isArray(monatsListe)) return;
                monatsListe.forEach(e => {
                    const d = dependencies.parseISODate(e.datum);
                    const betrag = dependencies.parseBetrag(e.betrag);
                    if (!d || isNaN(betrag)) return;
                    if (d >= von && d <= bis) liste.push({ ...e, betrag, datumObj: d });
                });
            });
            return liste;
        }

return { addFreizeit, renderFreizeit, gruppiereFreizeit, toggleFreizeitJahr, toggleFreizeitMonat, startEditFreizeit, cancelEditFreizeit, saveEditFreizeit, deleteFreizeit, deleteAlleFreizeit, bookFreizeitPlannedOccurrence, appendFreizeitExternalExpense, freizeitImZeitraum };
});
