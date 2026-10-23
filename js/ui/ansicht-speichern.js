Kostentracker.module({
 "id":"js/ui/ansicht-speichern.js","dependencies":["goHome"],
 "session":[],"read":[],"write":[],"replace":false
},(context,dependencies)=>{
"use strict";
// Bisheriger Dateiname bleibt kompatibel. Unterseiten werden nicht mehr gespeichert.
// Nur die Reiseansicht selbst merkt ihren Modus weiterhin im eigenen Modul.
function visible(node){return !!node&&(node.getClientRects?node.getClientRects().length>0:!node.classList?.contains('hidden'));}
function hasOpenEntry(){
 const focused=document.activeElement;
 if(focused&&visible(focused)&&(/^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)||focused.isContentEditable))return true;
 if(document.getElementById('paymentReviewDialog')?.open)return true;
 return [...document.querySelectorAll('dialog[open],.sheet-backdrop:not(.hidden),.category-add-panel:not(.hidden),.item input:not([type="hidden"]),.item textarea,.item select')].some(visible);
}
function restoreStartView(){
 if(document.visibilityState==='hidden'||hasOpenEntry())return;
 dependencies.goHome();
}
// Ein Hintergrundwechsel und eine Wiederherstellung derselben Seite behalten
// Navigation und Eingaben. Nur die Initialisierung eines neuen Dokuments
// setzt die Ansicht auf Start; keine Sichtbarkeits-/pageshow-Navigation.
// Nach der Registrierung aller Module, noch unter dem Ladebildschirm.
setTimeout(restoreStartView,0);
return {hasOpenEntry,restoreStartView};
});
