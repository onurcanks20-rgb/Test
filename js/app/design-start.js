
        // Design so frueh wie moeglich anwenden, damit beim Start nichts kurz aufblitzt.
        (() => {
            let mode = "system";
            let saved = null;
            try {
                saved = JSON.parse(localStorage.getItem(Kostentracker.storage.key) || "null");
                const candidate = saved?.Einstellungen?.designModus;
                if (["dunkel", "hell", "system"].includes(candidate)) mode = candidate;
            } catch (_) {}
            const dark = mode === "dunkel" || (mode === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
            document.documentElement.dataset.theme = dark ? "dark" : "light";
            document.documentElement.dataset.themeMode = mode;
            const colors = saved?.Einstellungen?.aktionsfarben || {};
            const valid = value => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
            if (valid(colors.hinzufuegen)) document.documentElement.style.setProperty("--action-add", colors.hinzufuegen);
            if (valid(colors.bearbeiten)) document.documentElement.style.setProperty("--action-edit", colors.bearbeiten);
            if (valid(colors.verschieben)) document.documentElement.style.setProperty("--action-move", colors.verschieben);
            if (valid(colors.schalter)) document.documentElement.style.setProperty("--action-switch", colors.schalter);
        })();
    