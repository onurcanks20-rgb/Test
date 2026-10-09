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
            const entryKey = value => isObject(value) && value.id != null ? "id:" + String(value.id) : "value:" + JSON.stringify(value);
            // A later edit may have moved an entry to a different month or category.
            const currentIds = new Set();
            const scan = value => {
                if (Array.isArray(value)) value.forEach(item => {
                    if (isObject(item) && item.id != null) currentIds.add(entryKey(item));
                    scan(item);
                });
                else if (isObject(value)) Object.values(value).forEach(scan);
            };
            scan(current);
            const merge = (oldValue, actionValue, now) => {
                if (equal(oldValue, actionValue)) return copy(now);
                if (Array.isArray(oldValue) && (actionValue === undefined || Array.isArray(actionValue)) && (now === undefined || Array.isArray(now))) {
                    const oldItems = new Map(oldValue.map(item => [entryKey(item), item]));
                    const actionItems = new Map((actionValue || []).map(item => [entryKey(item), item]));
                    const result = (now || []).filter(item => {
                        const key = entryKey(item);
                        return oldItems.has(key) || !actionItems.has(key) || !equal(item, actionItems.get(key));
                    }).map(item => {
                        const key = entryKey(item);
                        return oldItems.has(key) && actionItems.has(key) ? merge(oldItems.get(key), actionItems.get(key), item) : copy(item);
                    });
                    oldValue.forEach((item, index) => {
                        const key = entryKey(item);
                        if (actionItems.has(key) || result.some(x => entryKey(x) === key) || (item?.id != null && currentIds.has(key))) return;
                        // Reinsert before the next surviving neighbour; keep later additions.
                        const next = oldValue.slice(index + 1).map(entryKey).find(k => result.some(x => entryKey(x) === k));
                        const position = next === undefined ? result.length : result.findIndex(x => entryKey(x) === next);
                        result.splice(position, 0, copy(item));
                        if (item?.id != null) currentIds.add(key);
                    });
                    return result;
                }
                if (isObject(oldValue) && (actionValue === undefined || isObject(actionValue)) && (now === undefined || isObject(now))) {
                    const result = copy(now || {});
                    const keys = new Set([...Object.keys(oldValue), ...Object.keys(actionValue || {})]);
                    keys.forEach(key => {
                        const oldItem = Object.hasOwn(oldValue, key) ? oldValue[key] : undefined;
                        const actionItem = actionValue && Object.hasOwn(actionValue, key) ? actionValue[key] : undefined;
                        const nowItem = now && Object.hasOwn(now, key) ? now[key] : undefined;
                        const restored = merge(oldItem, actionItem, nowItem);
                        if (restored === undefined) delete result[key];
                        else Object.defineProperty(result, key, { value: restored, enumerable: true, writable: true, configurable: true });
                    });
                    return result;
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
