// Kostentracker Test: js/kategorien/alltag-gemeinsam.js
// Functions share the existing app state; initialize only in app/start.js.

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

        function alleAusgabenAusBereich(typ) {
            const quelle = typ === "freizeit" ? daten.Freizeit : daten.Haushalt;
            const liste = [];
            Object.values(quelle || {}).forEach(arr => {
                if (Array.isArray(arr)) arr.forEach(e => { if (e) liste.push(e); });
            });
            return liste;
        }

        function renderBereichWocheninfo(typ) {
            const istFreizeit = typ === "freizeit";
            const totalEl = document.getElementById(istFreizeit ? "freizeitWeekTotal" : "haushaltWeekTotal");
            const breakdownEl = document.getElementById(istFreizeit ? "freizeitWeekBreakdown" : "haushaltWeekBreakdown");
            if (!totalEl || !breakdownEl) return;

            const heute = startOfToday();
            const montag = montagDerWoche(heute);
            const liste = alleAusgabenAusBereich(typ).filter(e => {
                const d = datumAlsLokalenTag(e.datum);
                return d && d >= montag && d <= heute;
            });

            const gesamt = liste.reduce((sum, e) => sum + (Number(e.betrag) || 0), 0);
            totalEl.innerHTML = formatBetrag(gesamt);

            if (!liste.length) {
                breakdownEl.textContent = "Noch keine Ausgaben diese Woche.";
                return;
            }

            const gruppen = {};
            liste.forEach(e => {
                const kat = e.kategorie || "Sonstiges";
                gruppen[kat] = (gruppen[kat] || 0) + (Number(e.betrag) || 0);
            });
            const teile = Object.entries(gruppen)
                .sort((a,b) => b[1] - a[1])
                .map(([kat, betrag]) => `${kat}: ${formatBetrag(betrag)}`);
            breakdownEl.innerHTML = teile.join(" · ");
        }

        function alltagZusatztext(e) {
            const text = String(e?.text || e?.name || '').trim();
            const kategorie = String(e?.kategorie || 'Sonstiges').trim();
            if (!text) return '';
            return text.toLocaleLowerCase('de-DE') === kategorie.toLocaleLowerCase('de-DE') ? '' : text;
        }

        function renderRecentAusgaben(typ) {
            const istFreizeit = typ === "freizeit";
            const container = document.getElementById(istFreizeit ? "freizeitListe" : "haushaltListe");
            if (!container) return;
            container.innerHTML = "";
            const suche = getSearchTerm(istFreizeit ? "freizeitSuche" : "haushaltSuche");
            const liste = alleAusgabenAusBereich(typ)
                .filter(e => istInLetztenTagen(e.datum, 7))
                .filter(e => !istEintragAusgeblendet(typ, e.id))
                .filter(e => matchesSearch(suche, e.text, e.name, e.kategorie, e.datum, e.betrag))
                .sort((a,b) => datumZeitwert(b.datum) - datumZeitwert(a.datum));

            if (!liste.length) {
                container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${istFreizeit ? '🎉' : '🛒'}</div><div class="empty-state-title">Keine Ausgaben in den letzten 7 Tagen</div><div class="empty-state-text">${istFreizeit ? 'Deine neuen Freizeit-Ausgaben erscheinen hier.' : 'Deine neuen Haushalts-Ausgaben erscheinen hier.'}</div></div>`;
                return;
            }

            const offenMap = istFreizeit ? state.offeneFreizeitEintraege : state.offeneHaushaltEintraege;
            const tagesSummen = {};
            liste.forEach(e => {
                const key = e.datum || "ohne-datum";
                tagesSummen[key] = (tagesSummen[key] || 0) + (Number(e.betrag) || 0);
            });
            let letzterTag = null;

            liste.forEach(e => {
                const tagKey = e.datum || "ohne-datum";
                if (tagKey !== letzterTag) {
                    appendDateGroupHeader(container, e.datum, { first: letzterTag === null, total: tagesSummen[tagKey] || 0 });
                    letzterTag = tagKey;
                }
                const isEdit = istFreizeit ? String(state.editFreizeitId) === String(e.id) : String(state.editHaushaltId) === String(e.id);
                let html;
                if (isEdit) {
                    html = istFreizeit ? `
                        <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                            <input id="editFreizeitBetrag-${e.id}" type="text" inputmode="decimal" value="${formatInputBetrag(e.betrag)}" placeholder="Betrag" enterkeyhint="next">
                            <input id="editFreizeitText-${e.id}" value="${escapeHtml(e.text || e.name || '')}" autocapitalize="words" placeholder="Genauere Beschreibung (optional)" enterkeyhint="next">
                            <input id="editFreizeitDatum-${e.id}" type="date" value="${e.datum || ''}">
                            <div style="display:flex; gap:10px;"><button onclick="saveEditFreizeit('${e.id}')">💾 Speichern</button><button onclick="cancelEditFreizeit()">❌ Abbrechen</button></div>
                        </div>` : `
                        <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                            <input id="editBetrag-${e.id}" type="text" inputmode="decimal" value="${formatInputBetrag(e.betrag)}" placeholder="Betrag" enterkeyhint="next">
                            <input id="editText-${e.id}" value="${escapeHtml(e.text || e.name || '')}" autocapitalize="words" placeholder="Genauere Beschreibung (optional)" enterkeyhint="next">
                            <input id="editDatum-${e.id}" type="date" value="${e.datum || ''}">
                            <div style="display:flex; gap:10px;"><button onclick="saveEditHaushalt('${e.id}')">💾 Speichern</button><button onclick="cancelEditHaushalt()">❌ Abbrechen</button></div>
                        </div>`;
                } else {
                    const zusatz = alltagZusatztext(e);
                    html = `<div class="compact-alltag-content">
                        <div class="compact-alltag-main">
                            <span class="compact-alltag-title">${escapeHtml(e.kategorie || 'Sonstiges')}</span>
                            ${zusatz ? `<span class="compact-alltag-sub">${escapeHtml(zusatz)}</span>` : ''}
                        </div>
                        <strong class="compact-alltag-amount">${formatBetrag(e.betrag)}</strong>
                        <div class="actions" style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                            <button onclick="event.stopPropagation(); moveAusgabe('${typ}','${e.id}')" title="Verschieben">↪️</button>
                            <button class="edit" onclick="event.stopPropagation(); ${istFreizeit ? `startEditFreizeit('${e.id}')` : `startEditHaushalt('${e.id}')`}">✏️</button>
                            <button class="delete" onclick="event.stopPropagation(); ${istFreizeit ? `deleteFreizeit('${e.id}')` : `deleteHaushalt('${e.id}')`}">🗑️</button>
                        </div>
                    </div>`;
                }
                const item = createItem(html);
                if (!isEdit) item.classList.add("compact-alltag-card");
                item.style.background = "#3a3a3c";
                container.appendChild(item);
                if (isEdit) setTimeout(() => istFreizeit ? setupFreizeitEditEnterFlow(e.id) : setupHaushaltEditEnterFlow(e.id), 0);
            });
        }

        function toggleAlltagsDetails(typ, id) {
            const map = typ === 'freizeit' ? state.offeneFreizeitEintraege : state.offeneHaushaltEintraege;
            const key = String(id);
            map[key] = !map[key];
            renderRecentAusgaben(typ);
        }
