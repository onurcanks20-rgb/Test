// Kostentracker Test: js/kategorien/fixkosten.js
// Functions share the existing app state; initialize only in app/start.js.

        function renderLaufendeKosten() {

            const div = document.getElementById("kostenListe");
            const total = document.getElementById("kostenGesamt");
            if (!div) return;

            div.innerHTML = "";

            daten["Laufende Kosten"] ??= { fix: [] };
            daten["Laufende Kosten"].fix ??= [];
            document.getElementById("fixkostenDeleteAllBtn")?.classList.toggle("hidden", daten["Laufende Kosten"].fix.length === 0);

            if (daten["Laufende Kosten"].fix.length === 0) {
                div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📌</div><div class="empty-state-title">Noch keine Fixkosten</div><div class="empty-state-text">Regelmäßige monatliche Kosten erscheinen hier, sobald du sie anlegst.</div></div>`;
            }

            let summe = 0;

            const suche = getSearchTerm("fixkostenSuche");
            const gehaltszeitraum = getGehaltszeitraum();

            // Fixkosten werden in der Reihenfolge ihres Abbuchungstermins innerhalb
            // des aktuellen Gehaltszeitraums sortiert. Beispiel bei Gehalt am 28.:
            // 28. -> 01. -> 04. -> 14. -> 27.
            const terminImGehaltszeitraum = (k) => {
                const basisDatum = k.datum || datumAusTagAktuellerMonat(k.tag);
                const tag = tagAusDatum(basisDatum);
                const startDatum = parseISODate(basisDatum);

                let termin = datumMitSicheremTag(
                    gehaltszeitraum.start.getFullYear(),
                    gehaltszeitraum.start.getMonth(),
                    tag
                );

                if (termin < gehaltszeitraum.start) {
                    termin = datumMitSicheremTag(termin.getFullYear(), termin.getMonth() + 1, tag);
                }

                // Bei neuen Fixkosten darf die Sortierung keinen Termin vor der
                // ersten tatsächlichen Abbuchung vortäuschen.
                if (startDatum && termin < startDatum) {
                    termin = new Date(startDatum);
                }

                return termin;
            };

            summe = [...daten["Laufende Kosten"].fix]
                .filter(k => matchesSearch(suche, k.text, k.name, k.info, k.haendler, k.datum, k.tag, k.betrag))
                .reduce((acc, k) => acc + (parseBetrag(k.betrag) || 0), 0);

            const sortierteFixkosten = [...daten["Laufende Kosten"].fix]
                .filter(k => !istEintragAusgeblendet("fixkosten", k.id))
                .filter(k => matchesSearch(suche, k.text, k.name, k.info, k.haendler, k.datum, k.tag, k.betrag))
                .sort((a, b) => {
                    const terminA = terminImGehaltszeitraum(a);
                    const terminB = terminImGehaltszeitraum(b);
                    const diff = terminA - terminB;
                    if (diff !== 0) return diff;
                    return String(a.datum || '').localeCompare(String(b.datum || ''));
                });

            if (!sortierteFixkosten.length && daten["Laufende Kosten"].fix.length > 0 && !suche) {
                div.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👁️‍🗨️</div><div class="empty-state-title">Alle Fixkosten sind ausgeblendet</div><div class="empty-state-text">Unter Einstellungen → Gesten → Ausgeblendete verwalten kannst du sie wieder einblenden.</div></div>`;
            }

            let letzteFixkostenGruppe = null;
            sortierteFixkosten.forEach(k => {

                const datum = k.datum || datumAusTagAktuellerMonat(k.tag);
                const gruppenTermin = terminImGehaltszeitraum(k);
                const gruppenKey = gruppenTermin ? gruppenTermin.toISOString().slice(0,10) : datum;
                if (gruppenKey !== letzteFixkostenGruppe) {
                    appendDateGroupHeader(div, gruppenTermin || datum, { first: letzteFixkostenGruppe === null, note: "Abbuchung" });
                    letzteFixkostenGruppe = gruppenKey;
                }
                const tag = tagAusDatum(datum);

                // Für alte gespeicherte Einträge: Tag und Datum im Speicherobjekt ergänzen.
                k.datum = datum;
                k.tag = tag;
                k.info = k.info || "";

                const isEdit = String(state.editKostenId) === String(k.id);
                let item;

                if (isEdit) {
                    item = createItem(`
                    <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                        <input id="editKostenText-${k.id}" value="${escapeHtml(k.text || k.name || "")}" placeholder="Beschreibung" autocapitalize="words">
                        <input id="editKostenBetrag-${k.id}" type="text" inputmode="decimal" value="${formatInputBetrag(k.betrag)}" placeholder="Betrag">
                        <input id="editKostenInfo-${k.id}" value="${escapeHtml(k.info || "")}" placeholder="Info (z. B. Kundennummer, Vertragsnummer)" autocapitalize="words">
                        <label for="editKostenHaendler-${k.id}" style="opacity:0.7; font-size:13px; margin-top:4px;">Anbieter (optional)</label>
                        <input id="editKostenHaendler-${k.id}" value="${escapeHtml(k.haendler || "")}" placeholder="z. B. Telekom oder Netflix" autocapitalize="off">
                        <div class="info-text">Mehrere Namen mit einem Semikolon trennen.</div>
                        <label for="editKostenZuordnungTage-${k.id}" style="opacity:0.7; font-size:13px; margin-top:4px;">Zeitfenster zur Fälligkeit (± Tage)</label>
                        <input id="editKostenZuordnungTage-${k.id}" type="number" inputmode="numeric" min="0" max="31" step="1" value="${normalizeFixkostenZuordnungTage(k.zuordnungTage)}">
                        <div class="info-text">Vorbereitung für die Push-Erfassung: Tage vor oder nach der Fälligkeit.</div>
                        <label for="editKostenDatum-${k.id}" style="opacity:0.7; font-size:13px; margin-top:4px;">Erste Abbuchung · danach monatlich</label>
                        <input id="editKostenDatum-${k.id}" type="date" value="${datum}">

                        <div style="display:flex; gap:10px; margin-top:6px;">
                            <button onclick="saveEditKosten('${k.id}')">💾 Speichern</button>
                            <button onclick="cancelEditKosten()" style="background:#607d8b;">❌ Abbrechen</button>
                        </div>
                    </div>
                `);

                    setTimeout(() => setupKostenEditEnterFlow(k.id), 0);
                } else {

                    const istOffen = !!state.offeneFixkosten[String(k.id)];
                    item = createItem(`
                    <div style="display:flex; flex-direction:column; width:100%; gap:10px;">
                        <div class="compact-alltag-content">
                            <div class="compact-alltag-main" onclick="toggleFixkostenDetails('${k.id}')" style="cursor:pointer;">
                                <span class="compact-alltag-title">${escapeHtml(k.text || k.name || "-")}</span>
                                ${k.haendler ? `<span class="compact-alltag-sub">${escapeHtml(k.haendler)}</span>` : ''}
                                <span class="compact-alltag-sub">Monatlich am ${String(tag).padStart(2, "0")}.</span>
                            </div>
                            <strong class="compact-alltag-amount">${formatBetrag(k.betrag)}</strong>
                            <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                                <button onclick="event.stopPropagation(); moveAusgabe('fixkosten','${k.id}')" title="Verschieben">↪️</button>
                                <button class="edit" onclick="event.stopPropagation(); startEditKosten('${k.id}')">✏️</button>
                                <button class="delete" onclick="event.stopPropagation(); deleteLaufendeKosten('${k.id}')">🗑️</button>
                            </div>
                        </div>
                        ${istOffen ? `
                            <div onclick="toggleFixkostenDetails('${k.id}')" style="background:#3a3a3c;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:14px;cursor:pointer;">
                                <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Wiederholung</span><span style="font-weight:600;text-align:right;">Monatlich am ${tag}.</span></div>
                                <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Startdatum</span><span style="font-weight:600;text-align:right;">${formatDatum(datum)}</span></div>
                                ${k.info ? `<div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Info</span><span style="font-weight:600;text-align:right;overflow-wrap:anywhere;">${escapeHtml(k.info)}</span></div>` : ''}
                                ${k.haendler ? `<div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Anbieter</span><span style="font-weight:600;text-align:right;overflow-wrap:anywhere;">${escapeHtml(k.haendler)}</span></div>
                                <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Zeitfenster zur Fälligkeit</span><span style="font-weight:600;text-align:right;">±${normalizeFixkostenZuordnungTage(k.zuordnungTage)} Tage</span></div>` : ''}
                            </div>
                        ` : ''}
                    </div>
                `);
                }

                if (!isEdit) item.classList.add("compact-alltag-card");
                div.appendChild(item);
            });

            if (total) {
                total.innerHTML = "Gesamt: " + formatBetrag(summe);
            }
        }

        function toggleFixkostenDetails(id) {
            state.offeneFixkosten ??= {};
            const key = String(id);
            state.offeneFixkosten[key] = !state.offeneFixkosten[key];
            renderLaufendeKosten();
        }

        function normalizeFixkostenZuordnungTage(value) {
            if (value === undefined || value === null || String(value).trim() === "") return 5;
            const days = Number(value);
            return Number.isFinite(days) ? Math.min(31, Math.max(0, Math.floor(days))) : 5;
        }

        function addKosten() {

            let text = formatText(document.getElementById("costText").value);
            let betrag = parseBetrag(document.getElementById("costBetrag").value);
            let info = document.getElementById("costInfo")?.value.trim() || "";
            let datum = document.getElementById("costDatum").value;
            const haendler = (document.getElementById("costHaendler")?.value || "").trim();
            const zuordnungTage = normalizeFixkostenZuordnungTage(document.getElementById("costZuordnungTage")?.value);

            if (!text || isNaN(betrag)) return;
            if (!datum) datum = heuteISO();

            const tag = tagAusDatum(datum);

            // 🛡️ Struktur absichern
            if (!daten["Laufende Kosten"]) {
                daten["Laufende Kosten"] = { fix: [] };
            }
            if (!Array.isArray(daten["Laufende Kosten"].fix)) {
                daten["Laufende Kosten"].fix = [];
            }

            if (addItem(daten["Laufende Kosten"].fix, {
                id: generateId(),
                text,
                betrag,
                info,
                haendler,
                zuordnungTage,
                datum,
                tag,
                ...readReminderControl("add:fixkosten")
            }) === false) return;


            // reset
            document.getElementById("costText").value = "";
            document.getElementById("costBetrag").value = "";
            document.getElementById("costInfo").value = "";
            const haendlerInput = document.getElementById("costHaendler");
            if (haendlerInput) haendlerInput.value = "";
            const tageInput = document.getElementById("costZuordnungTage");
            if (tageInput) tageInput.value = "5";
            document.getElementById("costDatum").value = heuteISO();
            document.getElementById("kostenAddPanel")?.classList.add("hidden");

            renderLaufendeKosten();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
        }

        function deleteLaufendeKosten(id) {

            if (!confirm("Wirklich löschen?")) return;
            beginUndoDelete("Fixkosten-Eintrag gelöscht");

            if (!daten["Laufende Kosten"] || !Array.isArray(daten["Laufende Kosten"].fix)) return;

            let liste = daten["Laufende Kosten"].fix;
            let index = liste.findIndex(e => String(e.id) === String(id));

            if (index !== -1) {
                liste.splice(index, 1);
            }

            if (speichern() === false) return;
            renderLaufendeKosten();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
            finishUndoDelete("Fixkosten-Eintrag gelöscht");
        }

        function startEditKosten(id) {
            state.editKostenId = id;
            renderLaufendeKosten();
        }

        function cancelEditKosten() {
            state.editKostenId = null;
            renderLaufendeKosten();
        }

        function saveEditKosten(id) {

            let item = daten["Laufende Kosten"].fix.find(e => String(e.id) === String(id));
            if (!item) return;

            const textEl = document.getElementById("editKostenText-" + id);
            const betragEl = document.getElementById("editKostenBetrag-" + id);
            const infoEl = document.getElementById("editKostenInfo-" + id);
            const datumEl = document.getElementById("editKostenDatum-" + id);

            if (!textEl || !betragEl || !datumEl) return;

            let text = textEl.value;
            let betrag = parseBetrag(betragEl.value);
            let info = infoEl?.value.trim() || "";
            let datum = datumEl.value || heuteISO();

            if (!text || isNaN(betrag)) return;

            item.text = formatText(text);
            item.betrag = betrag;
            item.info = info;
            const haendlerEl = document.getElementById("editKostenHaendler-" + id);
            const tageEl = document.getElementById("editKostenZuordnungTage-" + id);
            item.haendler = (haendlerEl ? haendlerEl.value : item.haendler || "").trim();
            item.zuordnungTage = normalizeFixkostenZuordnungTage(tageEl ? tageEl.value : item.zuordnungTage);
            item.datum = datum;
            item.tag = tagAusDatum(datum);
            Object.assign(item, readReminderControl(`edit:fixkosten:${id}`));

            if (speichern() === false) return;
            state.editKostenId = null;
            renderLaufendeKosten();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
        }

        function editLaufendeKosten(id) {
            startEditKosten(id);
        }

        function deleteAlleLaufendeKosten() {

            if (!confirm("Alle Fixkosten wirklich löschen?")) return;
            beginUndoDelete("Alle Fixkosten gelöscht");

            // 🛡️ Struktur absichern
            if (!daten["Laufende Kosten"]) {
                daten["Laufende Kosten"] = { fix: [] };
            } else {
                daten["Laufende Kosten"].fix = [];
            }

            if (speichern() === false) return;
            state.editKostenId = null;
            renderLaufendeKosten();
            renderHomeUebersicht();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
            finishUndoDelete("Alle Fixkosten gelöscht");
        }
