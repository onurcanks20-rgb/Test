// Kostentracker Test: js/ui/ausgabenarchiv.js
// Functions share the existing app state; initialize only in app/start.js.

        function toggleArchivDetails(typ, id) {
            const map = typ === 'freizeit' ? state.offeneFreizeitEintraege : state.offeneHaushaltEintraege;
            const key = String(id);
            map[key] = !map[key];
            renderAusgabenArchiv();
        }

        function startEditAusgabenArchiv(typ, id) {
            if (state.ausgabenArchivTyp !== typ) return;
            state.editAusgabenArchivId = String(id);
            renderAusgabenArchiv();
            setTimeout(() => document.getElementById(`editArchivBetrag-${id}`)?.focus(), 0);
        }

        function cancelEditAusgabenArchiv() {
            state.editAusgabenArchivId = null;
            renderAusgabenArchiv();
        }

        function saveEditAusgabenArchiv(typ, id) {
            const textEl = document.getElementById(`editArchivText-${id}`);
            const betragEl = document.getElementById(`editArchivBetrag-${id}`);
            const datumEl = document.getElementById(`editArchivDatum-${id}`);
            if (!textEl || !betragEl || !datumEl) return;

            const betrag = parseBetrag(betragEl.value);
            const datum = datumEl.value;
            if (isNaN(betrag) || !datum) return;

            const bereich = typ === 'freizeit' ? daten.Freizeit : daten.Haushalt;
            if (!bereich) return;

            let found = null;
            let oldKey = null;
            let oldIndex = -1;
            for (const key of Object.keys(bereich)) {
                const liste = bereich[key];
                if (!Array.isArray(liste)) continue;
                const index = liste.findIndex(e => String(e.id) === String(id));
                if (index !== -1) {
                    found = liste[index];
                    oldKey = key;
                    oldIndex = index;
                    break;
                }
            }
            if (!found) return;

            const parsed = parseISODate(datum);
            const neuerMonat = (parsed ? parsed.getMonth() : new Date().getMonth()) + 1;
            const updated = {
                ...found,
                text: formatText(textEl.value.trim()),
                betrag,
                datum
            };

            bereich[oldKey].splice(oldIndex, 1);
            bereich[neuerMonat] ??= [];
            bereich[neuerMonat].push(updated);

            if (speichern() === false) return;
            state.editAusgabenArchivId = null;
            renderAusgabenArchiv();
        }

        function deleteArchivEintrag(typ, id) {
            if (typ === 'freizeit') deleteFreizeit(id);
            else deleteHaushalt(id);
            if (!document.getElementById('ausgabenArchivView')?.classList.contains('hidden')) {
                renderAusgabenArchiv();
            }
        }

        function renderAusgabenArchiv() {
            const typ = state.ausgabenArchivTyp === "freizeit" ? "freizeit" : "haushalt";
            const istFreizeit = typ === "freizeit";
            const titel = document.getElementById("ausgabenArchivTitel");
            const container = document.getElementById("ausgabenArchivListe");
            if (!container) return;
            if (titel) titel.textContent = istFreizeit ? "Freizeit · Alle Einträge" : "Haushalt · Alle Einträge";
            container.innerHTML = "";

            const suche = getSearchTerm("ausgabenArchivSuche");
            const data = istFreizeit ? gruppiereFreizeit() : gruppiereHaushalt();
            Object.keys(data).forEach(j => Object.keys(data[j]).forEach(m => {
                data[j][m] = data[j][m]
                    // In „Alle Einträge“ bleiben auch ausgeblendete Buchungen sichtbar,
                    // damit sie hier direkt erkannt und wieder eingeblendet werden können.
                    .filter(e => matchesSearch(suche, e.text, e.name, e.kategorie, e.datum, e.betrag))
                    .sort((a,b) => datumZeitwert(b.datum) - datumZeitwert(a.datum));
                if (!data[j][m].length) delete data[j][m];
            }));
            Object.keys(data).forEach(j => { if (!Object.keys(data[j]).length) delete data[j]; });
            const jahre = Object.keys(data).sort((a,b) => b-a);

            if (!jahre.length) {
                container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Noch keine Einträge</div><div class="empty-state-text">Hier ist aktuell noch nichts gespeichert.</div></div>`;
                return;
            }

            const jahresState = istFreizeit ? state.offeneFreizeitJahre : state.offeneHaushaltJahre;
            const monatsState = istFreizeit ? state.offeneFreizeitMonate : state.offeneHaushaltMonate;
            const offenMap = istFreizeit ? state.offeneFreizeitEintraege : state.offeneHaushaltEintraege;

            jahre.forEach(jahr => {
                const jahrOffen = !!jahresState[jahr];
                const jahrSumme = Object.values(data[jahr]).flat().reduce((a,b) => a + (parseBetrag(b.betrag)||0), 0);
                const jahrItem = createItem(`<div style="display:flex; justify-content:space-between; width:100%; align-items:center; cursor:pointer;">
                    <div><span class="toggle-btn">${jahrOffen ? '▲' : '▼'}</span> 📁 ${jahr}</div><strong>${formatBetrag(jahrSumme)}</strong>
                </div>`);
                jahrItem.onclick = () => { jahresState[jahr] = !jahrOffen; renderAusgabenArchiv(); };
                container.appendChild(jahrItem);
                if (!jahrOffen) return;

                Object.keys(data[jahr]).sort((a,b)=>b-a).forEach(monat => {
                    const key = jahr + "-" + monat;
                    const monatOffen = !!monatsState[key];
                    const liste = data[jahr][monat];
                    const summe = liste.reduce((a,b)=>a+(parseBetrag(b.betrag)||0),0);
                    const monatItem = createItem(`<div style="display:flex; justify-content:space-between; width:100%; align-items:center; cursor:pointer;">
                        <div><span class="toggle-btn">${monatOffen ? '▲' : '▼'}</span> 📂 ${getMonatName(parseInt(monat))}</div><strong>${formatBetrag(summe)}</strong>
                    </div>`,20);
                    monatItem.onclick = () => { monatsState[key] = !monatOffen; renderAusgabenArchiv(); };
                    container.appendChild(monatItem);
                    if (!monatOffen) return;

                    liste.forEach(e => {
                        const isEdit = String(state.editAusgabenArchivId) === String(e.id);
                        let item;

                        if (isEdit) {
                            item = createItem(`<div style="display:flex; flex-direction:column; width:100%; gap:6px;">
                                <input id="editArchivBetrag-${e.id}" type="text" inputmode="decimal" value="${formatInputBetrag(e.betrag)}" placeholder="Betrag" enterkeyhint="next">
                                <input id="editArchivText-${e.id}" value="${escapeHtml(e.text || e.name || '')}" autocapitalize="words" placeholder="Genauere Beschreibung (optional)" enterkeyhint="next">
                                <input id="editArchivDatum-${e.id}" type="date" value="${e.datum || ''}">
                                <div style="display:flex; gap:10px;">
                                    <button onclick="event.stopPropagation(); saveEditAusgabenArchiv('${typ}','${e.id}')">💾 Speichern</button>
                                    <button onclick="event.stopPropagation(); cancelEditAusgabenArchiv()">❌ Abbrechen</button>
                                </div>
                            </div>`,40);
                        } else {
                            const zusatz = alltagZusatztext(e);
                            const istAusgeblendet = istEintragAusgeblendet(typ, e.id);
                            item = createItem(`<div class="compact-alltag-content">
                                <div class="compact-alltag-main">
                                    <span class="compact-alltag-title">${escapeHtml(e.kategorie || 'Sonstiges')}</span>
                                    ${istAusgeblendet ? `<span class="compact-alltag-sub" style="opacity:.9;">👁️‍🗨️ Ausgeblendet</span>` : ''}
                                    ${zusatz ? `<span class="compact-alltag-sub">${escapeHtml(zusatz)}</span>` : ''}
                                    ${e.datum ? `<span class="compact-alltag-sub">${formatDatum(e.datum)}</span>` : ''}
                                </div>
                                <strong class="compact-alltag-amount">${formatBetrag(e.betrag)}</strong>
                                <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                                    ${istAusgeblendet ? `<button onclick="event.stopPropagation(); eintragEinblenden('${typ}','${e.id}')" title="Wieder einblenden">👁️</button>` : ''}
                                    <button onclick="event.stopPropagation(); moveAusgabe('${typ}','${e.id}')" title="Verschieben">↪️</button>
                                    <button class="edit" onclick="event.stopPropagation(); startEditAusgabenArchiv('${typ}','${e.id}')">✏️</button>
                                    <button class="delete" onclick="event.stopPropagation(); deleteArchivEintrag('${typ}','${e.id}')">🗑️</button>
                                </div>
                            </div>`,40);
                            item.classList.add("compact-alltag-card");
                        }

                        item.style.background = "#3a3a3c";
                        container.appendChild(item);
                    });
                });
            });
        }
