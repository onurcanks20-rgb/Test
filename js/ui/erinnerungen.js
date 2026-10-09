// Kostentracker Test: js/ui/erinnerungen.js
// Functions share the existing app state; initialize only in app/start.js.

        function normalizeWarnTage(value) {
            const days = parseInt(value, 10);
            return Number.isNaN(days) ? 14 : Math.min(365, Math.max(0, days));
        }

        function getWarnSettings(){ daten.Einstellungen??={}; daten.Einstellungen.warnungen??=structuredClone(STANDARD_DATEN.Einstellungen.warnungen); return daten.Einstellungen.warnungen; }

        function reminderControlHtml(key,value={}){ const on=!!value.warnung,tage=normalizeWarnTage(value.warnTage); return `<div class="reminder-control" data-reminder-key="${escapeHtml(key)}"><button type="button" class="reminder-toggle ${on?'on':''}" role="switch" aria-checked="${on?'true':'false'}" onclick="toggleReminderControl(this.closest('[data-reminder-key]').dataset.reminderKey)"><span>🔔 Auf Startseite erinnern</span><span class="ios-switch ${on?'on':''}" aria-hidden="true"></span></button><div class="reminder-days ${on?'':'hidden'}"><label>Warnzeit vorher (Tage)</label><input type="number" min="0" max="365" value="${tage}"></div></div>`; }

        function toggleReminderControl(key){ const box=document.querySelector(`.reminder-control[data-reminder-key="${CSS.escape(key)}"]`); if(!box)return; const btn=box.querySelector('.reminder-toggle'),days=box.querySelector('.reminder-days'),on=!btn.classList.contains('on'); btn.classList.toggle('on',on); btn.setAttribute('aria-checked',on?'true':'false'); btn.querySelector('.ios-switch')?.classList.toggle('on',on); days?.classList.toggle('hidden',!on); }

        function resetReminderControl(key){const box=document.querySelector(`.reminder-control[data-reminder-key=\"${CSS.escape(key)}\"]`);if(!box)return;const btn=box.querySelector('.reminder-toggle'),days=box.querySelector('.reminder-days'),inp=days?.querySelector('input');btn?.classList.remove('on');btn?.setAttribute('aria-checked','false');btn?.querySelector('.ios-switch')?.classList.remove('on');days?.classList.add('hidden');if(inp)inp.value=normalizeWarnTage(getWarnSettings().tage);}

        function resetAddReminderForPanel(panelId){const map={sparenInvestierenAddPanel:'sparen',geplantAddPanel:'geplant',reiseAddPanel:'reisen',versAddPanel:'versicherungen',hausAddPanel:'haushalt',freizeitAddPanel:'freizeit',einnahmenAddPanel:'einnahmen',kostenAddPanel:'fixkosten'};if(map[panelId])resetReminderControl(`add:${map[panelId]}`);}

        function readReminderControl(key){ const box=document.querySelector(`.reminder-control[data-reminder-key="${CSS.escape(key)}"]`); if(!box)return {warnung:false,warnTage:14}; return {warnung:!!box.querySelector('.reminder-toggle')?.classList.contains('on'),warnTage:normalizeWarnTage(box.querySelector('.reminder-days input')?.value)}; }

        function findReminderEntry(type,id){ const sid=String(id); if(type==='sparen')return(daten['Sparen & Investieren']||[]).find(e=>String(e.id)===sid); if(type==='geplant')return(daten['Geplante Ausgaben']||[]).find(e=>String(e.id)===sid); if(type==='fixkosten')return(daten['Laufende Kosten']?.fix||[]).find(e=>String(e.id)===sid); if(type==='versicherungen')return(daten.Versicherungen||[]).find(e=>String(e.id)===sid); if(type==='einnahmen')return(daten.Einnahmen||[]).find(e=>String(e.id)===sid); if(type==='haushalt'){for(const l of Object.values(daten.Haushalt||{})){const e=Array.isArray(l)&&l.find(x=>String(x.id)===sid);if(e)return e;}} if(type==='freizeit'){for(const l of Object.values(daten.Freizeit||{})){const e=Array.isArray(l)&&l.find(x=>String(x.id)===sid);if(e)return e;}} if(type==='reisen'){for(const r of Object.values(daten.Reisen||{}))for(const l of Object.values(r||{})){const e=Array.isArray(l)&&l.find(x=>String(x.id)===sid);if(e)return e;}} return null; }

        function decorateReminderControls(root=document){ const addMap={sparenInvestierenAddPanel:'sparen',geplantAddPanel:'geplant',reiseAddPanel:'reisen',versAddPanel:'versicherungen',hausAddPanel:'haushalt',freizeitAddPanel:'freizeit',einnahmenAddPanel:'einnahmen',kostenAddPanel:'fixkosten'}; Object.entries(addMap).forEach(([pid,type])=>{const p=document.getElementById(pid);if(!p||!(root===document||root===p||root.contains(p))||p.querySelector('[data-reminder-key]'))return;const b=p.querySelector('button.btn-primary');if(b)b.insertAdjacentHTML('beforebegin',reminderControlHtml(`add:${type}`,{warnTage:normalizeWarnTage(getWarnSettings().tage)}));}); [...(root.matches?.('input[type="date"][id^="edit"]')?[root]:[]),...root.querySelectorAll('input[type="date"][id^="edit"]')].forEach(inp=>{let type=null,id=null,m;if((m=inp.id.match(/^editSparenDatum-(.+)$/))){type='sparen';id=m[1];}else if((m=inp.id.match(/^editGeplantDatum-(.+)$/))){type='geplant';id=m[1];}else if((m=inp.id.match(/^editKostenDatum-(.+)$/))){type='fixkosten';id=m[1];}else if((m=inp.id.match(/^editEinnahmenDatum-(.+)$/))){type='einnahmen';id=m[1];}else if((m=inp.id.match(/^editFreizeitDatum-(.+)$/))){type='freizeit';id=m[1];}else if((m=inp.id.match(/^editDatum-(.+)$/))){id=m[1];if(inp.closest('#versicherungenView'))type='versicherungen';else if(inp.closest('#land'))type='reisen';else if(inp.closest('#haushaltView'))type='haushalt';} if(!type||!id)return;const key=`edit:${type}:${id}`,parent=inp.parentElement;if(parent?.querySelector(`[data-reminder-key="${CSS.escape(key)}"]`))return;inp.insertAdjacentHTML('afterend',reminderControlHtml(key,findReminderEntry(type,id)||{}));}); }

        function renderWarnSettings(){ const w=getWarnSettings(),a=document.getElementById('warnungenAktiv');if(a){const on=w.aktiv!==false;a.setAttribute('aria-checked',on?'true':'false');a.querySelector('.ios-switch')?.classList.toggle('on',on);}const s=document.getElementById('warnSchwelle');if(s)s.value=formatInputBetrag(w.schwelle??100);const t=document.getElementById('warnTage');if(t)t.value=normalizeWarnTage(w.tage);document.getElementById('warnGlobalFields')?.classList.toggle('hidden',w.aktiv===false);const g=document.getElementById('warnKategorieGrid');if(g)g.innerHTML=WARN_KATEGORIEN.map(([k,l])=>`<label class="warning-cat"><input type="checkbox" data-warn-cat="${k}" ${w.kategorien?.[k]?'checked':''} onchange="saveWarnSettings(false)"><span>${l}</span></label>`).join(''); }

        function toggleWarnungenAktiv(){ const a=document.getElementById('warnungenAktiv');if(!a)return;const on=a.getAttribute('aria-checked')!=='true';a.setAttribute('aria-checked',on?'true':'false');a.querySelector('.ios-switch')?.classList.toggle('on',on);saveWarnSettings();renderWarnSettings();renderHomeWarnings(); }

        function saveWarnSettings(doSave=true){ const w=getWarnSettings();const a=document.getElementById('warnungenAktiv');if(a)w.aktiv=a.getAttribute('aria-checked')!=='false';const s=parseBetrag(document.getElementById('warnSchwelle')?.value);if(!isNaN(s)&&s>=0)w.schwelle=s;const t=parseInt(document.getElementById('warnTage')?.value,10);if(!isNaN(t)&&t>=0)w.tage=Math.min(365,t);w.kategorien??={};document.querySelectorAll('[data-warn-cat]').forEach(el=>w.kategorien[el.dataset.warnCat]=el.checked);document.getElementById('warnGlobalFields')?.classList.toggle('hidden',!w.aktiv);if(doSave && speichern() === false)return; }

        function collectUpcomingWarnings(){ const w=getWarnSettings(),today=startOfToday(),horizon=addDays(today,365),rows=[]; const push=(type,label,entry,date,amount,name)=>{if(!date||date<today||date>horizon)return;const days=daysBetween(today,date),manual=!!entry?.warnung,own=normalizeWarnTage(entry?.warnTage),auto=type!=='einnahmen'&&w.aktiv!==false&&!!w.kategorien?.[type]&&(parseBetrag(amount)||0)>=(parseBetrag(w.schwelle)||0)&&days<=normalizeWarnTage(w.tage),manualAktiv=manual&&days<=own;if(!manualAktiv&&!auto)return;rows.push({type,label,name:name||label,betrag:parseBetrag(amount)||0,datum:new Date(date),manual:manualAktiv,auto});}; Object.values(daten.Haushalt||{}).forEach(l=>Array.isArray(l)&&l.forEach(e=>push('haushalt','Haushalt',e,parseISODate(e.datum),e.betrag,e.text||e.kategorie)));Object.values(daten.Freizeit||{}).forEach(l=>Array.isArray(l)&&l.forEach(e=>push('freizeit','Freizeit',e,parseISODate(e.datum),e.betrag,e.text||e.kategorie)));Object.entries(daten.Reisen||{}).forEach(([land,r])=>Object.values(r||{}).forEach(l=>Array.isArray(l)&&l.forEach(e=>push('reisen',`Reise · ${land}`,e,parseISODate(e.datum),e.betrag,e.text||land))));(daten['Geplante Ausgaben']||[]).forEach(e=>push('geplant','Geplante Ausgabe',e,parseISODate(e.datum),e.betrag,e.text)); const fix=(daten['Laufende Kosten']?.fix||[]);laufendeKostenImZeitraum(today,horizon).forEach(x=>{const e=fix.find(k=>String(k.id)===String(x.sourceId))||fix.find(k=>(k.text||k.name||'Fixkosten')===x.name&&(parseBetrag(k.betrag)||0)===x.betrag);push('fixkosten','Fixkosten',e||{},x.datum,x.betrag,x.name);});versicherungsZahlungenImZeitraum(today,horizon).forEach(x=>{const e=(daten.Versicherungen||[]).find(v=>String(v.id)===String(x.sourceId))||(daten.Versicherungen||[]).find(v=>(v.name||'Versicherung')===x.name&&(parseBetrag(v.betrag)||0)===x.betrag);push('versicherungen','Versicherung',e||{},x.datum,x.betrag,x.name);});einnahmenZahlungenImZeitraum(today,horizon).forEach(x=>{const e=(daten.Einnahmen||[]).find(v=>String(v.id)===String(x.id));push('einnahmen','Einnahme',e||x,x.datumObj,x.betrag,x.text);});const z=getGehaltszeitraum(),next=z.naechstesGehalt||addDays(today,30);(daten['Sparen & Investieren']||[]).forEach(e=>{const a=parseISODate(e.datum),d=a&&a>=today?a:next;push('sparen',e.typ==='sparen'?'Sparen':'Investieren',e,d,e.betrag,e.text||(e.typ==='sparen'?'Sparen':'Investieren'));});return rows.sort((a,b)=>a.datum-b.datum||b.betrag-a.betrag);}

        function formatReminderCountdown(tage) {
            if (tage <= 0) return "heute";
            if (tage === 1) return "in 1 Tag";
            return `in ${tage} Tagen`;
        }

        function renderHomeWarningGroup(rows, highAmount=false) {
            if (!rows.length) return "";
            const icon = highAmount ? "⚠️" : "🔔";
            const title = highAmount
                ? (rows.length === 1 ? "Hoher Betrag" : "Hohe Beträge")
                : `Bevorstehende ${rows.length === 1 ? "Erinnerung" : "Erinnerungen"}`;
            return `<div class="home-warning-card${highAmount ? ' high-amount-warning' : ''}">
                <div class="home-warning-head">
                    <span class="home-warning-icon">${icon}</span>
                    <strong>${title}</strong>
                </div>
                <div class="home-warning-list">${rows.map(r=>{
                    const tage=daysBetween(startOfToday(),r.datum);
                    return `<div class="home-warning-item">
                        <div class="home-warning-main">
                            <strong class="home-warning-title">${escapeHtml(r.name)}</strong>
                            <span class="home-warning-meta">${escapeHtml(r.label)} · ${formatReminderCountdown(tage)}</span>
                        </div>
                        <div class="home-warning-side">
                            <strong class="home-warning-amount">${formatBetrag(r.betrag)}</strong>
                            <span class="home-warning-date">${formatKurzDatum(r.datum)}</span>
                        </div>
                    </div>`;
                }).join('')}</div>
            </div>`;
        }

        function renderHomeWarnings(){
            const h=document.getElementById('homeWarnings');
            if(!h)return;
            const rows=collectUpcomingWarnings();
            h.classList.toggle('hidden',!rows.length);
            if(!rows.length){h.innerHTML='';return;}
            const hoheBetraege=rows.filter(r=>r.auto);
            const erinnerungen=rows.filter(r=>!r.auto);
            h.innerHTML=renderHomeWarningGroup(hoheBetraege,true)+renderHomeWarningGroup(erinnerungen,false);
        }
