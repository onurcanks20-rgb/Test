// Kostentracker Test: js/grafik/diagramme.js
// Functions share the existing app state; initialize only in app/start.js.

        function grafikSetRange(type, button){
            grafikRangeType = type;
            ["grafikRangeMonth","grafikRangeSalary","grafikRangeCustom"].forEach(id=>document.getElementById(id)?.classList.remove("selected"));
            button?.classList.add("selected");
            document.getElementById("grafikRangeMonthBox")?.classList.toggle("hidden",type!=="month");
            document.getElementById("grafikRangeSalaryBox")?.classList.toggle("hidden",type!=="salary");
            document.getElementById("grafikRangeCustomBox")?.classList.toggle("hidden",type!=="custom");
            renderGrafik();
        }

        function grafikSalaryPeriodForDate(ref){
            const tag=getGehaltstag();
            const gehaltDieser=berechneterGehaltstag(ref.getFullYear(),ref.getMonth(),tag);
            let start,next;
            if(ref>=gehaltDieser){ start=gehaltDieser; next=berechneterGehaltstag(ref.getFullYear(),ref.getMonth()+1,tag); }
            else { start=berechneterGehaltstag(ref.getFullYear(),ref.getMonth()-1,tag); next=gehaltDieser; }
            return {start:new Date(start), ende:addDays(next,-1), naechstesGehalt:new Date(next)};
        }

        function grafikPopulateSalaryPeriods(){
            const select=document.getElementById("grafikSalaryPeriod"); if(!select)return;
            const previous=select.value;
            const current=grafikSalaryPeriodForDate(startOfToday());
            const rows=[];
            let cursor=new Date(current.start);
            for(let i=0;i<18;i++){
                const z=grafikSalaryPeriodForDate(cursor);
                rows.push(z);
                cursor=addDays(z.start,-1);
            }
            select.innerHTML=rows.map((z,i)=>`<option value="${isoAusDate(z.start)}|${isoAusDate(z.ende)}">${i===0?"Aktuell · ":""}${formatDatum(isoAusDate(z.start))} – ${formatDatum(isoAusDate(z.ende))}</option>`).join("");
            if([...select.options].some(o=>o.value===previous))select.value=previous;
        }

        function initGrafik(){
            const month=document.getElementById("grafikMonth");
            const von=document.getElementById("grafikVon"), bis=document.getElementById("grafikBis");
            const today=startOfToday();
            if(month&&!month.value)month.value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
            if(von&&!von.value)von.value=isoAusDate(new Date(today.getFullYear(),today.getMonth(),1));
            if(bis&&!bis.value)bis.value=isoAusDate(today);
            grafikPopulateSalaryPeriods();
            grafikCategoryChanged(false);
            grafikInitCompareDates();
            grafikRenderCompareSelection();
        }

        function grafikGetRange(){
            if(grafikRangeType==="salary"){
                const raw=document.getElementById("grafikSalaryPeriod")?.value||""; const [a,b]=raw.split("|");
                const start=parseISODate(a), ende=parseISODate(b); if(start&&ende)return {start,ende,label:`${formatDatum(a)} – ${formatDatum(b)}`};
            }
            if(grafikRangeType==="custom"){
                let start=parseISODate(document.getElementById("grafikVon")?.value), ende=parseISODate(document.getElementById("grafikBis")?.value);
                if(start&&ende&&start>ende)[start,ende]=[ende,start];
                if(start&&ende)return {start,ende,label:`${formatDatum(isoAusDate(start))} – ${formatDatum(isoAusDate(ende))}`};
            }
            const raw=document.getElementById("grafikMonth")?.value||""; const m=raw.match(/^(\d{4})-(\d{2})$/);
            const now=startOfToday(), y=m?+m[1]:now.getFullYear(), mi=m?+m[2]-1:now.getMonth();
            const start=new Date(y,mi,1), ende=new Date(y,mi+1,0);
            return {start,ende,label:start.toLocaleDateString("de-DE",{month:"long",year:"numeric"})};
        }

        function grafikDays(a,b){ return Math.max(1,Math.round((b-a)/86400000)+1); }

        function grafikEntry(name,value,sub="",date=null){return {name,value:parseBetrag(value)||0,sub,date};}

        function grafikTravelEntries(von,bis){
            const out=[];
            Object.entries(daten.Reisen||{}).forEach(([land,r])=>Object.entries(r||{}).forEach(([kat,list])=>{
                if(!Array.isArray(list))return;
                list.forEach(e=>{const d=parseISODate(e.datum); if(d&&d>=von&&d<=bis)out.push(grafikEntry(land,e.betrag,kat,d));});
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
                const key=isoAusDate(z.start);
                if(seen.has(key)){
                    ref=addDays(ref,1);
                    continue;
                }
                seen.add(key);

                // Nur Perioden zaehlen, deren Startdatum im ausgewaehlten Zeitraum liegt.
                if(z.start>=von && z.start<=bis){
                    (daten["Sparen & Investieren"]||[]).forEach(e=>{
                        const valid=parseISODate(e.datum);
                        // Wie in der Budgetlogik gilt ein Eintrag fuer die Periode,
                        // sobald "Gueltig ab" spaetestens innerhalb dieser Periode liegt.
                        if(valid && valid<=z.ende){
                            out.push(grafikEntry(e.typ==="sparen"?"Sparen":"Investieren",e.betrag,e.typ,z.start));
                        }
                    });
                }
                ref=addDays(z.ende,1);
            }
            return out;
        }

        function grafikEntries(category,von,bis){
            if(category==="haushalt")return haushaltImZeitraum(von,bis).map(e=>grafikEntry(e.kategorie||"Sonstiges",e.betrag,e.kategorie||"Sonstiges",e.datumObj));
            if(category==="freizeit")return freizeitImZeitraum(von,bis).map(e=>grafikEntry(e.kategorie||"Sonstiges",e.betrag,e.kategorie||"Sonstiges",e.datumObj));
            if(category==="fixkosten")return laufendeKostenImZeitraum(von,bis).map(e=>grafikEntry(e.name||"Fixkosten",e.betrag,e.name||"Fixkosten",e.datum));
            if(category==="versicherungen")return versicherungsZahlungenImZeitraum(von,bis).map(e=>grafikEntry(e.name||"Versicherung",e.betrag,e.name||"Versicherung",e.datum));
            if(category==="einnahmen")return einnahmenZahlungenImZeitraum(von,bis).map(e=>grafikEntry(e.text||"Einnahme",e.betrag,e.text||"Einnahme",e.datumObj));
            if(category==="reisen")return grafikTravelEntries(von,bis);
            if(category==="geplant")return geplanteAusgabenImZeitraum(von,bis).map(e=>grafikEntry(e.bereich==="reisen"?(e.land||"Reise"):(e.bereich==="freizeit"?"Freizeit":"Haushalt"),e.betrag,e.kategorie||"Sonstiges",parseISODate(e.datum)));
            if(category==="sparen")return grafikSavingsEntries(von,bis);
            return [];
        }

        function grafikCategoryTotals(von,bis){
            return ["haushalt","freizeit","fixkosten","versicherungen","einnahmen","reisen","geplant","sparen"].map(k=>({key:k,name:GRAFIK_LABELS[k],value:grafikEntries(k,von,bis).reduce((s,e)=>s+e.value,0)})).filter(x=>x.value>0);
        }

        function grafikSubcategories(category){
            if(category==="haushalt")return ["Einkauf","Tanken","Drogerie","Sonstiges"];
            if(category==="freizeit")return ["Essen / Trinken","Aktivität","Geschenke","Sonstiges"];
            if(category==="reisen"){
                const set=new Set(); Object.values(daten.Reisen||{}).forEach(r=>Object.keys(r||{}).forEach(k=>Array.isArray(r[k])&&set.add(k)));
                return [...set].sort((a,b)=>a.localeCompare(b,"de"));
            }
            if(category==="geplant")return ["Einkauf","Tanken","Drogerie","Essen / Trinken","Geschenke","Essen","Trinken","Aktivität","Transport","Unterkunft","Sonstiges"];
            if(category==="sparen")return ["Sparen","Investieren"];
            return [];
        }

        function grafikInitCompareDates(){
            const range=grafikGetRange();
            const aVon=document.getElementById("grafikCompareAVon"), aBis=document.getElementById("grafikCompareABis"), bVon=document.getElementById("grafikCompareBVon"), bBis=document.getElementById("grafikCompareBBis");
            if(aVon&&!aVon.value)aVon.value=isoAusDate(range.start);
            if(aBis&&!aBis.value)aBis.value=isoAusDate(range.ende);
            const days=grafikDays(range.start,range.ende);
            if(bVon&&!bVon.value)bVon.value=isoAusDate(addDays(range.start,-days));
            if(bBis&&!bBis.value)bBis.value=isoAusDate(addDays(range.start,-1));
        }

        function grafikReadCompareRange(prefix){
            let start=parseISODate(document.getElementById(`grafikCompare${prefix}Von`)?.value), ende=parseISODate(document.getElementById(`grafikCompare${prefix}Bis`)?.value);
            if(start&&ende&&start>ende)[start,ende]=[ende,start];
            if(!start||!ende)return null;
            return {start,ende,label:`${formatDatum(isoAusDate(start))} – ${formatDatum(isoAusDate(ende))}`};
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
            grafikCompareMode=!grafikCompareMode;
            const btn=document.getElementById("grafikCompareToggle");
            btn?.classList.toggle("on",grafikCompareMode);
            if(btn)btn.textContent=grafikCompareMode?"✓ Vergleich beenden":"⇄ Zeiträume vergleichen";
            document.getElementById("grafikNormalRangeControls")?.classList.toggle("hidden",grafikCompareMode);
            document.getElementById("grafikComparePeriods")?.classList.toggle("hidden",!grafikCompareMode);
            document.getElementById("grafikNormalCategoryCard")?.classList.toggle("hidden",grafikCompareMode);
            document.getElementById("grafikCompareCategoryCard")?.classList.toggle("hidden",!grafikCompareMode);
            if(grafikCompareMode){grafikInitCompareDates();grafikRenderCompareSelection();}
            renderGrafik();
        }

        function grafikCompareGroups(){
            return ["haushalt","freizeit","fixkosten","versicherungen","einnahmen","reisen","geplant","sparen"].map(category=>({category,label:GRAFIK_LABELS[category],subs:grafikSubcategories(category)}));
        }

        function grafikRenderCompareSelection(){
            const host=document.getElementById("grafikCompareSelection"); if(!host)return;
            host.innerHTML=grafikCompareGroups().map(g=>{
                const totalKey=`${g.category}|all`, totalChecked=grafikCompareSelection.has(totalKey);
                const subRows=g.subs.map(sub=>{const key=`${g.category}|${sub}`;return `<label class="grafik-compare-option"><input type="checkbox" ${grafikCompareSelection.has(key)?"checked":""} onchange='grafikCompareChoose(${escapeHtml(JSON.stringify(g.category))},${escapeHtml(JSON.stringify(sub))},this.checked)'><span>${escapeHtml(sub)}</span></label>`;}).join("");
                const selectedCount=[...grafikCompareSelection].filter(k=>k.startsWith(g.category+"|")).length;
                return `<div class="grafik-compare-group"><div class="grafik-compare-group-head" onclick='grafikToggleCompareGroup(${escapeHtml(JSON.stringify(g.category))})'><div><div class="grafik-compare-group-title">${escapeHtml(g.label)}</div><div class="grafik-compare-group-count">${selectedCount?selectedCount+" ausgewählt":"nichts ausgewählt"}</div></div><span id="grafikCompareChevron-${g.category}">⌄</span></div><div id="grafikCompareOptions-${g.category}" class="grafik-compare-options hidden"><label class="grafik-compare-option"><input type="checkbox" ${totalChecked?"checked":""} onchange='grafikCompareChoose(${escapeHtml(JSON.stringify(g.category))},"all",this.checked)'><span>Gesamt</span></label>${subRows}</div></div>`;
            }).join("");
        }

        function grafikToggleCompareGroup(category){
            const el=document.getElementById(`grafikCompareOptions-${category}`), ch=document.getElementById(`grafikCompareChevron-${category}`); if(!el)return;
            const opening=el.classList.contains("hidden"); el.classList.toggle("hidden"); if(ch)ch.textContent=opening?"⌃":"⌄";
        }

        function grafikCompareChoose(category,sub,checked){
            const key=`${category}|${sub}`;
            if(checked){
                if(sub==="all"){[...grafikCompareSelection].filter(k=>k.startsWith(category+"|")).forEach(k=>grafikCompareSelection.delete(k));}
                else grafikCompareSelection.delete(`${category}|all`);
                grafikCompareSelection.add(key);
            } else grafikCompareSelection.delete(key);
            grafikRenderCompareSelection();
            const options=document.getElementById(`grafikCompareOptions-${category}`); if(options)options.classList.remove("hidden");
            const ch=document.getElementById(`grafikCompareChevron-${category}`); if(ch)ch.textContent="⌃";
            renderGrafik();
        }

        function grafikCompareRows(rangeA,rangeB){
            const rows=[];
            for(const key of grafikCompareSelection){
                const [category,...subParts]=key.split("|"), sub=subParts.join("|")||"all";
                let a=grafikEntries(category,rangeA.start,rangeA.ende), b=grafikEntries(category,rangeB.start,rangeB.ende);
                if(sub!=="all"){
                    const match=e=>category==="sparen"?((sub==="Sparen"&&e.sub==="sparen")||(sub==="Investieren"&&e.sub==="investieren")):e.sub===sub;
                    a=a.filter(match); b=b.filter(match);
                }
                rows.push({label:sub==="all"?GRAFIK_LABELS[category]:`${GRAFIK_LABELS[category]} · ${sub}`,a:a.reduce((sum,e)=>sum+e.value,0),b:b.reduce((sum,e)=>sum+e.value,0)});
            }
            return rows.filter(r=>r.a>0||r.b>0);
        }

        function grafikRenderCompareBars(rows,rangeA,rangeB){
            const chart=document.getElementById("grafikChart"), legend=document.getElementById("grafikLegend"); if(!chart||!legend)return;
            if(!rows.length){chart.innerHTML=`<div class="grafik-empty">Für diese Auswahl gibt es in beiden Zeiträumen noch keine passenden Daten.</div>`;legend.innerHTML="";return;}
            const W=340,rowH=58,padL=118,padR=10,padT=10,padB=10,H=Math.max(220,padT+rows.length*rowH+padB),innerW=W-padL-padR,max=Math.max(1,...rows.flatMap(r=>[r.a,r.b]));
            let svg=`<svg class="grafik-svg" style="height:${H}px" viewBox="0 0 ${W} ${H}" role="img">`;
            rows.forEach((r,i)=>{const y=padT+i*rowH,labelY=y+27,aW=(r.a/max)*innerW,bW=(r.b/max)*innerW;svg+=`<text class="grafik-axis-label" x="0" y="${labelY}" text-anchor="start">${grafikEscapeXml(grafikShortLabel(r.label,17))}</text><rect x="${padL}" y="${y+5}" width="${aW}" height="17" rx="5" fill="${GRAFIK_COLORS[0]}"/><rect x="${padL}" y="${y+31}" width="${bW}" height="17" rx="5" fill="${GRAFIK_COLORS[1]}"/>`;});
            svg+=`</svg>`;chart.innerHTML=svg;
            legend.innerHTML=`<div class="grafik-compare-legend" style="grid-column:1/-1"><span><i class="grafik-compare-swatch" style="background:${GRAFIK_COLORS[0]}"></i>A · ${escapeHtml(rangeA.label)}</span><span><i class="grafik-compare-swatch" style="background:${GRAFIK_COLORS[1]}"></i>B · ${escapeHtml(rangeB.label)}</span></div>`;
        }

        function grafikCategoryChanged(doRender=true){
            const category=document.getElementById("grafikCategory")?.value||"all", wrap=document.getElementById("grafikSubcategoryWrap"), select=document.getElementById("grafikSubcategory");
            const subs=grafikSubcategories(category), showSubs=category!=="all"&&subs.length>0;
            wrap?.classList.toggle("hidden",!showSubs);
            if(select&&showSubs){const old=select.value;select.innerHTML=`<option value="all">Alle Unterkategorien</option>`+subs.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");if([...select.options].some(o=>o.value===old))select.value=old;}
            if(doRender)renderGrafik();
        }

        function grafikGroup(entries){
            const map=new Map(); entries.forEach(e=>map.set(e.name,(map.get(e.name)||0)+e.value));
            return [...map.entries()].map(([name,value])=>({name,value})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
        }

        function grafikPrevRange(range){
            if(grafikRangeType==="month")return {start:new Date(range.start.getFullYear(),range.start.getMonth()-1,1),ende:new Date(range.start.getFullYear(),range.start.getMonth(),0)};
            if(grafikRangeType==="salary"){const p=grafikSalaryPeriodForDate(addDays(range.start,-1));return {start:p.start,ende:p.ende};}
            const days=grafikDays(range.start,range.ende);return {start:addDays(range.start,-days),ende:addDays(range.start,-1)};
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
            let p=0; const parts=rows.map((r,i)=>{const a=p,b=p+(r.value/total)*100;p=b;return `${GRAFIK_COLORS[i%GRAFIK_COLORS.length]} ${a}% ${b}%`;});
            chart.innerHTML=`<div class="grafik-donut" style="background:conic-gradient(${parts.join(",")})"><div class="grafik-donut-center"><span>Gesamt</span><strong>${formatBetrag(total)}</strong></div></div>`;
            legend.innerHTML=rows.map((r,i)=>`<div class="grafik-legend-item"><span class="grafik-dot" style="background:${GRAFIK_COLORS[i%GRAFIK_COLORS.length]}"></span><span class="grafik-legend-name">${escapeHtml(r.name)}</span><span class="grafik-legend-value">${formatBetrag(r.value)}</span></div>`).join("");
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
            if(document.getElementById("grafikView")?.classList.contains("hidden"))return;
            const titleEl=document.getElementById("grafikTitle"), subtitle=document.getElementById("grafikSubtitle"), totalEl=document.getElementById("grafikTotal"), stats=document.getElementById("grafikStats");

            if(grafikCompareMode){
                const rangeA=grafikReadCompareRange("A"), rangeB=grafikReadCompareRange("B");
                if(!rangeA||!rangeB){
                    if(titleEl)titleEl.textContent="Zeiträume vergleichen";
                    if(subtitle)subtitle.textContent="Bitte beide Zeiträume vollständig auswählen.";
                    if(totalEl)totalEl.textContent="";
                    const chart=document.getElementById("grafikChart"), legend=document.getElementById("grafikLegend");
                    if(chart)chart.innerHTML=`<div class="grafik-empty">Bitte Zeitraum A und Zeitraum B auswählen.</div>`;
                    if(legend)legend.innerHTML=""; if(stats)stats.innerHTML=""; return;
                }
                const rows=grafikCompareRows(rangeA,rangeB), totalA=rows.reduce((s,r)=>s+r.a,0), totalB=rows.reduce((s,r)=>s+r.b,0), diff=totalA-totalB, pct=totalB>0?(diff/totalB)*100:null;
                if(titleEl)titleEl.textContent="Zeiträume vergleichen";
                if(subtitle)subtitle.textContent=`A: ${rangeA.label} · B: ${rangeB.label}`;
                if(totalEl)totalEl.textContent="";
                grafikRenderCompareBars(rows,rangeA,rangeB);
                const pctText=pct===null?"–":`${pct>0?"+":""}${pct.toLocaleString("de-DE",{maximumFractionDigits:1})} %`;
                if(stats)stats.innerHTML=`
                    <div class="grafik-stat"><div class="grafik-stat-label">Zeitraum A</div><div class="grafik-stat-value">${formatBetrag(totalA)}</div></div>
                    <div class="grafik-stat"><div class="grafik-stat-label">Zeitraum B</div><div class="grafik-stat-value">${formatBetrag(totalB)}</div></div>
                    <div class="grafik-stat"><div class="grafik-stat-label">Unterschied</div><div class="grafik-stat-value">${diff>0?"+":""}${formatBetrag(diff)}</div></div>
                    <div class="grafik-stat"><div class="grafik-stat-label">Unterschied in %</div><div class="grafik-stat-value">${pctText}</div></div>`;
                return;
            }

            const range=grafikGetRange(), category=document.getElementById("grafikCategory")?.value||"all", sub=document.getElementById("grafikSubcategory")?.value||"all";
            let total=0, rows=[];
            if(category==="all"){rows=grafikCategoryTotals(range.start,range.ende);total=rows.reduce((s,x)=>s+x.value,0);}
            else {const entries=grafikFilteredEntries(category,range);total=entries.reduce((s,e)=>s+e.value,0);rows=grafikGroup(entries);}
            const selectedLabel=category==="all"?"Alle Kategorien":GRAFIK_LABELS[category]+(sub!=="all"?` · ${sub}`:"");
            if(titleEl)titleEl.textContent=category==="einnahmen"?"Einnahmen":category==="all"?"Finanzübersicht":selectedLabel;
            if(subtitle)subtitle.textContent=range.label;
            if(totalEl)totalEl.innerHTML=formatBetrag(total);

            const days=grafikDays(range.start,range.ende), months=(range.ende.getFullYear()-range.start.getFullYear())*12+range.ende.getMonth()-range.start.getMonth()+1;
            if(grafikRangeType==="custom"&&months>=3){const series=grafikMonthlySeries(category,range); if(months>=7)grafikRenderLine(series);else grafikRenderBars(series);}
            else grafikRenderDonut(rows,total);

            const biggest=rows[0]?.name||"–";
            if(stats)stats.innerHTML=`
                <div class="grafik-stat"><div class="grafik-stat-label">Gesamt</div><div class="grafik-stat-value">${formatBetrag(total)}</div></div>
                <div class="grafik-stat"><div class="grafik-stat-label">Ø pro Tag</div><div class="grafik-stat-value">${formatBetrag(total/days)}</div></div>
                <div class="grafik-stat"><div class="grafik-stat-label">${category==="all"?"Größte Kategorie":"Größter Anteil"}</div><div class="grafik-stat-value">${escapeHtml(biggest)}</div></div>`;
        }
