Kostentracker.module({
  "id": "js/grafik/diagramme.js",
  "dependencies": [
    "addDays",
    "renderTravelGraphic",
    "berechneterGehaltstag",
    "einnahmenZahlungenImZeitraum",
    "escapeHtml",
    "formatBetrag",
    "formatDatum",
    "freizeitImZeitraum",
    "geplanteAusgabenImZeitraum",
    "getGehaltstag",
    "haushaltImZeitraum",
    "isoAusDate",
    "laufendeKostenImZeitraum",
    "parseBetrag",
    "parseISODate",
    "startOfToday",
    "versicherungsZahlungenImZeitraum"
  ],
  "session": [
    "GRAFIK_COLORS",
    "GRAFIK_LABELS",
    "grafikCompareMode",
    "grafikCompareSelection",
    "grafikRangeType"
  ],
  "read": [
    "Reisen",
    "Sparen & Investieren"
  ],
  "write": [],
  "replace": false
}, (context, dependencies) => {
"use strict";
// Kostentracker Test: js/grafik/diagramme.js
// Privater Modulbereich; Zugriffe ausschließlich über die deklarierten Dienstschnittstellen.

        function grafikSetRange(type, button){
            context.session.grafikRangeType = type;
            ["grafikRangeMonth","grafikRangeSalary","grafikRangeCustom"].forEach(id=>document.getElementById(id)?.classList.remove("selected"));
            button?.classList.add("selected");
            document.getElementById("grafikRangeMonthBox")?.classList.toggle("hidden",type!=="month");
            document.getElementById("grafikRangeSalaryBox")?.classList.toggle("hidden",type!=="salary");
            document.getElementById("grafikRangeCustomBox")?.classList.toggle("hidden",type!=="custom");
            renderGrafik();
        }

        function grafikSalaryPeriodForDate(ref){
            const tag=dependencies.getGehaltstag();
            const gehaltDieser=dependencies.berechneterGehaltstag(ref.getFullYear(),ref.getMonth(),tag);
            let start,next;
            if(ref>=gehaltDieser){ start=gehaltDieser; next=dependencies.berechneterGehaltstag(ref.getFullYear(),ref.getMonth()+1,tag); }
            else { start=dependencies.berechneterGehaltstag(ref.getFullYear(),ref.getMonth()-1,tag); next=gehaltDieser; }
            return {start:new Date(start), ende:dependencies.addDays(next,-1), naechstesGehalt:new Date(next)};
        }

        function grafikPopulateSalaryPeriods(){
            const select=document.getElementById("grafikSalaryPeriod"); if(!select)return;
            const previous=select.value;
            const current=grafikSalaryPeriodForDate(dependencies.startOfToday());
            const rows=[];
            let cursor=new Date(current.start);
            for(let i=0;i<18;i++){
                const z=grafikSalaryPeriodForDate(cursor);
                rows.push(z);
                cursor=dependencies.addDays(z.start,-1);
            }
            select.innerHTML=rows.map((z,i)=>`<option value="${dependencies.isoAusDate(z.start)}|${dependencies.isoAusDate(z.ende)}">${i===0?"Aktuell · ":""}${dependencies.formatDatum(dependencies.isoAusDate(z.start))} – ${dependencies.formatDatum(dependencies.isoAusDate(z.ende))}</option>`).join("");
            if([...select.options].some(o=>o.value===previous))select.value=previous;
        }

        function initGrafik(){
            const month=document.getElementById("grafikMonth");
            const von=document.getElementById("grafikVon"), bis=document.getElementById("grafikBis");
            const today=dependencies.startOfToday();
            if(month&&!month.value)month.value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
            if(von&&!von.value)von.value=dependencies.isoAusDate(new Date(today.getFullYear(),today.getMonth(),1));
            if(bis&&!bis.value)bis.value=dependencies.isoAusDate(today);
            grafikPopulateSalaryPeriods();
            grafikCategoryChanged(false);
            grafikInitCompareDates();
            grafikRenderCompareSelection();
        }

        function grafikGetRange(){
            if(context.session.grafikRangeType==="salary"){
                const raw=document.getElementById("grafikSalaryPeriod")?.value||""; const [a,b]=raw.split("|");
                const start=dependencies.parseISODate(a), ende=dependencies.parseISODate(b); if(start&&ende)return {start,ende,label:`${dependencies.formatDatum(a)} – ${dependencies.formatDatum(b)}`};
            }
            if(context.session.grafikRangeType==="custom"){
                let start=dependencies.parseISODate(document.getElementById("grafikVon")?.value), ende=dependencies.parseISODate(document.getElementById("grafikBis")?.value);
                if(start&&ende&&start>ende)[start,ende]=[ende,start];
                if(start&&ende)return {start,ende,label:`${dependencies.formatDatum(dependencies.isoAusDate(start))} – ${dependencies.formatDatum(dependencies.isoAusDate(ende))}`};
            }
            const raw=document.getElementById("grafikMonth")?.value||""; const m=raw.match(/^(\d{4})-(\d{2})$/);
            const now=dependencies.startOfToday(), y=m?+m[1]:now.getFullYear(), mi=m?+m[2]-1:now.getMonth();
            const start=new Date(y,mi,1), ende=new Date(y,mi+1,0);
            return {start,ende,label:start.toLocaleDateString("de-DE",{month:"long",year:"numeric"})};
        }

        function grafikDays(a,b){ return Math.max(1,Math.round((b-a)/86400000)+1); }

        function grafikEntry(name,value,sub="",date=null){return {name,value:dependencies.parseBetrag(value)||0,sub,date};}

        function grafikTravelEntries(von,bis){
            const out=[];
            Object.entries(context.repository.view.Reisen||{}).forEach(([land,r])=>Object.entries(r||{}).forEach(([kat,list])=>{
                if(!Array.isArray(list))return;
                list.forEach(e=>{const d=dependencies.parseISODate(e.datum); if(d&&d>=von&&d<=bis)out.push(grafikEntry(land,e.betrag,kat,d));});
            }));
            return out;
        }

        function grafikSavingsEntries(von,bis){
            // Sparen & Investieren gilt einmal pro Gehaltsperiode.
            // Fuer die Grafik wird der Betrag dem Start der Gehaltsperiode (Gehaltstag) zugeordnet.
            // So wird ein Kalendermonat nicht doppelt belastet, nur weil er Teile von zwei
            // Gehaltsperioden enthaelt.
            const out=[];
            let ref=grafikSalaryPeriodForDate(von).start;
            const seen=new Set();

            while(ref<=bis){
                const z=grafikSalaryPeriodForDate(ref);
                const key=dependencies.isoAusDate(z.start);
                if(seen.has(key)){
                    ref=dependencies.addDays(ref,1);
                    continue;
                }
                seen.add(key);

                // Nur Perioden zaehlen, deren Startdatum im ausgewaehlten Zeitraum liegt.
                if(z.start>=von && z.start<=bis){
                    (context.repository.view["Sparen & Investieren"]||[]).forEach(e=>{
                        const valid=dependencies.parseISODate(e.datum);
                        // Wie in der Budgetlogik gilt ein Eintrag fuer die Periode,
                        // sobald "Gueltig ab" spaetestens innerhalb dieser Periode liegt.
                        if(valid && valid<=z.ende){
                            out.push(grafikEntry(e.typ==="sparen"?"Sparen":"Investieren",e.betrag,e.typ,z.start));
                        }
                    });
                }
                ref=dependencies.addDays(z.ende,1);
            }
            return out;
        }

        function grafikEntries(category,von,bis){
            if(category==="haushalt")return dependencies.haushaltImZeitraum(von,bis).map(e=>grafikEntry(e.kategorie||"Sonstiges",e.betrag,e.kategorie||"Sonstiges",e.datumObj));
            if(category==="freizeit")return dependencies.freizeitImZeitraum(von,bis).map(e=>grafikEntry(e.kategorie||"Sonstiges",e.betrag,e.kategorie||"Sonstiges",e.datumObj));
            if(category==="fixkosten")return dependencies.laufendeKostenImZeitraum(von,bis).map(e=>grafikEntry(e.name||"Fixkosten",e.betrag,e.name||"Fixkosten",e.datum));
            if(category==="versicherungen")return dependencies.versicherungsZahlungenImZeitraum(von,bis).map(e=>grafikEntry(e.name||"Versicherung",e.betrag,e.name||"Versicherung",e.datum));
            if(category==="einnahmen")return dependencies.einnahmenZahlungenImZeitraum(von,bis).map(e=>grafikEntry(e.text||"Einnahme",e.betrag,e.text||"Einnahme",e.datumObj));
            if(category==="reisen")return grafikTravelEntries(von,bis);
            if(category==="geplant")return dependencies.geplanteAusgabenImZeitraum(von,bis).map(e=>grafikEntry(e.bereich==="reisen"?(e.land||"Reise"):(e.bereich==="freizeit"?"Freizeit":"Haushalt"),e.betrag,e.kategorie||"Sonstiges",dependencies.parseISODate(e.datum)));
            if(category==="sparen")return grafikSavingsEntries(von,bis);
            return [];
        }

        function grafikCategoryTotals(von,bis){
            return ["haushalt","freizeit","fixkosten","versicherungen","einnahmen","reisen","geplant","sparen"].map(k=>({key:k,name:context.session.GRAFIK_LABELS[k],value:grafikEntries(k,von,bis).reduce((s,e)=>s+e.value,0)})).filter(x=>x.value>0);
        }

        function grafikSubcategories(category){
            if(category==="haushalt")return ["Einkauf","Tanken","Drogerie","Sonstiges"];
            if(category==="freizeit")return ["Essen / Trinken","Aktivität","Geschenke","Sonstiges"];
            if(category==="reisen"){
                const set=new Set(); Object.values(context.repository.view.Reisen||{}).forEach(r=>Object.keys(r||{}).forEach(k=>Array.isArray(r[k])&&set.add(k)));
                return [...set].sort((a,b)=>a.localeCompare(b,"de"));
            }
            if(category==="geplant")return ["Einkauf","Tanken","Drogerie","Essen / Trinken","Geschenke","Essen","Trinken","Aktivität","Transport","Unterkunft","Sonstiges"];
            if(category==="sparen")return ["Sparen","Investieren"];
            return [];
        }

        function grafikInitCompareDates(){
            const range=grafikGetRange();
            const aVon=document.getElementById("grafikCompareAVon"), aBis=document.getElementById("grafikCompareABis"), bVon=document.getElementById("grafikCompareBVon"), bBis=document.getElementById("grafikCompareBBis");
            if(aVon&&!aVon.value)aVon.value=dependencies.isoAusDate(range.start);
            if(aBis&&!aBis.value)aBis.value=dependencies.isoAusDate(range.ende);
            const days=grafikDays(range.start,range.ende);
            if(bVon&&!bVon.value)bVon.value=dependencies.isoAusDate(dependencies.addDays(range.start,-days));
            if(bBis&&!bBis.value)bBis.value=dependencies.isoAusDate(dependencies.addDays(range.start,-1));
        }

        function grafikReadCompareRange(prefix){
            let start=dependencies.parseISODate(document.getElementById(`grafikCompare${prefix}Von`)?.value), ende=dependencies.parseISODate(document.getElementById(`grafikCompare${prefix}Bis`)?.value);
            if(start&&ende&&start>ende)[start,ende]=[ende,start];
            if(!start||!ende)return null;
            return {start,ende,label:`${dependencies.formatDatum(dependencies.isoAusDate(start))} – ${dependencies.formatDatum(dependencies.isoAusDate(ende))}`};
        }

        function grafikSwapComparePeriods(){
            const aVon=document.getElementById("grafikCompareAVon");
            const aBis=document.getElementById("grafikCompareABis");
            const bVon=document.getElementById("grafikCompareBVon");
            const bBis=document.getElementById("grafikCompareBBis");
            if(!aVon||!aBis||!bVon||!bBis)return;
            const av=aVon.value, ab=aBis.value;
            aVon.value=bVon.value;
            aBis.value=bBis.value;
            bVon.value=av;
            bBis.value=ab;
            renderGrafik();
        }

        function grafikToggleCompare(){
            context.session.grafikCompareMode=!context.session.grafikCompareMode;
            const btn=document.getElementById("grafikCompareToggle");
            btn?.classList.toggle("on",context.session.grafikCompareMode);
            if(btn)btn.textContent=context.session.grafikCompareMode?"✓ Vergleich beenden":"⇄ Zeiträume vergleichen";
            document.getElementById("grafikNormalRangeControls")?.classList.toggle("hidden",context.session.grafikCompareMode);
            document.getElementById("grafikComparePeriods")?.classList.toggle("hidden",!context.session.grafikCompareMode);
            document.getElementById("grafikNormalCategoryCard")?.classList.toggle("hidden",context.session.grafikCompareMode);
            document.getElementById("grafikCompareCategoryCard")?.classList.toggle("hidden",!context.session.grafikCompareMode);
            if(context.session.grafikCompareMode){grafikInitCompareDates();grafikRenderCompareSelection();}
            renderGrafik();
        }

        function grafikCompareGroups(){
            return ["haushalt","freizeit","fixkosten","versicherungen","einnahmen","reisen","geplant","sparen"].map(category=>({category,label:context.session.GRAFIK_LABELS[category],subs:grafikSubcategories(category)}));
        }

        function grafikRenderCompareSelection(){
            const host=document.getElementById("grafikCompareSelection"); if(!host)return;
            const selectionLabel=document.getElementById("grafikCompareSelectionSummary");
            if(selectionLabel){
                const count=context.session.grafikCompareSelection.size;
                const allCategories=[...context.session.grafikCompareSelection].every(key=>key.endsWith("|all"));
                selectionLabel.textContent=count?`${count} ${allCategories?(count===1?"Kategorie":"Kategorien"):(count===1?"Auswahl":"Auswahlen")} ausgewählt`:"Kategorien auswählen";
            }
            host.innerHTML=grafikCompareGroups().map(g=>{
                const totalKey=`${g.category}|all`, totalChecked=context.session.grafikCompareSelection.has(totalKey);
                const subRows=g.subs.map(sub=>{const key=`${g.category}|${sub}`;return `<label class="grafik-compare-option"><input type="checkbox" ${context.session.grafikCompareSelection.has(key)?"checked":""} onchange='grafikCompareChoose(${dependencies.escapeHtml(JSON.stringify(g.category))},${dependencies.escapeHtml(JSON.stringify(sub))},this.checked)'><span>${dependencies.escapeHtml(sub)}</span></label>`;}).join("");
                const selectedCount=[...context.session.grafikCompareSelection].filter(k=>k.startsWith(g.category+"|")).length;
                return `<div class="grafik-compare-group"><div class="grafik-compare-group-head" onclick='grafikToggleCompareGroup(${dependencies.escapeHtml(JSON.stringify(g.category))})'><div><div class="grafik-compare-group-title">${dependencies.escapeHtml(g.label)}</div><div class="grafik-compare-group-count">${selectedCount?selectedCount+" ausgewählt":"nichts ausgewählt"}</div></div><span id="grafikCompareChevron-${g.category}">⌄</span></div><div id="grafikCompareOptions-${g.category}" class="grafik-compare-options hidden"><label class="grafik-compare-option"><input type="checkbox" ${totalChecked?"checked":""} onchange='grafikCompareChoose(${dependencies.escapeHtml(JSON.stringify(g.category))},"all",this.checked)'><span>Gesamt</span></label>${subRows}</div></div>`;
            }).join("");
        }

        function grafikToggleCompareGroup(category){
            const el=document.getElementById(`grafikCompareOptions-${category}`), ch=document.getElementById(`grafikCompareChevron-${category}`); if(!el)return;
            const opening=el.classList.contains("hidden"); el.classList.toggle("hidden"); if(ch)ch.textContent=opening?"⌃":"⌄";
        }

        function grafikCompareChoose(category,sub,checked){
            const key=`${category}|${sub}`;
            if(checked){
                if(sub==="all"){[...context.session.grafikCompareSelection].filter(k=>k.startsWith(category+"|")).forEach(k=>context.session.grafikCompareSelection.delete(k));}
                else context.session.grafikCompareSelection.delete(`${category}|all`);
                context.session.grafikCompareSelection.add(key);
            } else context.session.grafikCompareSelection.delete(key);
            grafikRenderCompareSelection();
            const options=document.getElementById(`grafikCompareOptions-${category}`); if(options)options.classList.remove("hidden");
            const ch=document.getElementById(`grafikCompareChevron-${category}`); if(ch)ch.textContent="⌃";
            renderGrafik();
        }

        function grafikCompareRows(rangeA,rangeB){
            const rows=[];
            for(const key of context.session.grafikCompareSelection){
                const [category,...subParts]=key.split("|"), sub=subParts.join("|")||"all";
                let a=grafikEntries(category,rangeA.start,rangeA.ende), b=grafikEntries(category,rangeB.start,rangeB.ende);
                if(sub!=="all"){
                    const match=e=>category==="sparen"?((sub==="Sparen"&&e.sub==="sparen")||(sub==="Investieren"&&e.sub==="investieren")):e.sub===sub;
                    a=a.filter(match); b=b.filter(match);
                }
                rows.push({label:sub==="all"?context.session.GRAFIK_LABELS[category]:`${context.session.GRAFIK_LABELS[category]} · ${sub}`,a:a.reduce((sum,e)=>sum+e.value,0),b:b.reduce((sum,e)=>sum+e.value,0)});
            }
            return rows.filter(r=>r.a>0||r.b>0);
        }

        function grafikComparePeriodLabel(range, fallback) {
            const a=range.start, b=range.ende;
            const fullMonth=a.getDate()===1 && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && b.getDate()===new Date(b.getFullYear(),b.getMonth()+1,0).getDate();
            return fullMonth ? a.toLocaleDateString("de-DE",{month:"long",year:"numeric"}) : (range.label||fallback);
        }

        function grafikCompareDelta(a,b,kind="expense") {
            const value=Math.round((a-b)*100)/100;
            const tone=value===0 || kind==="neutral" ? "neutral" : ((kind==="income" ? value>0 : value<0) ? "less" : "more");
            return {value,tone,sign:value>0?"+":value<0?"−":"",description:value===0?"unverändert":kind==="expense"?(value>0?"mehr ausgegeben":"weniger ausgegeben"):(value>0?"mehr im Zeitraum A":"weniger im Zeitraum A")};
        }

        // Der bisherige Schnittstellenname bleibt erhalten; statt Balken erscheinen exakte Werte.
        function grafikRenderCompareBars(rows,rangeA,rangeB){
            const chart=document.getElementById("grafikChart"), legend=document.getElementById("grafikLegend"); if(!chart||!legend)return;
            legend.innerHTML="";
            if(!rows.length){chart.innerHTML=`<div class="grafik-empty">Für diese Auswahl gibt es in beiden Zeiträumen noch keine passenden Daten.</div>`;return;}
            const labelA=dependencies.escapeHtml(grafikComparePeriodLabel(rangeA,"Zeitraum A")), labelB=dependencies.escapeHtml(grafikComparePeriodLabel(rangeB,"Zeitraum B"));
            const totalA=rows.reduce((sum,row)=>sum+row.a,0),totalB=rows.reduce((sum,row)=>sum+row.b,0);
            const kindFor=row=>row.label.split(" · ")[0]==="Einnahmen"?"income":row.label.split(" · ")[0]==="Sparen & Investieren"?"neutral":"expense";
            const kind=rows.every(row=>kindFor(row)==="expense")?"expense":rows.every(row=>kindFor(row)==="income")?"income":"neutral";
            const delta=grafikCompareDelta(totalA,totalB,kind);
            const percent=totalB!==0?(delta.value/Math.abs(totalB))*100:null;
            const percentText=percent===null?(totalA===0?"Keine Veränderung":"Kein Vergleichswert in Zeitraum B"):`${percent>0?"+":""}${percent.toLocaleString("de-DE",{maximumFractionDigits:1})} % gegenüber Zeitraum B`;
            const summary=delta.value===0?"Keine Veränderung":`${dependencies.formatBetrag(Math.abs(delta.value))} ${delta.description}`;
            const icons={"Haushalt":"cart","Freizeit":"activity","Fixkosten":"receipt","Versicherungen":"shield","Einnahmen":"income","Reisen":"plane","Geplante Ausgaben":"calendar","Sparen & Investieren":"wallet"};
            chart.innerHTML=`<section class="grafik-comparison" aria-label="Zeiträume vergleichen">
                <h3>${kind==="expense"?"Ausgaben im Vergleich":kind==="income"?"Einnahmen im Vergleich":"Werte im Vergleich"}</h3>
                <div class="grafik-comparison-summary">
                    <div class="grafik-comparison-totals"><div><span>A · ${labelA}</span><strong>${dependencies.formatBetrag(totalA)}</strong></div><div><span>B · ${labelB}</span><strong>${dependencies.formatBetrag(totalB)}</strong></div></div>
                    <div class="grafik-comparison-summary-delta"><strong>${summary}</strong><span>${percentText}</span></div>
                </div>
                <h3>Nach Kategorie</h3>
                <div class="grafik-comparison-list">${rows.map(row=>{
                    const delta=grafikCompareDelta(row.a,row.b,kindFor(row));
                    const area=row.label.split(" · ")[0], icon=Object.hasOwn(icons,area)?icons[area]:"spark";
                    return `<article class="grafik-comparison-row"><span class="grafik-comparison-icon"><svg class="alltag-icon" aria-hidden="true"><use href="#alltag-${icon}"></use></svg></span>
                        <div class="grafik-comparison-main"><h4>${dependencies.escapeHtml(row.label)}</h4><div class="grafik-comparison-values"><div><span>A · ${labelA}</span><strong>${dependencies.formatBetrag(row.a)}</strong></div><div><span>B · ${labelB}</span><strong>${dependencies.formatBetrag(row.b)}</strong></div></div></div>
                        <div class="grafik-comparison-delta ${delta.tone}"><strong>${delta.sign}${dependencies.formatBetrag(Math.abs(delta.value))}</strong><span>${delta.description}</span></div>
                    </article>`;
                }).join("")}</div><p class="grafik-comparison-note">Differenz: Zeitraum A minus Zeitraum B</p>
            </section>`;
        }

        function grafikCategoryChanged(doRender=true){
            const category=document.getElementById("grafikCategory")?.value||"all", wrap=document.getElementById("grafikSubcategoryWrap"), select=document.getElementById("grafikSubcategory");
            const subs=grafikSubcategories(category), showSubs=category!=="all"&&subs.length>0;
            wrap?.classList.toggle("hidden",!showSubs);
            if(select&&showSubs){const old=select.value;select.innerHTML=`<option value="all">Alle Unterkategorien</option>`+subs.map(x=>`<option value="${dependencies.escapeHtml(x)}">${dependencies.escapeHtml(x)}</option>`).join("");if([...select.options].some(o=>o.value===old))select.value=old;}
            if(doRender)renderGrafik();
        }

        function grafikGroup(entries){
            const map=new Map(); entries.forEach(e=>map.set(e.name,(map.get(e.name)||0)+e.value));
            return [...map.entries()].map(([name,value])=>({name,value})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
        }

        function grafikPrevRange(range){
            if(context.session.grafikRangeType==="month")return {start:new Date(range.start.getFullYear(),range.start.getMonth()-1,1),ende:new Date(range.start.getFullYear(),range.start.getMonth(),0)};
            if(context.session.grafikRangeType==="salary"){const p=grafikSalaryPeriodForDate(dependencies.addDays(range.start,-1));return {start:p.start,ende:p.ende};}
            const days=grafikDays(range.start,range.ende);return {start:dependencies.addDays(range.start,-days),ende:dependencies.addDays(range.start,-1)};
        }

        function grafikFilteredEntries(category,range){
            let entries=grafikEntries(category,range.start,range.ende); const sub=document.getElementById("grafikSubcategory")?.value||"all";
            if(category!=="all"&&sub!=="all")entries=entries.filter(e=>category==="sparen"?((sub==="Sparen"&&e.sub==="sparen")||(sub==="Investieren"&&e.sub==="investieren")):e.sub===sub);
            return entries;
        }

        function grafikEscapeXml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));}

        function grafikShortLabel(v,max=10){v=String(v);return v.length>max?v.slice(0,Math.max(1,max-1))+"…":v;}

        function grafikRenderDonut(rows,total){
            const chart=document.getElementById("grafikChart"), legend=document.getElementById("grafikLegend"); if(!chart||!legend)return;
            if(!rows.length||total<=0){chart.innerHTML=`<div class="grafik-empty">Für diesen Zeitraum gibt es noch keine passenden Daten.</div>`;legend.innerHTML="";return;}
            let p=0; const parts=rows.map((r,i)=>{const a=p,b=p+(r.value/total)*100;p=b;return `${context.session.GRAFIK_COLORS[i%context.session.GRAFIK_COLORS.length]} ${a}% ${b}%`;});
            chart.innerHTML=`<div class="grafik-donut" style="background:conic-gradient(${parts.join(",")})"><div class="grafik-donut-center"><span>Gesamt</span><strong>${dependencies.formatBetrag(total)}</strong></div></div>`;
            legend.innerHTML=rows.map((r,i)=>`<div class="grafik-legend-item"><span class="grafik-dot" style="background:${context.session.GRAFIK_COLORS[i%context.session.GRAFIK_COLORS.length]}"></span><span class="grafik-legend-name">${dependencies.escapeHtml(r.name)}</span><span class="grafik-legend-value">${dependencies.formatBetrag(r.value)}</span></div>`).join("");
        }

        function grafikMonthlySeries(category,range){
            const rows=[]; let cursor=new Date(range.start.getFullYear(),range.start.getMonth(),1);
            while(cursor<=range.ende){const a=new Date(Math.max(cursor,range.start)), mend=new Date(cursor.getFullYear(),cursor.getMonth()+1,0), b=new Date(Math.min(mend,range.ende));let value;
                if(category==="all")value=grafikCategoryTotals(a,b).reduce((s,x)=>s+x.value,0); else value=grafikFilteredEntries(category,{start:a,ende:b}).reduce((s,e)=>s+e.value,0);
                rows.push({label:cursor.toLocaleDateString("de-DE",{month:"short",year:range.start.getFullYear()!==range.ende.getFullYear()?"2-digit":undefined}),value});cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);}
            return rows;
        }

        function grafikRenderBars(rows){
            const chart=document.getElementById("grafikChart"), legend=document.getElementById("grafikLegend"); if(!chart||!legend)return; legend.innerHTML="";
            if(!rows.length||Math.max(...rows.map(r=>r.value),0)<=0){chart.innerHTML=`<div class="grafik-empty">Für diesen Zeitraum gibt es noch keine passenden Daten.</div>`;return;}
            const W=340,H=220,padL=12,padR=8,padT=12,padB=38,innerW=W-padL-padR,innerH=H-padT-padB,max=Math.max(...rows.map(r=>r.value),1),gap=8,bw=Math.max(8,(innerW-gap*(rows.length-1))/rows.length);
            let svg=`<svg class="grafik-svg" viewBox="0 0 ${W} ${H}" role="img">`;
            [0,.5,1].forEach(t=>{const y=padT+innerH*(1-t);svg+=`<line class="grafik-grid-line" x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"/>`;});
            rows.forEach((r,i)=>{const h=(r.value/max)*innerH,x=padL+i*(bw+gap),y=padT+innerH-h;svg+=`<rect class="grafik-bar" x="${x}" y="${y}" width="${bw}" height="${h}" rx="4"/><text class="grafik-axis-label" x="${x+bw/2}" y="${H-16}" text-anchor="middle">${grafikEscapeXml(grafikShortLabel(r.label))}</text>`;});
            svg+=`</svg>`;chart.innerHTML=svg;
        }

        function grafikRenderLine(rows){
            const chart=document.getElementById("grafikChart"), legend=document.getElementById("grafikLegend"); if(!chart||!legend)return; legend.innerHTML="";
            if(!rows.length||Math.max(...rows.map(r=>r.value),0)<=0){chart.innerHTML=`<div class="grafik-empty">Für diesen Zeitraum gibt es noch keine passenden Daten.</div>`;return;}
            const W=340,H=220,padL=14,padR=14,padT=16,padB=38,innerW=W-padL-padR,innerH=H-padT-padB,max=Math.max(...rows.map(r=>r.value),1),step=rows.length>1?innerW/(rows.length-1):0;
            const pts=rows.map((r,i)=>({x:padL+i*step,y:padT+innerH-(r.value/max)*innerH,...r}));
            let svg=`<svg class="grafik-svg" viewBox="0 0 ${W} ${H}" role="img">`;
            [0,.5,1].forEach(t=>{const y=padT+innerH*(1-t);svg+=`<line class="grafik-grid-line" x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"/>`;});
            svg+=`<polyline class="grafik-line" points="${pts.map(p=>`${p.x},${p.y}`).join(" ")}"/>`;
            pts.forEach((p,i)=>{svg+=`<circle class="grafik-point" cx="${p.x}" cy="${p.y}" r="4"/>`; if(rows.length<=7||i===0||i===rows.length-1||i%2===0)svg+=`<text class="grafik-axis-label" x="${p.x}" y="${H-16}" text-anchor="middle">${grafikEscapeXml(grafikShortLabel(p.label))}</text>`;});
            svg+=`</svg>`;chart.innerHTML=svg;
        }

        function renderGrafik(){
            if (dependencies.renderTravelGraphic?.()) return;
            if(document.getElementById("grafikView")?.classList.contains("hidden"))return;
            const titleEl=document.getElementById("grafikTitle"), subtitle=document.getElementById("grafikSubtitle"), totalEl=document.getElementById("grafikTotal"), stats=document.getElementById("grafikStats");

            document.getElementById("grafikChartCard")?.classList.toggle("grafik-is-comparison",context.session.grafikCompareMode);
            if(context.session.grafikCompareMode){
                const rangeA=grafikReadCompareRange("A"), rangeB=grafikReadCompareRange("B");
                if(!rangeA||!rangeB){
                    if(titleEl)titleEl.textContent="Zeiträume vergleichen";
                    if(subtitle)subtitle.textContent="Bitte beide Zeiträume vollständig auswählen.";
                    if(totalEl)totalEl.textContent="";
                    const chart=document.getElementById("grafikChart"), legend=document.getElementById("grafikLegend");
                    if(chart)chart.innerHTML=`<div class="grafik-empty">Bitte Zeitraum A und Zeitraum B auswählen.</div>`;
                    if(legend)legend.innerHTML=""; if(stats)stats.innerHTML=""; return;
                }
                const rows=grafikCompareRows(rangeA,rangeB);
                if(titleEl)titleEl.textContent="Werte im Vergleich";
                if(subtitle)subtitle.textContent=`A: ${rangeA.label} · B: ${rangeB.label}`;
                if(totalEl)totalEl.textContent="";
                grafikRenderCompareBars(rows,rangeA,rangeB);
                if(stats)stats.innerHTML="";
                return;
            }

            const range=grafikGetRange(), category=document.getElementById("grafikCategory")?.value||"all", sub=document.getElementById("grafikSubcategory")?.value||"all";
            let total=0, rows=[];
            if(category==="all"){rows=grafikCategoryTotals(range.start,range.ende);total=rows.reduce((s,x)=>s+x.value,0);}
            else {const entries=grafikFilteredEntries(category,range);total=entries.reduce((s,e)=>s+e.value,0);rows=grafikGroup(entries);}
            const selectedLabel=category==="all"?"Alle Kategorien":context.session.GRAFIK_LABELS[category]+(sub!=="all"?` · ${sub}`:"");
            if(titleEl)titleEl.textContent=category==="einnahmen"?"Einnahmen":category==="all"?"Finanzübersicht":selectedLabel;
            if(subtitle)subtitle.textContent=range.label;
            if(totalEl)totalEl.innerHTML=dependencies.formatBetrag(total);

            const days=grafikDays(range.start,range.ende), months=(range.ende.getFullYear()-range.start.getFullYear())*12+range.ende.getMonth()-range.start.getMonth()+1;
            if(context.session.grafikRangeType==="custom"&&months>=3){const series=grafikMonthlySeries(category,range); if(months>=7)grafikRenderLine(series);else grafikRenderBars(series);}
            else grafikRenderDonut(rows,total);

            const biggest=rows[0]?.name||"–";
            if(stats)stats.innerHTML=`
                <div class="grafik-stat"><div class="grafik-stat-label">Gesamt</div><div class="grafik-stat-value">${dependencies.formatBetrag(total)}</div></div>
                <div class="grafik-stat"><div class="grafik-stat-label">Ø pro Tag</div><div class="grafik-stat-value">${dependencies.formatBetrag(total/days)}</div></div>
                <div class="grafik-stat"><div class="grafik-stat-label">${category==="all"?"Größte Kategorie":"Größter Anteil"}</div><div class="grafik-stat-value">${dependencies.escapeHtml(biggest)}</div></div>`;
        }

return { grafikSetRange, grafikSalaryPeriodForDate, grafikPopulateSalaryPeriods, initGrafik, grafikGetRange, grafikDays, grafikEntry, grafikTravelEntries, grafikSavingsEntries, grafikEntries, grafikCategoryTotals, grafikSubcategories, grafikInitCompareDates, grafikReadCompareRange, grafikSwapComparePeriods, grafikToggleCompare, grafikCompareGroups, grafikRenderCompareSelection, grafikToggleCompareGroup, grafikCompareChoose, grafikCompareRows, grafikRenderCompareBars, grafikCategoryChanged, grafikGroup, grafikPrevRange, grafikFilteredEntries, grafikEscapeXml, grafikShortLabel, grafikRenderDonut, grafikMonthlySeries, grafikRenderBars, grafikRenderLine, renderGrafik };
});
