Kostentracker.module({
  "id": "js/ui/archiv.js",
  "dependencies": [
    "datumZeitwert",
    "escapeHtml",
    "formatBetrag",
    "formatDatum",
    "generateId",
    "getMonatName",
    "getSearchTerm",
    "heuteISO",
    "isoAusDate",
    "istEintragAusgeblendet",
    "matchesSearch",
    "parseBetrag",
    "parseISODate",
    "show",
    "speichern"
  ],
  "session": [
    "state"
  ],
  "read": [
    "Haushalt",
    "Freizeit",
    "Laufende Kosten",
    "Versicherungen",
    "Einnahmen",
    "Reisen",
    "ReisenMeta"
  ],
  "write": [
    "Haushalt",
    "Freizeit",
    "Laufende Kosten",
    "Versicherungen",
    "Einnahmen",
    "Reisen",
    "ReisenMeta"
  ],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/ui/archiv.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function openGlobalArchiv() {
            dependencies.show("globalArchivView");
            populateGlobalArchivJahre();
            renderGlobalArchiv();
        }

        function resetGlobalArchivFilter() {
            const ids = ["globalArchivSuche", "globalArchivVon", "globalArchivBis"];
            ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
            const bereich = document.getElementById("globalArchivBereich");
            const jahr = document.getElementById("globalArchivJahr");
            const sichtbarkeit = document.getElementById("globalArchivSichtbarkeit");
            if (bereich) bereich.value = "alle";
            if (jahr) jahr.value = "alle";
            if (sichtbarkeit) sichtbarkeit.value = "alle";
            renderGlobalArchiv();
        }

        function getGlobalArchivFilter() {
            return {
                suche: dependencies.getSearchTerm("globalArchivSuche"),
                bereich: document.getElementById("globalArchivBereich")?.value || "alle",
                jahr: document.getElementById("globalArchivJahr")?.value || "alle",
                sichtbarkeit: document.getElementById("globalArchivSichtbarkeit")?.value || "alle",
                von: document.getElementById("globalArchivVon")?.value || "",
                bis: document.getElementById("globalArchivBis")?.value || ""
            };
        }

        function globalArchivRohEintraege() {
            const out = [];
            const add = (bereich, eintrag, target, display = {}) => {
                if (!eintrag || !eintrag.datum || !dependencies.parseISODate(eintrag.datum)) return;
                out.push({
                    bereich,
                    datum: eintrag.datum,
                    eintrag: JSON.parse(JSON.stringify(eintrag)),
                    target: JSON.parse(JSON.stringify(target || {})),
                    titel: display.titel || eintrag.text || eintrag.name || "Eintrag",
                    meta: display.meta || "",
                    betrag: dependencies.parseBetrag(eintrag.betrag) || 0,
                    id: eintrag.id,
                    ausgeblendet: dependencies.istEintragAusgeblendet(bereich, eintrag.id),
                    positiv: bereich === "einnahmen"
                });
            };

            Object.values(context.repository.view.Haushalt || {}).forEach(liste => {
                if (!Array.isArray(liste)) return;
                liste.forEach(e => add("haushalt", e, {}, { titel:e.text || e.kategorie || "Haushalt", meta:e.kategorie || "" }));
            });
            Object.values(context.repository.view.Freizeit || {}).forEach(liste => {
                if (!Array.isArray(liste)) return;
                liste.forEach(e => add("freizeit", e, {}, { titel:e.text || e.kategorie || "Freizeit", meta:e.kategorie || "" }));
            });
            (context.repository.view["Laufende Kosten"]?.fix || []).forEach(e => add("fixkosten", e, {}, { titel:e.text || e.name || "Fixkosten", meta:"Monatlich" }));
            (context.repository.view.Versicherungen || []).forEach(e => add("versicherungen", e, {}, { titel:e.name || "Versicherung", meta:e.intervall || "" }));
            (context.repository.view.Einnahmen || []).forEach(e => add("einnahmen", e, {}, { titel:e.text || "Einnahme", meta:[e.von, e.wiederholung].filter(Boolean).join(" · ") }));
            Object.entries(context.repository.view.Reisen || {}).forEach(([land, reise]) => {
                if (!reise || typeof reise !== "object") return;
                Object.entries(reise).forEach(([kategorie, liste]) => {
                    if (!Array.isArray(liste)) return;
                    liste.forEach(e => add("reisen", e, { land, kategorie }, { titel:e.text || kategorie || "Reiseausgabe", meta:`${land} · ${kategorie}` }));
                });
            });
            return out.sort((a,b) => {
                    const diff = dependencies.datumZeitwert(b.datum) - dependencies.datumZeitwert(a.datum);
                    if (diff !== 0) return diff;
                    return Number(b.id || 0) - Number(a.id || 0);
                });
        }

        function filterGlobalArchivRecords(records) {
            const f = getGlobalArchivFilter();
            return (records || []).filter(e => {
                if (f.bereich !== "alle" && e.bereich !== f.bereich) return false;
                if (f.jahr !== "alle" && !String(e.datum || "").startsWith(f.jahr + "-")) return false;
                if (f.sichtbarkeit === "sichtbar" && e.ausgeblendet) return false;
                if (f.sichtbarkeit === "ausgeblendet" && !e.ausgeblendet) return false;
                if (f.von && e.datum < f.von) return false;
                if (f.bis && e.datum > f.bis) return false;
                if (f.suche && !dependencies.matchesSearch(f.suche, e.titel, e.meta, e.datum, e.betrag, globalArchivBereichLabel(e.bereich))) return false;
                return true;
            });
        }

        function setGlobalArchivTransferStatus(text) {
            const el = document.getElementById("globalArchivTransferStatus");
            if (el) el.textContent = text || "";
        }

        function archivExportBasisName(records) {
            const f = getGlobalArchivFilter();
            if (f.von || f.bis) return `kostentracker-${f.von || "start"}-bis-${f.bis || "ende"}`;
            if (f.jahr !== "alle") return `kostentracker-${f.jahr}`;
            if (records.length) {
                const dates = records.map(r => r.datum).sort();
                return `kostentracker-${dates[0]}-bis-${dates[dates.length - 1]}`;
            }
            return `kostentracker-export-${dependencies.heuteISO()}`;
        }

        function csvCell(value) {
            let text = String(value ?? "");
            if (/^[=+\-@]/.test(text)) text = "'" + text;
            return '"' + text.replace(/"/g, '""') + '"';
        }

        function downloadFile(file) {
            const url = URL.createObjectURL(file);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1200);
        }

        async function exportGlobalArchiv() {
            const records = filterGlobalArchivRecords(globalArchivRohEintraege());
            if (!records.length) {
                alert("Für die aktuellen Filter gibt es keine Einträge zum Exportieren.");
                return;
            }

            const basis = archivExportBasisName(records);
            const header = ["Datum","Bereich","Kategorie / Details","Beschreibung","Betrag","Reise"];
            const rows = records.map(r => {
                const raw = r.eintrag || {};
                const reise = r.bereich === "reisen" ? (r.target?.land || "") : "";
                const kategorie = r.bereich === "reisen" ? (r.target?.kategorie || "") : (raw.kategorie || r.meta || "");
                return [r.datum, globalArchivBereichLabel(r.bereich).replace(/^\S+\s*/, ""), kategorie, r.titel, Number(r.betrag || 0).toFixed(2).replace(".", ","), reise];
            });
            const csv = "\ufeff" + [header, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n");
            const payload = {
                app: "Kostentracker",
                typ: "archiv-export",
                version: 1,
                erstelltAm: new Date().toISOString(),
                filter: getGlobalArchivFilter(),
                eintraege: records.map(r => ({ bereich:r.bereich, datum:r.datum, target:r.target, eintrag:r.eintrag }))
            };

            const csvFile = new File([csv], `${basis}.csv`, { type:"text/csv;charset=utf-8" });
            const jsonFile = new File([JSON.stringify(payload, null, 2)], `${basis}.json`, { type:"application/json" });

            try {
                if (navigator.canShare && navigator.share && navigator.canShare({ files:[csvFile, jsonFile] })) {
                    await navigator.share({ title:"Kostentracker Export", text:`${records.length} Einträge`, files:[csvFile, jsonFile] });
                    setGlobalArchivTransferStatus(`${records.length} Einträge als CSV + JSON bereitgestellt.`);
                    return;
                }
            } catch (error) {
                if (error?.name === "AbortError") return;
                console.warn("Archiv teilen fehlgeschlagen:", error);
            }

            downloadFile(csvFile);
            setTimeout(() => downloadFile(jsonFile), 250);
            setGlobalArchivTransferStatus(`${records.length} Einträge exportiert. CSV = Excel/Numbers, JSON = späterer Re-Import.`);
        }

        function archivFingerprint(bereich, eintrag, target = {}) {
            const e = eintrag || {};
            if (e.id !== undefined && e.id !== null && e.id !== "") return `${bereich}|id|${String(e.id)}`;
            const basis = [bereich, e.datum || "", e.betrag ?? "", e.text || e.name || "", e.kategorie || "", e.von || "", e.wiederholung || "", e.intervall || "", target.land || "", target.kategorie || ""];
            return basis.join("|").toLocaleLowerCase("de");
        }

        function vorhandeneArchivFingerprints() {
            const set = new Set();
            globalArchivRohEintraege().forEach(r => set.add(archivFingerprint(r.bereich, r.eintrag, r.target)));
            return set;
        }

        function importiereArchivRecord(record) {
            const bereich = record?.bereich;
            const e = record?.eintrag;
            if (!bereich || !e || typeof e !== "object" || !e.datum || !dependencies.parseISODate(e.datum)) return false;
            const copy = JSON.parse(JSON.stringify(e));
            if (copy.id === undefined || copy.id === null || copy.id === "") copy.id = dependencies.generateId();

            if (bereich === "haushalt" || bereich === "freizeit") {
                const store = bereich === "haushalt" ? context.repository.view.Haushalt : context.repository.view.Freizeit;
                const monat = dependencies.parseISODate(copy.datum).getMonth() + 1;
                store[monat] ??= [];
                store[monat].push(copy);
                return true;
            }
            if (bereich === "fixkosten") {
                context.repository.view["Laufende Kosten"] ??= { fix:[] };
                context.repository.view["Laufende Kosten"].fix ??= [];
                context.repository.view["Laufende Kosten"].fix.push(copy);
                return true;
            }
            if (bereich === "versicherungen") {
                context.repository.view.Versicherungen ??= [];
                context.repository.view.Versicherungen.push(copy);
                return true;
            }
            if (bereich === "einnahmen") {
                context.repository.view.Einnahmen ??= [];
                context.repository.view.Einnahmen.push(copy);
                return true;
            }
            if (bereich === "reisen") {
                const land = record.target?.land || "Importierte Reise";
                const kategorie = record.target?.kategorie || "Sonstiges";
                context.repository.view.Reisen ??= {};
                context.repository.view.Reisen[land] ??= {};
                context.repository.view.Reisen[land][kategorie] ??= [];
                context.repository.view.Reisen[land][kategorie].push(copy);
                context.repository.view.ReisenMeta ??= {};
                context.repository.view.ReisenMeta[land] ??= { budget:0, von:"", bis:"" };
                return true;
            }
            return false;
        }

        async function importGlobalArchiv(event) {
            const input = event?.target;
            const file = input?.files?.[0];
            if (!file) return;
            try {
                const parsed = JSON.parse(await file.text());
                if (parsed?.app !== "Kostentracker" || parsed?.typ !== "archiv-export" || !Array.isArray(parsed.eintraege)) {
                    throw new Error("Kein Kostentracker-Archivexport");
                }

                const vorhandene = vorhandeneArchivFingerprints();
                let neu = 0, doppelt = 0, ungueltig = 0;
                parsed.eintraege.forEach(record => {
                    const fp = archivFingerprint(record?.bereich, record?.eintrag, record?.target || {});
                    if (vorhandene.has(fp)) { doppelt++; return; }
                    if (importiereArchivRecord(record)) {
                        vorhandene.add(fp);
                        neu++;
                    } else ungueltig++;
                });

                if (neu > 0 && dependencies.speichern() === false) return;
                populateGlobalArchivJahre();
                renderGlobalArchiv();
                setGlobalArchivTransferStatus(`${neu} Einträge importiert${doppelt ? ` · ${doppelt} bereits vorhanden` : ""}${ungueltig ? ` · ${ungueltig} übersprungen` : ""}.`);
                alert(neu > 0 ? `${neu} Einträge wurden wiederhergestellt. Bereits vorhandene Einträge wurden nicht doppelt angelegt.` : "Keine neuen Einträge importiert. Die vorhandenen Daten wurden nicht dupliziert.");
            } catch (error) {
                console.error("Archiv-Import fehlgeschlagen:", error);
                alert("Die Datei konnte nicht importiert werden. Bitte verwende eine JSON-Datei, die über den Archiv-Export erstellt wurde.");
                setGlobalArchivTransferStatus("Import fehlgeschlagen.");
            } finally {
                if (input) input.value = "";
            }
        }

        function globalArchivEintraege() {
            const out = [];
            const push = (bereich, titel, betrag, datum, meta = "", extra = {}) => {
                if (!datum) return;
                const d = dependencies.parseISODate(datum);
                if (!d) return;
                const id = extra?.id;
                out.push({ bereich, titel: titel || "Eintrag", betrag: dependencies.parseBetrag(betrag) || 0, datum: dependencies.isoAusDate(d), meta, ausgeblendet: dependencies.istEintragAusgeblendet(bereich, id), ...extra });
            };

            Object.values(context.repository.view.Haushalt || {}).forEach(liste => {
                if (!Array.isArray(liste)) return;
                liste.forEach(e => push("haushalt", e.text || e.kategorie || "Haushalt", e.betrag, e.datum, e.kategorie || "", { id:e.id }));
            });
            Object.values(context.repository.view.Freizeit || {}).forEach(liste => {
                if (!Array.isArray(liste)) return;
                liste.forEach(e => push("freizeit", e.text || e.kategorie || "Freizeit", e.betrag, e.datum, e.kategorie || "", { id:e.id }));
            });
            (context.repository.view["Laufende Kosten"]?.fix || []).forEach(e => push("fixkosten", e.text || e.name || "Fixkosten", e.betrag, e.datum, "Monatlich", { id:e.id }));
            (context.repository.view.Versicherungen || []).forEach(e => push("versicherungen", e.name || "Versicherung", e.betrag, e.datum, e.intervall || "", { id:e.id }));
            (context.repository.view.Einnahmen || []).forEach(e => push("einnahmen", e.text || "Einnahme", e.betrag, e.datum, [e.von, e.wiederholung].filter(Boolean).join(" · "), { positiv:true, id:e.id }));
            Object.entries(context.repository.view.Reisen || {}).forEach(([land, reise]) => {
                if (!reise || typeof reise !== "object") return;
                Object.entries(reise).forEach(([kategorie, liste]) => {
                    if (!Array.isArray(liste)) return;
                    liste.forEach(e => push("reisen", e.text || kategorie || "Reiseausgabe", e.betrag, e.datum, `${land} · ${kategorie}`, { id:e.id, land, kategorie }));
                });
            });
            return out.sort((a,b) => dependencies.datumZeitwert(b.datum) - dependencies.datumZeitwert(a.datum));
        }

        function globalArchivBereichLabel(bereich) {
            return ({ haushalt:"🛒 Haushalt", freizeit:"🎉 Freizeit", fixkosten:"📌 Fixkosten", versicherungen:"🛡️ Versicherungen", einnahmen:"💰 Einnahmen", reisen:"✈️ Reisen" })[bereich] || bereich;
        }

        function populateGlobalArchivJahre() {
            const select = document.getElementById("globalArchivJahr");
            if (!select) return;
            const aktuell = select.value || "alle";
            const jahre = [...new Set(globalArchivEintraege().map(e => String(dependencies.parseISODate(e.datum)?.getFullYear() || "")).filter(Boolean))].sort((a,b)=>b-a);
            select.innerHTML = '<option value="alle">Alle Jahre</option>' + jahre.map(j => `<option value="${j}">${j}</option>`).join("");
            select.value = jahre.includes(aktuell) ? aktuell : "alle";
        }

        function renderGlobalArchiv() {
            const container = document.getElementById("globalArchivListe");
            if (!container) return;
            populateGlobalArchivJahre();
            let liste = filterGlobalArchivRecords(globalArchivEintraege());

            if (!liste.length) {
                container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Keine Einträge gefunden</div><div class="empty-state-text">Passe Suche oder Filter an.</div></div>`;
                return;
            }

            const gruppen = {};
            liste.forEach(e => {
                const d = dependencies.parseISODate(e.datum);
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                gruppen[y] ??= {};
                gruppen[y][m] ??= [];
                gruppen[y][m].push(e);
            });

            let html = "";
            Object.keys(gruppen).sort((a,b)=>b-a).forEach(y => {
                html += `<div class="archive-year">${y}</div>`;
                Object.keys(gruppen[y]).sort((a,b)=>b-a).forEach(m => {
                    const key = `${y}-${String(m).padStart(2,"0")}`;
                    const entries = gruppen[y][m];
                    const offen = context.session.state.offeneArchivMonate[key] !== false;
                    const ausgaben = entries.filter(e=>!e.positiv).reduce((s,e)=>s+e.betrag,0);
                    const einnahmen = entries.filter(e=>e.positiv).reduce((s,e)=>s+e.betrag,0);
                    const sumText = einnahmen > 0 ? `${dependencies.formatBetrag(ausgaben)} · +${dependencies.formatBetrag(einnahmen)}` : dependencies.formatBetrag(ausgaben);
                    html += `<div class="archive-month"><div class="archive-month-head" onclick="toggleGlobalArchivMonat('${key}')"><div class="archive-month-title">${offen?'▾':'▸'} ${dependencies.getMonatName(parseInt(m))}</div><div class="archive-month-sum">${sumText}</div></div>`;
                    if (offen) {
                        entries.forEach(e => {
                            html += `<div class="archive-entry"><div class="archive-entry-main"><div class="archive-entry-type">${globalArchivBereichLabel(e.bereich)}${e.ausgeblendet ? ' · 👁️‍🗨️ Ausgeblendet' : ''}</div><div class="archive-entry-title">${dependencies.escapeHtml(e.titel)}</div><div class="archive-entry-meta">${dependencies.formatDatum(e.datum)}${e.meta ? ' · '+dependencies.escapeHtml(e.meta) : ''}</div>${e.ausgeblendet && e.id != null ? `<button type="button" onclick="event.stopPropagation(); eintragEinblenden('${e.bereich}','${e.id}')" style="width:auto;margin:8px 0 0;padding:7px 10px;background:#3a3a3c;font-size:12px;">👁️ Einblenden</button>` : ''}</div><div class="archive-entry-amount">${e.positiv?'+':''}${dependencies.formatBetrag(e.betrag)}</div></div>`;
                        });
                    }
                    html += `</div>`;
                });
            });
            container.innerHTML = html;
        }

        function toggleGlobalArchivMonat(key) {
            context.session.state.offeneArchivMonate[key] = context.session.state.offeneArchivMonate[key] === false ? true : false;
            renderGlobalArchiv();
        }

return { openGlobalArchiv, resetGlobalArchivFilter, getGlobalArchivFilter, globalArchivRohEintraege, filterGlobalArchivRecords, setGlobalArchivTransferStatus, archivExportBasisName, csvCell, downloadFile, exportGlobalArchiv, archivFingerprint, vorhandeneArchivFingerprints, importiereArchivRecord, importGlobalArchiv, globalArchivEintraege, globalArchivBereichLabel, populateGlobalArchivJahre, renderGlobalArchiv, toggleGlobalArchivMonat };
});
