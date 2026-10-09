Kostentracker.module({
  "id": "js/kategorien/reisen.js",
  "dependencies": [
    "addItem",
    "appendDateGroupHeader",
    "applyLetzteReiseKategorie",
    "beginUndoDelete",
    "closeStartQuickAdd",
    "datumZeitwert",
    "escapeHtml",
    "finishUndoDelete",
    "formatBetrag",
    "formatBetragText",
    "formatDatum",
    "formatInputBetrag",
    "generateId",
    "getLetzteKategorie",
    "getSearchTerm",
    "heuteISO",
    "istEintragAusgeblendet",
    "matchesSearch",
    "merkeLetzteKategorie",
    "parseBetrag",
    "readReminderControl",
    "renderHomeUebersicht",
    "safeId",
    "setupKategorieEditEnterFlow",
    "setupLandEditEnterFlow",
    "setupReiseEditEnterFlow",
    "setupReisenEnterFlow",
    "show",
    "speichern"
  ],
  "session": [
    "aktuellesLand",
    "state"
  ],
  "read": [
    "Reisen",
    "ReisenMeta",
    "geloeschteKategorien"
  ],
  "write": [
    "Reisen",
    "ReisenMeta",
    "geloeschteKategorien"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/kategorien/reisen.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function addLand() {
            let name = document.getElementById("landInput").value.trim();
            if (!name) return;

            name = name.charAt(0).toUpperCase() + name.slice(1);
            const budget = dependencies.parseBetrag(document.getElementById("landBudget")?.value) || 0;
            const von = document.getElementById("landVon")?.value || "";
            const bis = document.getElementById("landBis")?.value || "";
            if (von && bis && bis < von) {
                alert("Das Enddatum darf nicht vor dem Startdatum liegen.");
                return;
            }

            if (context.repository.view.Reisen[name]) {
                alert("Diese Reise existiert bereits.");
                return;
            }
            context.repository.view.Reisen[name] = {
                Essen: [],
                Trinken: [],
                Transport: [],
                Unterkunft: [],
                Aktivität: [],
                Einkauf: [],
                Sonstiges: []
            };
            context.repository.view.ReisenMeta ||= {};
            context.repository.view.ReisenMeta[name] = { budget, von, bis };

            if (dependencies.speichern() === false) return;
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

            const suche = dependencies.getSearchTerm("reisenSuche");
            const laender = Object.keys(context.repository.view.Reisen).filter(land => {
                if (dependencies.matchesSearch(suche, land)) return true;
                return Object.entries(context.repository.view.Reisen[land] || {}).some(([kat, liste]) =>
                    dependencies.matchesSearch(suche, kat) || (Array.isArray(liste) && liste.some(e => dependencies.matchesSearch(suche, e.text, e.datum, e.betrag)))
                );
            }).sort((a,b) => a.localeCompare(b, "de"));

            for (const land of laender) {

                let sum = 0;
                for (let k in context.repository.view.Reisen[land]) {
                    sum += context.repository.view.Reisen[land][k].reduce((a, b) => a + b.betrag, 0);
                }

                let row = document.createElement("div");
                row.className = "reise-row";

                let item = document.createElement("div");
                item.className = "item land-item";
                item.style.flex = "1";

                const meta = context.repository.view.ReisenMeta?.[land] || { budget: 0, von: "", bis: "" };
                const budget = dependencies.parseBetrag(meta.budget) || 0;
                const uebrig = budget - sum;
                item.innerHTML = `
            <div class="land-main">
                ${context.session.state.editLandName === land
                    ? `<input id="editLand-${dependencies.safeId(land)}" value="${dependencies.escapeHtml(land)}">`
                    : `<span class="land-name">${dependencies.escapeHtml(land)}</span>`
                }
                <div class="land-stats">
                    <span class="land-spent">Ausgegeben: ${dependencies.formatBetrag(sum)}</span>
                    ${budget > 0
                        ? `<span>Übrig: ${dependencies.formatBetrag(uebrig)} von ${dependencies.formatBetrag(budget)}</span>`
                        : `<span>Kein Budget festgelegt</span>`}
                </div>
            </div>
        `;

                item.onclick = () => {
                    if (context.session.state.editLandName !== land) {
                        openLand(land);
                    }
                };

                let editBtn = document.createElement("button");

                if (context.session.state.editLandName === land) {

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

                if (context.session.state.editLandName === land) {

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

                if (context.session.state.editLandName === land) {
                    actions.appendChild(cancelBtn);
                } else {
                    actions.appendChild(delBtn);
                }

                item.appendChild(actions);
                row.appendChild(item);

                if (context.session.state.editLandName === land) {
                    setTimeout(() => {
                        dependencies.setupLandEditEnterFlow(land);

                        let input = document.getElementById("editLand-" + dependencies.safeId(land));
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
            context.session.state.editLandName = null;
            context.session.state.editReiseId = null;
            context.session.state.reiseBudgetEdit = false;

            context.session.aktuellesLand = l;

            dependencies.show("land");

            document.getElementById("landTitel").innerText = l;
            renderReiseBudget();

            document.getElementById("datum").value =
                new Date().toISOString().split('T')[0];

            updateDropdown();
            renderListe();
            renderKategorienUebersicht();
            dependencies.applyLetzteReiseKategorie();
            dependencies.setupReisenEnterFlow();
        }

        function reiseGesamtAusgegeben(land) {
            if (!land || !context.repository.view.Reisen?.[land]) return 0;
            return Object.values(context.repository.view.Reisen[land]).reduce((sum, liste) => {
                if (!Array.isArray(liste)) return sum;
                return sum + liste.reduce((s, e) => s + (dependencies.parseBetrag(e.betrag) || 0), 0);
            }, 0);
        }

        function renderReiseBudget() {
            const box = document.getElementById("reiseBudgetCard");
            if (!box || !context.session.aktuellesLand) return;
            context.repository.view.ReisenMeta ||= {};
            const meta = context.repository.view.ReisenMeta[context.session.aktuellesLand] || { budget: 0, von: "", bis: "" };
            const budget = dependencies.parseBetrag(meta.budget) || 0;
            const ausgegeben = reiseGesamtAusgegeben(context.session.aktuellesLand);
            const uebrig = budget - ausgegeben;
            const zeitraum = meta.von || meta.bis
                ? `${meta.von ? dependencies.formatDatum(meta.von) : "…"} – ${meta.bis ? dependencies.formatDatum(meta.bis) : "…"}`
                : "Kein Zeitraum festgelegt";

            if (context.session.state.reiseBudgetEdit) {
                box.innerHTML = `
                    <div class="item" style="margin-bottom:16px;display:flex;flex-direction:column;gap:10px;">
                        <div style="font-weight:700;">Reise planen</div>
                        <input id="reiseBudgetEdit" type="text" inputmode="decimal" value="${budget ? dependencies.formatInputBetrag(budget) : ""}" placeholder="Budget" enterkeyhint="next">
                        <div class="date-range">
                            <div class="date-field">
                                <label for="reiseVonEdit">Von</label>
                                <input id="reiseVonEdit" type="date" value="${dependencies.escapeHtml(meta.von || "")}">
                            </div>
                            <div class="date-field">
                                <label for="reiseBisEdit">Bis</label>
                                <input id="reiseBisEdit" type="date" value="${dependencies.escapeHtml(meta.bis || "")}">
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
                            <div><div style="font-size:12px;opacity:.65;">Budget</div><strong>${dependencies.formatBetrag(budget)}</strong></div>
                            <div><div style="font-size:12px;opacity:.65;">Ausgegeben</div><strong>${dependencies.formatBetrag(ausgegeben)}</strong></div>
                            <div><div style="font-size:12px;opacity:.65;">Übrig</div><strong>${dependencies.formatBetrag(uebrig)}</strong></div>
                        </div>` : `
                        <div style="opacity:.7;">Noch kein Budget festgelegt.</div>`}
                    <div style="font-size:13px;opacity:.72;">🗓️ ${zeitraum}</div>
                </div>`;
        }

        function saveReiseBudget() {
            if (!context.session.aktuellesLand) return;
            const budget = dependencies.parseBetrag(document.getElementById("reiseBudgetEdit")?.value) || 0;
            const von = document.getElementById("reiseVonEdit")?.value || "";
            const bis = document.getElementById("reiseBisEdit")?.value || "";
            if (von && bis && bis < von) {
                alert("Das Enddatum darf nicht vor dem Startdatum liegen.");
                return;
            }
            context.repository.view.ReisenMeta ||= {};
            context.repository.view.ReisenMeta[context.session.aktuellesLand] = { budget, von, bis };
            if (dependencies.speichern() === false) return;
            context.session.state.reiseBudgetEdit = false;
            renderReiseBudget();
            renderLaender();
        }

        function backToReisen() {
            context.session.aktuellesLand = null;
            context.session.state.editLandName = null;
            context.session.state.editReiseId = null;

            dependencies.show("reisen");
            renderLaender();
        }

        function updateDropdown() {
            let select = document.getElementById("kategorieSelect");
            if (!select || !context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;

            select.innerHTML = "";

            Object.keys(context.repository.view.Reisen[context.session.aktuellesLand]).forEach(k => {
                let opt = document.createElement("option");
                opt.value = k;
                opt.innerText = k;
                select.appendChild(opt);
            });

            const letzte = dependencies.getLetzteKategorie("reisen", "Essen");
            if ([...select.options].some(o => o.value === letzte)) select.value = letzte;
        }

        function addKategorie() {
            let name = prompt("Neue Kategorie?");
            if (!name) return;
            name = name.trim();
            if (!name) return;

            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;

            name = name.charAt(0).toUpperCase() + name.slice(1);

            if (!Object.hasOwn(context.repository.view.Reisen[context.session.aktuellesLand], name)) {
                Object.defineProperty(context.repository.view.Reisen[context.session.aktuellesLand], name, { value: [], enumerable: true, writable: true, configurable: true });
            }

            if (dependencies.speichern() === false) return;
            updateDropdown();
            renderListe();
        }

        function addEintrag() {

            let kat = document.getElementById("kategorieSelect").value;
            let betrag = dependencies.parseBetrag(document.getElementById("betrag").value);
            let text = document.getElementById("text").value;
            let datum = document.getElementById("datum").value;

            if (isNaN(betrag)) return;
            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;

            if (!context.repository.view.Reisen[context.session.aktuellesLand][kat]) {
                console.warn("❌ Kategorie existiert nicht:", kat);
                return;
            }

            dependencies.merkeLetzteKategorie("reisen", kat);
            if (dependencies.addItem(context.repository.view.Reisen[context.session.aktuellesLand][kat], {
                id: dependencies.generateId(),
                betrag,
                text,
                datum,
                ...dependencies.readReminderControl("add:reisen")
            }) === false) return;

            const betragInput = document.getElementById("betrag");
            const textInput = document.getElementById("text");
            if (betragInput) betragInput.value = "";
            if (textInput) textInput.value = "";
            const datumInput = document.getElementById("datum");
            if (datumInput) datumInput.value = dependencies.heuteISO();

            renderListe();
            renderKategorienUebersicht();
            renderReiseBudget();
            renderLaender();
            dependencies.applyLetzteReiseKategorie();
            if (!document.getElementById("startQuickAddSheet")?.classList.contains("hidden")) dependencies.closeStartQuickAdd();
            dependencies.renderHomeUebersicht();
        }

        function toggleKategorie(k) {

            // sicherstellen, dass state existiert
            if (!context.session.state.offeneKategorie) {
                context.session.state.offeneKategorie = null;
            }

            context.session.state.offeneKategorie = (context.session.state.offeneKategorie === k ? null : k);

            renderKategorienUebersicht();
        }

        function renderListe() {

            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;

            let div = document.getElementById("kategorienUebersicht");
            if (!div) return;

            div.innerHTML = "";

            const hatReiseAusgaben = Object.values(context.repository.view.Reisen[context.session.aktuellesLand] || {}).some(liste => Array.isArray(liste) && liste.length > 0);
            document.getElementById("reiseDeleteAllBtn")?.classList.toggle("hidden", !hatReiseAusgaben);

            let gesamt = 0;
            const suche = dependencies.getSearchTerm("reiseEintragSuche");

            for (let k in context.repository.view.Reisen[context.session.aktuellesLand]) {

                const alleEintraege = Array.isArray(context.repository.view.Reisen[context.session.aktuellesLand][k]) ? context.repository.view.Reisen[context.session.aktuellesLand][k] : [];
                const gefilterteEintraege = alleEintraege
                    .filter(e => !dependencies.istEintragAusgeblendet("reisen", e.id))
                    .filter(e => dependencies.matchesSearch(suche, k, e.text, e.datum, e.betrag))
                    .sort((a,b) => dependencies.datumZeitwert(b.datum) - dependencies.datumZeitwert(a.datum));
                if (suche && !dependencies.matchesSearch(suche, k) && gefilterteEintraege.length === 0) continue;

                let sum = alleEintraege
                    .filter(e => dependencies.matchesSearch(suche, k, e.text, e.datum, e.betrag))
                    .reduce((a, b) => a + (b.betrag || 0), 0);

                gesamt += sum;

                let item = document.createElement("div");
                item.className = "item";

                const editingCategory = context.session.state.editKategorieName === k;
                const categoryMain = document.createElement("div");
                categoryMain.style.cssText = `display:flex; align-items:center; min-width:0; flex:1; cursor:${editingCategory ? 'default' : 'pointer'}; padding:4px 0;`;
                if (editingCategory) {
                    const input = document.createElement("input");
                    input.id = "editKategorie-" + dependencies.safeId(k);
                    input.value = k;
                    input.addEventListener("click", event => event.stopPropagation());
                    categoryMain.appendChild(input);
                } else {
                    const label = document.createElement("span");
                    label.style.cssText = "font-weight:600; overflow-wrap:anywhere;";
                    label.textContent = k + " – " + dependencies.formatBetragText(sum);
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
                if (context.session.state.editKategorieName === k) {
                    setTimeout(() => dependencies.setupKategorieEditEnterFlow(k), 10);
                }

                // Einträge
                if (context.session.state.offeneKategorie === k) {

                    let letzteReiseDatumsGruppe = null;
                    gefilterteEintraege.forEach(e => {
                        const gruppenKey = e.datum || "ohne-datum";
                        if (gruppenKey !== letzteReiseDatumsGruppe) {
                            dependencies.appendDateGroupHeader(div, e.datum, { first: false, inset: true });
                            letzteReiseDatumsGruppe = gruppenKey;
                        }

                        let sub = document.createElement("div");
                        sub.className = "item";
                        sub.style.marginLeft = "20px";
                        sub.style.background = "#3a3a3c";

                        if (context.session.state.editReiseId === e.id) {

                            sub.innerHTML = `
                        <input id="editBetrag-${e.id}" type="text" inputmode="decimal" value="${dependencies.formatInputBetrag(e.betrag)}" placeholder="Betrag" enterkeyhint="next">
                        <input id="editText-${e.id}" value="${dependencies.escapeHtml(e.text || "")}" autocapitalize="words" placeholder="Genauere Beschreibung (optional)" enterkeyhint="next">
                        <input id="editDatum-${e.id}" type="date" value="${e.datum || ""}">

                        <div class="actions">
                            <button onclick="saveEditReise(${e.id})">💾</button>
                            <button onclick="cancelEditReise()">❌</button>
                        </div>
                    `;

                            setTimeout(() => dependencies.setupReiseEditEnterFlow(e.id), 10);
                        }

                        else {
                            const reiseOffen = !!context.session.state.offeneReiseEintraege[String(e.id)];
                            const reiseBeschreibung = dependencies.escapeHtml(e.text || '');
                            sub.innerHTML = `
                        <div style="display:flex; flex-direction:column; width:100%; gap:10px;">
                            <div style="display:grid; grid-template-columns:minmax(0,1fr) auto; width:100%; gap:10px; align-items:center;">
                                <div onclick="toggleReiseDetails('${e.id}')"
                                     style="display:flex; align-items:flex-start; gap:10px; min-width:0; cursor:pointer;">
                                    <div style="display:flex; flex-direction:column; min-width:0; gap:4px;">
                                        <span style="font-weight:700; overflow-wrap:anywhere;">${dependencies.escapeHtml(k)}</span>
                                        <strong style="font-size:18px;">${dependencies.formatBetrag(e.betrag)}</strong>
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
                                    <div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.7;">Datum</span><span style="font-weight:600;text-align:right;">${e.datum ? dependencies.formatDatum(e.datum) : '-'}</span></div>
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
                                🗑️ Alle ${dependencies.escapeHtml(k)}-Ausgaben löschen
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
            if (gesamtEl) gesamtEl.innerText = "Gesamt: " + dependencies.formatBetragText(gesamt);
            renderReiseBudget();
        }

        function toggleReiseDetails(id) {
            const key = String(id);
            context.session.state.offeneReiseEintraege[key] = !context.session.state.offeneReiseEintraege[key];
            renderKategorienUebersicht();
        }

        function editKategorie(k) {

            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;

            let neuerName = prompt("Neuer Name:", k);
            if (!neuerName) return;

            neuerName = neuerName.charAt(0).toUpperCase() + neuerName.slice(1);

            if (context.repository.view.Reisen[context.session.aktuellesLand][neuerName]) {
                alert("Kategorie existiert bereits!");
                return;
            }

            context.repository.view.Reisen[context.session.aktuellesLand][neuerName] = context.repository.view.Reisen[context.session.aktuellesLand][k];
            delete context.repository.view.Reisen[context.session.aktuellesLand][k];

            if (dependencies.speichern() === false) return;
            updateDropdown();
            renderListe();
        }

        function clearKategorie(k) {

            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;
            if (!context.repository.view.Reisen[context.session.aktuellesLand][k]) return;

            if (!confirm(`Alle Ausgaben aus „${k}“ löschen?`)) return;

            context.repository.view.Reisen[context.session.aktuellesLand][k] = [];

            if (dependencies.speichern() === false) return;
            renderListe();
        }

        function deleteKategorie(k) {

            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;
            if (!context.repository.view.Reisen[context.session.aktuellesLand][k]) return;

            if (!confirm("Kategorie wirklich löschen?")) return;

            // 🔥 sicherstellen
            if (!context.repository.view.geloeschteKategorien[context.session.aktuellesLand]) {
                context.repository.view.geloeschteKategorien[context.session.aktuellesLand] = [];
            }

            // 🔥 keine Duplikate
            if (!context.repository.view.geloeschteKategorien[context.session.aktuellesLand].includes(k)) {
                context.repository.view.geloeschteKategorien[context.session.aktuellesLand].push(k);
            }

            delete context.repository.view.Reisen[context.session.aktuellesLand][k];

            if (dependencies.speichern() === false) return;
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
            dependencies.beginUndoDelete(`Reise „${land}“ gelöscht`);

            if (context.repository.view.Reisen && context.repository.view.Reisen[land]) {
                delete context.repository.view.Reisen[land];
            }
            if (context.repository.view.ReisenMeta?.[land]) {
                delete context.repository.view.ReisenMeta[land];
            }

            // 🔥 auch gelöschte Kategorien entfernen
            if (context.repository.view.geloeschteKategorien && context.repository.view.geloeschteKategorien[land]) {
                delete context.repository.view.geloeschteKategorien[land];
            }

            if (dependencies.speichern() === false) return;
            renderLaender();
            dependencies.finishUndoDelete(`Reise „${land}“ gelöscht`);
        }

        function clearLand() {

            if (!context.session.aktuellesLand || !context.repository.view.Reisen?.[context.session.aktuellesLand]) return;

            if (!confirm("Wirklich ALLE Kosten in diesem Land löschen?")) return;
            dependencies.beginUndoDelete("Alle Reisekosten gelöscht");

            for (let k in context.repository.view.Reisen[context.session.aktuellesLand]) {
                if (Array.isArray(context.repository.view.Reisen[context.session.aktuellesLand][k])) {
                    context.repository.view.Reisen[context.session.aktuellesLand][k] = [];
                }
            }

            if (dependencies.speichern() === false) return;
            renderListe();
            dependencies.finishUndoDelete("Alle Reisekosten gelöscht");
        }

        function startEditReise(id) {

            context.session.state.editReiseId = id;

            renderListe();
        }

        function saveEditReise(id) {

            if (!context.session.aktuellesLand || !context.repository.view.Reisen?.[context.session.aktuellesLand]) return;

            let textEl = document.getElementById("editText-" + id);
            let betragEl = document.getElementById("editBetrag-" + id);
            let datumEl = document.getElementById("editDatum-" + id);

            if (!textEl || !betragEl || !datumEl) return;

            let text = textEl.value;
            let betrag = dependencies.parseBetrag(betragEl.value);
            let datum = datumEl.value;

            if (!text || isNaN(betrag) || !datum) return;

            for (let k in context.repository.view.Reisen[context.session.aktuellesLand]) {

                let liste = context.repository.view.Reisen[context.session.aktuellesLand][k];

                let eintrag = liste.find(e => String(e.id) === String(id));

                if (eintrag) {

                    eintrag.text = text;
                    eintrag.betrag = betrag;
                    eintrag.datum = datum;
                    Object.assign(eintrag, dependencies.readReminderControl(`edit:reisen:${id}`));

                    break;
                }
            }

            if (dependencies.speichern() === false) return;
            context.session.state.editReiseId = null; // 👈 vereinheitlicht
            renderListe();
        }

        function cancelEditReise() {
            context.session.state.editReiseId = null;
            renderListe();
        }

        function saveEditKategorie(oldName) {

            if (!context.session.aktuellesLand || !context.repository.view.Reisen?.[context.session.aktuellesLand]) return;

            let input = document.getElementById("editKategorie-" + dependencies.safeId(oldName));
            if (!input) return;

            let newName = input.value.trim();
            if (!newName) return;

            newName = newName.charAt(0).toUpperCase() + newName.slice(1);

            let land = context.repository.view.Reisen[context.session.aktuellesLand];

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
            if (context.session.state.offeneKategorie === oldName) context.session.state.offeneKategorie = newName;
            if (dependencies.getLetzteKategorie("reisen", "Essen") === oldName) dependencies.merkeLetzteKategorie("reisen", newName);
            if (dependencies.speichern() === false) return;
            context.session.state.editKategorieName = null;
            updateDropdown();
            renderListe();
        }

        function cancelEditKategorie() {
            context.session.state.editKategorieName = null;
            renderListe();
        }

        function startEditKategorie(name) {
            context.session.state.editKategorieName = name;
            renderListe();
        }

        function editLand(oldName) {

            if (!context.repository.view.Reisen) return;

            let neuerName = prompt("Neuer Name:", oldName);
            if (!neuerName) return;

            neuerName = neuerName.trim();
            if (!neuerName) return;

            if (neuerName === oldName) return;

            neuerName = neuerName.charAt(0).toUpperCase() + neuerName.slice(1);

            let reisen = context.repository.view.Reisen;

            if (reisen[neuerName]) {
                alert("Land existiert bereits!");
                return;
            }

            if (!reisen[oldName]) return;

            reisen[neuerName] = reisen[oldName];
            delete reisen[oldName];

            if (!context.repository.view.geloeschteKategorien) {
                context.repository.view.geloeschteKategorien = {};
            }

            if (context.repository.view.geloeschteKategorien[oldName]) {
                context.repository.view.geloeschteKategorien[neuerName] =
                    context.repository.view.geloeschteKategorien[oldName];

                delete context.repository.view.geloeschteKategorien[oldName];
            }

            if (dependencies.speichern() === false) return;
            renderLaender();
        }

        function startEditLand(name) {

            context.session.state.editLandName = name;

            renderLaender();

            requestAnimationFrame(() => {

                let input = document.getElementById("editLand-" + dependencies.safeId(name));

                if (input) {
                    input.focus();
                    input.select();
                }
            });
        }

        function saveEditLand(oldName) {

            if (!context.repository.view.Reisen) return;

            let input = document.getElementById("editLand-" + dependencies.safeId(oldName));
            if (!input) return;

            let newName = input.value.trim();
            if (!newName) return;

            if (newName === oldName) {
                context.session.state.editLandName = null;
                renderLaender();
                return;
            }

            newName = newName.charAt(0).toUpperCase() + newName.slice(1);

            let reisen = context.repository.view.Reisen;

            if (reisen[newName]) {
                alert("Land existiert bereits!");
                return;
            }

            if (!reisen[oldName]) return;

            reisen[newName] = reisen[oldName];
            delete reisen[oldName];
            context.repository.view.ReisenMeta ||= {};
            if (context.repository.view.ReisenMeta[oldName]) {
                context.repository.view.ReisenMeta[newName] = context.repository.view.ReisenMeta[oldName];
                delete context.repository.view.ReisenMeta[oldName];
            }

            if (!context.repository.view.geloeschteKategorien) {
                context.repository.view.geloeschteKategorien = {};
            }

            if (context.repository.view.geloeschteKategorien[oldName]) {

                context.repository.view.geloeschteKategorien[newName] =
                    context.repository.view.geloeschteKategorien[oldName];

                delete context.repository.view.geloeschteKategorien[oldName];
            }

            if (dependencies.speichern() === false) return;
            context.session.state.editLandName = null;
            renderLaender();
        }

        function cancelEditLand() {
            context.session.state.editLandName = null;
            renderLaender();
        }

        function reisenGesamt() {
            let sum = 0;
            if (!context.repository.view.Reisen) return 0;
            Object.values(context.repository.view.Reisen).forEach(land => {
                if (!land || typeof land !== "object") return;
                Object.values(land).forEach(liste => {
                    if (!Array.isArray(liste)) return;
                    liste.forEach(e => sum += dependencies.parseBetrag(e.betrag) || 0);
                });
            });
            return sum;
        }

function bookReisePlannedOccurrence(entry, datum, occurrenceKey, wiederholung) {
    const reise = context.repository.view.Reisen?.[entry.land || ""]; if (!reise) return false;
    const kategorie = entry.kategorie || "Sonstiges"; reise[kategorie] ??= [];
    const exists = reise[kategorie].some(x => String(x.geplantOccurrenceKey || "") === occurrenceKey || (wiederholung === "einmalig" && String(x.geplantId || "") === String(entry.id)));
    if (!exists) reise[kategorie].push({id:dependencies.generateId(), geplantId:entry.id, geplantOccurrenceKey:occurrenceKey, ausGeplant:true,
        text:entry.text || kategorie || "Geplante Ausgabe", betrag:dependencies.parseBetrag(entry.betrag)||0, datum});
    return true;
}

function editEintrag(k, i) {

            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;

            let eintrag = context.repository.view.Reisen[context.session.aktuellesLand][k][i];
            if (!eintrag) return;

            let neuerText = prompt("Beschreibung:", eintrag.text);
            if (neuerText === null) return;

            let neuerBetrag = prompt("Betrag:", eintrag.betrag);
            if (neuerBetrag === null) return;

            let neuesDatum = prompt("Datum (YYYY-MM-DD):", eintrag.datum);
            if (neuesDatum === null) return;

            context.repository.view.Reisen[context.session.aktuellesLand][k][i] = {
                ...eintrag,
                text: neuerText,
                betrag: dependencies.parseBetrag(neuerBetrag),
                datum: neuesDatum
            };

            if (dependencies.speichern() === false) return;
            renderListe();
        }

function deleteEintrag(k, i) {

            if (!confirm("Eintrag wirklich löschen?")) return;
            dependencies.beginUndoDelete("Reiseausgabe gelöscht");

            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;
            if (!context.repository.view.Reisen[context.session.aktuellesLand][k]) return;

            context.repository.view.Reisen[context.session.aktuellesLand][k].splice(i, 1);

            if (dependencies.speichern() === false) return;
            renderListe();
            dependencies.finishUndoDelete("Reiseausgabe gelöscht");
        }

return { addLand, renderLaender, openLand, reiseGesamtAusgegeben, renderReiseBudget, saveReiseBudget, backToReisen, updateDropdown, addKategorie, addEintrag, toggleKategorie, renderListe, toggleReiseDetails, editKategorie, clearKategorie, deleteKategorie, renderKategorienUebersicht, deleteLand, clearLand, startEditReise, saveEditReise, cancelEditReise, saveEditKategorie, cancelEditKategorie, startEditKategorie, editLand, startEditLand, saveEditLand, cancelEditLand, reisenGesamt, bookReisePlannedOccurrence, editEintrag, deleteEintrag };
});
