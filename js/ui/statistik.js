Kostentracker.module({
    id: "js/ui/statistik.js",
    dependencies: ["statistikDaten", "formatDatum", "formatBetragText", "isoAusDate", "escapeHtml", "rundeCent"],
    session: [], read: [], write: [], replace: false
}, (context, d) => {
    "use strict";

    const el = id => document.getElementById(id);
    const esc = value => d.escapeHtml(value);
    const money = value => value === null ? "–" : d.formatBetragText(value);
    const metrics = [
        ["ausgaben", "Gesamtausgaben"], ["gehalt", "Gehalt"], ["einnahmen", "Weitere Einnahmen"],
        ["sparen", "Sparen & Investieren"], ["rest", "Verbleibend"], ["haushalt", "Haushalt"],
        ["freizeit", "Freizeit"], ["fixkosten", "Fixkosten"], ["versicherungen", "Versicherungen"],
        ["reisen", "Reisen"], ["geplant", "Geplante Ausgaben"]
    ];
    const months = new Intl.DateTimeFormat("de-DE", {month: "short", year: "2-digit"});
    const axis = new Intl.NumberFormat("de-DE", {notation: "compact", maximumFractionDigits: 1});
    let mode = "overview", selectedKey, comparisonKeys = [], activeMetric = "ausgaben";
    let data, latestKey;
    const cache = new Map();

    function formatPeriod(period) {
        const start = d.formatDatum(period.key);
        const end = d.formatDatum(d.isoAusDate(period.ende));
        return `${start.slice(0, 6)}${start.slice(6) === end.slice(6) ? "" : start.slice(6)} – ${end}`;
    }

    function analysis(period) {
        if (!cache.has(period.key)) cache.set(period.key, data.auswertung(period));
        return cache.get(period.key);
    }

    function pair(label, value, css = "stat-row") {
        return `<div class="${css}"><span>${esc(label)}</span><strong>${esc(money(value))}</strong></div>`;
    }

    function entryRows(entries, fallback) {
        return entries.map(entry => pair(
            [entry.region, entry.text || entry.name || entry.kategorie || fallback].filter(Boolean).join(" · "),
            entry.betrag, "stat-detail-row"
        )).join("");
    }

    function summaryLine(label, total, entries, fallback) {
        if (!entries.length) return pair(label, total);
        const detail = entryRows(entries, fallback);
        if (entries.length === 1) return `<div class="stat-item">${pair(label, total)}${detail}</div>`;
        return `<details class="stat-item"><summary class="stat-row"><span>${esc(label)}</span><strong>${esc(money(total))}</strong></summary>${detail}</details>`;
    }

    function summary(index) {
        const period = data.periods[index];
        const {values, groups, income, savings, planned} = analysis(period);
        el("statsPeriod").textContent = formatPeriod(period);
        el("statsPeriodStatus").textContent = period.current ? "Laufender Zeitraum · Stand heute" : "";
        el("statsPrevious").disabled = index === 0;
        el("statsNext").disabled = index === data.periods.length - 1;
        el("statsCompareButton").disabled = data.periods.length < 2;
        const groupsWithEntries = groups.filter(group => group.entries.length);
        const breakdown = groupsWithEntries.map(group => summaryLine(group.label, group.total, group.entries, group.label)).join("");
        el("statsSummary").innerHTML = [
            pair("Gehalt", values.gehalt),
            values.gehalt === null ? '<p class="stat-note stat-inset">Für diesen Zeitraum ist kein Gehalt erfasst.</p>' : "",
            summaryLine("Weitere Einnahmen", values.einnahmen, income, "Einnahme"),
            breakdown ? `<details class="stat-item"><summary class="stat-row"><span>Ausgaben</span><strong>${esc(money(values.ausgaben))}</strong></summary><div class="stat-groups">${breakdown}</div></details>` : pair("Ausgaben", values.ausgaben),
            summaryLine("Sparen & Investieren", values.sparen, savings.map(entry => ({
                ...entry, name: entry.typ === "investieren" ? "Investieren" : "Sparen"
            })), "Sparen & Investieren"),
            pair("Verbleibend", values.rest, "stat-row stat-remainder")
        ].join("");
        el("statsPlanned").innerHTML = summaryLine("Geplante Ausgaben", values.geplant, planned, "Geplante Ausgabe");
    }

    function renderComparison() {
        const periods = [...data.periods].reverse();
        const first = periods.find(period => period.key === comparisonKeys[0]) || periods[0];
        const second = periods.find(period => period.key === comparisonKeys[1] && period.key !== first.key)
            || periods.find(period => period.key !== first.key);
        if (!second) return;
        comparisonKeys = [first.key, second.key];
        for (const [id, chosen, other] of [["statsFirst", first, second], ["statsSecond", second, first]]) {
            el(id).innerHTML = periods.filter(period => period.key !== other.key).map(period =>
                `<option value="${esc(period.key)}">${esc(formatPeriod(period))}</option>`).join("");
            el(id).value = chosen.key;
        }
        const [later, earlier] = first.start > second.start ? [first, second] : [second, first];
        el("statsCompareNote").hidden = !later.current;
        const a = analysis(later).values, b = analysis(earlier).values;
        el("statsComparisonResult").innerHTML = [
            ["gehalt", "Gehalt"], ["einnahmen", "Weitere Einnahmen"], ["ausgaben", "Ausgaben"],
            ["sparen", "Sparen & Investieren"], ["rest", "Verbleibend"], ["geplant", "Geplante Ausgaben"]
        ].map(([key, label]) => {
            const diff = a[key] === null || b[key] === null ? null : d.rundeCent(a[key] - b[key]);
            const change = diff === null ? "" : diff === 0 ? "Unverändert" : `${money(Math.abs(diff))} ${diff > 0 ? "mehr" : "weniger"}`;
            return `<section class="stat-card stat-compare-card"><header><h4>${esc(label)}</h4><span>${esc(change)}</span></header>
                ${pair(formatPeriod(later), a[key])}${pair(formatPeriod(earlier), b[key])}</section>`;
        }).join("");
    }

    function renderTrend() {
        const periods = data.periods;
        const values = periods.map(period => analysis(period).values[activeMetric]);
        const valid = values.filter(value => value !== null);
        const chart = el("statsChart"), caption = el("statsPoint");
        if (!valid.length) {
            caption.textContent = "Für diese Kennzahl sind noch keine Werte erfasst.";
            chart.replaceChildren();
            return;
        }

        const width = Math.max(300, 64 + periods.length * 56);
        const left = 51, right = width - 51, top = 19, bottom = 159;
        const min = valid.reduce((min, value) => Math.min(min, value), 0);
        const max = valid.reduce((max, value) => Math.max(max, value), 0);
        const chartMax = min === max ? 1 : max;
        const x = index => periods.length === 1 ? (left + right) / 2 : left + index * (right - left) / (periods.length - 1);
        const y = value => bottom - (value - min) / (chartMax - min) * (bottom - top);
        let previous = null;
        const path = values.map((value, index) => {
            const segment = value === null ? "" : `${previous === null ? "M" : "L"}${x(index)} ${y(value)}`;
            previous = value;
            return segment;
        }).join(" ");
        const grid = Array.from({length: 5}, (_, index) => {
            const value = min + (chartMax - min) * index / 4;
            const lineY = y(value);
            const label = `${esc(axis.format(value))} €`;
            return `<line x1="${left}" x2="${right}" y1="${lineY}" y2="${lineY}"/>
                <text x="${left - 6}" y="${lineY + 4}" text-anchor="end">${label}</text>
                <text x="${right + 6}" y="${lineY + 4}">${label}</text>`;
        }).join("");
        const labels = periods.map((period, index) =>
            `<text x="${x(index)}" y="181" text-anchor="middle">${esc(months.format(period.start))}</text>`).join("");
        const points = values.map((value, index) => value === null ? "" :
            `<g role="button" tabindex="0" class="stat-dot" data-index="${index}" aria-label="${esc(formatPeriod(periods[index]) + ", " + money(value))}">
                <circle r="14" cx="${x(index)}" cy="${y(value)}" fill="transparent"/><circle r="4" cx="${x(index)}" cy="${y(value)}" class="stat-dot-mark"/>
            </g>`).join("");
        chart.innerHTML = `<svg viewBox="0 0 ${width} 196" style="min-width:${width}px" aria-label="Verlauf über alle Gehaltszeiträume">
            <g class="stat-grid" aria-hidden="true">${grid}${labels}</g><path class="stat-line" d="${path}"/>${points}</svg>`;
        const dots = [...chart.querySelectorAll(".stat-dot")];
        function focusPoint(dot) {
            const index = Number(dot.dataset.index);
            caption.textContent = `${formatPeriod(periods[index])} · ${money(values[index])}`;
            chart.querySelector(".stat-dot.active")?.classList.remove("active");
            dot.classList.add("active");
        }
        for (const dot of dots) {
            dot.addEventListener("click", () => focusPoint(dot));
            dot.addEventListener("focus", () => focusPoint(dot));
            dot.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                focusPoint(dot);
            });
        }
        focusPoint(dots.at(-1));
        chart.scrollLeft = chart.scrollWidth;
    }

    function render() {
        const periods = data.periods;
        const index = periods.findIndex(period => period.key === selectedKey);
        const selected = index < 0 ? periods.length - 1 : index;
        selectedKey = periods[selected].key;
        if (mode === "compare" && periods.length < 2) mode = "overview";
        el("statsOverview").hidden = mode !== "overview";
        el("statsTrend").hidden = mode !== "trend";
        el("statsComparison").hidden = mode !== "compare";
        el("statsOverviewButton").setAttribute("aria-pressed", String(mode !== "trend"));
        el("statsTrendButton").setAttribute("aria-pressed", String(mode === "trend"));
        if (mode === "trend") renderTrend();
        else if (mode === "compare") renderComparison();
        else summary(selected);
    }

    function renderStatistik() {
        if (!el("statsOverview")) return;
        const followLatest = !selectedKey || selectedKey === latestKey;
        data = d.statistikDaten();
        latestKey = data.periods.at(-1).key;
        if (followLatest) selectedKey = latestKey;
        cache.clear();
        render();
    }

    function shiftPeriod(step) {
        if (!data) return;
        const periods = data.periods;
        const index = periods.findIndex(period => period.key === selectedKey);
        if (!periods[index + step]) return;
        selectedKey = periods[index + step].key;
        render();
    }

    function updateStatistik(action, value) {
        if (!data) return;
        switch (action) {
            case "previous": shiftPeriod(-1); break;
            case "next": shiftPeriod(1); break;
            case "overview":
            case "trend":
                if (mode === action) return;
                mode = action;
                render();
                break;
            case "compare": {
                const index = data.periods.findIndex(period => period.key === selectedKey);
                const other = data.periods[index - 1] || data.periods[index + 1];
                if (!other) return;
                comparisonKeys = [selectedKey, other.key];
                mode = "compare";
                render();
                el("statsCompareTitle").focus();
                break;
            }
            case "back":
                mode = "overview";
                render();
                el("statsCompareButton").focus();
                break;
            case "first":
            case "second":
                comparisonKeys[action === "first" ? 0 : 1] = value;
                renderComparison();
                break;
            case "metric":
                activeMetric = value;
                renderTrend();
        }
    }

    const select = el("statsMetric");
    if (select) select.innerHTML = metrics.map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join("");

    return {renderStatistik, updateStatistik};
});
