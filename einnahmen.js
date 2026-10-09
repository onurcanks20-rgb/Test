// Kostentracker Test: js/kategorien/einnahmen.js
// Functions share the existing app state; initialize only in app/start.js.

        function addEinnahme() {
            const text = formatText(document.getElementById("einnahmenText")?.value || "");
            const betrag = parseBetrag(document.getElementById("einnahmenBetrag")?.value);
            const von = formatText(document.getElementById("einnahmenVon")?.value || "");
            const datum = document.getElementById("einnahmenDatum")?.value;
            const wiederholung = document.getElementById("einnahmenWiederholung")?.value === "monatlich" ? "monatlich" : "einmalig";

            if (!text || isNaN(betrag) || betrag <= 0 || !datum) return;
            daten.Einnahmen ??= [];
            daten.Einnahmen.push({ id: generateId(), text, betrag, von, datum, wiederholung, ...readReminderControl("add:einnahmen") });
            if (speichern() === false) return;

            document.getElementById("einnahmenText").value = "";
            document.getElementById("einnahmenBetrag").value = "";
            document.getElementById("einnahmenVon").value = "";
            document.getElementById("einnahmenDatum").value = heuteISO();
            document.getElementById("einnahmenWiederholung").value = "einmalig";
            document.getElementById("einnahmenAddPanel")?.classList.add("hidden");
            if (wiederholung === "monatlich") state.einnahmenMonatlichOffen = true;
            renderEinnahmen();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
        }

        function renderEinnahmen() {
            const container = document.getElementById("einnahmenListe");
            const total = document.getElementById("einnahmenGesamt");
            if (!container) return;
            container.innerHTML = "";
            const suche = getSearchTerm("einnahmenSuche");
            const alleEinnahmen = Array.isArray(daten.Einnahmen) ? daten.Einnahmen : [];
            document.getElementById("einnahmenDeleteAllBtn")?.classList.toggle("hidden", alleEinnahmen.length === 0);
            const sichtbar = alleEinnahmen
                .filter(e => !istEintragAusgeblendet("einnahmen", e.id))
                .filter(e => matchesSearch(suche, e.text, e.von, e.wiederholung, e.datum, e.betrag));
            const einmalig = sichtbar.filter(e => e.wiederholung !== "monatlich" && (
                istInLetztenTagen(e.datum, 7) || parseISODate(e.datum) > startOfToday() || String(state.editEinnahmeId) === String(e.id)
            )).sort((a,b) => String(b.datum).localeCompare(String(a.datum)));
            const monatlich = sichtbar.filter(e => e.wiederholung === "monatlich")
                .sort((a,b) => (parseISODate(a.datum)?.getDate() || 0) - (parseISODate(b.datum)?.getDate() || 0) || String(a.text || '').localeCompare(String(b.text || ''),'de'));
            const z = getGehaltszeitraum();
            const sum = einnahmenZahlungenImZeitraum(z.start, z.ende).reduce((a,e)=>a+e.betrag,0);
            if (total) total.innerHTML = `<div style="opacity:.7;font-size:12px;margin-bottom:4px;">Einnahmen im aktuellen Gehaltszeitraum</div><strong style="font-size:24px;">+${formatBetrag(sum)}</strong>`;

            const monthlySum = monatlich.reduce((sum,e)=>sum+(parseBetrag(e.betrag)||0),0);
            if (state.einnahmenLetzteSuche !== suche) {
                if (suche) state.einnahmenMonatlichOffen = true;
                state.einnahmenLetzteSuche = suche;
            }
            const expanded = !!state.einnahmenMonatlichOffen || monatlich.some(e=>String(state.editEinnahmeId)===String(e.id));
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.id = "einnahmenMonatlichToggle";
            toggle.setAttribute("aria-expanded",String(expanded));
            toggle.setAttribute("aria-controls","einnahmenMonatlichListe");
            toggle.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;background:var(--secondary);color:var(--text);text-align:left;margin:10px 0 14px;padding:16px;border-radius:16px;";
            toggle.innerHTML = `<span><strong style="display:block;">Monatlich wiederkehrend</strong><span style="display:block;font-size:13px;opacity:.7;margin-top:4px;">${monatlich.length} ${monatlich.length === 1 ? 'Eintrag' : 'Einträge'} · +${formatBetrag(monthlySum)} / Monat</span></span><span aria-hidden="true" style="font-size:20px;">${expanded ? '⌃' : '⌄'}</span>`;
            toggle.addEventListener("click",()=>{state.einnahmenMonatlichOffen=!expanded;renderEinnahmen();});
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
                    appendDateGroupHeader(host, e.datum, { first: letzteEinnahmenGruppe === null, note: e.wiederholung === "monatlich" ? "Startdatum" : "Datum" });
                    letzteEinnahmenGruppe = gruppenKey;
                }
                const isEdit = String(state.editEinnahmeId) === String(e.id);
                let html;
                if (isEdit) {
                    html = `<div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                        <input id="editEinnahmenText-${e.id}" value="${escapeHtml(e.text || '')}" autocapitalize="words">
                        <input id="editEinnahmenBetrag-${e.id}" type="text" inputmode="decimal" min="0" step="0.01" value="${formatInputBetrag(e.betrag)}">
                        <input id="editEinnahmenVon-${e.id}" value="${escapeHtml(e.von || '')}" placeholder="Von wem? (optional)" autocapitalize="words">
                        <input id="editEinnahmenDatum-${e.id}" type="date" value="${e.datum || ''}">
                        <select id="editEinnahmenWiederholung-${e.id}"><option value="einmalig" ${e.wiederholung !== 'monatlich' ? 'selected' : ''}>Einmalig</option><option value="monatlich" ${e.wiederholung === 'monatlich' ? 'selected' : ''}>Monatlich</option></select>
                        <div style="display:flex; gap:10px;"><button onclick="saveEditEinnahme('${e.id}')">💾 Speichern</button><button onclick="cancelEditEinnahme()">❌ Abbrechen</button></div>
                    </div>`;
                } else {
                    const info = e.wiederholung === "monatlich" ? `Monatlich am ${parseISODate(e.datum)?.getDate() || '-'} · seit ${formatDatum(e.datum)}` : `Einmalig · ${formatDatum(e.datum)}`;
                    const istOffen = !!state.offeneEinnahmen[String(e.id)];
                    html = `<div style="display:flex; flex-direction:column; width:100%; gap:10px;">
                        <div class="compact-alltag-content">
                            <div class="compact-alltag-main" onclick="toggleEinnahmeDetails('${e.id}')" style="cursor:pointer;">
                                <span class="compact-alltag-title">${escapeHtml(e.text || 'Einnahme')}</span>
                                ${e.von ? `<span class="compact-alltag-sub">${escapeHtml(e.von)}</span>` : ''}
                                ${recurring ? `<span class="compact-alltag-sub">Monatlich am ${parseISODate(e.datum)?.getDate() || '-'}.${parseISODate(e.datum) > startOfToday() ? ' · ab '+formatDatum(e.datum) : ''}</span>` : ''}
                            </div>
                            <strong class="compact-alltag-amount">+${formatBetrag(e.betrag)}</strong>
                            <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;"><button onclick="event.stopPropagation(); moveAusgabe('einnahmen','${e.id}')" title="Verschieben">↪️</button><button class="edit" onclick="event.stopPropagation(); startEditEinnahme('${e.id}')">✏️</button><button class="delete" onclick="event.stopPropagation(); deleteEinnahme('${e.id}')">🗑️</button></div>
                        </div>
                        ${istOffen ? `<div onclick="toggleEinnahmeDetails('${e.id}')" style="background:#3a3a3c;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:14px;cursor:pointer;">
                            <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Art</span><span style="font-weight:600;text-align:right;">${escapeHtml(info)}</span></div>
                            ${e.von ? `<div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Von</span><span style="font-weight:600;text-align:right;overflow-wrap:anywhere;">${escapeHtml(e.von)}</span></div>` : ''}
                        </div>` : ''}
                    </div>`;
                }
                const item = createItem(html);
                if (!isEdit) item.classList.add("compact-alltag-card");
                item.style.background = "#3a3a3c";
                host.appendChild(item);
            });

            }
        }

        function toggleEinnahmeDetails(id) {
            state.offeneEinnahmen ??= {};
            const key = String(id);
            state.offeneEinnahmen[key] = !state.offeneEinnahmen[key];
            renderEinnahmen();
        }

        function startEditEinnahme(id) { state.editEinnahmeId = id; renderEinnahmen(); }

        function cancelEditEinnahme() { state.editEinnahmeId = null; renderEinnahmen(); }

        function saveEditEinnahme(id) {
            const index = daten.Einnahmen.findIndex(e => String(e.id) === String(id));
            if (index < 0) return;
            const text = formatText(document.getElementById(`editEinnahmenText-${id}`)?.value || "");
            const betrag = parseBetrag(document.getElementById(`editEinnahmenBetrag-${id}`)?.value);
            const von = formatText(document.getElementById(`editEinnahmenVon-${id}`)?.value || "");
            const datum = document.getElementById(`editEinnahmenDatum-${id}`)?.value;
            const wiederholung = document.getElementById(`editEinnahmenWiederholung-${id}`)?.value === "monatlich" ? "monatlich" : "einmalig";
            if (!text || isNaN(betrag) || betrag <= 0 || !datum) return;
            daten.Einnahmen[index] = { ...daten.Einnahmen[index], text, betrag, von, datum, wiederholung, ...readReminderControl(`edit:einnahmen:${id}`) };
            if (speichern() === false) return;
            state.editEinnahmeId = null;
            renderEinnahmen();
        }

        function deleteEinnahme(id) {
            if (!confirm("Einnahme wirklich löschen?")) return;
            beginUndoDelete("Einnahme gelöscht");
            daten.Einnahmen = (daten.Einnahmen || []).filter(e => String(e.id) !== String(id));
            if (speichern() === false) return;
            renderEinnahmen();
            finishUndoDelete("Einnahme gelöscht");
        }

        function deleteAlleEinnahmen() {
            if (!Array.isArray(daten.Einnahmen) || !daten.Einnahmen.length) return;
            if (!confirm("Alle Einnahmen wirklich löschen?")) return;
            beginUndoDelete("Alle Einnahmen gelöscht");
            daten.Einnahmen = [];
            if (speichern() === false) return;
            renderEinnahmen();
            finishUndoDelete("Alle Einnahmen gelöscht");
        }
