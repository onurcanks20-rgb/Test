Kostentracker.module({
    id: "js/budget/zeitraeume.js",
    dependencies: [
        "addDays", "berechneterGehaltstag", "einnahmenZahlungenImZeitraum",
        "freizeitImZeitraum", "geplanteAusgabenImZeitraum", "getGehaltszeitraum",
        "getStartgehalt", "haushaltImZeitraum", "isoAusDate", "laufendeKostenImZeitraum",
        "parseBetrag", "parseISODate", "rundeCent", "sparenInvestierenAktivImZeitraum",
        "summeBetraege", "versicherungsZahlungenImZeitraum"
    ],
    session: [],
    read: ["Einstellungen", "Haushalt", "Freizeit", "Reisen", "Einnahmen",
        "Laufende Kosten", "Versicherungen", "Geplante Ausgaben", "Sparen & Investieren"],
    write: [],
    replace: false
}, (context, d) => {
    "use strict";

    const array = value => Array.isArray(value) ? value : [];
    const lists = object => Object.values(object || {}).flatMap(array);
    const iso = date => d.isoAusDate(date);
    const amount = list => d.summeBetraege(list);

    function statistikDaten() {
        const data = context.repository.view;
        const current = d.getGehaltszeitraum();
        const salaries = data.Einstellungen?.startgehaelter || {};
        const currentKey = iso(current.start);
        const travel = Object.entries(data.Reisen || {}).flatMap(([country, categories]) =>
            Object.entries(categories || {}).flatMap(([category, entries]) =>
                array(entries).map(entry => ({...entry, name: entry?.text || category, region: country, kategorie: category}))));
        const recordedDates = [
            ...lists(data.Haushalt), ...lists(data.Freizeit), ...travel, ...array(data.Einnahmen),
            ...array(data["Laufende Kosten"]?.fix), ...array(data.Versicherungen),
            ...array(data["Geplante Ausgaben"]), ...array(data["Sparen & Investieren"])
        ];
        const starts = new Map([[currentKey, current.start]]);
        let earliest = current.start;
        for (const key of Object.keys(salaries)) {
            const date = d.parseISODate(key);
            if (date && iso(date) === key && date <= current.start) {
                starts.set(key, date);
                if (date < earliest) earliest = date;
            }
        }
        for (const entry of recordedDates) {
            const date = d.parseISODate(entry?.datum);
            if (date && date < earliest) earliest = date;
        }

        const scheduledDay = (year, month) => d.berechneterGehaltstag(year, month, current.gehaltstag);
        // Bestätigte oder gespeicherte Starts ersetzen den nächstliegenden regulären Gehaltstag.
        const covered = new Set();
        for (const date of starts.values()) {
            const year = date.getFullYear(), month = date.getMonth();
            const nearest = [-1, 0, 1].map(offset => scheduledDay(year, month + offset))
                .reduce((best, day) => Math.abs(day - date) < Math.abs(best - date) ? day : best);
            covered.add(iso(nearest));
        }

        let month = new Date(earliest.getFullYear(), earliest.getMonth() - 2, 1);
        const lastMonth = new Date(current.start.getFullYear(), current.start.getMonth(), 1);
        while (month <= lastMonth) {
            const date = scheduledDay(month.getFullYear(), month.getMonth());
            const key = iso(date);
            if (date < current.start && !covered.has(key)) starts.set(key, date);
            month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        }
        const periods = [...starts].sort((a, b) => a[1] - b[1]).map(([key, start], index, all) => ({
            key, start, ende: all[index + 1] ? d.addDays(all[index + 1][1], -1) : current.ende,
            current: key === currentKey
        })).filter(period => period.ende >= earliest);
        const travelDated = travel.map(entry => ({...entry, datumObj: d.parseISODate(entry.datum)}))
            .filter(entry => entry.datumObj && Number.isFinite(d.parseBetrag(entry.betrag)));

        function auswertung(period) {
            const {start, ende} = period;
            const through = ende < current.heute ? ende : current.heute;
            const expenses = [
                ["haushalt", "Haushalt", d.haushaltImZeitraum(start, through)],
                ["freizeit", "Freizeit", d.freizeitImZeitraum(start, through)],
                ["fixkosten", "Fixkosten", d.laufendeKostenImZeitraum(start, through)],
                ["versicherungen", "Versicherungen", d.versicherungsZahlungenImZeitraum(start, through)],
                ["reisen", "Reisen", travelDated.filter(entry => entry.datumObj >= start && entry.datumObj <= through)]
            ];
            const groups = expenses.map(([key, label, entries]) => ({key, label, entries, total: amount(entries)}));
            const income = d.einnahmenZahlungenImZeitraum(start, through);
            const savings = d.sparenInvestierenAktivImZeitraum(start, through);
            const planned = d.geplanteAusgabenImZeitraum(start, ende);
            const salary = Object.hasOwn(salaries, period.key) && Number.isFinite(d.parseBetrag(salaries[period.key]))
                ? d.getStartgehalt(period) : null;
            const values = Object.fromEntries(groups.map(group => [group.key, group.total]));
            Object.assign(values, {
                gehalt: salary, einnahmen: amount(income), ausgaben: d.summeBetraege(groups, group => group.total),
                sparen: amount(savings), geplant: amount(planned)
            });
            values.rest = salary === null ? null : d.rundeCent(salary + values.einnahmen - values.ausgaben - values.sparen);
            return {values, groups, income, savings, planned};
        }

        return {periods, auswertung};
    }

    return {statistikDaten};
});
