Kostentracker.module({
  "id": "js/ui/eintragsaktionen.js",
  "dependencies": [
    "beginUndoDelete",
    "findeAusgabeZumVerschieben",
    "finishUndoDelete",
    "heuteISO",
    "populateGlobalArchivJahre",
    "renderAusgabenArchiv",
    "renderEinnahmen",
    "renderFreizeit",
    "renderGlobalArchiv",
    "renderHaushalt",
    "renderLaufendeKosten",
    "renderListe",
    "renderVersicherungen",
    "show",
    "speichern",
    "speichernOhneHomeRender",
    "openStartQuickAdd",
    "setQuickCategory",
    "setReiseKategorie",
    "openLand",
    "getReiseInputCurrency",
    "toggleReiseInputCurrency",
    "updateReiseAmountPreview",
    "formatInputBetrag",
    "resetAddReminderForPanel",
    "toggleIncomeTime",
    "updateGeplantBereichUI",
    "updateGeplantKategorieSelect"
  ],
  "session": [],
  "read": [
    "Einstellungen",
    "Haushalt",
    "Freizeit",
    "Reisen",
    "Geplante Ausgaben",
    "Sparen & Investieren"
  ],
  "write": [
    "Einstellungen",
    "Haushalt",
    "Freizeit",
    "Reisen"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/ui/eintragsaktionen.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function getRightSwipeAction() {
            context.repository.view.Einstellungen ??= {};
            const value = context.repository.view.Einstellungen.rechtsSwipeAktion;
            return ["aus", "erneut", "ausblenden", "bearbeiten", "verschieben"].includes(value) ? value : "aus";
        }

        function rightSwipeActionLabel(value = getRightSwipeAction()) {
            return ({ aus:"Aus", erneut:"Kopieren", ausblenden:"Ausblenden", bearbeiten:"Bearbeiten", verschieben:"Verschieben" })[value] || "Aus";
        }

        function renderGestureSettings() {
            const select = document.getElementById("rightSwipeAction");
            if (select) select.value = getRightSwipeAction();
            const sub = document.getElementById("settingsGesturesMenuSub");
            if (sub) sub.textContent = `Rechts-Swipe: ${rightSwipeActionLabel()}`;
        }

        function openSettingsGestures() {
            dependencies.show("settingsGesturesView");
            renderGestureSettings();
        }

        function setRightSwipeAction(value) {
            if (!["aus", "erneut", "ausblenden", "bearbeiten", "verschieben"].includes(value)) return;
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.rechtsSwipeAktion = value;
            if (dependencies.speichern() === false) return;
            renderGestureSettings();
            document.dispatchEvent(new CustomEvent("kostentracker:rightSwipeSettingChanged"));
        }

        function hiddenEntryKey(type, id) {
            return `${String(type || "")}:${String(id ?? "")}`;
        }

        function istEintragAusgeblendet(type, id) {
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.ausgeblendeteEintraege ??= {};
            return !!context.repository.view.Einstellungen.ausgeblendeteEintraege[hiddenEntryKey(type, id)];
        }

        function setEintragAusgeblendet(type, id, hidden) {
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.ausgeblendeteEintraege ??= {};
            const key = hiddenEntryKey(type, id);
            if (hidden) context.repository.view.Einstellungen.ausgeblendeteEintraege[key] = true;
            else delete context.repository.view.Einstellungen.ausgeblendeteEintraege[key];
        }

        function renderNachEintragsAktion(type) {
            if (!document.getElementById("globalArchivView")?.classList.contains("hidden")) { dependencies.populateGlobalArchivJahre(); dependencies.renderGlobalArchiv(); return; }
            if (!document.getElementById("ausgabenArchivView")?.classList.contains("hidden") && ["haushalt","freizeit"].includes(type)) { dependencies.renderAusgabenArchiv(); return; }
            if (type === "haushalt") dependencies.renderHaushalt();
            else if (type === "freizeit") dependencies.renderFreizeit();
            else if (type === "fixkosten") dependencies.renderLaufendeKosten();
            else if (type === "versicherungen") dependencies.renderVersicherungen();
            else if (type === "einnahmen") dependencies.renderEinnahmen();
            else if (type === "reisen") dependencies.renderListe();
        }

        function cloneEintragFuerSichtbarkeit(eintrag) {
            if (!eintrag || typeof eintrag !== "object") return null;
            try { return context.clone(eintrag); }
            catch (_) { return JSON.parse(JSON.stringify(eintrag)); }
        }

        function restoreEintragNachSichtbarkeit(type, id, snapshot) {
            if (!snapshot) return;
            const gefunden = dependencies.findeAusgabeZumVerschieben(type, id);
            const ziel = gefunden?.eintrag;
            if (!ziel || typeof ziel !== "object") return;

            // Aus-/Einblenden darf niemals Buchungsdaten veraendern.
            // Deshalb wird der komplette Eintrag exakt auf den Stand vor der
            // Sichtbarkeitsaenderung zurueckgesetzt.
            Object.keys(ziel).forEach(key => delete ziel[key]);
            Object.assign(ziel, cloneEintragFuerSichtbarkeit(snapshot));
        }

        function ausblendenEintrag(type, id) {
            const gefunden = dependencies.findeAusgabeZumVerschieben(type, id);
            if (!gefunden?.eintrag) return;
            const snapshot = cloneEintragFuerSichtbarkeit(gefunden.eintrag);
            dependencies.beginUndoDelete("Eintrag ausgeblendet");
            setEintragAusgeblendet(type, id, true);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!dependencies.speichernOhneHomeRender()) return;
            renderNachEintragsAktion(type);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!dependencies.speichernOhneHomeRender()) return;
            dependencies.finishUndoDelete("Eintrag ausgeblendet");
        }

        function eintragEinblenden(type, id) {
            const gefunden = dependencies.findeAusgabeZumVerschieben(type, id);
            if (!gefunden?.eintrag) return;
            const snapshot = cloneEintragFuerSichtbarkeit(gefunden.eintrag);
            dependencies.beginUndoDelete("Eintrag eingeblendet");
            setEintragAusgeblendet(type, id, false);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!dependencies.speichernOhneHomeRender()) return;
            renderNachEintragsAktion(type);
            restoreEintragNachSichtbarkeit(type, id, snapshot);
            if (!dependencies.speichernOhneHomeRender()) return;
            dependencies.finishUndoDelete("Eintrag eingeblendet");
        }

        function erneutBuchenEintrag(type, id) {
            // Keep the stored gesture key and public handler compatible; copying is now a draft.
            if (!["haushalt", "freizeit", "reisen", "fixkosten", "versicherungen", "einnahmen", "geplant", "sparen"].includes(type)) return;
            const list=type==="geplant"?context.repository.view["Geplante Ausgaben"]:type==="sparen"?context.repository.view["Sparen & Investieren"]:null;
            const gefunden=list?{eintrag:list.find(entry=>String(entry.id)===String(id))}:dependencies.findeAusgabeZumVerschieben(type,id);
            if (!gefunden?.eintrag) return;
            const entry=gefunden.eintrag;
            const template={
                fixkosten:{panel:'kostenAddPanel',focus:'costText',date:'costDatum',fields:{costText:entry.text||entry.name||'',costBetrag:dependencies.formatInputBetrag(entry.betrag),costInfo:entry.info||'',costHaendler:entry.haendler||'',costZuordnungTage:entry.zuordnungTage??5}},
                versicherungen:{panel:'versAddPanel',focus:'versName',date:'versDatum',fields:{versName:entry.name||entry.text||'',versBetrag:dependencies.formatInputBetrag(entry.betrag),versAnbieter:entry.anbieter||'',versNummer:entry.versicherungsnummer||'',versIntervall:entry.intervall||'monatlich',versMonat:entry.monat||1}},
                einnahmen:{panel:'einnahmenAddPanel',focus:'einnahmenText',date:'einnahmenDatum',fields:{einnahmenText:entry.text||'',einnahmenBetrag:dependencies.formatInputBetrag(entry.betrag),einnahmenVon:entry.von||'',einnahmenWiederholung:entry.wiederholung==='monatlich'?'monatlich':'einmalig'}},
                geplant:{panel:'geplantAddPanel',focus:'geplantText',date:'geplantDatum',fields:{geplantText:entry.text||'',geplantBetrag:dependencies.formatInputBetrag(entry.betrag),geplantWiederholung:['monatlich','jaehrlich'].includes(entry.wiederholung)?entry.wiederholung:'einmalig',geplantBereich:['haushalt','freizeit','reisen'].includes(entry.bereich)?entry.bereich:'haushalt',geplantBudgetWirksam:entry.budgetWirksam===false?'nein':'ja'}},
                sparen:{panel:'sparenInvestierenAddPanel',focus:'sparenInvestierenBetrag',date:'sparenInvestierenDatum',fields:{sparenInvestierenTyp:entry.typ==='sparen'?'sparen':'investieren',sparenInvestierenText:entry.text||'',sparenInvestierenBetrag:dependencies.formatInputBetrag(entry.betrag)}}
            }[type];
            if(template){
                dependencies.openStartQuickAdd(template.panel,template.focus);
                dependencies.resetAddReminderForPanel(template.panel);
                for(const [key,value] of Object.entries(template.fields)){const input=document.getElementById(key);if(input)input.value=String(value);}
                document.getElementById(template.date).value=dependencies.heuteISO();
                if(type==='einnahmen')dependencies.toggleIncomeTime('einnahmenWiederholung','einnahmenUhrzeitWrap');
                if(type==='geplant'){
                    dependencies.updateGeplantBereichUI(false);
                    const country=document.getElementById('geplantReise');
                    if(entry.bereich==='reisen'&&country){country.value=context.repository.view.Reisen?.[entry.land]?entry.land:'';}
                    dependencies.updateGeplantKategorieSelect();
                    const category=document.getElementById('geplantKategorie');
                    if(category&&Array.from(category.options).some(option=>option.value===entry.kategorie))category.value=entry.kategorie;
                }
                return;
            }
            const panelId=type==="haushalt"?"hausAddPanel":type==="freizeit"?"freizeitAddPanel":"reiseAddPanel";
            if (type==="reisen") dependencies.openLand(gefunden.land);
            const amountId=type==="haushalt"?"hausBetrag":type==="freizeit"?"freizeitBetrag":"betrag";
            const textId=type==="haushalt"?"hausText":type==="freizeit"?"freizeitText":"text";
            const dateId=type==="haushalt"?"hausDatum":type==="freizeit"?"freizeitDatum":"datum";
            dependencies.openStartQuickAdd(panelId,amountId);
            dependencies.resetAddReminderForPanel(panelId);
            document.getElementById(dateId).value=dependencies.heuteISO();
            document.getElementById(textId).value=entry.text || entry.name || "";
            const amount=document.getElementById(amountId);
            if (type==="reisen") {
                // Prefer the original foreign amount only when it matches this journey's input currency.
                const local=dependencies.getReiseInputCurrency();
                const useOriginal=entry.fx?.currency===local && local!=="EUR" && Number.isFinite(entry.fx.amount) && entry.fx.amount>0;
                if (!useOriginal && local!=="EUR") { amount.value=""; dependencies.toggleReiseInputCurrency(); }
                amount.value=dependencies.formatInputBetrag(useOriginal?entry.fx.amount:entry.betrag);
                const category=gefunden.kategorie;
                const button=document.querySelector(`#reiseKategorieGrid [data-category="${CSS.escape(category)}"]`);
                dependencies.setReiseKategorie(category,button,false);
                dependencies.updateReiseAmountPreview();
            } else {
                amount.value=dependencies.formatInputBetrag(entry.betrag);
                const category=entry.kategorie || "Sonstiges",prefix=type==="haushalt"?"haus":"freizeit";
                const button=document.querySelector(`#${prefix}KategorieGrid [data-category="${CSS.escape(category)}"]`);
                dependencies.setQuickCategory(prefix,category,button);
            }
            // No ID, import/transaction marker, reminder or old exchange rate is copied to storage.
        }

        function openHiddenArchive() {
            dependencies.show("globalArchivView");
            dependencies.populateGlobalArchivJahre();
            const sichtbarkeit = document.getElementById("globalArchivSichtbarkeit");
            if (sichtbarkeit) sichtbarkeit.value = "ausgeblendet";
            dependencies.renderGlobalArchiv();
        }

return { getRightSwipeAction, rightSwipeActionLabel, renderGestureSettings, openSettingsGestures, setRightSwipeAction, hiddenEntryKey, istEintragAusgeblendet, setEintragAusgeblendet, renderNachEintragsAktion, cloneEintragFuerSichtbarkeit, restoreEintragNachSichtbarkeit, ausblendenEintrag, eintragEinblenden, erneutBuchenEintrag, openHiddenArchive };
});
