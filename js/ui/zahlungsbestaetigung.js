Kostentracker.module({
 "id":"js/ui/zahlungsbestaetigung.js","dependencies":["formatBetragText","moveAusgabe"],
 "session":[],"read":["Haushalt","Freizeit","Reisen","Einstellungen"],"write":[],"replace":false
},(context,dependencies)=>{
"use strict";
let ids=new Set(),success=true,remaining=0,started=0,timer=null,hover=false,active=false;
const host=()=>document.getElementById('paymentImportedNotice');
function importedNoticeEntry(paymentId){
 const data=context.repository.view;
 for(const [area,source] of [['Haushalt','haushalt'],['Freizeit','freizeit']])
  for(const list of Object.values(data[area]||{}))if(Array.isArray(list)){
   const entry=list.find(row=>row._serverPaymentId===paymentId);
   if(entry)return {entry,source,target:area+' · '+(entry.kategorie||'Sonstiges')};
  }
 for(const [country,categories]of Object.entries(data.Reisen||{}))for(const [category,list]of Object.entries(categories||{}))if(Array.isArray(list)){
  const entry=list.find(row=>row._serverPaymentId===paymentId);
  if(entry)return {entry,source:'reisen',target:'Reisen · '+country+' · '+category};
 }
 return null;
}
function pausePaymentImportedNotice(hide=false){
 if(timer!==null){clearTimeout(timer);timer=null;remaining=Math.max(0,remaining-(Date.now()-started));}
 if(hide)host()?.classList.remove('is-visible');
}
function dismissPaymentImportedNotice(){pausePaymentImportedNotice(true);ids.clear();active=false;remaining=0;hover=false;}
function noticeBlocked(){
 if(document.visibilityState==='hidden'||document.documentElement.classList.contains('boot-starting'))return true;
 if((context.repository.view.Einstellungen?.serverPendingReview||[]).length)return true;
 return [...document.querySelectorAll('dialog[open],.sheet-backdrop:not(.hidden)')].some(node=>!node.getClientRects||node.getClientRects().length>0);
}
function armPaymentNoticeTimer(){
 pausePaymentImportedNotice();const node=host();if(!node||!active)return;
 if(noticeBlocked()){node.classList.remove('is-visible');return;}
 if(hover||node.contains(document.activeElement))return;
 if(remaining<=0){dismissPaymentImportedNotice();return;}
 started=Date.now();timer=setTimeout(dismissPaymentImportedNotice,remaining);
}
function editImportedNoticePayment(paymentId){
 const found=importedNoticeEntry(paymentId);
 if(!found){ids.delete(paymentId);if(!ids.size)dismissPaymentImportedNotice();else resumePaymentImportedNotice();return;}
 pausePaymentImportedNotice(true);remaining=Math.max(remaining,6000);
 dependencies.moveAusgabe(found.source,found.entry.id);
}
function noticeNode(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function renderPaymentImportedNotice(){
 const node=host();if(!node)return;
 node.replaceChildren();node.classList.toggle('is-error',!success);
 const header=noticeNode('div','payment-notice-heading');
 const rows=[...ids].map(id=>({id,found:importedNoticeEntry(id)})).filter(row=>row.found);
 const title=!success?'Zahlung konnte nicht gespeichert werden':rows.length>1?rows.length+' Zahlungen übernommen':ids.size&&!rows.length?'Eintrag nicht mehr vorhanden':'Zahlung übernommen';
 header.appendChild(noticeNode('strong','',(!success?'❌ ':'✅ ')+title));
 const close=noticeNode('button','payment-notice-close','×');close.type='button';close.setAttribute('aria-label','Buchungsbestätigung schließen');close.addEventListener('click',dismissPaymentImportedNotice);header.appendChild(close);node.appendChild(header);
 if(!success){node.appendChild(noticeNode('div','payment-notice-target','Bitte erneut versuchen. Es wurde keine neue Zahlung bestätigt.'));return;}
 for(const {id,found}of rows){
  const item=noticeNode('div','payment-notice-item');
  const content=noticeNode('div','payment-notice-content');
  content.appendChild(noticeNode('div','payment-notice-merchant',(found.entry._serverMerchant||found.entry.text||'Zahlung')+' · '+dependencies.formatBetragText(found.entry.betrag)));
  content.appendChild(noticeNode('div','payment-notice-target',found.target));item.appendChild(content);
  const edit=noticeNode('button','payment-notice-edit','Ändern');edit.type='button';edit.setAttribute('aria-label','Zuordnung für '+(found.entry.text||'Zahlung')+' ändern');edit.addEventListener('click',()=>editImportedNoticePayment(id));item.appendChild(edit);node.appendChild(item);
 }
}
function resumePaymentImportedNotice(){
 if(!active)return;
 const hadIds=ids.size>0;for(const id of ids)if(!importedNoticeEntry(id))ids.delete(id);
 if(success&&hadIds&&!ids.size){dismissPaymentImportedNotice();return;}
 if(noticeBlocked()){pausePaymentImportedNotice(true);return;}
 renderPaymentImportedNotice();host()?.classList.add('is-visible');armPaymentNoticeTimer();
}
function showDetailedPaymentNotice(ok=true,paymentIds=[]){
 pausePaymentImportedNotice();if(!active||!ok)ids.clear();
 success=!!ok;for(const id of paymentIds)if(typeof id==='string'&&importedNoticeEntry(id))ids.add(id);
 active=true;remaining=ok?12000:6000;resumePaymentImportedNotice();
}
const node=host();
node?.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hover=true;pausePaymentImportedNotice();}});
node?.addEventListener('pointerleave',()=>{hover=false;armPaymentNoticeTimer();});
node?.addEventListener('focusin',()=>pausePaymentImportedNotice());
node?.addEventListener('focusout',()=>setTimeout(armPaymentNoticeTimer,0));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pausePaymentImportedNotice(true);else resumePaymentImportedNotice();});
document.addEventListener('kostentracker:boot-complete',resumePaymentImportedNotice);
document.addEventListener('close',()=>setTimeout(resumePaymentImportedNotice,0),true);
document.addEventListener('focusin',()=>{if(active&&noticeBlocked())pausePaymentImportedNotice(true);});
return {importedNoticeEntry,pausePaymentImportedNotice,dismissPaymentImportedNotice,editImportedNoticePayment,renderPaymentImportedNotice,resumePaymentImportedNotice,showDetailedPaymentNotice};
});
