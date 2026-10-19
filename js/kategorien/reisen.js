Kostentracker.module({
  "id": "js/kategorien/reisen.js",
  "dependencies": [
    "addItem",
    "appendDateGroupHeader",
    "applyLetzteReiseKategorie",
    "isTravelMode", "activeHomeTrips", "openTravelOverview",
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
    "speichern",
    "getNewReiseCurrency",
    "getNewReiseCurrencyCountry",
    "resetNewReiseCurrency",
    "renderReiseCurrencySelector",
    "setReiseCurrency",
    "initExistingReiseCurrency",
    "reiseBudgetPresentation",
    "getReiseCurrency",
    "requestReiseBudgetRate",
    "refreshReiseQuickAmounts",
    "formatReiseBudgetAmount",
    "renderReiseBudgetToggle",
    "renderReiseBudgetRateNote",
    "prepareReiseBudgetRate",
    "readEntryTime",
    "renderEntryTime",
    "renderEntryTimeInput",
    "compareEntriesNewest"
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
            const currency = dependencies.getNewReiseCurrency();
            if (!currency) { alert("Bitte eine Währung für die Reise auswählen."); return; }
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
                "Essen / Trinken": [],
                Transport: [],
                Unterkunft: [],
                Aktivität: [],
                Einkauf: [],
                Sonstiges: []
            };
            context.repository.view.ReisenMeta ||= {};
            context.repository.view.ReisenMeta[name] = { budget, von, bis, currency, currencyCountry:dependencies.getNewReiseCurrencyCountry() };

            if (dependencies.speichern() === false) return;
            document.getElementById("landInput").value = "";
            dependencies.resetNewReiseCurrency();
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
                item.className = "item land-item" + (context.session.state.editLandName === land ? " land-editing" : "");
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

                    editBtn.innerText = "Speichern";
                    editBtn.className = "btn btn-primary";
                    editBtn.type = "button";
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

                    cancelBtn.innerText = "Abbrechen";
                    cancelBtn.className = "btn";
                    cancelBtn.type = "button";
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
            if (dependencies.isTravelMode?.() && !dependencies.activeHomeTrips().includes(l)) {
                dependencies.openTravelOverview(); return;
            }

            // 🔥 WICHTIG: alten Zustand sauber zurücksetzen
            context.session.state.editLandName = null;
            context.session.state.editReiseId = null;
            context.session.state.reiseBudgetEdit = false;

            context.session.aktuellesLand = l;
            dependencies.initExistingReiseCurrency(l);

            dependencies.show("land");

            document.getElementById("landTitel").innerText = l;
            renderReiseBudget();

            document.getElementById("datum").value =
                dependencies.heuteISO();

            updateDropdown();
            renderKategorienUebersicht();
            dependencies.applyLetzteReiseKategorie();
            dependencies.setupReisenEnterFlow();
            prepareReiseExpenseRate(true);
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
            const presentation = dependencies.reiseBudgetPresentation();
            const zeitraum = meta.von || meta.bis
                ? `${meta.von ? dependencies.formatDatum(meta.von) : "…"} – ${meta.bis ? dependencies.formatDatum(meta.bis) : "…"}`
                : "Kein Zeitraum festgelegt";

            if (context.session.state.reiseBudgetEdit) {
                box.innerHTML = `
                    <div class="item reise-budget-editor">
                        <div class="reise-budget-editor-title">Reise planen</div>
                        <input id="reiseBudgetEdit" type="text" inputmode="decimal" value="${budget ? dependencies.formatInputBetrag(budget) : ""}" placeholder="Budget in Euro" enterkeyhint="next">
                        <div class="reise-currency-settings"><span>Reisewährung</span>${dependencies.renderReiseCurrencySelector(true)}</div>
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
                        <div class="reise-form-actions">
                            <button type="button" onclick="saveReiseBudget()" class="btn btn-primary">Speichern</button>
                            <button type="button" onclick="setReiseBudgetEditing(false)" class="btn reise-form-cancel">Abbrechen</button>
                        </div>
                    </div>`;
                return;
            }

            box.innerHTML = `
                <div class="item reise-budget-card">
                    <div class="reise-budget-heading">
                        <div class="reise-budget-title">Reisebudget</div>
                        ${dependencies.renderReiseBudgetToggle()}
                        <button type="button" onclick="setReiseBudgetEditing(true)" class="reise-budget-edit" aria-label="Reisebudget bearbeiten" title="Budget bearbeiten">
                            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/></svg>
                        </button>
                    </div>
                    ${budget > 0 ? `
                        <div class="reise-budget-values${presentation.local ? ' reise-budget-values-local' : ''}">
                            <div><div style="font-size:12px;opacity:.65;">Budget</div><strong class="reise-budget-value">${dependencies.formatReiseBudgetAmount(budget)}</strong></div>
                            <div><div style="font-size:12px;opacity:.65;">Ausgegeben</div><strong class="reise-budget-value">${dependencies.formatReiseBudgetAmount(ausgegeben)}</strong></div>
                            <div><div style="font-size:12px;opacity:.65;">Übrig</div><strong class="reise-budget-value">${dependencies.formatReiseBudgetAmount(uebrig)}</strong></div>
                        </div>` : `
                        <div style="opacity:.7;">Noch kein Budget festgelegt.</div>`}
                    <div style="font-size:13px;opacity:.72;">🗓️ ${zeitraum}</div>
                    <div class="reise-currency-note reise-budget-rate-note" role="status">${dependencies.renderReiseBudgetRateNote()}</div>
                </div>`;
        }

        function setReiseBudgetEditing(enabled) {
            context.session.state.reiseBudgetEdit = !!enabled;
            renderReiseBudget();
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
            context.repository.view.ReisenMeta[context.session.aktuellesLand] = { ...context.repository.view.ReisenMeta[context.session.aktuellesLand], budget, von, bis };
            const currencyChoice = document.getElementById("reiseCurrencySelect")?.value;
            if (currencyChoice) dependencies.setReiseCurrency(currencyChoice, false);
            if (dependencies.speichern() === false) return;
            context.session.state.reiseBudgetEdit = false;
            renderReiseBudget();
            renderLaender();
            prepareReiseExpenseRate();
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

            const letzte = dependencies.getLetzteKategorie("reisen", "Essen / Trinken");
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

        function getReiseInputCurrency() {
            const quote = dependencies.getReiseCurrency() || 'EUR';
            const state = context.session.state;
            if (state.reiseInputLand !== context.session.aktuellesLand || state.reiseInputQuote !== quote) {
                state.reiseInputLand = context.session.aktuellesLand;
                state.reiseInputQuote = quote;
                state.reiseInputCurrency = quote;
            }
            return state.reiseInputCurrency === 'EUR' ? 'EUR' : quote;
        }
        function prepareReiseExpenseRate(reset = false) {
            if (reset) {
                context.session.state.reiseInputLand = null;
                const input = document.getElementById("betrag");
                if (input) input.value = "";
            }
            updateReiseAmountPreview();
            if ((dependencies.getReiseCurrency() || 'EUR') !== 'EUR') dependencies.requestReiseBudgetRate();
        }
        function toggleReiseInputCurrency() {
            const quote = dependencies.getReiseCurrency() || 'EUR';
            if (quote === 'EUR') return;
            const current = getReiseInputCurrency(), input = document.getElementById('betrag');
            const amount = dependencies.parseBetrag(input?.value), record = dependencies.reiseBudgetPresentation().record;
            if (input?.value.trim() && Number.isFinite(amount)) {
                if (!record) { alert('Zum Umrechnen des eingegebenen Betrags fehlt noch der Kurs. Leere das Feld, um die Eingabewährung zu wechseln.'); return; }
                const value = current === 'EUR' ? amount * record.rate : amount / record.rate;
                const target = current === 'EUR' ? quote : 'EUR';
                const digits = new Intl.NumberFormat('de-DE',{style:'currency',currency:target}).resolvedOptions().maximumFractionDigits;
                input.value = value.toFixed(digits).replace('.', ',');
            }
            context.session.state.reiseInputCurrency = current === 'EUR' ? quote : 'EUR';
            updateReiseAmountPreview();
            dependencies.refreshReiseQuickAmounts();
        }
        function updateReiseAmountPreview() {
            const input = document.getElementById('betrag'), note = document.getElementById('reiseAmountPreview'), button = document.getElementById('reiseInputCurrencyToggle');
            if (!input || !note) return;
            const quote = dependencies.getReiseCurrency() || 'EUR', currency = getReiseInputCurrency();
            input.placeholder = 'Betrag in ' + currency;
            input.setAttribute('aria-label', 'Betrag in ' + currency);
            if (button) { button.textContent = currency + ' ⇄'; button.disabled = quote === 'EUR'; button.setAttribute('aria-label','Eingabewährung auf ' + (currency === 'EUR' ? quote : 'EUR') + ' wechseln'); }
            const amount = dependencies.parseBetrag(input.value), record = dependencies.reiseBudgetPresentation().record;
            if (quote === 'EUR') { note.textContent = 'Ausgabe in Euro'; return; }
            if (!record) { note.textContent = currency === 'EUR' ? 'Eurobetrag speicherbar · Umrechnungskurs fehlt' : 'Kurs fehlt · Fremdwährungsbetrag noch nicht speicherbar'; return; }
            const target = currency === 'EUR' ? quote : 'EUR';
            const converted = Number.isFinite(amount) ? (currency === 'EUR' ? amount * record.rate : Math.round(amount / record.rate * 100) / 100) : null;
            const formatted = converted === null ? 'Umrechnung in ' + target : target === 'EUR' ? dependencies.formatBetragText(converted) : new Intl.NumberFormat('de-DE',{style:'currency',currency:target,currencyDisplay:'code'}).format(converted);
            note.textContent = (converted === null ? formatted : '≈ ' + formatted) + ' · ' + dependencies.formatDatum(record.date) + (navigator.onLine === false ? ' · Offlinekurs' : '');
            note.setAttribute('title','Referenzkurs vom ' + dependencies.formatDatum(record.date) + ' · Richtwert');
        }
        function entryFxDetails(entry, details = false) {
            const fx = entry.fx;
            if (!fx || !Number.isFinite(fx.amount) || !Number.isFinite(fx.rate) || fx.rate <= 0 || !/^[A-Z]{3}$/.test(fx.currency)) return '';
            const displayCurrency = fx.currency === 'EUR' && fx.counterCurrency ? fx.counterCurrency : fx.currency;
            const displayAmount = fx.currency === 'EUR' && fx.counterCurrency ? fx.amount * fx.counterRate : fx.amount;
            const original = (fx.currency === 'EUR' && fx.counterCurrency ? '≈ ' : '') + new Intl.NumberFormat('de-DE', {style:'currency',currency:displayCurrency,currencyDisplay:'code'}).format(displayAmount);
            return details ? `<div style="opacity:.7;">${fx.rateSource === 'bank' ? 'Bankabrechnung vom' : 'Umrechnungskurs vom'} ${dependencies.escapeHtml(dependencies.formatDatum(fx.date))}${fx.rateSource === 'bank' ? '' : ' · Richtwert'}</div>` : `<div class="reise-original-amount">${original}</div>`;
        }

        function addEintrag() {

            let kat = document.getElementById("kategorieSelect").value;
            let betrag = dependencies.parseBetrag(document.getElementById("betrag").value);
            let text = document.getElementById("text").value;
            let datum = document.getElementById("datum").value;

            if (!Number.isFinite(betrag) || betrag <= 0) return;
            const currency = getReiseInputCurrency();
            let fx;
            if (currency !== 'EUR') {
                const record = dependencies.reiseBudgetPresentation().record;
                if (!record) { alert('Noch kein Wechselkurs verfügbar. Bitte mit Internet den Kurs laden und danach erneut Hinzufügen antippen.'); prepareReiseExpenseRate(); return; }
                fx = { amount: betrag, currency, rate: record.rate, date: record.date };
                betrag = Math.round(betrag / record.rate * 100) / 100;
                if (betrag <= 0) { alert('Der umgerechnete Betrag ist kleiner als ein Cent.'); return; }
            }
            if (currency === 'EUR') {
                betrag = Math.round(betrag * 100) / 100;
                const quote = dependencies.getReiseCurrency(), record = dependencies.reiseBudgetPresentation().record;
                if (quote && quote !== 'EUR' && record) fx = {amount:betrag,currency:'EUR',rate:1,date:record.date,counterCurrency:quote,counterRate:record.rate};
            }
            if (!context.session.aktuellesLand || !context.repository.view.Reisen[context.session.aktuellesLand]) return;

            if (!context.repository.view.Reisen[context.session.aktuellesLand][kat]) {
                console.warn("❌ Kategorie existiert nicht:", kat);
                return;
            }

            const zeit=dependencies.readEntryTime("reiseUhrzeit",datum);if(zeit===null)return;
            dependencies.merkeLetzteKategorie("reisen", kat);
            if (dependencies.addItem(context.repository.view.Reisen[context.session.aktuellesLand][kat], {
                id: dependencies.generateId(),
                betrag,
                ...(fx ? {fx} : {}),
                ...zeit,
                text,
                datum,
                ...dependencies.readReminderControl("add:reisen")
            }) === false) return;

            const betragInput = document.getElementById("betrag");
            const textInput = document.getElementById("text");
            if (betragInput) betragInput.value = "";
            updateReiseAmountPreview();
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
                    .sort(dependencies.compareEntriesNewest);
                if (suche && !dependencies.matchesSearch(suche, k) && gefilterteEintraege.length === 0) continue;

                let sum = alleEintraege
                    .filter(e => dependencies.matchesSearch(suche, k, e.text, e.datum, e.betrag))
                    .reduce((a, b) => a + (b.betrag || 0), 0);

                gesamt += sum;

                let item = document.createElement("div");
                item.className = "item reise-category-card" + ((context.session.state.offeneKategorie === k || context.session.state.editKategorieName === k) ? " reise-category-open" : "");

                const editingCategory = context.session.state.editKategorieName === k;
                const categoryMain = document.createElement("div");
                categoryMain.className = 'reise-category-main';
                categoryMain.style.cursor = editingCategory ? 'default' : 'pointer';
                if (editingCategory) {
                    const input = document.createElement("input");
                    input.id = "editKategorie-" + dependencies.safeId(k);
                    input.value = k;
                    input.addEventListener("click", event => event.stopPropagation());
                    categoryMain.appendChild(input);
                } else {
                    const label = document.createElement("span");
                    label.className = "reise-category-label";
                    label.textContent = k;
                    const amount = document.createElement("strong");
                    amount.className = "reise-category-amount";
                    amount.textContent = dependencies.formatBetragText(sum);
                    const chevron = document.createElement("span");
                    chevron.className = "reise-category-chevron";
                    chevron.setAttribute("aria-hidden", "true");
                    chevron.textContent = "›";
                    categoryMain.append(label, amount, chevron);
                    categoryMain.addEventListener("click", () => toggleKategorie(k));
                }
                const categoryActions = document.createElement("div");
                categoryActions.className = "actions reise-category-actions";
                categoryActions.style.cssText = "gap:8px; align-items:center;";
                const addCategoryAction = (label, className, action) => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = className;
                    button.textContent = label;
                    button.setAttribute("aria-label", (className === "edit" ? "Kategorie bearbeiten" : className === "delete" ? "Kategorie löschen" : label) + " · " + k);
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
                        sub.className = "item reise-entry-card";
                        sub.style.marginLeft = "12px";
                        sub.style.background = "#3a3a3c";

                        if (context.session.state.editReiseId === e.id) {

                            sub.innerHTML = `
                        <div style="font-size:13px;opacity:.75;">Betrag in ${e.fx ? e.fx.currency : 'EUR'}${e.fx ? ' · gespeicherter Kurs' : ''}</div>
                        <input id="editBetrag-${e.id}" type="text" inputmode="decimal" value="${dependencies.formatInputBetrag(e.fx ? e.fx.amount : e.betrag)}" placeholder="Betrag in ${e.fx ? e.fx.currency : 'EUR'}" enterkeyhint="next">
                        <input id="editText-${e.id}" value="${dependencies.escapeHtml(e.text || "")}" autocapitalize="words" placeholder="Genauere Beschreibung (optional)" enterkeyhint="next">
                        <div class="entry-date-time"><label><span>Datum</span><input id="editDatum-${e.id}" type="date" value="${e.datum || ""}"></label>${dependencies.renderEntryTimeInput(`editReiseUhrzeit-${e.id}`,e)}</div>

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
                            <div class="reise-entry-heading" onclick="toggleReiseDetails('${e.id}')">
                                <span class="reise-entry-label">${dependencies.escapeHtml(e.text || k)}${dependencies.renderEntryTime(e)}</span>
                                <div class="reise-entry-amounts"><strong class="reise-entry-amount">${dependencies.formatBetrag(e.betrag)}</strong>${entryFxDetails(e)}</div>
                            </div>
                            <div class="reise-entry-controls">
                                <div class="actions reise-entry-actions">
                                    <button onclick="event.stopPropagation(); moveAusgabe('reisen','${e.id}')" title="Verschieben">↪️</button>
                                    <button class="edit" onclick="event.stopPropagation(); startEditReise(${e.id})">✏️</button>
                                    <button class="delete" data-delete-reise>🗑️</button>
                                </div>
                            </div>
                            ${reiseOffen ? `
                                <div onclick="toggleReiseDetails('${e.id}')" style="background:#48484a;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:14px;cursor:pointer;">
                                    ${entryFxDetails(e, true)}
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
            // Prepare connected swipe rows synchronously, before the first paint.
            document.dispatchEvent(new CustomEvent('kostentracker:rowsRendered', {detail:{root:div}}));
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

            if (!text || !Number.isFinite(betrag) || betrag <= 0 || !datum) return;

            for (let k in context.repository.view.Reisen[context.session.aktuellesLand]) {

                let liste = context.repository.view.Reisen[context.session.aktuellesLand][k];

                let eintrag = liste.find(e => String(e.id) === String(id));

                if (eintrag) {

                    const zeit=dependencies.readEntryTime("editReiseUhrzeit-"+id,datum,eintrag);if(zeit===null)return;
                    Object.assign(eintrag,zeit);
                    eintrag.text = text;
                    if (eintrag.fx) {
                        eintrag.fx = {...eintrag.fx, amount: betrag};
                        eintrag.betrag = Math.round(betrag / eintrag.fx.rate * 100) / 100;
                    } else eintrag.betrag = betrag;
                    eintrag.datum = datum;
                    Object.assign(eintrag, dependencies.readReminderControl(`edit:reisen:${id}`));

                    break;
                }
            }

            if (dependencies.speichern() === false) return;
            context.session.state.editReiseId = null; // 👈 vereinheitlicht
            renderListe();
            renderReiseBudget();
            renderLaender();
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
            if (dependencies.getLetzteKategorie("reisen", "Essen / Trinken") === oldName) dependencies.merkeLetzteKategorie("reisen", newName);
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

function refreshReiseImportedViews() {
    if (!context.session.state.editLandName) renderLaender();
    if (context.session.aktuellesLand) {
        if (!context.session.state.reiseBudgetEdit) renderReiseBudget();
        if (!context.session.state.editReiseId) renderKategorienUebersicht();
    }
}
function appendReiseExternalExpense(entry,land,category) {
    const list=context.repository.view.Reisen?.[land]?.[category];
    if(!Array.isArray(list))throw new Error('Reisekategorie nicht mehr vorhanden.');
    list.push(entry);
}

function bookReisePlannedOccurrence(entry, datum, occurrenceKey, wiederholung) {
    const reise = context.repository.view.Reisen?.[entry.land || ""]; if (!reise) return false;
    const rawCategory = entry.kategorie || "Sonstiges";
    const kategorie = ["Essen", "Trinken", "Verpflegung", "Snacks", "Essen & Trinken"].includes(rawCategory) ? "Essen / Trinken" : rawCategory; reise[kategorie] ??= [];
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

            let neuerBetrag = prompt("Betrag in " + (eintrag.fx?.currency || "EUR") + ":", eintrag.fx?.amount ?? eintrag.betrag);
            if (neuerBetrag === null) return;

            let neuesDatum = prompt("Datum (YYYY-MM-DD):", eintrag.datum);
            if (neuesDatum === null) return;

            context.repository.view.Reisen[context.session.aktuellesLand][k][i] = {
                ...eintrag,
                text: neuerText,
                betrag: eintrag.fx ? Math.round(dependencies.parseBetrag(neuerBetrag) / eintrag.fx.rate * 100) / 100 : dependencies.parseBetrag(neuerBetrag),
                ...(eintrag.fx ? {fx:{...eintrag.fx,amount:dependencies.parseBetrag(neuerBetrag)}} : {}),
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

return { refreshReiseImportedViews, appendReiseExternalExpense, getReiseInputCurrency, toggleReiseInputCurrency, prepareReiseExpenseRate, updateReiseAmountPreview, entryFxDetails, addLand, renderLaender, openLand, reiseGesamtAusgegeben, renderReiseBudget, setReiseBudgetEditing, saveReiseBudget, backToReisen, updateDropdown, addKategorie, addEintrag, toggleKategorie, renderListe, toggleReiseDetails, editKategorie, clearKategorie, deleteKategorie, renderKategorienUebersicht, deleteLand, clearLand, startEditReise, saveEditReise, cancelEditReise, saveEditKategorie, cancelEditKategorie, startEditKategorie, editLand, startEditLand, saveEditLand, cancelEditLand, reisenGesamt, bookReisePlannedOccurrence, editEintrag, deleteEintrag };
});
