Kostentracker.module({
  "id": "js/kategorien/einnahmen.js",
  "dependencies": [
    "appendDateGroupHeader",
    "beginUndoDelete",
    "closeStartQuickAdd",
    "createItem",
    "escapeHtml",
    "finishUndoDelete",
    "formatBetrag",
    "formatDatum",
    "formatInputBetrag",
    "formatText",
    "generateId",
    "getGehaltszeitraum",
    "getSearchTerm",
    "heuteISO",
    "isoAusDate",
    "istEintragAusgeblendet",
    "istInLetztenTagen",
    "matchesSearch",
    "parseBetrag",
    "parseISODate",
    "readReminderControl",
    "renderHomeUebersicht",
    "speichern",
    "startOfToday"
  ],
  "session": [
    "state"
  ],
  "read": [
    "Einnahmen"
  ],
  "write": [
    "Einnahmen"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/kategorien/einnahmen.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function addEinnahme() {
            const text = dependencies.formatText(document.getElementById("einnahmenText")?.value || "");
            const betrag = dependencies.parseBetrag(document.getElementById("einnahmenBetrag")?.value);
            const von = dependencies.formatText(document.getElementById("einnahmenVon")?.value || "");
            const datum = document.getElementById("einnahmenDatum")?.value;
            const wiederholung = document.getElementById("einnahmenWiederholung")?.value === "monatlich" ? "monatlich" : "einmalig";

            if (!text || isNaN(betrag) || betrag <= 0 || !datum) return;
            context.repository.view.Einnahmen ??= [];
            context.repository.view.Einnahmen.push({ id: dependencies.generateId(), text, betrag, von, datum, wiederholung, ...dependencies.readReminderControl("add:einnahmen") });
            if (dependencies.speichern() === false) return;

            document.getElementById("einnahmenText").value = "";
            document.getElementById("einnahmenBetrag").value = "";
            document.getElementById("einnahmenVon").value = "";
            document.getElementById("einnahmenDatum").value = dependencies.heuteISO();
            document.getElementById("einnahmenWiederholung").value = "einmalig";
            document.getElementById("einnahmenAddPanel")?.classList.add("hidden");
            if (wiederholung === "monatlich") context.session.state.einnahmenMonatlichOffen = true;
            renderEinnahmen();
            dependencies.renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) dependencies.closeStartQuickAdd();
        }

        function renderEinnahmen() {
            const container = document.getElementById("einnahmenListe");
            const total = document.getElementById("einnahmenGesamt");
            if (!container) return;
            container.innerHTML = "";
            const suche = dependencies.getSearchTerm("einnahmenSuche");
            const alleEinnahmen = Array.isArray(context.repository.view.Einnahmen) ? context.repository.view.Einnahmen : [];
            document.getElementById("einnahmenDeleteAllBtn")?.classList.toggle("hidden", alleEinnahmen.length === 0);
            const sichtbar = alleEinnahmen
                .filter(e => !dependencies.istEintragAusgeblendet("einnahmen", e.id))
                .filter(e => dependencies.matchesSearch(suche, e.text, e.von, e.wiederholung, e.datum, e.betrag));
            const einmalig = sichtbar.filter(e => e.wiederholung !== "monatlich" && (
                dependencies.istInLetztenTagen(e.datum, 7) || dependencies.parseISODate(e.datum) > dependencies.startOfToday() || String(context.session.state.editEinnahmeId) === String(e.id)
            )).sort((a,b) => String(b.datum).localeCompare(String(a.datum)));
            const monatlich = sichtbar.filter(e => e.wiederholung === "monatlich")
                .sort((a,b) => (dependencies.parseISODate(a.datum)?.getDate() || 0) - (dependencies.parseISODate(b.datum)?.getDate() || 0) || String(a.text || '').localeCompare(String(b.text || ''),'de'));
            const z = dependencies.getGehaltszeitraum();
            const sum = einnahmenZahlungenImZeitraum(z.start, z.ende).reduce((a,e)=>a+e.betrag,0);
            if (total) total.innerHTML = `<div style="opacity:.7;font-size:12px;margin-bottom:4px;">Einnahmen im aktuellen Gehaltszeitraum</div><strong style="font-size:24px;">+${dependencies.formatBetrag(sum)}</strong>`;

            const monthlySum = monatlich.reduce((sum,e)=>sum+(dependencies.parseBetrag(e.betrag)||0),0);
            if (context.session.state.einnahmenLetzteSuche !== suche) {
                if (suche) context.session.state.einnahmenMonatlichOffen = true;
                context.session.state.einnahmenLetzteSuche = suche;
            }
            const expanded = !!context.session.state.einnahmenMonatlichOffen || monatlich.some(e=>String(context.session.state.editEinnahmeId)===String(e.id));
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.id = "einnahmenMonatlichToggle";
            toggle.setAttribute("aria-expanded",String(expanded));
            toggle.setAttribute("aria-controls","einnahmenMonatlichListe");
            toggle.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;background:var(--secondary);color:var(--text);text-align:left;margin:10px 0 14px;padding:16px;border-radius:16px;";
            toggle.innerHTML = `<span><strong style="display:block;">Monatlich wiederkehrend</strong><span style="display:block;font-size:13px;opacity:.7;margin-top:4px;">${monatlich.length} ${monatlich.length === 1 ? 'Eintrag' : 'Einträge'} · +${dependencies.formatBetrag(monthlySum)} / Monat</span></span><span aria-hidden="true" style="font-size:20px;">${expanded ? '⌃' : '⌄'}</span>`;
            toggle.addEventListener("click",()=>{context.session.state.einnahmenMonatlichOffen=!expanded;renderEinnahmen();});
            container.appendChild(toggle);
            const monthlyList = document.createElement("div");
            monthlyList.id = "einnahmenMonatlichListe";
            if (!expanded) monthlyList.classList.add("hidden");
            container.appendChild(monthlyList);
            if (expanded) {
                if (monatlich.length) renderRows(monthlyList,monatlich,true);
                else monthlyList.innerHTML = `<div class="info-text">${suche ? 'Keine passenden monatlichen Einnahmen.' : 'Noch keine monatlich wiederkehrenden Einnahmen hinterlegt.'}</div>`;
            }

            const label = document.createElement("div");
            label.className = "section-label";
            label.textContent = "Einmalige Einnahmen";
            container.appendChild(label);
            const note = document.createElement("div");
            note.className = "info-text";
            note.textContent = "Letzte 7 Tage und kommende Zahlungen. Ältere Einträge bleiben unter Einstellungen → Archiv erhalten.";
            container.appendChild(note);
            if (!einmalig.length) {
                const empty = document.createElement("div");
                empty.className = "empty-state";
                empty.innerHTML = `<div class="empty-state-icon">💰</div><div class="empty-state-title">${suche ? 'Keine passenden einmaligen Einnahmen' : 'Keine aktuellen einmaligen Einnahmen'}</div><div class="empty-state-text">Neue Einnahmen erscheinen hier.</div>`;
                container.appendChild(empty);
            }
            renderRows(container,einmalig,false);

            function renderRows(host,liste,recurring) {
            let letzteEinnahmenGruppe = null;
            liste.forEach(e => {
                const gruppenKey = e.datum || "ohne-datum";
                if (!recurring && gruppenKey !== letzteEinnahmenGruppe) {
                    dependencies.appendDateGroupHeader(host, e.datum, { first: letzteEinnahmenGruppe === null, note: e.wiederholung === "monatlich" ? "Startdatum" : "Datum" });
                    letzteEinnahmenGruppe = gruppenKey;
                }
                const isEdit = String(context.session.state.editEinnahmeId) === String(e.id);
                let html;
                if (isEdit) {
                    html = `<div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                        <input id="editEinnahmenText-${e.id}" value="${dependencies.escapeHtml(e.text || '')}" autocapitalize="words">
                        <input id="editEinnahmenBetrag-${e.id}" type="text" inputmode="decimal" min="0" step="0.01" value="${dependencies.formatInputBetrag(e.betrag)}">
                        <input id="editEinnahmenVon-${e.id}" value="${dependencies.escapeHtml(e.von || '')}" placeholder="Von wem? (optional)" autocapitalize="words">
                        <input id="editEinnahmenDatum-${e.id}" type="date" value="${e.datum || ''}">
                        <select id="editEinnahmenWiederholung-${e.id}"><option value="einmalig" ${e.wiederholung !== 'monatlich' ? 'selected' : ''}>Einmalig</option><option value="monatlich" ${e.wiederholung === 'monatlich' ? 'selected' : ''}>Monatlich</option></select>
                        <div style="display:flex; gap:10px;"><button onclick="saveEditEinnahme('${e.id}')">💾 Speichern</button><button onclick="cancelEditEinnahme()">❌ Abbrechen</button></div>
                    </div>`;
                } else {
                    const info = e.wiederholung === "monatlich" ? `Monatlich am ${dependencies.parseISODate(e.datum)?.getDate() || '-'} · seit ${dependencies.formatDatum(e.datum)}` : `Einmalig · ${dependencies.formatDatum(e.datum)}`;
                    const istOffen = !!context.session.state.offeneEinnahmen[String(e.id)];
                    html = `<div style="display:flex; flex-direction:column; width:100%; gap:10px;">
                        <div class="compact-alltag-content">
                            <div class="compact-alltag-main" onclick="toggleEinnahmeDetails('${e.id}')" style="cursor:pointer;">
                                <span class="compact-alltag-title">${dependencies.escapeHtml(e.text || 'Einnahme')}</span>
                                ${e.von ? `<span class="compact-alltag-sub">${dependencies.escapeHtml(e.von)}</span>` : ''}
                                ${recurring ? `<span class="compact-alltag-sub">Monatlich am ${dependencies.parseISODate(e.datum)?.getDate() || '-'}.${dependencies.parseISODate(e.datum) > dependencies.startOfToday() ? ' · ab '+dependencies.formatDatum(e.datum) : ''}</span>` : ''}
                            </div>
                            <strong class="compact-alltag-amount">+${dependencies.formatBetrag(e.betrag)}</strong>
                            <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;"><button onclick="event.stopPropagation(); moveAusgabe('einnahmen','${e.id}')" title="Verschieben">↪️</button><button class="edit" onclick="event.stopPropagation(); startEditEinnahme('${e.id}')">✏️</button><button class="delete" onclick="event.stopPropagation(); deleteEinnahme('${e.id}')">🗑️</button></div>
                        </div>
                        ${istOffen ? `<div onclick="toggleEinnahmeDetails('${e.id}')" style="background:#3a3a3c;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:14px;cursor:pointer;">
                            <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Art</span><span style="font-weight:600;text-align:right;">${dependencies.escapeHtml(info)}</span></div>
                            ${e.von ? `<div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Von</span><span style="font-weight:600;text-align:right;overflow-wrap:anywhere;">${dependencies.escapeHtml(e.von)}</span></div>` : ''}
                        </div>` : ''}
                    </div>`;
                }
                const item = dependencies.createItem(html);
                if (!isEdit) item.classList.add("compact-alltag-card");
                item.style.background = "#3a3a3c";
                host.appendChild(item);
            });

            }
        }

        function toggleEinnahmeDetails(id) {
            context.session.state.offeneEinnahmen ??= {};
            const key = String(id);
            context.session.state.offeneEinnahmen[key] = !context.session.state.offeneEinnahmen[key];
            renderEinnahmen();
        }

        function startEditEinnahme(id) { context.session.state.editEinnahmeId = id; renderEinnahmen(); }

        function cancelEditEinnahme() { context.session.state.editEinnahmeId = null; renderEinnahmen(); }

        function saveEditEinnahme(id) {
            const index = context.repository.view.Einnahmen.findIndex(e => String(e.id) === String(id));
            if (index < 0) return;
            const text = dependencies.formatText(document.getElementById(`editEinnahmenText-${id}`)?.value || "");
            const betrag = dependencies.parseBetrag(document.getElementById(`editEinnahmenBetrag-${id}`)?.value);
            const von = dependencies.formatText(document.getElementById(`editEinnahmenVon-${id}`)?.value || "");
            const datum = document.getElementById(`editEinnahmenDatum-${id}`)?.value;
            const wiederholung = document.getElementById(`editEinnahmenWiederholung-${id}`)?.value === "monatlich" ? "monatlich" : "einmalig";
            if (!text || isNaN(betrag) || betrag <= 0 || !datum) return;
            context.repository.view.Einnahmen[index] = { ...context.repository.view.Einnahmen[index], text, betrag, von, datum, wiederholung, ...dependencies.readReminderControl(`edit:einnahmen:${id}`) };
            if (dependencies.speichern() === false) return;
            context.session.state.editEinnahmeId = null;
            renderEinnahmen();
        }

        function deleteEinnahme(id) {
            if (!confirm("Einnahme wirklich löschen?")) return;
            dependencies.beginUndoDelete("Einnahme gelöscht");
            context.repository.view.Einnahmen = (context.repository.view.Einnahmen || []).filter(e => String(e.id) !== String(id));
            if (dependencies.speichern() === false) return;
            renderEinnahmen();
            dependencies.finishUndoDelete("Einnahme gelöscht");
        }

        function deleteAlleEinnahmen() {
            if (!Array.isArray(context.repository.view.Einnahmen) || !context.repository.view.Einnahmen.length) return;
            if (!confirm("Alle Einnahmen wirklich löschen?")) return;
            dependencies.beginUndoDelete("Alle Einnahmen gelöscht");
            context.repository.view.Einnahmen = [];
            if (dependencies.speichern() === false) return;
            renderEinnahmen();
            dependencies.finishUndoDelete("Alle Einnahmen gelöscht");
        }

function einnahmenZahlungenImZeitraum(von, bis) {
            const result = [];
            if (!Array.isArray(context.repository.view.Einnahmen)) return result;

            context.repository.view.Einnahmen.forEach(e => {
                const betrag = dependencies.parseBetrag(e.betrag);
                const start = dependencies.parseISODate(e.datum);
                if (!start || isNaN(betrag) || betrag <= 0) return;

                if (e.wiederholung !== "monatlich") {
                    if (start >= von && start <= bis) result.push({ ...e, betrag, datumObj: start });
                    return;
                }

                let jahr = von.getFullYear();
                let monat = von.getMonth();
                const startTag = start.getDate();
                let kandidat = new Date(jahr, monat, Math.min(startTag, new Date(jahr, monat + 1, 0).getDate()));
                if (kandidat < start) {
                    monat += 1;
                    if (monat > 11) { monat = 0; jahr += 1; }
                }

                while (true) {
                    const letzterTag = new Date(jahr, monat + 1, 0).getDate();
                    const zahlung = new Date(jahr, monat, Math.min(startTag, letzterTag));
                    if (zahlung > bis) break;
                    if (zahlung >= von && zahlung >= start) {
                        result.push({ ...e, betrag, datumObj: zahlung, datumVorkommen: dependencies.isoAusDate(zahlung) });
                    }
                    monat += 1;
                    if (monat > 11) { monat = 0; jahr += 1; }
                }
            });

            return result;
        }

return { addEinnahme, renderEinnahmen, toggleEinnahmeDetails, startEditEinnahme, cancelEditEinnahme, saveEditEinnahme, deleteEinnahme, deleteAlleEinnahmen, einnahmenZahlungenImZeitraum };
});
