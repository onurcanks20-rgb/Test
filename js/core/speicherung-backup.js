// Kostentracker Test: js/core/speicherung-backup.js
// Functions share the existing app state; initialize only in app/start.js.

        function ladeDaten() {
            try {
                return JSON.parse(localStorage.getItem("kostenApp_test")) || structuredClone(STANDARD_DATEN);
            } catch (error) {
                console.error("Gespeicherte Daten konnten nicht gelesen werden:", error);
                return structuredClone(STANDARD_DATEN);
            }
        }

        function speichernOhneHomeRender(showError = true) {
            try {
                const serialized = JSON.stringify(daten);
                localStorage.setItem("kostenApp_test", serialized);
                zuletztGespeicherteDaten = serialized;
                if (typeof scheduleTestServerSync === "function") scheduleTestServerSync();
                return true;
            } catch (error) {
                daten = JSON.parse(zuletztGespeicherteDaten);
                console.error("Speichern fehlgeschlagen:", error);
                if (showError) alert("Speichern im Browser ist fehlgeschlagen. Deine Eingabe bleibt stehen. Bitte versuche es erneut. Falls es weiterhin nicht funktioniert, sichere deine Daten als Backup und prüfe den verfügbaren Browserspeicher.");
                return false;
            }
        }

        function speichern() {
            if (!speichernOhneHomeRender()) return false;
            renderHomeUebersicht();
            return true;
        }

        function deleteAllAppEntries() {
            if (!confirm("Alle Einträge in der gesamten App löschen?\n\nAuch Einnahmen, Fixkosten, Versicherungen, geplante Ausgaben, Spar-/Investitionseinträge und Reiseeinträge werden aus allen Zeiträumen entfernt. Länder, Kategorien, Budgets und Einstellungen bleiben erhalten.\n\nDies kann nur mit einem zuvor gespeicherten Backup rückgängig gemacht werden.")) return;
            const status = document.getElementById("deleteAllEntriesStatus");
            try {
                const cleared = structuredClone(daten);
                // Keep category/country structure and settings; clear entries only.
                for (const area of ["Haushalt", "Freizeit"]) {
                    for (const key of Object.keys(cleared[area] || {})) {
                        if (Array.isArray(cleared[area][key])) cleared[area][key] = [];
                    }
                }
                for (const country of Object.values(cleared.Reisen || {})) {
                    for (const category of Object.keys(country || {})) {
                        if (Array.isArray(country[category])) country[category] = [];
                    }
                }
                for (const area of ["Versicherungen", "Einnahmen", "Geplante Ausgaben", "Sparen & Investieren"]) cleared[area] = [];
                for (const key of Object.keys(cleared["Laufende Kosten"] || {})) {
                    if (Array.isArray(cleared["Laufende Kosten"][key])) cleared["Laufende Kosten"][key] = [];
                }
                // Commit before replacing the in-memory data, so storage failure loses nothing.
                localStorage.setItem("kostenApp_test", JSON.stringify(cleared));
                daten = cleared;
                zuletztGespeicherteDaten = JSON.stringify(cleared);
                clearUndoDelete();
            } catch (error) {
                if (status) status.textContent = "Die Einträge konnten nicht gelöscht werden. Deine Daten bleiben erhalten.";
                return;
            }
            if (status) status.textContent = "Alle Einträge wurden gelöscht. Länder, Kategorien, Budgets und Einstellungen bleiben erhalten.";
        }

        function backupDateiname() {
            const d = new Date();
            const pad = n => String(n).padStart(2, "0");
            return `kostentracker-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
        }

        function setBackupStatus(text) {
            const el = document.getElementById("backupStatus");
            if (el) el.textContent = text || "";
        }

        async function exportBackup() {
            const payload = {
                app: "Kostentracker",
                version: 1,
                erstelltAm: new Date().toISOString(),
                daten
            };

            const json = JSON.stringify(payload, null, 2);
            const file = new File([json], backupDateiname(), { type: "application/json" });

            try {
                if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: "Kostentracker Backup",
                        text: "Backup meiner Kostentracker-Daten",
                        files: [file]
                    });
                    setBackupStatus("Backup wurde zum Sichern bereitgestellt.");
                    return;
                }
            } catch (error) {
                if (error?.name === "AbortError") return;
                console.warn("Teilen des Backups fehlgeschlagen:", error);
            }

            const url = URL.createObjectURL(file);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setBackupStatus("Backup wurde heruntergeladen.");
        }

        function istGueltigesBackup(obj) {
            const kandidat = obj?.daten ?? obj;
            return kandidat &&
                typeof kandidat === "object" &&
                !Array.isArray(kandidat) &&
                kandidat.Reisen && typeof kandidat.Reisen === "object" &&
                Array.isArray(kandidat.Versicherungen) &&
                kandidat.Haushalt && typeof kandidat.Haushalt === "object" &&
                kandidat["Laufende Kosten"] && typeof kandidat["Laufende Kosten"] === "object";
        }

        async function importBackup(event) {
            const input = event?.target;
            const file = input?.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const parsed = JSON.parse(text);

                if (!istGueltigesBackup(parsed)) {
                    throw new Error("Ungültige Backup-Datei");
                }

                if (!confirm("Backup wiederherstellen? Deine aktuell gespeicherten Daten werden dadurch ersetzt.")) {
                    input.value = "";
                    return;
                }

                const neueDaten = parsed.daten ?? parsed;
                localStorage.setItem("kostenApp_test", JSON.stringify(neueDaten));
                daten = neueDaten;
                zuletztGespeicherteDaten = JSON.stringify(neueDaten);
                clearUndoDelete();
                setBackupStatus("Backup wurde wiederhergestellt. Die App wird neu geladen …");
                setTimeout(() => location.reload(), 400);
            } catch (error) {
                console.error("Backup-Import fehlgeschlagen:", error);
                alert("Die Backup-Datei konnte nicht gelesen werden. Bitte wähle ein gültiges Kostentracker-Backup aus.");
                setBackupStatus("Backup konnte nicht wiederhergestellt werden.");
            } finally {
                if (input) input.value = "";
            }
        }
