// Kostentracker Test: js/ui/einstellungen.js
// Functions share the existing app state; initialize only in app/start.js.

        function getDesignMode() {
            daten.Einstellungen ??= {};
            return ["dunkel", "hell", "system"].includes(daten.Einstellungen.designModus) ? daten.Einstellungen.designModus : "system";
        }

        function resolveDesignTheme(mode = getDesignMode()) {
            if (mode === "dunkel") return "dark";
            if (mode === "hell") return "light";
            return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }

        function applyDesignTheme() {
            const mode = getDesignMode();
            const theme = resolveDesignTheme(mode);
            document.documentElement.dataset.themeMode = mode;
            document.documentElement.dataset.theme = theme;
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#f2f2f7");
            applyActionColors();
            renderDesignMenuStatus();
            renderDesignSettings();
        }

        function setDesignMode(mode) {
            if (!["dunkel", "hell", "system"].includes(mode)) return;
            daten.Einstellungen ??= {};
            daten.Einstellungen.designModus = mode;
            if (speichern() === false) return;
            applyDesignTheme();
        }

        function normalizeActionColor(value) {
            const color = String(value || "").trim();
            return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : DEFAULT_ACTION_COLOR;
        }

        function getActionColors() {
            daten.Einstellungen ??= {};
            const src = daten.Einstellungen.aktionsfarben || {};
            return {
                hinzufuegen: normalizeActionColor(src.hinzufuegen || DEFAULT_ACTION_COLORS.hinzufuegen),
                bearbeiten: normalizeActionColor(src.bearbeiten || DEFAULT_ACTION_COLORS.bearbeiten),
                verschieben: normalizeActionColor(src.verschieben || DEFAULT_ACTION_COLORS.verschieben),
                schalter: normalizeActionColor(src.schalter || DEFAULT_ACTION_COLORS.schalter)
            };
        }

        function applyActionColors(colors = getActionColors()) {
            document.documentElement.style.setProperty("--action-add", normalizeActionColor(colors.hinzufuegen));
            document.documentElement.style.setProperty("--action-edit", normalizeActionColor(colors.bearbeiten));
            document.documentElement.style.setProperty("--action-move", normalizeActionColor(colors.verschieben));
            document.documentElement.style.setProperty("--action-switch", normalizeActionColor(colors.schalter));
        }

        function setActionColorStatus(text = "") {
            const el = document.getElementById("actionColorStatus");
            if (el) el.textContent = text;
        }

        function readActionColorInputs() {
            return {
                hinzufuegen: normalizeActionColor(document.getElementById("actionColorAdd")?.value),
                bearbeiten: normalizeActionColor(document.getElementById("actionColorEdit")?.value),
                verschieben: normalizeActionColor(document.getElementById("actionColorMove")?.value),
                schalter: normalizeActionColor(document.getElementById("actionColorSwitch")?.value)
            };
        }

        function previewCommonActionColor(value) {
            const c = normalizeActionColor(value);
            ["actionColorAdd","actionColorEdit","actionColorMove","actionColorSwitch"].forEach(id => {
                const input = document.getElementById(id);
                if (input) input.value = c;
            });
            applyActionColors({hinzufuegen:c,bearbeiten:c,verschieben:c,schalter:c});
            setActionColorStatus("Noch nicht gespeichert");
        }

        function previewActionColor(key, value) {
            const colors = readActionColorInputs();
            if (key in colors) colors[key] = normalizeActionColor(value);
            applyActionColors(colors);
            const common = document.getElementById("actionColorCommon");
            if (common && colors.hinzufuegen === colors.bearbeiten && colors.hinzufuegen === colors.verschieben && colors.hinzufuegen === colors.schalter) {
                common.value = colors.hinzufuegen;
            }
            setActionColorStatus("Noch nicht gespeichert");
        }

        function saveActionColorsFromInputs() {
            daten.Einstellungen ??= {};
            const colors = readActionColorInputs();
            daten.Einstellungen.aktionsfarben = colors;
            delete daten.Einstellungen.aktionsfarbenModus;
            delete daten.Einstellungen.akzentfarbe;
            if (speichern() === false) return;
            applyActionColors(colors);
            renderDesignSettings();
            setActionColorStatus("Gespeichert ✓");
        }

        function saveCommonActionColor(value) { previewCommonActionColor(value); }

        function saveActionColor(key, value) { previewActionColor(key, value); }

        function resetActionColors() {
            daten.Einstellungen ??= {};
            const defaults = { ...DEFAULT_ACTION_COLORS };
            daten.Einstellungen.aktionsfarben = defaults;
            delete daten.Einstellungen.aktionsfarbenModus;
            delete daten.Einstellungen.akzentfarbe;
            if (speichern() === false) return;
            applyActionColors(defaults);
            [
                ["actionColorCommon", DEFAULT_ACTION_COLOR],
                ["actionColorAdd", defaults.hinzufuegen],
                ["actionColorEdit", defaults.bearbeiten],
                ["actionColorMove", defaults.verschieben],
                ["actionColorSwitch", defaults.schalter]
            ].forEach(([id,value]) => { const input=document.getElementById(id); if(input) input.value=value; });
            setActionColorStatus("Standardfarbe wiederhergestellt ✓");
        }

        function renderDesignSettings() {
            const mode = getDesignMode();
            applyActionColors();
            const colors = getActionColors();
            const values = {
                actionColorCommon: (colors.hinzufuegen === colors.bearbeiten && colors.hinzufuegen === colors.verschieben && colors.hinzufuegen === colors.schalter) ? colors.hinzufuegen : DEFAULT_ACTION_COLOR,
                actionColorAdd: colors.hinzufuegen,
                actionColorEdit: colors.bearbeiten,
                actionColorMove: colors.verschieben,
                actionColorSwitch: colors.schalter
            };
            Object.entries(values).forEach(([id,value]) => {
                const input = document.getElementById(id);
                if (input) input.value = value;
            });
            setActionColorStatus("");
            document.querySelectorAll(".design-choice").forEach(button => {
                const active = button.dataset.designMode === mode;
                button.setAttribute("aria-pressed", active ? "true" : "false");
                const check = button.querySelector(".design-choice-check");
                if (check) check.textContent = active ? "✓" : "";
            });
        }

        function renderDesignMenuStatus() {
            const sub = document.getElementById("settingsDesignMenuSub");
            if (!sub) return;
            const mode = getDesignMode();
            sub.textContent = mode === "dunkel" ? "Dunkles Erscheinungsbild" : mode === "hell" ? "Helles Erscheinungsbild" : "Systemeinstellung verwenden";
        }

        function openSettingsBackup() {
            show("settingsBackupView");
            setBackupStatus("");
        }
