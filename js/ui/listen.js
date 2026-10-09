Kostentracker.module({
  "id": "js/ui/listen.js",
  "dependencies": [
    "renderFreizeit",
    "renderHaushalt",
    "renderLaufendeKosten",
    "renderVersicherungen"
  ],
  "session": [
    "aktuelleSimple"
  ],
  "read": [],
  "write": [],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/ui/listen.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function renderSimple() {

            if (!context.session.aktuelleSimple) return;

            console.log("AKTUELLE KATEGORIE:", context.session.aktuelleSimple);

            if (context.session.aktuelleSimple === "Versicherungen") {
                dependencies.renderVersicherungen();
            }
            else if (context.session.aktuelleSimple === "Laufende Kosten") {
                dependencies.renderLaufendeKosten();
            }
            else if (context.session.aktuelleSimple === "Haushalt") {
                dependencies.renderHaushalt();
            }
            else if (context.session.aktuelleSimple === "Freizeit") {
                dependencies.renderFreizeit();
            }
        }

        

        

return { renderSimple };
});
