// Kostentracker Test: js/kategorien/geplante-ausgaben.js
// Functions share the existing app state; initialize only in app/start.js.

        function updateGeplantBereichUI(setzeStandardBudget = false) {
            const bereich = document.getElementById("geplantBereich")?.value || "haushalt";
            const reiseWrap = document.getElementById("geplantReiseWrap");
            const reiseSelect = document.getElementById("geplantReise");
            const budgetSelect = document.getElementById("geplantBudgetWirksam");
            const hinweis = document.getElementById("geplantBudgetHinweis");

            if (reiseWrap) reiseWrap.classList.toggle("hidden", bereich !== "reisen");
            if (bereich === "reisen" && reiseSelect) {
                const vorher = reiseSelect.value;
                const laender = Object.keys(daten.Reisen || {}).sort((a,b) => a.localeCompare(b, "de"));
                reiseSelect.innerHTML = laender.length
                    ? laender.map(land => `<option value="${escapeHtml(land)}">${escapeHtml(land)}</option>`).join("")
                    : `<option value="">Keine Reise vorhanden</option>`;
                if (laender.includes(vorher)) reiseSelect.value = vorher;
            }

            if (setzeStandardBudget && budgetSelect) {
                budgetSelect.value = bereich === "reisen" ? "nein" : "ja";
            }
            if (hinweis) {
                hinweis.textContent = bereich === "reisen"
                    ? "Reisen sind standardmäßig nicht Teil deines Alltagsbudgets. Du kannst die Reservierung oben trotzdem bewusst aktivieren. Ab dem Folgetag wird die Ausgabe automatisch in die gewählte Reise übernommen."
                    : "Bei „Ja“ wird der Betrag im Gehaltszeitraum des geplanten Datums reserviert. Ab dem Folgetag wird er automatisch als echte Ausgabe übernommen.";
            }
            updateGeplantKategorieSelect();
        }

        function updateGeplantKategorieSelect() {
            const bereich = document.getElementById("geplantBereich")?.value || "haushalt";
            const select = document.getElementById("geplantKategorie");
            if (!select) return;
            let kategorien;
            if (bereich === "freizeit") {
                kategorien = ["Essen / Trinken", "Aktivität", "Geschenke", "Sonstiges"];
            } else if (bereich === "reisen") {
                const land = document.getElementById("geplantReise")?.value || "";
                const reise = daten.Reisen?.[land] || {};
                kategorien = Object.keys(reise).filter(k => Array.isArray(reise[k]));
                if (!kategorien.length) kategorien = ["Essen", "Trinken", "Transport", "Unterkunft", "Aktivität", "Einkauf", "Sonstiges"];
                kategorien.sort((a,b) => a.localeCompare(b, "de"));
            } else {
                kategorien = ["Einkauf", "Tanken", "Drogerie", "Sonstiges"];
            }
            const vorher = select.value;
            select.innerHTML = kategorien.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join("");
            if (kategorien.includes(vorher)) select.value = vorher;
        }

        function geplantDatumZuISO(d) {
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        }

        function geplantNaechstesDatum(datum, wiederholung, ankerDatum = datum) {
            const d = parseISODate(datum);
            const anker = parseISODate(ankerDatum) || d;
            if (!d || !anker) return "";
            const ankerTag = anker.getDate();
            if (wiederholung === "monatlich") {
                const ziel = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                const letzterTag = new Date(ziel.getFullYear(), ziel.getMonth() + 1, 0).getDate();
                ziel.setDate(Math.min(ankerTag, letzterTag));
                return geplantDatumZuISO(ziel);
            }
            if (wiederholung === "jaehrlich") {
                const zielJahr = d.getFullYear() + 1;
                const zielMonat = anker.getMonth();
                const letzterTag = new Date(zielJahr, zielMonat + 1, 0).getDate();
                return geplantDatumZuISO(new Date(zielJahr, zielMonat, Math.min(ankerTag, letzterTag)));
            }
            return "";
        }

        function geplanteAusgabenImZeitraum(von, bis) {
            const out = [];
            (daten["Geplante Ausgaben"] || []).forEach(e => {
                let datum = e.datum || "";
                const wiederholung = ["monatlich", "jaehrlich"].includes(e.wiederholung) ? e.wiederholung : "einmalig";
                let guard = 0;
                while (datum && guard++ < 240) {
                    const d = parseISODate(datum);
                    if (!d || d > bis) break;
                    if (d >= von) out.push({ ...e, datum, betrag: parseBetrag(e.betrag) || 0 });
                    if (wiederholung === "einmalig") break;
                    const next = geplantNaechstesDatum(datum, wiederholung, e.wiederholungStart || e.datum);
                    if (!next || next === datum) break;
                    datum = next;
                }
            });
            return out;
        }

        function geplanteReservierungenImZeitraum(von, bis) {
            return geplanteAusgabenImZeitraum(von, bis).filter(e => e.budgetWirksam !== false);
        }

        function addGeplanteAusgabe() {
            const text = formatText(document.getElementById("geplantText")?.value);
            const betrag = parseBetrag(document.getElementById("geplantBetrag")?.value);
            const datum = document.getElementById("geplantDatum")?.value || "";
            const wiederholungRaw = document.getElementById("geplantWiederholung")?.value || "einmalig";
            const wiederholung = ["monatlich", "jaehrlich"].includes(wiederholungRaw) ? wiederholungRaw : "einmalig";
            const bereichRaw = document.getElementById("geplantBereich")?.value || "haushalt";
            const bereich = ["haushalt", "freizeit", "reisen"].includes(bereichRaw) ? bereichRaw : "haushalt";
            const land = bereich === "reisen" ? (document.getElementById("geplantReise")?.value || "") : "";
            const kategorie = document.getElementById("geplantKategorie")?.value || "Sonstiges";
            const budgetWirksam = document.getElementById("geplantBudgetWirksam")?.value !== "nein";
            if (!text || !datum || isNaN(betrag) || betrag <= 0) return;
            if (bereich === "reisen" && (!land || !daten.Reisen?.[land])) {
                alert("Bitte wähle zuerst eine vorhandene Reise aus.");
                return;
            }

            daten["Geplante Ausgaben"] ??= [];
            daten["Geplante Ausgaben"].push({ id: generateId(), text, betrag, datum, wiederholung, wiederholungStart: datum, bereich, land, kategorie, budgetWirksam, ...readReminderControl("add:geplant") });
            if (speichern() === false) return;
            document.getElementById("geplantText").value = "";
            document.getElementById("geplantBetrag").value = "";
            document.getElementById("geplantDatum").value = heuteISO();
            if (document.getElementById("geplantWiederholung")) document.getElementById("geplantWiederholung").value = "einmalig";
            if (document.getElementById("geplantBereich")) document.getElementById("geplantBereich").value = "haushalt";
            if (document.getElementById("geplantBudgetWirksam")) document.getElementById("geplantBudgetWirksam").value = "ja";
            updateGeplantBereichUI(false);
            document.getElementById("geplantAddPanel")?.classList.add("hidden");
            verarbeiteFaelligeGeplanteAusgaben();
            renderGeplanteAusgaben();
            renderUebersicht();
        }

        function deleteGeplanteAusgabe(id) {
            const liste = daten["Geplante Ausgaben"] || [];
            const idx = liste.findIndex(e => String(e.id) === String(id));
            if (idx < 0) return;
            beginUndoDelete("Geplante Ausgabe gelöscht");
            liste.splice(idx, 1);
            if (speichern() === false) return;
            renderGeplanteAusgaben();
            renderUebersicht();
            finishUndoDelete("Geplante Ausgabe gelöscht");
        }

        function deleteAlleGeplanteAusgaben() {
            const liste = daten["Geplante Ausgaben"] || [];
            if (!liste.length) return;
            if (!confirm("Alle geplanten Ausgaben wirklich löschen?")) return;
            beginUndoDelete("Alle geplanten Ausgaben gelöscht");
            daten["Geplante Ausgaben"] = [];
            if (speichern() === false) return;
            state.editGeplanteAusgabeId = null;
            renderGeplanteAusgaben();
            renderUebersicht();
            renderHomeUebersicht();
            finishUndoDelete("Alle geplanten Ausgaben gelöscht");
        }

        function startEditGeplanteAusgabe(id) {
            state.editGeplanteAusgabeId = id;
            renderGeplanteAusgaben();
            setTimeout(() => document.getElementById(`editGeplantText-${id}`)?.focus(), 40);
        }

        function cancelEditGeplanteAusgabe() {
            state.editGeplanteAusgabeId = null;
            renderGeplanteAusgaben();
        }

        function editGeplantKategorienFuer(bereich, land = "") {
            if (bereich === "freizeit") return ["Essen / Trinken", "Aktivität", "Geschenke", "Sonstiges"];
            if (bereich === "reisen") {
                const reise = daten.Reisen?.[land] || {};
                const kategorien = Object.keys(reise).filter(k => Array.isArray(reise[k]));
                return (kategorien.length ? kategorien : ["Essen", "Trinken", "Transport", "Unterkunft", "Aktivität", "Einkauf", "Sonstiges"]).sort((a,b)=>a.localeCompare(b,"de"));
            }
            return ["Einkauf", "Tanken", "Drogerie", "Sonstiges"];
        }

        function updateEditGeplantBereichUI(id, setzeStandardBudget = false) {
            const bereich = document.getElementById(`editGeplantBereich-${id}`)?.value || "haushalt";
            const reiseWrap = document.getElementById(`editGeplantReiseWrap-${id}`);
            const reiseSelect = document.getElementById(`editGeplantReise-${id}`);
            const budgetSelect = document.getElementById(`editGeplantBudget-${id}`);
            if (reiseWrap) reiseWrap.classList.toggle("hidden", bereich !== "reisen");
            if (bereich === "reisen" && reiseSelect) {
                const vorher = reiseSelect.value;
                const laender = Object.keys(daten.Reisen || {}).sort((a,b)=>a.localeCompare(b,"de"));
                reiseSelect.innerHTML = laender.length ? laender.map(land => `<option value="${escapeHtml(land)}">${escapeHtml(land)}</option>`).join("") : `<option value="">Keine Reise vorhanden</option>`;
                if (laender.includes(vorher)) reiseSelect.value = vorher;
            }
            if (setzeStandardBudget && budgetSelect) budgetSelect.value = bereich === "reisen" ? "nein" : "ja";
            updateEditGeplantKategorieSelect(id);
        }

        function updateEditGeplantKategorieSelect(id) {
            const bereich = document.getElementById(`editGeplantBereich-${id}`)?.value || "haushalt";
            const land = document.getElementById(`editGeplantReise-${id}`)?.value || "";
            const select = document.getElementById(`editGeplantKategorie-${id}`);
            if (!select) return;
            const vorher = select.value;
            const kategorien = editGeplantKategorienFuer(bereich, land);
            select.innerHTML = kategorien.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join("");
            if (kategorien.includes(vorher)) select.value = vorher;
        }

        function saveEditGeplanteAusgabe(id) {
            const e = (daten["Geplante Ausgaben"] || []).find(x => String(x.id) === String(id));
            if (!e) return;
            const text = formatText(document.getElementById(`editGeplantText-${id}`)?.value);
            const betrag = parseBetrag(document.getElementById(`editGeplantBetrag-${id}`)?.value);
            const datum = document.getElementById(`editGeplantDatum-${id}`)?.value || "";
            const wiederholungRaw = document.getElementById(`editGeplantWiederholung-${id}`)?.value || "einmalig";
            const wiederholung = ["monatlich", "jaehrlich"].includes(wiederholungRaw) ? wiederholungRaw : "einmalig";
            const bereichRaw = document.getElementById(`editGeplantBereich-${id}`)?.value || "haushalt";
            const bereich = ["haushalt", "freizeit", "reisen"].includes(bereichRaw) ? bereichRaw : "haushalt";
            const land = bereich === "reisen" ? (document.getElementById(`editGeplantReise-${id}`)?.value || "") : "";
            const kategorie = document.getElementById(`editGeplantKategorie-${id}`)?.value || "Sonstiges";
            const budgetWirksam = document.getElementById(`editGeplantBudget-${id}`)?.value !== "nein";
            if (!text || isNaN(betrag) || betrag <= 0 || !parseISODate(datum)) return;
            if (bereich === "reisen" && (!land || !daten.Reisen?.[land])) { alert("Bitte wähle eine vorhandene Reise aus."); return; }
            Object.assign(e, { text, betrag, datum, wiederholung, wiederholungStart: datum, bereich, land, kategorie, budgetWirksam, ...readReminderControl(`edit:geplant:${id}`) });
            if (speichern() === false) return;
            state.editGeplanteAusgabeId = null;
            verarbeiteFaelligeGeplanteAusgaben();
            renderGeplanteAusgaben();
            renderUebersicht();
        }

        function editGeplanteAusgabe(id) { startEditGeplanteAusgabe(id); }

        function verarbeiteFaelligeGeplanteAusgaben() {
            daten["Geplante Ausgaben"] ??= [];
            const heute = heuteISO();
            const offen = [];
            let geaendert = false;

            daten["Geplante Ausgaben"].forEach(e => {
                let datum = e?.datum || "";
                const wiederholung = ["monatlich", "jaehrlich"].includes(e?.wiederholung) ? e.wiederholung : "einmalig";
                if (!datum) { offen.push(e); return; }

                let guard = 0;
                while (datum && datum < heute && guard++ < 240) {
                    const d = parseISODate(datum);
                    if (!d) break;
                    const bereich = ["haushalt", "freizeit", "reisen"].includes(e.bereich) ? e.bereich : "haushalt";
                    const occurrenceKey = `${e.id}:${datum}`;
                    let konnteBuchen = true;

                    if (bereich === "reisen") {
                        const land = e.land || "";
                        const reise = daten.Reisen?.[land];
                        if (!reise) { konnteBuchen = false; }
                        else {
                            const kategorie = e.kategorie || "Sonstiges";
                            reise[kategorie] ??= [];
                            const exists = reise[kategorie].some(x => String(x.geplantOccurrenceKey || "") === occurrenceKey || (wiederholung === "einmalig" && String(x.geplantId || "") === String(e.id)));
                            if (!exists) {
                                reise[kategorie].push({
                                    id: generateId(), geplantId: e.id, geplantOccurrenceKey: occurrenceKey, ausGeplant: true,
                                    text: e.text || kategorie || "Geplante Ausgabe", betrag: parseBetrag(e.betrag) || 0, datum
                                });
                            }
                        }
                    } else {
                        const store = bereich === "freizeit" ? daten.Freizeit : daten.Haushalt;
                        const monat = d.getMonth() + 1;
                        store[monat] ??= [];
                        const exists = store[monat].some(x => String(x.geplantOccurrenceKey || "") === occurrenceKey || (wiederholung === "einmalig" && String(x.geplantId || "") === String(e.id)));
                        if (!exists) {
                            store[monat].push({
                                id: generateId(), geplantId: e.id, geplantOccurrenceKey: occurrenceKey, ausGeplant: true,
                                text: e.text || e.kategorie || "Geplante Ausgabe", betrag: parseBetrag(e.betrag) || 0,
                                datum, kategorie: e.kategorie || "Sonstiges"
                            });
                        }
                    }

                    if (!konnteBuchen) break;
                    geaendert = true;
                    if (wiederholung === "einmalig") { datum = ""; break; }
                    const next = geplantNaechstesDatum(datum, wiederholung, e.wiederholungStart || e.datum);
                    if (!next || next === datum) break;
                    datum = next;
                }

                if (datum) {
                    if (datum !== e.datum) { e.datum = datum; geaendert = true; }
                    offen.push(e);
                }
            });

            if (geaendert) {
                daten["Geplante Ausgaben"] = offen;
                if (!speichernOhneHomeRender(false)) return false;
            }
            return geaendert;
        }

        function renderGeplanteAusgaben() {
            const listeEl = document.getElementById("geplantListe");
            const sumEl = document.getElementById("geplantZusammenfassung");
            if (!listeEl) return;
            const z = getGehaltszeitraum();
            const reserviert = geplanteReservierungenImZeitraum(z.start, z.ende).reduce((sum,e)=>sum+(parseBetrag(e.betrag)||0),0);
            if (sumEl) sumEl.innerHTML = `<div class="bereich-week-info-top"><span class="bereich-week-info-label">Reserviert in dieser Gehaltsperiode</span><span class="bereich-week-info-amount">${formatBetrag(reserviert)}</span></div><div class="bereich-week-info-breakdown">Nur Einträge mit „Vom Frei verfügbar abziehen: Ja“ werden reserviert.</div>`;
            const items = [...(daten["Geplante Ausgaben"] || [])].sort((a,b) => String(a.datum).localeCompare(String(b.datum)));
            document.getElementById("geplantDeleteAllBtn")?.classList.toggle("hidden", !items.length);
            if (!items.length) {
                listeEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗓️</div><div class="empty-state-title">Keine geplanten Ausgaben</div><div class="empty-state-text">Plane größere oder kommende Ausgaben vorab. Am Folgetag werden sie automatisch in den gewählten Bereich übernommen.</div></div>`;
                return;
            }
            let letzteGeplantGruppe = null;
            listeEl.innerHTML = items.map(e => {
                let gruppenHeader = "";
                const gruppenKey = e.datum || "ohne-datum";
                if (gruppenKey !== letzteGeplantGruppe) {
                    gruppenHeader = `<div class="date-group-title${letzteGeplantGruppe === null ? " first" : ""}">${formatDateGroupLabel(e.datum)}<small>Geplant</small></div>`;
                    letzteGeplantGruppe = gruppenKey;
                }
                const isEdit = String(state.editGeplanteAusgabeId) === String(e.id);
                if (isEdit) {
                    const bereich = ["haushalt","freizeit","reisen"].includes(e.bereich) ? e.bereich : "haushalt";
                    const laender = Object.keys(daten.Reisen || {}).sort((a,b)=>a.localeCompare(b,"de"));
                    const land = bereich === "reisen" && laender.includes(e.land) ? e.land : (laender[0] || "");
                    const kategorien = editGeplantKategorienFuer(bereich, land);
                    const kategorie = kategorien.includes(e.kategorie) ? e.kategorie : (kategorien[0] || "Sonstiges");
                    return gruppenHeader + `
                        <div class="item" style="align-items:stretch;">
                            <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
                                <input id="editGeplantText-${e.id}" value="${escapeHtml(e.text || '')}" autocapitalize="words" placeholder="Beschreibung" enterkeyhint="next">
                                <input id="editGeplantBetrag-${e.id}" type="text" inputmode="decimal" value="${formatInputBetrag(e.betrag)}" placeholder="Betrag" enterkeyhint="next">
                                <input id="editGeplantDatum-${e.id}" type="date" value="${e.datum || ''}">
                                <select id="editGeplantWiederholung-${e.id}">
                                    <option value="einmalig" ${(e.wiederholung || "einmalig") === "einmalig" ? "selected" : ""}>Einmalig</option>
                                    <option value="monatlich" ${e.wiederholung === "monatlich" ? "selected" : ""}>Monatlich</option>
                                    <option value="jaehrlich" ${e.wiederholung === "jaehrlich" ? "selected" : ""}>Jährlich</option>
                                </select>
                                <select id="editGeplantBereich-${e.id}" onchange="updateEditGeplantBereichUI('${e.id}',true)">
                                    <option value="haushalt" ${bereich === "haushalt" ? "selected" : ""}>Haushalt</option>
                                    <option value="freizeit" ${bereich === "freizeit" ? "selected" : ""}>Freizeit</option>
                                    <option value="reisen" ${bereich === "reisen" ? "selected" : ""}>Reisen</option>
                                </select>
                                <div id="editGeplantReiseWrap-${e.id}" class="${bereich === "reisen" ? "" : "hidden"}">
                                    <select id="editGeplantReise-${e.id}" onchange="updateEditGeplantKategorieSelect('${e.id}')">
                                        ${laender.length ? laender.map(l => `<option value="${escapeHtml(l)}" ${l === land ? "selected" : ""}>${escapeHtml(l)}</option>`).join("") : `<option value="">Keine Reise vorhanden</option>`}
                                    </select>
                                </div>
                                <select id="editGeplantKategorie-${e.id}">
                                    ${kategorien.map(k => `<option value="${escapeHtml(k)}" ${k === kategorie ? "selected" : ""}>${escapeHtml(k)}</option>`).join("")}
                                </select>
                                <select id="editGeplantBudget-${e.id}">
                                    <option value="ja" ${e.budgetWirksam !== false ? "selected" : ""}>Ja, vom Frei verfügbar abziehen</option>
                                    <option value="nein" ${e.budgetWirksam === false ? "selected" : ""}>Nein, nur vormerken</option>
                                </select>
                                <div style="display:flex;gap:10px;">
                                    <button onclick="saveEditGeplanteAusgabe('${e.id}')">💾 Speichern</button>
                                    <button onclick="cancelEditGeplanteAusgabe()" style="background:#3a3a3c;">❌ Abbrechen</button>
                                </div>
                            </div>
                        </div>`;
                }
                const ziel = e.bereich === "reisen" ? `✈️ ${escapeHtml(e.land || "Reise")} · ${escapeHtml(e.kategorie || "Sonstiges")}` : `${e.bereich === "freizeit" ? "🎉 Freizeit" : "🛒 Haushalt"} · ${escapeHtml(e.kategorie || "Sonstiges")}`;
                return gruppenHeader + `
                    <div class="item" style="align-items:center;">
                        <div style="min-width:0;flex:1;">
                            <div style="font-weight:750;">${escapeHtml(e.text || "Geplante Ausgabe")}</div>
                            <div class="info-text" style="margin-top:4px;">${formatDatum(e.datum)} · ${ziel}</div>
                            <div class="info-text" style="margin-top:3px;">${e.wiederholung === "monatlich" ? "🔁 Monatlich" : e.wiederholung === "jaehrlich" ? "🔁 Jährlich" : "1× Einmalig"} · ${e.budgetWirksam !== false ? "💶 Im Frei verfügbar reserviert" : "📝 Nur vorgemerkt"}</div>
                            <div style="font-weight:800;margin-top:5px;">${formatBetrag(e.betrag)}</div>
                        </div>
                        <div class="actions" style="display:flex;gap:5px;">
                            <button class="edit" onclick="event.stopPropagation();startEditGeplanteAusgabe('${String(e.id)}')">✏️</button>
                            <button class="delete" onclick="event.stopPropagation();deleteGeplanteAusgabe('${String(e.id)}')">🗑️</button>
                        </div>
                    </div>`;
            }).join("");
        }
