Kostentracker.module({
  "id": "js/ui/ansicht-speichern.js",
  "dependencies": ["goHome", "openUebersicht", "openGrafik", "openReisen", "openHaushalt", "openFreizeit", "openEinnahmen", "openKosten", "openVersicherungen", "openGeplanteAusgaben", "openSparenInvestieren", "openAusgabenArchiv", "openGlobalArchiv", "openSettings", "openSettingsBudget", "openSettingsQuickAdd", "openSettingsWarnings", "openSettingsDesign", "openSettingsGestures", "openMerchantSettings", "openSettingsBackup", "openServerSettings"],
  "session": ["state"], "read": [], "write": [], "replace": false
}, (context, dependencies) => {
"use strict";
const key = 'kostenApp_test_ansicht';
const routes = {
    home: 'goHome', uebersichtView: 'openUebersicht', grafikView: 'openGrafik', reisen: 'openReisen',
    haushaltView: 'openHaushalt', freizeitView: 'openFreizeit', einnahmenView: 'openEinnahmen', kostenView: 'openKosten',
    versicherungenView: 'openVersicherungen', geplanteAusgabenView: 'openGeplanteAusgaben', sparenInvestierenView: 'openSparenInvestieren',
    globalArchivView: 'openGlobalArchiv', settingsView: 'openSettings', settingsBudgetView: 'openSettingsBudget',
    settingsQuickAddView: 'openSettingsQuickAdd', settingsWarningsView: 'openSettingsWarnings', settingsDesignView: 'openSettingsDesign',
    settingsGesturesView: 'openSettingsGestures', settingsMerchantView: 'openMerchantSettings', settingsBackupView: 'openSettingsBackup', serverSettingsView: 'openServerSettings'
};
let currentView = 'home', restoring = false, lastWritten = '', navigationObserved = false;
function snapshotCurrentView(id) {
    // Kein einzelnes Land merken: Reiseeinträge kehren zur normalen Reiseliste zurück.
    const view = id === 'land' || id === 'travelOverviewView' ? 'reisen' : id;
    if (!Object.hasOwn(routes, view) && view !== 'ausgabenArchivView') return null;
    return {version:1, view, archive:context.session.state?.ausgabenArchivTyp === 'freizeit' ? 'freizeit' : 'haushalt'};
}
function rememberCurrentView(id) {
    if (id) { currentView = id; navigationObserved = true; }
    if (restoring) return;
    const value = snapshotCurrentView(currentView); if (!value) return;
    try {
        const json = JSON.stringify(value);
        if (json !== lastWritten) { localStorage.setItem(key,json); lastWritten = json; }
    } catch (_) {} // Browser-Speicher gesperrt/voll: Navigation bleibt funktionsfähig.
}
function restoreCurrentView() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
    if (!saved || saved.version !== 1 || typeof saved.view !== 'string') { rememberCurrentView('home'); return; }
    restoring = true;
    try {
        if (saved.view === 'ausgabenArchivView') dependencies.openAusgabenArchiv(saved.archive === 'freizeit' ? 'freizeit' : 'haushalt');
        else if (Object.hasOwn(routes,saved.view)) dependencies[routes[saved.view]]();
        else dependencies.goHome();
    } catch (_) { dependencies.goHome(); }
    finally { restoring = false; rememberCurrentView(); }
}
window.addEventListener('pagehide', () => rememberCurrentView());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') rememberCurrentView(); });
// Dieses Modul wird zuletzt geladen: alle Daten und Ansichtsrenderer sind bereit,
// der Ladebildschirm verdeckt die Wiederherstellung noch.
setTimeout(() => { if (!navigationObserved) restoreCurrentView(); },0);
return { rememberCurrentView, restoreCurrentView, snapshotCurrentView };
});
