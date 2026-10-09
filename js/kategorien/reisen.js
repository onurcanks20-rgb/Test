// Kostentracker Test: js/kategorien/reisen.js
// Functions share the existing app state; initialize only in app/start.js.

        function addLand() {
            let name = document.getElementById("landInput").value.trim();
            if (!name) return;

            name = name.charAt(0).toUpperCase() + name.slice(1);
            const budget = parseBetrag(document.getElementById("landBudget")?.value) || 0;
            const von = document.getElementById("landVon")?.value || "";
            const bis = document.getElementById("landBis")?.value || "";
            if (von && bis && bis < von) {
                alert("Das Enddatum darf nicht vor dem Startdatum liegen.");
                return;
            }

            if (daten.Reisen[name]) {
                alert("Diese Reise existiert bereits.");
                return;
            }
            daten.Reisen[name] = {
                Essen: [],
                Trinken: [],
                Transport: [],
                Unterkunft: [],
                Aktivität: [],
                Einkauf: [],
                Sonstiges: []
            };
            daten.ReisenMeta ||= {};
            daten.ReisenMeta[name] = { budget, von, bis };

            if (speichern() === false) return;
            document.getElementById("landInput").value = "";
            if (document.getElementById("landBudget")) document.getElementById("landBudget").value = "";
            if (document.getElementById("landVon")) document.getElementById("landVon").value = "";
            if (document.getElementById("landBis")) document.getElementById("landBis").value = "";
            document.getElementById("reisenAddPanel")?.classList.add("hidden");
            renderLaender();
        }

        function renderLaender() {
            let div = document.getElementById("laenderListe");
            div.innerHTML = "";

            const suche = getSearchTerm("reisenSuche");
            const laender = Object.keys(daten.Reisen).filter(land => {
                if (matchesSearch(suche, land)) return true;
                return Object.entries(daten.Reisen[land] || {}).some(([kat, liste]) =>
                    matchesSearch(suche, kat) || (Array.isArray(liste) && liste.some(e => matchesSearch(suche, e.text, e.datum, e.betrag)))
                );
            }).sort((a,b) => a.localeCompare(b, "de"));

            for (const land of laender) {

                let sum = 0;
                for (let k in daten.Reisen[land]) {
                    sum += daten.Reisen[land][k].reduce((a, b) => a + b.betrag, 0);
                }

                let row = document.createElement("div");
                row.className = "reise-row";

                let item = document.createElement("div");
                item.className = "item land-item";
                item.style.flex = "1";

                const meta = daten.ReisenMeta?.[land] || { budget: 0, von: "", bis: "" };
                const budget = parseBetrag(meta.budget) || 0;
                const uebrig = budget - sum;
                item.innerHTML = `
            <div class="land-main">
                ${state.editLandName === land
                    ? `<input id="editLand-${safeId(land)}" value="${escapeHtml(land)}">`
                    : `<span class="land-name">${escapeHtml(land)}</span>`
                }
                <div class="land-stats">
                    <span class="land-spent">Ausgegeben: ${formatBetrag(sum)}</span>
                    ${budget > 0
                        ? `<span>Übrig: ${formatBetrag(uebrig)} von ${formatBetrag(budget)}</span>`
                        : `<span>Kein Budget festgelegt</span>`}
                </div>
            </div>
        `;

                item.onclick = () => {
                    if (state.editLandName !== land) {
                        openLand(land);
                    }
                };

                let editBtn = document.createElement("button");

                if (state.editLandName === land) {

                    editBtn.innerText = "💾";
                    editBtn.onclick = (event) => {
                        event.stopPropagation();
                        saveEditLand(land);
                    };

                } else {

                    editBtn.className = "edit";
                    editBtn.innerText = "✏️";
                    editBtn.onclick = (event) => {
                        event.stopPropagation();
                        startEditLand(land);
                    };
                }

                let cancelBtn = document.createElement("button");

                if (state.editLandName === land) {

                    cancelBtn.innerText = "❌";
                    cancelBtn.onclick = (event) => {
                        event.stopPropagation();
                        cancelEditLand();
                    };

                }

                // 🗑️ Button daneben
                let delBtn = document.createElement("button");
                delBtn.className = "delete";
                delBtn.innerText = "🗑️";

                // 🔥 wichtig: verhindert Öffnen
                delBtn.onclick = (event) => deleteLand(event, land);

                const actions = document.createElement("div");
                actions.className = "land-actions";
                actions.appendChild(editBtn);

                if (state.editLandName === land) {
                    actions.appendChild(cancelBtn);
                } else {
                    actions.appendChild(delBtn);
                }

                item.appendChild(actions);
                row.appendChild(item);

                if (state.editLandName === land) {
                    setTimeout(() => {
                        setupLandEditEnterFlow(land);

                        let input = document.getElementById("editLand-" + safeId(land));
                        if (input) {
                            input.focus();
                            input.select(); // 🔥 markiert direkt den Text
                        }

                    }, 10);
                }

                div.appendChild(row);
            }
        }

        function openLand(l) {

            // 🔥 WICHTIG: alten Zustand sauber zurücksetzen
            state.editLandName = null;
            state.editReiseId = null;
            state.reiseBudgetEdit = false;

            aktuellesLand = l;

            show("land");

            document.getElementById("landTitel").innerText = l;
            renderReiseBudget();

            document.getElementById("datum").value =
                new Date().toISOString().split('T')[0];

            updateDropdown();
            renderListe();
            renderKategorienUebersicht();
            applyLetzteReiseKategorie();
            setupReisenEnterFlow();
        }

        function reiseGesamtAusgegeben(land) {
            if (!land || !daten.Reisen?.[land]) return 0;
            return Object.values(daten.Reisen[land]).reduce((sum, liste) => {
                if (!Array.isArray(liste)) return sum;
                return sum + liste.reduce((s, e) => s + (parseBetrag(e.betrag) || 0), 0);
            }, 0);
        }

        function renderReiseBudget() {
            const box = document.getElementById("reiseBudgetCard");
            if (!box || !aktuellesLand) return;
            daten.ReisenMeta ||= {};
            const meta = daten.ReisenMeta[aktuellesLand] || { budget: 0, von: "", bis: "" };
            const budget = parseBetrag(meta.budget) || 0;
            const ausgegeben = reiseGesamtAusgegeben(aktuellesLand);
            const uebrig = budget - ausgegeben;
            const zeitraum = meta.von || meta.bis
                ? `${meta.von ? formatDatum(meta.von) : "…"} – ${meta.bis ? formatDatum(meta.bis) : "…"}`
                : "Kein Zeitraum festgelegt";

            if (state.reiseBudgetEdit) {
                box.innerHTML = `
                    <div class="item" style="margin-bottom:16px;display:flex;flex-direction:column;gap:10px;">
                        <div style="font-weight:700;">Reise planen</div>
                        <input id="reiseBudgetEdit" type="text" inputmode="decimal" value="${budget ? formatInputBetrag(budget) : ""}" placeholder="Budget" enterkeyhint="next">
                        <div class="date-range">
                            <div class="date-field">
                                <label for="reiseVonEdit">Von</label>
                                <input id="reiseVonEdit" type="date" value="${escapeHtml(meta.von || "")}">
                            </div>
                            <div class="date-field">
                                <label for="reiseBisEdit">Bis</label>
                                <input id="reiseBisEdit" type="date" value="${escapeHtml(meta.bis || "")}">
                            </div>
                        </div>
                        <div class="row">
                            <button onclick="saveReiseBudget()" class="btn btn-primary">Speichern</button>
                            <button onclick="state.reiseBudgetEdit=false;renderReiseBudget()" style="background:#3a3a3c;">Abbrechen</button>
                        </div>
                    </div>`;
                return;
            }

            box.innerHTML = `
                <div class="item" style="margin-bottom:16px;display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <div style="font-weight:700;">Reisebudget</div>
                        <button onclick="state.reiseBudgetEdit=true;renderReiseBudget()" class="edit" title="Budget bearbeiten">✏️</button>
                    </div>
                    ${budget > 0 ? `
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">
                            <div><div style="font-size:12px;opacity:.65;">Budget</div><strong>${formatBetrag(budget)}</strong></div>
                            <div><div style="font-size:12px;opacity:.65;">Ausgegeben</div><strong>${formatBetrag(ausgegeben)}</strong></div>
                            <div><div style="font-size:12px;opacity:.65;">Übrig</div><strong>${formatBetrag(uebrig)}</strong></div>
                        </div>` : `
                        <div style="opacity:.7;">Noch kein Budget festgelegt.</div>`}
                    <div style="font-size:13px;opacity:.72;">🗓️ ${zeitraum}</div>
                </div>`;
        }

        function saveReiseBudget() {
            if (!aktuellesLand) return;
            const budget = parseBetrag(document.getElementById("reiseBudgetEdit")?.value) || 0;
            const von = document.getElementById("reiseVonEdit")?.value || "";
            const bis = document.getElementById("reiseBisEdit")?.value || "";
            if (von && bis && bis < von) {
                alert("Das Enddatum darf nicht vor dem Startdatum liegen.");
                return;
            }
            daten.ReisenMeta ||= {};
            daten.ReisenMeta[aktuellesLand] = { budget, von, bis };
            if (speichern() === false) return;
            state.reiseBudgetEdit = false;
            renderReiseBudget();
            renderLaender();
        }

        function backToReisen() {
            aktuellesLand = null;
            state.editLandName = null;
            state.editReiseId = null;

            show("reisen");
            renderLaender();
        }

        function updateDropdown() {
            let select = document.getElementById("kategorieSelect");
            if (!select || !aktuellesLand || !daten.Reisen[aktuellesLand]) return;

            select.innerHTML = "";

            Object.keys(daten.Reisen[aktuellesLand]).forEach(k => {
                let opt = document.createElement("option");
                opt.value = k;
                opt.innerText = k;
                select.appendChild(opt);
            });

            const letzte = getLetzteKategorie("reisen", "Essen");
            if ([...select.options].some(o => o.value === letzte)) select.value = letzte;
        }

        function addKategorie() {
            let name = prompt("Neue Kategorie?");
            if (!name) return;
            name = name.trim();
            if (!name) return;

            if (!aktuellesLand || !daten.Reisen[aktuellesLand]) return;

            name = name.charAt(0).toUpperCase() + name.slice(1);

            if (!Object.hasOwn(daten.Reisen[aktuellesLand], name)) {
                Object.defineProperty(daten.Reisen[aktuellesLand], name, { value: [], enumerable: true, writable: true, configurable: true });
            }

            if (speichern() === false) return;
            updateDropdown();
            renderListe();
        }

        function addItem(liste, item) {

            if (!Array.isArray(liste)) {
                console.error("❌ KEIN ARRAY:", liste);
                return;
            }

            liste.push(item);
            return speichern();
        }

        function addEintrag() {

            let kat = document.getElementById("kategorieSelect").value;
            let betrag = parseBetrag(document.getElementById("betrag").value);
            let text = document.getElementById("text").value;
            let datum = document.getElementById("datum").value;

            if (isNaN(betrag)) return;
            if (!aktuellesLand || !daten.Reisen[aktuellesLand]) return;

            if (!daten.Reisen[aktuellesLand][kat]) {
                console.warn("❌ Kategorie existiert nicht:", kat);
                return;
            }

            merkeLetzteKategorie("reisen", kat);
            if (addItem(daten.Reisen[aktuellesLand][kat], {
                id: generateId(),
                betrag,
                text,
                datum,
                ...readReminderControl("add:reisen")
            }) === false) return;

            const betragInput = document.getElementById("betrag");
            const textInput = document.getElementById("text");
            if (betragInput) betragInput.value = "";
            if (textInput) textInput.value = "";
            const datumInput = document.getElementById("datum");
            if (datumInput) datumInput.value = heuteISO();

            renderListe();
            renderKategorienUebersicht();
            renderReiseBudget();
            renderLaender();
            applyLetzteReiseKategorie();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) closeStartQuickAdd();
            renderHomeUebersicht();
        }

        function toggleKategorie(k) {

            // sicherstellen, dass state existiert
            if (!state.offeneKategorie) {
                state.offeneKategorie = null;
            }

            state.offeneKategorie = (state.offeneKategorie === k ? null : k);

            renderKategorienUebersicht();
        }

        function renderListe() {

            if (!aktuellesLand || !daten.Reisen[aktuellesLand]) return;

            let div = document.getElementById("kategorienUebersicht");
            if (!div) return;

            div.innerHTML = "";

            const hatReiseAusgaben = Object.values(daten.Reisen[aktuellesLand] || {}).some(liste => Array.isArray(liste) && liste.length > 0);
            document.getElementById("reiseDeleteAllBtn")?.classList.toggle("hidden", !hatReiseAusgaben);

            let gesamt = 0;
            const suche = getSearchTerm("reiseEintragSuche");

            for (let k in daten.Reisen[aktuellesLand]) {

                const alleEintraege = Array.isArray(daten.Reisen[aktuellesLand][k]) ? daten.Reisen[aktuellesLand][k] : [];
                const gefilterteEintraege = alleEintraege
                    .filter(e => !istEintragAusgeblendet("reisen", e.id))
                    .filter(e => matchesSearch(suche, k, e.text, e.datum, e.betrag))
                    .sort((a,b) => datumZeitwert(b.datum) - datumZeitwert(a.datum));
                if (suche && !matchesSearch(suche, k) && gefilterteEintraege.length === 0) continue;

                let sum = alleEintraege
                    .filter(e => matchesSearch(suche, k, e.text, e.datum, e.betrag))
                    .reduce((a, b) => a + (b.betrag || 0), 0);

                gesamt += sum;

                let item = document.createElement("div");
                item.className = "item";

                const editingCategory = state.editKategorieName === k;
                const categoryMain = document.createElement("div");
                categoryMain.style.cssText = `display:flex; align-items:center; min-width:0; flex:1; cursor:${editingCategory ? 'default' : 'pointer'}; padding:4px 0;`;
                if (editingCategory) {
                    const input = document.createElement("input");
                    input.id = "editKategorie-" + safeId(k);
                    input.value = k;
                    input.addEventListener("click", event => event.stopPropagation());
                    categoryMain.appendChild(input);
                } else {
                    const label = document.createElement("span");
                    label.style.cssText = "font-weight:600; overflow-wrap:anywhere;";
                    label.textContent = k + " – " + formatBetragText(sum);
                    categoryMain.appendChild(label);
                    categoryMain.addEventListener("click", () => toggleKategorie(k));
                }
                const categoryActions = document.createElement("div");
                categoryActions.className = "actions";
                categoryActions.style.cssText = "display:flex; gap:8px; align-items:center;";
                const addCategoryAction = (label, className, action) => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = className;
                    button.textContent = label;
                    button.addEventListener("click", event => {
                        event.stopPropagation();
                        action();
                    });
                    categoryActions.appendChild(button);
                };
                if (editingCategory) {
                    addCategoryAction("💾", "btn btn-icon btn-primary", () => saveEditKategorie(k));
                    addCategoryAction("❌", "btn btn-icon btn-cancel", cancelEditKategorie);
                } else {
                    addCategoryAction("✏️", "edit", () => startEditKategorie(k));
                    addCategoryAction("🗑️", "delete", () => deleteKategorie(k));
                }
                item.append(categoryMain, categoryActions);

                div.appendChild(item);

                // ENTER Kategorie
                if (state.editKategorieName === k) {
                    setTimeout(() => setupKategorieEditEnterFlow(k), 10);
                }

                // Einträge
                if (state.offeneKategorie === k) {

                    let letzteReiseDatumsGruppe = null;
                    gefilterteEintraege.forEach(e => {
                        const gruppenKey = e.datum || "ohne-datum";
                        if (gruppenKey !== letzteReiseDatumsGruppe) {
                            appendDateGroupHeader(div, e.datum, { first: false, inset: true });
                            letzteReiseDatumsGruppe = gruppenKey;
                        }

                        let sub = document.createElement("div");
                        sub.className = "item";
                        sub.style.marginLeft = "20px";
                        sub.style.background = "#3a3a3c";

                        if (state.editReiseId === e.id) {

                            sub.innerHTML = `
                        <input id="editBetrag-${e.id}" type="text" inputmode="decimal" value="${formatInputBetrag(e.betrag)}" placeholder="Betrag" enterkeyhint="next">
                        <input id="editText-${e.id}" value="${escapeHtml(e.text || "")}" autocapitalize="words" placeholder="Genauere Beschreibung (optional)" enterkeyhint="next">
                        <input id="editDatum-${e.id}" type="date" value="${e.datum || ""}">

                        <div class="actions">
                            <button onclick="saveEditReise(${e.id})">💾</button>
                            <button onclick="cancelEditReise()">❌</button>
                        </div>
                    `;

                            setTimeout(() => setupReiseEditEnterFlow(e.id), 10);
                        }

                        else {
                            const reiseOffen = !!state.offeneReiseEintraege[String(e.id)];
                            const reiseBeschreibung = escapeHtml(e.text || '');
                            sub.innerHTML = `
                        <div style="display:flex; flex-direction:column; width:100%; gap:10px;">
                            <div style="display:grid; grid-template-columns:minmax(0,1fr) auto; width:100%; gap:10px; align-items:center;">
                                <div onclick="toggleReiseDetails('${e.id}')"
                                     style="display:flex; align-items:flex-start; gap:10px; min-width:0; cursor:pointer;">
                                    <div style="display:flex; flex-direction:column; min-width:0; gap:4px;">
                                        <span style="font-weight:700; overflow-wrap:anywhere;">${escapeHtml(k)}</span>
                                        <strong style="font-size:18px;">${formatBetrag(e.betrag)}</strong>
                                    </div>
                                </div>
                                <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                                    <button onclick="event.stopPropagation(); moveAusgabe('reisen','${e.id}')" title="Verschieben">↪️</button>
                                    <button class="edit" onclick="event.stopPropagation(); startEditReise(${e.id})">✏️</button>
                                    <button class="delete" data-delete-reise>🗑️</button>
                                </div>
                            </div>
                            ${reiseOffen ? `
                                <div onclick="toggleReiseDetails('${e.id}')" style="background:#48484a;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:14px;cursor:pointer;">
                                    ${reiseBeschreibung ? `<div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Beschreibung</span><span style="font-weight:600;text-align:right;overflow-wrap:anywhere;">${reiseBeschreibung}</span></div>` : ''}
                                    <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Datum</span><span style="font-weight:600;text-align:right;">${e.datum ? formatDatum(e.datum) : '-'}</span></div>
                                </div>` : ''}
                        </div>
                    `;
                        }

                        sub.querySelector('[data-delete-reise]')?.addEventListener("click", event => {
                            event.stopPropagation();
                            const index = alleEintraege.indexOf(e);
                            if (index !== -1) deleteEintrag(k, index);
                        });
                        div.appendChild(sub);
                    });

                    if (alleEintraege.length > 0 && !suche) {
                        const clearWrap = document.createElement("div");
                        clearWrap.style.marginLeft = "20px";
                        clearWrap.style.marginTop = "8px";
                        clearWrap.innerHTML = `
                            <button class="delete"
                                    data-clear-kategorie
                                    style="width:100%;padding:11px 14px;border-radius:12px;font-weight:700;">
                                🗑️ Alle ${escapeHtml(k)}-Ausgaben löschen
                            </button>
                        `;
                        clearWrap.querySelector('button').addEventListener("click", event => {
                            event.stopPropagation();
                            clearKategorie(k);
                        });
                        div.appendChild(clearWrap);
                    }
                }
            }

            const gesamtEl = document.getElementById("gesamt");
            if (gesamtEl) gesamtEl.innerText = "Gesamt: " + formatBetragText(gesamt);
            renderReiseBudget();
        }

        function toggleReiseDetails(id) {
            const key = String(id);
            state.offeneReiseEintraege[key] = !state.offeneReiseEintraege[key];
            renderKategorienUebersicht();
        }

        function editKategorie(k) {

            if (!aktuellesLand || !daten.Reisen[aktuellesLand]) return;

            let neuerName = prompt("Neuer Name:", k);
            if (!neuerName) return;

            neuerName = neuerName.charAt(0).toUpperCase() + neuerName.slice(1);

            if (daten.Reisen[aktuellesLand][neuerName]) {
                alert("Kategorie existiert bereits!");
                return;
            }

            daten.Reisen[aktuellesLand][neuerName] = daten.Reisen[aktuellesLand][k];
            delete daten.Reisen[aktuellesLand][k];

            if (speichern() === false) return;
            updateDropdown();
            renderListe();
        }

        function clearKategorie(k) {

            if (!aktuellesLand || !daten.Reisen[aktuellesLand]) return;
            if (!daten.Reisen[aktuellesLand][k]) return;

            if (!confirm(`Alle Ausgaben aus „${k}“ löschen?`)) return;

            daten.Reisen[aktuellesLand][k] = [];

            if (speichern() === false) return;
            renderListe();
        }

        function deleteKategorie(k) {

            if (!aktuellesLand || !daten.Reisen[aktuellesLand]) return;
            if (!daten.Reisen[aktuellesLand][k]) return;

            if (!confirm("Kategorie wirklich löschen?")) return;

            // 🔥 sicherstellen
            if (!daten.geloeschteKategorien[aktuellesLand]) {
                daten.geloeschteKategorien[aktuellesLand] = [];
            }

            // 🔥 keine Duplikate
            if (!daten.geloeschteKategorien[aktuellesLand].includes(k)) {
                daten.geloeschteKategorien[aktuellesLand].push(k);
            }

            delete daten.Reisen[aktuellesLand][k];

            if (speichern() === false) return;
            updateDropdown();
            renderListe();
        }

        function renderKategorienUebersicht() {
            renderListe();
        }

        function deleteLand(event, land) {

            // 🛡️ Event-Schutz
            if (event) {
                event.stopPropagation();
            }

            if (!confirm(land + " wirklich löschen?")) return;
            beginUndoDelete(`Reise „${land}“ gelöscht`);

            if (daten.Reisen && daten.Reisen[land]) {
                delete daten.Reisen[land];
            }
            if (daten.ReisenMeta?.[land]) {
                delete daten.ReisenMeta[land];
            }

            // 🔥 auch gelöschte Kategorien entfernen
            if (daten.geloeschteKategorien && daten.geloeschteKategorien[land]) {
                delete daten.geloeschteKategorien[land];
            }

            if (speichern() === false) return;
            renderLaender();
            finishUndoDelete(`Reise „${land}“ gelöscht`);
        }

        function clearLand() {

            if (!aktuellesLand || !daten.Reisen?.[aktuellesLand]) return;

            if (!confirm("Wirklich ALLE Kosten in diesem Land löschen?")) return;
            beginUndoDelete("Alle Reisekosten gelöscht");

            for (let k in daten.Reisen[aktuellesLand]) {
                if (Array.isArray(daten.Reisen[aktuellesLand][k])) {
                    daten.Reisen[aktuellesLand][k] = [];
                }
            }

            if (speichern() === false) return;
            renderListe();
            finishUndoDelete("Alle Reisekosten gelöscht");
        }

        function startEditReise(id) {

            state.editReiseId = id;

            renderListe();
        }

        function saveEditReise(id) {

            if (!aktuellesLand || !daten.Reisen?.[aktuellesLand]) return;

            let textEl = document.getElementById("editText-" + id);
            let betragEl = document.getElementById("editBetrag-" + id);
            let datumEl = document.getElementById("editDatum-" + id);

            if (!textEl || !betragEl || !datumEl) return;

            let text = textEl.value;
            let betrag = parseBetrag(betragEl.value);
            let datum = datumEl.value;

            if (!text || isNaN(betrag) || !datum) return;

            for (let k in daten.Reisen[aktuellesLand]) {

                let liste = daten.Reisen[aktuellesLand][k];

                let eintrag = liste.find(e => String(e.id) === String(id));

                if (eintrag) {

                    eintrag.text = text;
                    eintrag.betrag = betrag;
                    eintrag.datum = datum;
                    Object.assign(eintrag, readReminderControl(`edit:reisen:${id}`));

                    break;
                }
            }

            if (speichern() === false) return;
            state.editReiseId = null; // 👈 vereinheitlicht
            renderListe();
        }

        function cancelEditReise() {
            state.editReiseId = null;
            renderListe();
        }

        function saveEditKategorie(oldName) {

            if (!aktuellesLand || !daten.Reisen?.[aktuellesLand]) return;

            let input = document.getElementById("editKategorie-" + safeId(oldName));
            if (!input) return;

            let newName = input.value.trim();
            if (!newName) return;

            newName = newName.charAt(0).toUpperCase() + newName.slice(1);

            let land = daten.Reisen[aktuellesLand];

            if (!land || !land[oldName]) return;

            if (newName === oldName) {
                cancelEditKategorie();
                return;
            }
            if (Object.hasOwn(land, newName)) {
                alert("Kategorie existiert bereits!");
                return;
            }

            Object.defineProperty(land, newName, { value: land[oldName], enumerable: true, writable: true, configurable: true });
            delete land[oldName];
            if (state.offeneKategorie === oldName) state.offeneKategorie = newName;
            if (getLetzteKategorie("reisen", "Essen") === oldName) merkeLetzteKategorie("reisen", newName);
            if (speichern() === false) return;
            state.editKategorieName = null;
            updateDropdown();
            renderListe();
        }

        function cancelEditKategorie() {
            state.editKategorieName = null;
            renderListe();
        }

        function startEditKategorie(name) {
            state.editKategorieName = name;
            renderListe();
        }

        function editLand(oldName) {

            if (!daten.Reisen) return;

            let neuerName = prompt("Neuer Name:", oldName);
            if (!neuerName) return;

            neuerName = neuerName.trim();
            if (!neuerName) return;

            if (neuerName === oldName) return;

            neuerName = neuerName.charAt(0).toUpperCase() + neuerName.slice(1);

            let reisen = daten.Reisen;

            if (reisen[neuerName]) {
                alert("Land existiert bereits!");
                return;
            }

            if (!reisen[oldName]) return;

            reisen[neuerName] = reisen[oldName];
            delete reisen[oldName];

            if (!daten.geloeschteKategorien) {
                daten.geloeschteKategorien = {};
            }

            if (daten.geloeschteKategorien[oldName]) {
                daten.geloeschteKategorien[neuerName] =
                    daten.geloeschteKategorien[oldName];

                delete daten.geloeschteKategorien[oldName];
            }

            if (speichern() === false) return;
            renderLaender();
        }

        function startEditLand(name) {

            state.editLandName = name;

            renderLaender();

            requestAnimationFrame(() => {

                let input = document.getElementById("editLand-" + safeId(name));

                if (input) {
                    input.focus();
                    input.select();
                }
            });
        }

        function saveEditLand(oldName) {

            if (!daten.Reisen) return;

            let input = document.getElementById("editLand-" + safeId(oldName));
            if (!input) return;

            let newName = input.value.trim();
            if (!newName) return;

            if (newName === oldName) {
                state.editLandName = null;
                renderLaender();
                return;
            }

            newName = newName.charAt(0).toUpperCase() + newName.slice(1);

            let reisen = daten.Reisen;

            if (reisen[newName]) {
                alert("Land existiert bereits!");
                return;
            }

            if (!reisen[oldName]) return;

            reisen[newName] = reisen[oldName];
            delete reisen[oldName];
            daten.ReisenMeta ||= {};
            if (daten.ReisenMeta[oldName]) {
                daten.ReisenMeta[newName] = daten.ReisenMeta[oldName];
                delete daten.ReisenMeta[oldName];
            }

            if (!daten.geloeschteKategorien) {
                daten.geloeschteKategorien = {};
            }

            if (daten.geloeschteKategorien[oldName]) {

                daten.geloeschteKategorien[newName] =
                    daten.geloeschteKategorien[oldName];

                delete daten.geloeschteKategorien[oldName];
            }

            if (speichern() === false) return;
            state.editLandName = null;
            renderLaender();
        }

        function cancelEditLand() {
            state.editLandName = null;
            renderLaender();
        }

        function reisenGesamt() {
            let sum = 0;
            if (!daten.Reisen) return 0;
            Object.values(daten.Reisen).forEach(land => {
                if (!land || typeof land !== "object") return;
                Object.values(land).forEach(liste => {
                    if (!Array.isArray(liste)) return;
                    liste.forEach(e => sum += parseBetrag(e.betrag) || 0);
                });
            });
            return sum;
        }
