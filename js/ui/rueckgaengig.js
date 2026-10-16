Kostentracker.module({
  "id": "js/ui/rueckgaengig.js",
  "dependencies": [
    "renderAusgabenArchiv",
    "renderEinnahmen",
    "renderFreizeit",
    "renderGeplanteAusgaben",
    "renderGlobalArchiv",
    "renderHaushalt",
    "renderHomeUebersicht",
    "renderLaender",
    "renderLaufendeKosten",
    "renderListe",
    "renderSparenInvestieren",
    "renderVersicherungen",
    "speichern"
  ],
  "session": [
    "aktuellesLand"
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
let undoDeleteState = null, undoDeleteTimer = null, undoBatchDepth = 0;
function beginUndoBatch(label) { if (!undoBatchDepth) beginUndoDelete(label); undoBatchDepth++; }
function finishUndoBatch(label) { if (undoBatchDepth) undoBatchDepth--; if (!undoBatchDepth) finishUndoDelete(label); }
// Kostentracker Test: js/ui/rueckgaengig.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function cloneDatenForUndo() {
            try { return context.clone(context.repository.view); }
            catch (_) { return JSON.parse(JSON.stringify(context.repository.view)); }
        }

        function beginUndoDelete(label = "Eintrag gelöscht") {
            if (undoBatchDepth) return;
            undoDeleteState = { daten: cloneDatenForUndo(), danach: null, label };
        }

        function showUndoDelete(label) {
            const toast = document.getElementById("undoToast");
            const text = document.getElementById("undoToastText");
            if (!toast || !undoDeleteState) return;
            if (text) text.textContent = label || undoDeleteState.label || "Eintrag gelöscht";
            toast.classList.remove("hidden");
            clearTimeout(undoDeleteTimer);
            undoDeleteTimer = setTimeout(() => {
                toast.classList.add("hidden");
                undoDeleteState = null;
            }, 6000);
        }

        function mergeUndoData(before, after, current) {
            const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
            const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
            const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
            const merchantRule=value=>isObject(value)&&typeof value.merchant==="string"&&typeof value.area==="string"&&typeof value.category==="string";
            const merchantKey=value=>value.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/['’`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
            const entryKey = value => isObject(value) && value.id != null ? "id:" + String(value.id) : merchantRule(value) ? "merchant:"+merchantKey(value.merchant) : "value:" + JSON.stringify(value);
            const arrayChange=(oldValue,actionValue,now)=>(Array.isArray(oldValue)||Array.isArray(actionValue))&&(oldValue===undefined||Array.isArray(oldValue))&&(actionValue===undefined||Array.isArray(actionValue))&&(now===undefined||Array.isArray(now));
            // A move removes the unchanged destination copy before restoring its source.
            // Exclude precisely those copies from the global duplicate guard.
            const removedEntries=new WeakSet();
            const planRemovals=(oldValue,actionValue,now)=>{
                if(equal(oldValue,actionValue))return;
                if(arrayChange(oldValue,actionValue,now)){
                    const oldItems=new Map((oldValue||[]).map(item=>[entryKey(item),item]));
                    const actionItems=new Map((actionValue||[]).map(item=>[entryKey(item),item]));
                    for(const item of now||[]){const key=entryKey(item);if(!oldItems.has(key)&&actionItems.has(key)&&equal(item,actionItems.get(key))){if(isObject(item))removedEntries.add(item);}else if(oldItems.has(key)&&actionItems.has(key))planRemovals(oldItems.get(key),actionItems.get(key),item);}
                }else if((isObject(oldValue)||isObject(actionValue))&&(now===undefined||isObject(now))){
                    for(const key of new Set([...Object.keys(oldValue||{}),...Object.keys(actionValue||{})]))planRemovals(oldValue?.[key],actionValue?.[key],now?.[key]);
                }
            };
            planRemovals(before,after,current);
            // A later edit may have moved an entry to a different month or category.
            const currentIds = new Set();
            const scan = value => {
                if (Array.isArray(value)) value.forEach(item => {
                    if (isObject(item) && removedEntries.has(item)) return;
                    if (isObject(item) && item.id != null) currentIds.add(entryKey(item));
                    scan(item);
                });
                else if (isObject(value)) Object.values(value).forEach(scan);
            };
            scan(current);
            const merge = (oldValue, actionValue, now) => {
                if (equal(oldValue, actionValue)) return copy(now);
                if (arrayChange(oldValue,actionValue,now)) {
                    const oldItems = new Map((oldValue||[]).map(item => [entryKey(item), item]));
                    const actionItems = new Map((actionValue || []).map(item => [entryKey(item), item]));
                    const result = (now || []).filter(item => {
                        const key = entryKey(item);
                        return oldItems.has(key) || !actionItems.has(key) || !equal(item, actionItems.get(key));
                    }).map(item => {
                        const key = entryKey(item);
                        return oldItems.has(key) && actionItems.has(key) ? merge(oldItems.get(key), actionItems.get(key), item) : copy(item);
                    });
                    (oldValue||[]).forEach((item, index) => {
                        const key = entryKey(item);
                        if (actionItems.has(key) || result.some(x => entryKey(x) === key) || (item?.id != null && currentIds.has(key))) return;
                        // Reinsert before the next surviving neighbour; keep later additions.
                        const next = oldValue.slice(index + 1).map(entryKey).find(k => result.some(x => entryKey(x) === k));
                        const position = next === undefined ? result.length : result.findIndex(x => entryKey(x) === next);
                        result.splice(position, 0, copy(item));
                        if (item?.id != null) currentIds.add(key);
                    });
                    return oldValue===undefined&&!result.length?undefined:result;
                }
                // Merchant rules are one decision; never combine a later rule with the old category.
                if(merchantRule(oldValue)||merchantRule(actionValue))return equal(now,actionValue)?copy(oldValue):copy(now);
                if ((isObject(oldValue)||isObject(actionValue)) && (oldValue===undefined||isObject(oldValue)) && (actionValue === undefined || isObject(actionValue)) && (now === undefined || isObject(now))) {
                    const result = copy(now || {});
                    const keys = new Set([...Object.keys(oldValue||{}), ...Object.keys(actionValue || {})]);
                    keys.forEach(key => {
                        const oldItem = oldValue && Object.hasOwn(oldValue, key) ? oldValue[key] : undefined;
                        const actionItem = actionValue && Object.hasOwn(actionValue, key) ? actionValue[key] : undefined;
                        const nowItem = now && Object.hasOwn(now, key) ? now[key] : undefined;
                        const restored = merge(oldItem, actionItem, nowItem);
                        if (restored === undefined) delete result[key];
                        else Object.defineProperty(result, key, { value: restored, enumerable: true, writable: true, configurable: true });
                    });
                    return oldValue===undefined&&!Object.keys(result).length?undefined:result;
                }
                // Preserve subsequent edits; revert only the value left by this action.
                return equal(now, actionValue) ? copy(oldValue) : copy(now);
            };
            return merge(before, after, current);
        }

        function clearUndoDelete() {
            undoDeleteState = null;
            clearTimeout(undoDeleteTimer);
            document.getElementById("undoToast")?.classList.add("hidden");
        }

        function undoDelete() {
            if (!undoDeleteState?.danach) return;
            context.repository.view = mergeUndoData(undoDeleteState.daten, undoDeleteState.danach, context.repository.view);
            if (dependencies.speichern() === false) return;
            clearUndoDelete();
            dependencies.renderHomeUebersicht();
            dependencies.renderHaushalt();
            dependencies.renderFreizeit();
            dependencies.renderLaufendeKosten();
            dependencies.renderVersicherungen();
            dependencies.renderEinnahmen();
            dependencies.renderLaender();
            if (context.session.aktuellesLand && context.repository.view.Reisen?.[context.session.aktuellesLand]) dependencies.renderListe();
            if (!document.getElementById("ausgabenArchivView")?.classList.contains("hidden")) dependencies.renderAusgabenArchiv();
            if (!document.getElementById("globalArchivView")?.classList.contains("hidden")) dependencies.renderGlobalArchiv();
            if (!document.getElementById("geplanteAusgabenView")?.classList.contains("hidden")) dependencies.renderGeplanteAusgaben();
            if (!document.getElementById("sparenInvestierenView")?.classList.contains("hidden")) dependencies.renderSparenInvestieren();
        }

        function finishUndoDelete(label) {
            if (undoBatchDepth) return;
            if (!undoDeleteState) return;
            undoDeleteState.danach = cloneDatenForUndo();
            showUndoDelete(label);
        }

return { beginUndoBatch, finishUndoBatch, cloneDatenForUndo, beginUndoDelete, showUndoDelete, mergeUndoData, clearUndoDelete, undoDelete, finishUndoDelete };
});
