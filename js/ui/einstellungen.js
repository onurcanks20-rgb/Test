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

        const HELP_CONTENT = {
  "settingsMerchantView": {
    "title":"Händlerzuordnung",
    "html":"<p>Bekannte Händler werden automatisch erkannt. Unbekannte Zahlungen bleiben in der Prüfung, bis du Bereich und Kategorie auswählst.</p><p>Mit „Für diesen Händler merken“ gilt deine Auswahl auch für kommende Zahlungen mit demselben Händlernamen. Groß-/Kleinschreibung und Satzzeichen werden vereinheitlicht. Deine eigenen Regeln haben Vorrang vor den mitgelieferten Zuordnungen.</p><p>Hier kannst du eigene Regeln ergänzen, bearbeiten oder löschen. Bereits gespeicherte Buchungen werden dadurch nicht verschoben. Die Regeln sind Teil deiner Datensicherung.</p><p>Die Reiseprüfung und die Prüfung von Fixkosten bleiben erhalten. Eine Händlerregel legt kein dauerhaftes Reiseland fest. Im eindeutigen Reisezeitraum wird die passende Reisekategorie verwendet. Auf Reisezahlungen lassen sich Regeln nicht direkt speichern; lege dafür hier eine Alltagszuordnung an.</p>"
  },
  "settingsView": {
    "title": "Einstellungen",
    "html": "<p>Aktuelles und nächstes Gehalt, Gehaltstag</p><p>Bereiche auswählen und Reihenfolge anpassen</p><p>Große Ausgaben und Hinweise auf der Startseite</p><p>Alle gespeicherten Einträge durchsuchen und exportieren</p><p>Persönlicher Zugang, Sicherung und Benachrichtigungen</p><p>Daten sichern oder wiederherstellen</p>"
  },
  "serverSettingsView": {
    "title": "Anmelden & Datensicherung",
    "html": "<p>Dein persönlicher Zugangscode funktioniert wie ein Passwort. Wer ihn kennt, kann auf einem neuen Gerät auf die Daten dieses Zugangs zugreifen. Gib ihn nicht weiter.</p><p>Nach der Anmeldung prüft die App, ob eine gespeicherte Sicherung vorhanden ist. Stelle sie bei einem neuen Gerät wieder her. Bis dahin werden keine neuen Zahlungen übernommen und die Sicherung wird nicht überschrieben.</p><p>Bei einer Wiederherstellung werden die Daten auf diesem Gerät ersetzt. Bereits vorhandene lokale Einträge kannst du vorher unter Backup in eine Datei exportieren.</p><p>Trage deinen Code einmal ein. Danach öffnet sich die App direkt. Deine Daten bleiben offline verfügbar. Mit Internet werden neue Zahlungen übernommen und deine Daten auf dem Server gesichert.</p><p>Nur Testversion: Diese Buttons erzeugen lokale Testausgaben oder Prüfungen. Keine echte Bankzahlung und keine nachgewiesenen Push-Formate. Für das Korea-Beispiel eine Reise mit KRW auswählen.</p><p>Dein Kurzbefehl übermittelt Bank-Mitteilungen an deinen persönlichen Zugang. Bäckereien werden unter Freizeit → Essen / Trinken erfasst. Neue Zahlungen werden beim Öffnen der App mit Internet übernommen. Zahlungen im eindeutigen Reisezeitraum können in Reisen übernommen werden. An- und Abreisetage sowie Überschneidungen werden geprüft. Experimentelle Fremdwährungsmeldungen werden nicht ungeprüft gebucht.</p><p>Öffne die App über ihr Home-Bildschirm-Icon und erlaube Mitteilungen. Die Anmeldung richtet den Empfang von Servernachrichten ein; automatische Erinnerungen werden später ergänzt.</p>"
  },
  "settingsBudgetView": {
    "title": "Budget & Gehalt",
    "html": "<p>Das Startgehalt wird getrennt für jeden Gehaltszeitraum gespeichert.</p><p>Sobald deine Lohnabrechnung da ist, kannst du das tatsächliche Datum und den Betrag für das nächste Gehalt vormerken. Der neue Gehaltszeitraum beginnt erst, wenn du den Eingang bestätigst.</p><p>Dieser Tag bleibt der Standard, falls du kein konkretes nächstes Gehalt eingetragen hast. Fällt er auf Samstag oder Sonntag, verwendet die App weiterhin automatisch den folgenden Montag.</p>"
  },
  "settingsQuickAddView": {
    "title": "Schnelleingabe",
    "html": "<p>Lege fest, was unter „Abrechnung hinzufügen“ erscheint und in welcher Reihenfolge.</p><p>Diese vier Beträge erscheinen bei Haushalt, Freizeit und Reisen in der Schnelleingabe.</p>"
  },
  "settingsWarningsView": {
    "title": "Erinnerung",
    "html": "<p>Automatische Hinweise nutzen Schwellwert und Erinnerungszeit. Manuell markierte Einträge werden unabhängig vom Schwellwert angezeigt.</p>"
  },
  "settingsGesturesView": {
    "title": "Gesten",
    "html": "<p>Ein Rechts-Swipe führt die gewählte Aktion aus. „Kopieren“ ist in allen Buchungsbereichen verfügbar. Es öffnet ein vorausgefülltes Formular mit aktuellem Datum und aktueller Uhrzeit. Prüfe oder ändere die Angaben und bestätige erst über die Speichertaste des jeweiligen Formulars.</p><p>Ausgeblendete Einträge bleiben in Summen und Budgets enthalten. Du kannst sie jederzeit im Archiv wieder einblenden.</p>"
  },
  "settingsDesignView": {
    "title": "Design",
    "html": "<p>Wähle, ob der Kostentracker dunkel, hell oder automatisch passend zu deinem iPhone dargestellt wird.</p><p>Oben kannst du alle Farben gleichzeitig setzen. Darunter lässt sich jede Aktion bei Bedarf einzeln anpassen.</p><p>„Alle Buttons, Schalter & Haken“ setzt Hinzufügen/Speichern, Bearbeiten, Verschieben sowie aktive Schalter und Auswahlhaken auf dieselbe Farbe. Darunter kannst du einzelne Farben wieder abweichend wählen. Erst mit „Farben speichern“ wird die Auswahl dauerhaft übernommen. Löschen bleibt bewusst rot.</p>"
  },
  "settingsBackupView": {
    "title": "Backup",
    "html": "<p>Sichere alle Einträge und Einstellungen in einer Datei. Diese kannst du später auf diesem oder einem neuen Gerät wieder einspielen.</p><p>Beim Wiederherstellen werden die aktuell gespeicherten App-Daten durch das gewählte Backup ersetzt.</p><p>Löscht alle Ausgaben, Einnahmen, Fixkosten, Versicherungen sowie Spar- und Investitionseinträge aus allen Zeiträumen, einschließlich der Reiseeinträge. Länder, Kategorien, Budgets und Einstellungen bleiben erhalten. Erstelle vorher ein Backup, wenn du die Einträge später wiederherstellen möchtest.</p>"
  },
  "globalArchivView": {
    "title": "Archiv",
    "html": "<p>Durchsuche deine gespeicherten Einträge. Filtere nach Bereich, Jahr, Sichtbarkeit und Datum. Ausgeblendete Einträge bleiben in Budgets und Summen enthalten.</p>"
  },
  "weekPreviewSheet": {
    "title": "Wochenbudget",
    "html": "<p>Das Budget dieser Woche bleibt fest. Ein positiver Wochenrest bleibt für diese Woche reserviert. Wenn du das Wochenbudget überschreitest, werden die kommenden Wochen sofort angepasst. Die Überschreitung ist im Gesamtbetrag bereits verrechnet und wird nicht noch einmal abgezogen. Teilwochen werden nach ihren Tagen verteilt.</p>"
  }
};
        const appDialogs = new Map();
        const preparedAppDialogs = new WeakSet();
        function openAccessibleDialog(id, headingId) {
            const dialog = document.getElementById(id);
            if (!dialog) return false;
            if (dialog.open) return true;
            if ([...document.querySelectorAll('dialog[open]')].some(node => node !== dialog)) return false;
            if (!preparedAppDialogs.has(dialog)) {
                dialog.addEventListener('cancel', event => {
                    event.preventDefault();
                    if (dialog.dataset.busy !== 'true') closeAccessibleDialog(id);
                });
                dialog.addEventListener('close', () => restoreAppDialogState(id));
                preparedAppDialogs.add(dialog);
            }
            const state = { focus:document.activeElement, overflow:document.body.style.overflow || '', inert:new Map(), fallback:typeof dialog.showModal !== 'function' };
            appDialogs.set(id, state);
            document.body.style.overflow = 'hidden';
            if (!state.fallback) {
                try { dialog.showModal(); }
                catch (_) { restoreAppDialogState(id); return false; }
            } else {
                dialog.setAttribute('open', ''); dialog.open = true;
                for (const node of [...document.body.children]) {
                    if (node === dialog) continue;
                    state.inert.set(node, node.inert); node.inert = true;
                }
            }
            document.getElementById(headingId)?.focus();
            return true;
        }
        function restoreAppDialogState(id) {
            const state = appDialogs.get(id);
            if (!state) return;
            appDialogs.delete(id);
            document.body.style.overflow = state.overflow;
            for (const [node, previous] of state.inert) node.inert = previous;
            state.focus?.focus?.();
        }
        function closeAccessibleDialog(id) {
            const dialog = document.getElementById(id);
            if (!dialog || dialog.dataset.busy === 'true') return;
            if (typeof dialog.close === 'function' && dialog.open) dialog.close();
            else { dialog.removeAttribute('open'); dialog.open = false; }
            restoreAppDialogState(id);
        }
        function openPageInfo(key) {
            const info = HELP_CONTENT[key];
            if (!info) return;
            document.getElementById('pageInfoTitle').textContent = info.title;
            document.getElementById('pageInfoContent').innerHTML = info.html;
            openAccessibleDialog('pageInfoDialog', 'pageInfoTitle');
        }
        function closePageInfo() { closeAccessibleDialog('pageInfoDialog'); }
        document.addEventListener('keydown', event => {
            if (document.getElementById('paymentReviewDialog')?.open) return;
            const item = [...appDialogs].find(([id]) => document.getElementById(id)?.open);
            if (!item) return;
            const [id, state] = item, dialog = document.getElementById(id);
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation();
                if (dialog.dataset.busy !== 'true') closeAccessibleDialog(id);
            } else if (state.fallback && event.key === 'Tab') {
                const controls = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]')];
                const first = controls[0], last = controls[controls.length - 1];
                if (!first) { event.preventDefault(); dialog.querySelector('[tabindex="-1"]')?.focus(); }
                else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
            }
        });
        document.addEventListener('focusin', event => {
            if (document.getElementById('paymentReviewDialog')?.open) return;
            for (const [id, state] of appDialogs) {
                const dialog = document.getElementById(id);
                if (state.fallback && dialog?.open && !dialog.contains(event.target)) dialog.querySelector('[tabindex="-1"]')?.focus();
            }
        });

return { openAccessibleDialog, closeAccessibleDialog, openPageInfo, closePageInfo, getDesignMode, resolveDesignTheme, applyDesignTheme, setDesignMode, normalizeActionColor, getActionColors, applyActionColors, setActionColorStatus, readActionColorInputs, previewCommonActionColor, previewActionColor, saveActionColorsFromInputs, saveCommonActionColor, saveActionColor, resetActionColors, renderDesignSettings, renderDesignMenuStatus, openSettingsBackup };
});
