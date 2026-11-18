Kostentracker.module({
 id:'js/budget/wiederholungen.js',dependencies:['parseBetrag','heuteISO','isoAusDate','formatDatum','formatBetragText','escapeHtml'],session:[],read:[],write:[],replace:false
},(context,d)=>{
 'use strict';
 const day=value=>value instanceof Date?d.isoAusDate(value):String(value||'');
 function recurringDateValid(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
 function recurringChanges(entry){return (Array.isArray(entry?.betragsAenderungen)?entry.betragsAenderungen:[]).filter(change=>recurringDateValid(change?.ab)&&Number.isFinite(d.parseBetrag(change.betrag))&&d.parseBetrag(change.betrag)>0).map(change=>({ab:change.ab,betrag:d.parseBetrag(change.betrag)})).sort((a,b)=>a.ab.localeCompare(b.ab));}
 function recurringActive(entry,date){const end=entry?.wiederholungEnde;return !recurringDateValid(end)||day(date)<=end;}
 function recurringAmount(entry,date){let value=d.parseBetrag(entry?.betrag)||0;const when=day(date);for(const change of recurringChanges(entry)){if(change.ab>when)break;value=change.betrag;}return value;}
 function recurringSavingsReference(entry,start){const date=entry?.datum||'';return date>day(start)?date:day(start);}
 function recurringSummary(entry,reference=d.heuteISO()){
  if(!entry?.wiederholungEnde&&!entry?.betragsAenderungen?.length)return '';
  const parts=[];if(entry.wiederholungEnde)parts.push((day(reference)>entry.wiederholungEnde?'Beendet am ':'Endet am ')+d.formatDatum(entry.wiederholungEnde));
  for(const change of recurringChanges(entry))parts.push('Ab '+d.formatDatum(change.ab)+': '+d.formatBetragText(change.betrag));
  return '<div class="recurring-summary">'+parts.map(part=>'<span>'+d.escapeHtml(part)+'</span>').join('')+'</div>';
 }
 function recurringRow(prefix,index,change={}){return `<div class="recurring-change-row" data-recurring-row="${index}"><label class="booking-field-label" for="${prefix}ChangeDate-${index}">Gültig ab<input class="booking-control" id="${prefix}ChangeDate-${index}" type="date" value="${d.escapeHtml(change.ab||'')}"></label><label class="booking-field-label" for="${prefix}ChangeAmount-${index}">Neuer Betrag (€)<input class="booking-control" id="${prefix}ChangeAmount-${index}" type="text" inputmode="decimal" value="${change.betrag===undefined?'':d.escapeHtml(String(change.betrag).replace('.',','))}"></label><button class="recurring-remove" type="button" aria-label="Betragsänderung entfernen" onclick="removeRecurringChange('${prefix}',${index})">Entfernen</button></div>`;}
 function renderRecurringOptions(prefix,entry={},repeat=true,savings=false){
  const changes=recurringChanges(entry),rows=changes.length?changes:[{}];
  return `<details id="${prefix}Options" class="recurring-options${repeat?'':' hidden'}" ${changes.length||entry.wiederholungEnde?'open':''}><summary>Laufzeit &amp; Betragsänderungen (optional)</summary><label class="booking-field-label" for="${prefix}End">Enddatum (optional)</label><input class="booking-control" id="${prefix}End" type="date" value="${d.escapeHtml(entry.wiederholungEnde||'')}"><h4>Betrag ab Datum ändern</h4><div id="${prefix}Changes" data-next-index="${rows.length}">${rows.map((change,index)=>recurringRow(prefix,index,change)).join('')}</div><button class="recurring-add" type="button" onclick="addRecurringChange('${prefix}')">Weitere Betragsänderung</button><input id="${prefix}Changed" type="hidden" value=""><p id="${prefix}Error" class="recurring-error" role="alert"></p></details>`;
 }
 function mark(prefix){const node=document.getElementById(prefix+'Changed');if(node){node.value=String(Number(node.value||0)+1);node.dispatchEvent(new Event('input',{bubbles:true}));}}
 function addRecurringChange(prefix){const host=document.getElementById(prefix+'Changes');if(!host)return;const count=host.querySelectorAll('[data-recurring-row]').length;if(count>=50){alert('Bitte höchstens 50 Betragsänderungen anlegen.');return;}const index=Number(host.dataset.nextIndex||0);host.dataset.nextIndex=String(index+1);host.insertAdjacentHTML('beforeend',recurringRow(prefix,index));mark(prefix);document.getElementById(prefix+'ChangeDate-'+index)?.focus();}
 function removeRecurringChange(prefix,index){document.getElementById(prefix+'ChangeDate-'+index)?.closest('[data-recurring-row]')?.remove();mark(prefix);}
 function toggleRecurringOptions(prefix,selectId){const select=document.getElementById(selectId);document.getElementById(prefix+'Options')?.classList.toggle('hidden',!!select&&select.value==='einmalig');}
 function readRecurringOptions(prefix,entry,repeat,start){
  if(!repeat)return {wiederholungEnde:'',betragsAenderungen:[]};
  const box=document.getElementById(prefix+'Options');if(!box)return {wiederholungEnde:entry?.wiederholungEnde||'',betragsAenderungen:recurringChanges(entry)};
  const error=document.getElementById(prefix+'Error');if(error)error.textContent='';
  if(!repeat)return {wiederholungEnde:'',betragsAenderungen:[]};
  const reject=message=>{if(error)error.textContent=message;box.open=true;return null;};
  const end=document.getElementById(prefix+'End')?.value||'';
  if(end&&(!recurringDateValid(end)||recurringDateValid(start)&&end<start))return reject('Das Enddatum muss gültig sein und darf nicht vor dem Start liegen.');
  const rows=[...(document.getElementById(prefix+'Changes')?.querySelectorAll('[data-recurring-row]')||[])],changes=[],used=new Set();
  for(const row of rows){const index=row.dataset.recurringRow,ab=document.getElementById(prefix+'ChangeDate-'+index)?.value||'',raw=document.getElementById(prefix+'ChangeAmount-'+index)?.value.trim()||'';if(!ab&&!raw)continue;const betrag=d.parseBetrag(raw);
   if(!recurringDateValid(ab)||!raw||!Number.isFinite(betrag)||betrag<=0)return reject('Für jede Betragsänderung ein gültiges Datum und einen Betrag größer null eintragen.');
   if(recurringDateValid(start)&&ab<start)return reject('Eine Betragsänderung darf nicht vor dem Startdatum liegen.');
   if(end&&ab>end)return reject('Eine Betragsänderung darf nicht nach dem Enddatum liegen.');
   if(used.has(ab))return reject('Pro Datum ist nur eine Betragsänderung möglich.');used.add(ab);changes.push({ab,betrag});
  }
  if(changes.length>50)return reject('Bitte höchstens 50 Betragsänderungen verwenden.');
  return {wiederholungEnde:end,betragsAenderungen:changes.sort((a,b)=>a.ab.localeCompare(b.ab))};
 }
 const configs=[['recCost','kostenAddPanel',null,false],['recVers','versAddPanel',null,false],['recIncome','einnahmenAddPanel','einnahmenWiederholung',false],['recSavings','sparenInvestierenAddPanel',null,true],['recPlanned','geplantAddPanel','geplantWiederholung',false]];
 function resetRecurringOptions(prefix){const config=configs.find(c=>c[0]===prefix);const host=document.getElementById(prefix+'Host');if(!host||!config)return;host.innerHTML=renderRecurringOptions(prefix,{},!config[2]||document.getElementById(config[2])?.value!=='einmalig',config[3]);}
 function initializeRecurringOptions(){for(const [prefix,,select]of configs){resetRecurringOptions(prefix);if(select)document.getElementById(select)?.addEventListener('change',()=>toggleRecurringOptions(prefix,select));}}
 initializeRecurringOptions();
 return {recurringDateValid,recurringChanges,recurringActive,recurringAmount,recurringSavingsReference,recurringSummary,renderRecurringOptions,readRecurringOptions,resetRecurringOptions,addRecurringChange,removeRecurringChange,toggleRecurringOptions};
});
