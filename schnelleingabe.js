// Kostentracker Test: js/ui/schnelleingabe.js
// Functions share the existing app state; initialize only in app/start.js.

        function getQuickAddFavoriten() {
            daten.Einstellungen ??= {};
            if (!Array.isArray(daten.Einstellungen.quickAddFavoriten)) daten.Einstellungen.quickAddFavoriten = [...QUICK_ADD_DEFAULT];
            return daten.Einstellungen.quickAddFavoriten;
        }

        function renderQuickAddMenu() {
            const host = document.getElementById("quickAddChoices");
            if (!host) return;
            host.innerHTML = "";
            const favoriten = getQuickAddFavoriten().filter(key => QUICK_ADD_OPTIONEN[key]);
            if (!favoriten.length) {
                host.innerHTML = '<div class="quick-add-empty">Keine Favoriten ausgewählt.<br>Du kannst sie unter Einstellungen → Schnelleingabe festlegen.</div>';
                return;
            }
            favoriten.forEach(key => {
                const option = QUICK_ADD_OPTIONEN[key];
                const btn = document.createElement("button");
                btn.className = "add-choice";
                btn.textContent = option.label;
                btn.addEventListener("click", option.action);
                host.appendChild(btn);
            });
        }

        function toggleQuickAddSettingsPanel(forceOpen) {
            const panel = document.getElementById("quickAddSettingsPanel");
            const btn = document.getElementById("quickAddSettingsToggle");
            if (!panel || !btn) return;
            const sollOeffnen = typeof forceOpen === "boolean" ? forceOpen : panel.classList.contains("hidden");
            panel.classList.toggle("hidden", !sollOeffnen);
            btn.setAttribute("aria-expanded", sollOeffnen ? "true" : "false");
            if (sollOeffnen) renderQuickAddSettings();
        }

        function getQuickAmounts() {
            const fallback = [5, 10, 20, 50];
            const values = daten.Einstellungen?.schnellbetraege;
            if (!Array.isArray(values) || values.length !== 4) return fallback;
            return values.map((wert, index) => {
                const n = parseBetrag(wert);
                return Number.isFinite(n) && n > 0 ? n : fallback[index];
            });
        }

        function renderQuickAmountSettings() {
            getQuickAmounts().forEach((wert, index) => {
                const input = document.getElementById(`quickAmount${index + 1}`);
                if (input) input.value = formatInputBetrag(wert);
            });
        }

        function saveQuickAmounts() {
            const values = [1,2,3,4].map(index => parseBetrag(document.getElementById(`quickAmount${index}`)?.value));
            if (values.some(v => !Number.isFinite(v) || v <= 0)) {
                alert("Bitte vier gültige Schnellbeträge größer als 0 eingeben.");
                return;
            }
            daten.Einstellungen.schnellbetraege = values;
            if (speichern() === false) return;
            renderQuickAmountSettings();
        }

        function renderQuickAddSettings() {
            const host = document.getElementById("quickAddSettingsList");
            if (!host) return;
            const aktiv = getQuickAddFavoriten();
            const reihenfolge = [...aktiv, ...QUICK_ADD_DEFAULT.filter(key => !aktiv.includes(key))];
            host.innerHTML = "";
            reihenfolge.forEach((key, index) => {
                const option = QUICK_ADD_OPTIONEN[key];
                if (!option) return;
                const row = document.createElement("div");
                row.className = "quick-fav-row";

                const label = document.createElement("label");
                label.className = "quick-fav-toggle";
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.checked = aktiv.includes(key);
                cb.addEventListener("change", () => toggleQuickAddFavorit(key, cb.checked));
                const text = document.createElement("span");
                text.className = "quick-fav-label";
                text.textContent = option.label;
                label.append(cb, text);

                const actions = document.createElement("div");
                actions.className = "quick-fav-actions";
                const activeIndex = aktiv.indexOf(key);
                const up = document.createElement("button");
                up.type = "button"; up.textContent = "↑"; up.setAttribute("aria-label", "Nach oben");
                up.disabled = activeIndex <= 0;
                up.addEventListener("click", () => moveQuickAddOption(key, -1));
                const down = document.createElement("button");
                down.type = "button"; down.textContent = "↓"; down.setAttribute("aria-label", "Nach unten");
                down.disabled = activeIndex < 0 || activeIndex >= aktiv.length - 1;
                down.addEventListener("click", () => moveQuickAddOption(key, 1));
                actions.append(up, down);
                row.append(label, actions);
                host.appendChild(row);
            });
        }

        function toggleQuickAddFavorit(key, aktivieren) {
            const aktuell = getQuickAddFavoriten();
            if (aktivieren) {
                if (!aktuell.includes(key)) aktuell.push(key);
            } else {
                daten.Einstellungen.quickAddFavoriten = aktuell.filter(x => x !== key);
            }
            if (speichern() === false) return;
            renderQuickAddSettings();
        }

        function moveQuickAddOption(key, richtung) {
            const aktiv = [...getQuickAddFavoriten()];
            const index = aktiv.indexOf(key);
            const neu = index + richtung;
            if (index < 0 || neu < 0 || neu >= aktiv.length) return;
            [aktiv[index], aktiv[neu]] = [aktiv[neu], aktiv[index]];
            daten.Einstellungen.quickAddFavoriten = aktiv;
            if (speichern() === false) return;
            renderQuickAddSettings();
        }

        function openAddSheet() {
            renderQuickAddMenu();
            document.getElementById("addSheet")?.classList.remove("hidden");
        }

        function closeAddSheet() {
            document.getElementById("addSheet")?.classList.add("hidden");
        }

        function prepareStartQuickAdd(panelId) {
            const today = heuteISO();
            const dateIds = {
                hausAddPanel: "hausDatum",
                freizeitAddPanel: "freizeitDatum",
                einnahmenAddPanel: "einnahmenDatum",
                kostenAddPanel: "costDatum",
                versAddPanel: "versDatum",
                reiseAddPanel: "datum"
            };
            const dateEl = document.getElementById(dateIds[panelId]);
            if (dateEl && !dateEl.value) dateEl.value = today;
            if (panelId === "versAddPanel") {
                const monat = document.getElementById("versMonat");
                if (monat) monat.value = String(getAktuellerMonat());
            }
            if (panelId === "hausAddPanel") applyLetzteAlltagsKategorie("haushalt");
            if (panelId === "freizeitAddPanel") applyLetzteAlltagsKategorie("freizeit");
            if (panelId === "reiseAddPanel") applyLetzteReiseKategorie(false);
        }

        function setQuickAmount(inputId, amount) {
            const input = document.getElementById(inputId);
            if (!input) return;
            input.value = String(amount).replace(".", ",");
            input.focus();
        }

        function prepareQuickEntryLayout(panelId) {
            const panel = document.getElementById(panelId);
            if (!panel) return;

            const config = {
                hausAddPanel: { amountId:"hausBetrag", textId:"hausText" },
                freizeitAddPanel: { amountId:"freizeitBetrag", textId:"freizeitText" },
                reiseAddPanel: { amountId:"betrag", textId:"text" }
            }[panelId];

            panel.classList.toggle("quick-entry-mode", !!config);
            panel.querySelectorAll(".quick-amount-row").forEach(el => el.remove());
            if (!config) return;

            const textInput = document.getElementById(config.textId);
            if (textInput) textInput.value = "";

            const amountInput = document.getElementById(config.amountId);
            if (!amountInput) return;
            const row = document.createElement("div");
            row.className = "quick-amount-row";
            row.setAttribute("aria-label", "Schnellbeträge");
            getQuickAmounts().forEach(amount => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "quick-amount-btn";
                btn.textContent = `${amount} €`;
                btn.addEventListener("click", () => setQuickAmount(config.amountId, amount));
                row.appendChild(btn);
            });
            amountInput.insertAdjacentElement("afterend", row);
        }

        function openStartQuickAdd(panelId, focusId) {
            closeAddSheet();
            closeStartQuickAdd();
            const panel = document.getElementById(panelId);
            const host = document.getElementById("startQuickAddHost");
            const sheet = document.getElementById("startQuickAddSheet");
            if (!panel || !host || !sheet) return;

            startQuickAddContext = {
                panel,
                parent: panel.parentNode,
                nextSibling: panel.nextSibling
            };
            host.appendChild(panel);
            panel.classList.remove("hidden");
            prepareStartQuickAdd(panelId);
            prepareQuickEntryLayout(panelId);
            sheet.classList.remove("hidden");

            setTimeout(() => {
                setupUniversalAddEnterFlow(panelId);
                document.getElementById(focusId)?.focus();
            }, 80);
        }

        function closeStartQuickAdd() {
            const sheet = document.getElementById("startQuickAddSheet");
            if (startQuickAddContext?.panel) {
                const {panel, parent, nextSibling} = startQuickAddContext;
                panel.querySelectorAll(".quick-amount-row").forEach(el => el.remove());
                panel.classList.remove("quick-entry-mode");
                panel.classList.add("hidden");
                if (parent) {
                    if (nextSibling && nextSibling.parentNode === parent) parent.insertBefore(panel, nextSibling);
                    else parent.appendChild(panel);
                }
            }
            startQuickAddContext = null;
            sheet?.classList.add("hidden");
        }

        function closeReiseAuswahlSheet() {
            document.getElementById("reiseAuswahlSheet")?.classList.add("hidden");
        }

        function openReiseAuswahlFromHome() {
            closeAddSheet();

            const sheet = document.getElementById("reiseAuswahlSheet");
            const choices = document.getElementById("reiseAuswahlChoices");
            if (!sheet || !choices) return;

            const laender = Object.keys(daten.Reisen || {}).sort((a, b) => a.localeCompare(b, "de"));
            const heute = heuteISO();
            const aktiveReisen = laender.filter(land => {
                const meta = daten.ReisenMeta?.[land];
                if (!meta?.von || !meta?.bis) return false;
                return heute >= meta.von && heute <= meta.bis;
            });

            // Ist heute genau eine Reise aktiv, wird sie bei der Schnelleingabe
            // automatisch gewaehlt und die zusaetzliche Laenderauswahl uebersprungen.
            if (aktiveReisen.length === 1) {
                aktuellesLand = aktiveReisen[0];
                updateDropdown();
                openStartQuickAdd("reiseAddPanel", "betrag");
                setTimeout(() => applyLetzteReiseKategorie(true), 30);
                return;
            }

            choices.innerHTML = "";

            if (!laender.length) {
                const info = document.createElement("div");
                info.style.cssText = "padding:12px 4px 16px;opacity:.72;line-height:1.45;";
                info.textContent = "Noch keine Reise vorhanden. Lege zuerst eine Reise an.";
                choices.appendChild(info);

                const neu = document.createElement("button");
                neu.className = "add-choice";
                neu.textContent = "＋ Reise anlegen";
                neu.addEventListener("click", () => {
                    closeReiseAuswahlSheet();
                    openReisen();
                    toggleCategoryAdd("reisenAddPanel", "landInput");
                });
                choices.appendChild(neu);
            } else {
                laender.forEach(land => {
                    const btn = document.createElement("button");
                    btn.className = "add-choice";
                    btn.textContent = "✈️ " + land;
                    btn.addEventListener("click", () => {
                        closeReiseAuswahlSheet();
                        aktuellesLand = land;
                        updateDropdown();
                        openStartQuickAdd("reiseAddPanel", "betrag");
                        setTimeout(() => applyLetzteReiseKategorie(true), 30);
                    });
                    choices.appendChild(btn);
                });
            }

            sheet.classList.remove("hidden");
        }

        function focusLater(id) {
            setTimeout(() => document.getElementById(id)?.focus(), 80);
        }

        function closeCategoryAddPanels() {
            ["reisenAddPanel","reiseAddPanel","versAddPanel","hausAddPanel","freizeitAddPanel","einnahmenAddPanel","kostenAddPanel","geplantAddPanel","sparenInvestierenAddPanel"].forEach(id => {
                document.getElementById(id)?.classList.add("hidden");
            });
        }

        function toggleCategoryAdd(panelId, focusId) {
            const panel = document.getElementById(panelId);
            if (!panel) return;
            const wirdGeoeffnet = panel.classList.contains("hidden");
            closeCategoryAddPanels();
            if (wirdGeoeffnet) {
                panel.classList.remove("hidden");
                resetAddReminderForPanel(panelId);
                prepareStartQuickAdd(panelId);
                setTimeout(() => {
                    const firstId = setupUniversalAddEnterFlow(panelId) || focusId;
                    document.getElementById(firstId)?.focus();
                }, 80);
            }
        }

        function toggleFreiDetails() {
            state.freiDetailsOffen = !state.freiDetailsOffen;
            renderHomeUebersicht();
        }

        function getLetzteKategorie(bereich, fallback) {
            const lk = daten.Einstellungen?.letzteKategorien || {};
            if (bereich === "reisen") return lk.reisen?.[aktuellesLand] || fallback;
            return lk[bereich] || fallback;
        }

        function merkeLetzteKategorie(bereich, kategorie) {
            daten.Einstellungen ??= {};
            daten.Einstellungen.letzteKategorien ??= { haushalt: "Einkauf", freizeit: "Essen / Trinken", reisen: {} };
            if (bereich === "reisen") {
                daten.Einstellungen.letzteKategorien.reisen ??= {};
                if (aktuellesLand) daten.Einstellungen.letzteKategorien.reisen[aktuellesLand] = kategorie;
            } else {
                daten.Einstellungen.letzteKategorien[bereich] = kategorie;
            }
        }

        function applyLetzteAlltagsKategorie(bereich) {
            const isHaus = bereich === "haushalt";
            const prefix = isHaus ? "haus" : "freizeit";
            const fallback = isHaus ? "Einkauf" : "Essen / Trinken";
            const kat = getLetzteKategorie(bereich, fallback);
            const btn = document.querySelector(`#${prefix}KategorieGrid [data-category="${CSS.escape(kat)}"]`)
                || document.querySelector(`#${prefix}KategorieGrid [data-category="${fallback}"]`);
            setQuickCategory(prefix, btn?.dataset.category || fallback, btn);
        }

        function focusBetragSchnell(id) {
            const el = document.getElementById(id);
            if (!el) return;
            setTimeout(() => {
                el.focus({ preventScroll: true });
                // Falls bereits ein Betrag steht, kann er direkt überschrieben werden.
                if (typeof el.select === "function" && el.value) el.select();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 40);
        }

        function setQuickCategory(bereich, kategorie, button) {
            const inputId = bereich === "haus" ? "hausKategorie" : "freizeitKategorie";
            const gridId = bereich === "haus" ? "hausKategorieGrid" : "freizeitKategorieGrid";
            const betragId = bereich === "haus" ? "hausBetrag" : "freizeitBetrag";
            const input = document.getElementById(inputId);
            if (input) input.value = kategorie;
            document.querySelectorAll(`#${gridId} .quick-category-btn`).forEach(btn => btn.classList.remove("selected"));
            button?.classList.add("selected");

            // Alltag schneller erfassen: Kategorie antippen -> Betragstastatur sofort bereit.
            if (button) focusBetragSchnell(betragId);
        }

        function setReiseKategorie(kategorie, button, focusBetrag = true) {
            const select = document.getElementById("kategorieSelect");
            if (select) select.value = kategorie;
            document.querySelectorAll("#reiseKategorieGrid .quick-category-btn").forEach(btn => btn.classList.remove("selected"));
            button?.classList.add("selected");
            if (button && focusBetrag) focusBetragSchnell("betrag");
        }

        function applyLetzteReiseKategorie(focusBetrag = false) {
            const fallback = "Essen";
            const kat = getLetzteKategorie("reisen", fallback);
            const btn = document.querySelector(`#reiseKategorieGrid [data-category="${CSS.escape(kat)}"]`)
                || document.querySelector(`#reiseKategorieGrid [data-category="${fallback}"]`);
            setReiseKategorie(btn?.dataset.category || fallback, btn, focusBetrag);
        }

        function renderQuickAdd() {

            let div = document.getElementById("quickAdd");
            if (!div) return;

            div.innerHTML = "";

            if (!aktuellesLand || !daten.Reisen?.[aktuellesLand]) return;

            Object.keys(daten.Reisen[aktuellesLand]).forEach(k => {

                let btn = document.createElement("button");
                btn.className = "quick-chip";
                btn.innerText = "➕ " + k;

                btn.onclick = () => quickAdd(k);

                div.appendChild(btn);
            });

            let addBtn = document.createElement("button");
            addBtn.innerText = "➕ Kategorie";
            addBtn.style.background = "#555";

            addBtn.onclick = () => {
                addKategorie();
                renderQuickAdd(); // ok, aber optional (siehe Hinweis unten)
            };

            div.appendChild(addBtn);
        }

        function quickAdd(k) {

            quickKategorie = k;

            const titel = document.getElementById("quickTitel");
            const box = document.getElementById("quickBox");

            if (!titel || !box) return;

            titel.innerText = "➕ " + k;

            box.classList.remove("hidden");

            // Reset Felder
            const betrag = document.getElementById("quickBetrag");
            const text = document.getElementById("quickText");

            if (betrag) betrag.value = "";
            if (text) text.value = "";

            setTimeout(() => {
                box.classList.add("show");

                // optional: nur setzen, wenn nicht schon gesetzt
                setupQuickAddEnterFlow();

                betrag?.focus();

            }, 10);
        }

        function toggleManual() {

            const box = document.getElementById("manualBox");
            if (!box) return;

            const wirdGeoeffnet = box.classList.contains("hidden");
            box.classList.toggle("hidden");
            if (wirdGeoeffnet) focusBetragSchnell("betrag");
        }

        function saveQuickAdd() {

            if (!aktuellesLand || !quickKategorie) return;

            let betrag = parseBetrag(document.getElementById("quickBetrag")?.value);
            let text = document.getElementById("quickText")?.value || "";
            let datum = new Date().toISOString().split('T')[0];

            if (isNaN(betrag)) return;

            if (!daten.Reisen[aktuellesLand]) return;

            if (!Array.isArray(daten.Reisen[aktuellesLand][quickKategorie])) {
                daten.Reisen[aktuellesLand][quickKategorie] = [];
            }

            daten.Reisen[aktuellesLand][quickKategorie].push({
                id: generateId(),
                betrag,
                text,
                datum
            });
            merkeLetzteKategorie("reisen", quickKategorie);

            if (speichern() === false) return;

            const box = document.getElementById("quickBox");

            if (box) {
                box.classList.remove("show");

                setTimeout(() => {
                    box.classList.add("hidden");
                }, 200);
            }

            renderListe();
        }
