Kostentracker.module({
  "id": "js/ui/einstellungen.js",
  "dependencies": [
    "setBackupStatus",
    "show",
    "speichern"
  ],
  "session": [
    "DEFAULT_ACTION_COLOR",
    "DEFAULT_ACTION_COLORS"
  ],
  "read": [
    "Einstellungen"
  ],
  "write": [
    "Einstellungen"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/ui/einstellungen.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function getDesignMode() {
            context.repository.view.Einstellungen ??= {};
            return ["dunkel", "hell", "system"].includes(context.repository.view.Einstellungen.designModus) ? context.repository.view.Einstellungen.designModus : "system";
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
            context.repository.view.Einstellungen ??= {};
            context.repository.view.Einstellungen.designModus = mode;
            if (dependencies.speichern() === false) return;
            applyDesignTheme();
        }

        function normalizeActionColor(value) {
            const color = String(value || "").trim();
            return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : context.session.DEFAULT_ACTION_COLOR;
        }

        function getActionColors() {
            context.repository.view.Einstellungen ??= {};
            const src = context.repository.view.Einstellungen.aktionsfarben || {};
            return {
                hinzufuegen: normalizeActionColor(src.hinzufuegen || context.session.DEFAULT_ACTION_COLORS.hinzufuegen),
                bearbeiten: normalizeActionColor(src.bearbeiten || context.session.DEFAULT_ACTION_COLORS.bearbeiten),
                verschieben: normalizeActionColor(src.verschieben || context.session.DEFAULT_ACTION_COLORS.verschieben),
                schalter: normalizeActionColor(src.schalter || context.session.DEFAULT_ACTION_COLORS.schalter)
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
            context.repository.view.Einstellungen ??= {};
            const colors = readActionColorInputs();
            context.repository.view.Einstellungen.aktionsfarben = colors;
            delete context.repository.view.Einstellungen.aktionsfarbenModus;
            delete context.repository.view.Einstellungen.akzentfarbe;
            if (dependencies.speichern() === false) return;
            applyActionColors(colors);
            renderDesignSettings();
            setActionColorStatus("Gespeichert ✓");
        }

        function saveCommonActionColor(value) { previewCommonActionColor(value); }

        function saveActionColor(key, value) { previewActionColor(key, value); }

        function resetActionColors() {
            context.repository.view.Einstellungen ??= {};
            const defaults = { ...context.session.DEFAULT_ACTION_COLORS };
            context.repository.view.Einstellungen.aktionsfarben = defaults;
            delete context.repository.view.Einstellungen.aktionsfarbenModus;
            delete context.repository.view.Einstellungen.akzentfarbe;
            if (dependencies.speichern() === false) return;
            applyActionColors(defaults);
            [
                ["actionColorCommon", context.session.DEFAULT_ACTION_COLOR],
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
                actionColorCommon: (colors.hinzufuegen === colors.bearbeiten && colors.hinzufuegen === colors.verschieben && colors.hinzufuegen === colors.schalter) ? colors.hinzufuegen : context.session.DEFAULT_ACTION_COLOR,
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
            dependencies.show("settingsBackupView");
            dependencies.setBackupStatus("");
        }

return { getDesignMode, resolveDesignTheme, applyDesignTheme, setDesignMode, normalizeActionColor, getActionColors, applyActionColors, setActionColorStatus, readActionColorInputs, previewCommonActionColor, previewActionColor, saveActionColorsFromInputs, saveCommonActionColor, saveActionColor, resetActionColors, renderDesignSettings, renderDesignMenuStatus, openSettingsBackup };
});
