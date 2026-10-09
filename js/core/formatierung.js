Kostentracker.module({
  "id": "js/core/formatierung.js",
  "dependencies": [
    "aktuellerTag"
  ],
  "session": [],
  "read": [],
  "write": [],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/core/formatierung.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function daysBetween(a,b){return Math.round((b-a)/86400000);}

        function getAktuellerMonat() {
            return new Date().getMonth() + 1;
        }

        function heuteISO() {
            const d = new Date();
            const jahr = d.getFullYear();
            const monat = String(d.getMonth() + 1).padStart(2, "0");
            const tag = String(d.getDate()).padStart(2, "0");
            return `${jahr}-${monat}-${tag}`;
        }

        function tagAusDatum(datum) {
            const tag = parseInt(String(datum || "").split("-")[2], 10);
            if (isNaN(tag)) return dependencies.aktuellerTag();
            return Math.min(Math.max(tag, 1), 31);
        }

        function datumAusTagAktuellerMonat(tag) {
            const heute = new Date();
            const jahr = heute.getFullYear();
            const monatIndex = heute.getMonth();
            const letzterTagImMonat = new Date(jahr, monatIndex + 1, 0).getDate();
            const sichererTag = Math.min(Math.max(parseInt(tag, 10) || heute.getDate(), 1), letzterTagImMonat);
            const monat = String(monatIndex + 1).padStart(2, "0");
            const tagString = String(sichererTag).padStart(2, "0");
            return `${jahr}-${monat}-${tagString}`;
        }

        function parseISODate(datum) {
            if (!datum) return null;

            const parts = String(datum).split("-").map(Number);
            if (parts.length !== 3) return null;

            const [jahr, monat, tag] = parts;
            if (!jahr || !monat || !tag) return null;

            const d = new Date(jahr, monat - 1, tag);
            if (isNaN(d)) return null;

            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }

        function startOfToday() {
            const d = new Date();
            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }

        function addDays(datum, tage) {
            const d = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
            d.setDate(d.getDate() + tage);
            return d;
        }

        function isoAusDate(datum) {
            const jahr = datum.getFullYear();
            const monat = String(datum.getMonth() + 1).padStart(2, "0");
            const tag = String(datum.getDate()).padStart(2, "0");
            return `${jahr}-${monat}-${tag}`;
        }

        function formatKurzDatum(datum) {
            return `${String(datum.getDate()).padStart(2, "0")}.${String(datum.getMonth() + 1).padStart(2, "0")}.`;
        }

        function generateId() {
            return Date.now() + Math.random();
        }

        function getSearchTerm(id) {
            return (document.getElementById(id)?.value || "").trim().toLocaleLowerCase("de-DE");
        }

        function matchesSearch(term, ...werte) {
            if (!term) return true;
            return werte.some(v => String(v ?? "").toLocaleLowerCase("de-DE").includes(term));
        }

        function datumZeitwert(value) {
            const d = parseISODate ? parseISODate(value) : new Date(value);
            return d && !isNaN(d) ? d.getTime() : 0;
        }

        function createItem(html, marginLeft = 0) {
            let div = document.createElement("div");
            div.className = "item";
            div.style.marginLeft = marginLeft + "px";
            div.innerHTML = html;
            return div;
        }

        function escapeHtml(value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function formatDatum(d) {
            if (!d) return "";
            let parts = d.split("-");
            return parts[2] + "." + parts[1] + "." + parts[0];
        }

        function getMonatName(m) {

            const monate = [
                "Januar", "Februar", "März", "April", "Mai", "Juni",
                "Juli", "August", "September", "Oktober", "November", "Dezember"
            ];

            if (!m || m < 1 || m > 12) return "-";

            return monate[m - 1];
        }

        function parseBetrag(value) {
            if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
            if (value === null || value === undefined) return NaN;
            let text = String(value).trim()
                .replace(/\s/g, "")
                .replace(/€/g, "");

            // German input: 1.234,56 -> 1234.56; 23,10 -> 23.10
            if (text.includes(",")) {
                text = text.replace(/\./g, "").replace(",", ".");
            }
            return Number(text);
        }

        function formatInputBetrag(value) {
            const number = parseBetrag(value);
            if (!Number.isFinite(number)) return "";
            return number.toFixed(2).replace(".", ",");
        }

        function formatBetragText(betrag) {
            let value = parseBetrag(betrag);
            if (!Number.isFinite(value)) value = 0;
            return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
        }

        function formatBetrag(betrag) {
            return `
        <span style="white-space:nowrap; font-weight:600;">
            ${formatBetragText(betrag)}
        </span>
    `;
        }

        function bindOnce(el, event, handler) {
            if (!el) return;
            el.onkeydown = null; // 🔥 ALTEN CLEANEN
            el.addEventListener(event, handler);
        }

function formatText(text) {
            if (!text) return "";
            return String(text).trim();
        }

function formatDateGroupLabel(value) {
            const d = value instanceof Date ? new Date(value) : parseISODate(value);
            if (!d || isNaN(d)) return "Ohne Datum";
            const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            const heute = heuteISO();
            const gesternDate = addDays(startOfToday(), -1);
            const gestern = `${gesternDate.getFullYear()}-${String(gesternDate.getMonth()+1).padStart(2,"0")}-${String(gesternDate.getDate()).padStart(2,"0")}`;
            if (iso === heute) return "Heute";
            if (iso === gestern) return "Gestern";
            return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
        }

function appendDateGroupHeader(container, value, options = {}) {
            if (!container) return;
            const el = document.createElement("div");
            const hasTotal = Number.isFinite(Number(options.total));
            el.className = `date-group-title${options.first ? " first" : ""}${options.inset ? " inset" : ""}${hasTotal ? " has-total" : ""}`;
            const left = document.createElement("span");
            left.textContent = options.label || formatDateGroupLabel(value);
            if (options.note) {
                const small = document.createElement("small");
                small.textContent = options.note;
                left.appendChild(small);
            }
            el.appendChild(left);
            if (hasTotal) {
                const total = document.createElement("span");
                total.className = "date-group-total";
                total.textContent = formatBetragText(Number(options.total));
                el.appendChild(total);
            }
            container.appendChild(el);
        }

function datumAlsLokalenTag(datum) {
            const m = String(datum || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return null;
            const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            d.setHours(0,0,0,0);
            return d;
        }

function istInLetztenTagen(datum, tage = 7) {
            const d = datumAlsLokalenTag(datum);
            if (!d) return false;
            const heute = new Date();
            heute.setHours(0,0,0,0);
            const start = new Date(heute);
            start.setDate(start.getDate() - (tage - 1));
            return d >= start && d <= heute;
        }

return { daysBetween, getAktuellerMonat, heuteISO, tagAusDatum, datumAusTagAktuellerMonat, parseISODate, startOfToday, addDays, isoAusDate, formatKurzDatum, generateId, getSearchTerm, matchesSearch, datumZeitwert, createItem, escapeHtml, formatDatum, getMonatName, parseBetrag, formatInputBetrag, formatBetragText, formatBetrag, bindOnce, formatText, formatDateGroupLabel, appendDateGroupHeader, datumAlsLokalenTag, istInLetztenTagen };
});
