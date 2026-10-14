Kostentracker.module({
  "id":"js/server/haendler.js",
  "dependencies":["show","speichern","escapeHtml"],
  "session":[],"read":["Einstellungen"],"write":["Einstellungen"],"replace":false
}, (context, dependencies) => {
  'use strict';
  let editingMerchantKey=null;
  const CATEGORIES={Haushalt:['Einkauf','Tanken','Drogerie','Sonstiges'],Freizeit:['Essen / Trinken','Aktivität','Geschenke','Sonstiges']};
  const BUILTINS=[
    {names:'Lieferando, Wolt, Uber Eats',pattern:/\b(?:lieferando|wolt|uber\s*eats)\b/,area:'Freizeit',category:'Essen / Trinken'},
    {names:'McDonald’s, KFC, Burger King, Subway, Little Tokyo',pattern:/\b(?:mc\s*donalds?|kfc|burger\s*king|subway|little\s*tokyo)\b/,area:'Freizeit',category:'Essen / Trinken'},
    {names:'Restaurant, Café, Bäckerei / Bakery',pattern:/\b(?:restaurant|cafe|cafeteria|baeckerei|backerei|baecker|backer|backstube|bakery)\b/,area:'Freizeit',category:'Essen / Trinken'},
    {names:'REWE, EDEKA, Lidl, Aldi, Netto, Penny, Kaufland, Globus, tegut, Norma, Marktkauf, Carrefour, Tesco, Supermarkt, CU, GS25, 7-Eleven',pattern:/\b(?:rewe|edeka|lidl|aldi|netto|penny|kaufland|globus|tegut|norma|marktkauf|carrefour|tesco|supermarkt|cu|gs25|7\s*eleven)\b/,area:'Haushalt',category:'Einkauf'},
    {names:'Aral, Shell, Esso, TotalEnergies, JET, AVIA, OMV, Agip, Orlen, Q8, HEM, Westfalen, Tankstelle',pattern:/\b(?:aral|shell|esso|totalenergies|jet|avia|omv|agip|orlen|q8|hem|westfalen|tankstelle|tankstation)\b/,area:'Haushalt',category:'Tanken'},
    {names:'dm, Rossmann',pattern:/\b(?:dm|rossmann)\b/,area:'Haushalt',category:'Drogerie'}
  ];
  function normalizeMerchantName(value) {
    return String(value||'').normalize('NFKC').toLocaleLowerCase('de-DE')
      .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/['’`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function merchantCategories(area) { return [...(CATEGORIES[area]||[])]; }
  function validMerchantDestination(area,category) { return Object.hasOwn(CATEGORIES,area)&&CATEGORIES[area].includes(category); }
  function merchantRules() {
    const rows=context.repository.view.Einstellungen?.haendlerRegeln;
    return Array.isArray(rows)?rows.filter(r=>r&&typeof r.merchant==='string'&&normalizeMerchantName(r.merchant)&&validMerchantDestination(r.area,r.category)):[];
  }
  function merchantDestination(name) {
    const key=normalizeMerchantName(name);if(!key)return null;
    const own=merchantRules().find(r=>normalizeMerchantName(r.merchant)===key);
    if(own)return {area:own.area,category:own.category};
    const match=BUILTINS.find(r=>r.pattern.test(key));
    return match?{area:match.area,category:match.category}:null;
  }
  // Used inside the same transaction as a reviewed payment; the caller persists both together.
  function rememberMerchantRule(merchant,area,category) {
    const name=String(merchant||'').trim(),key=normalizeMerchantName(name);
    if(!key||name.length>200||!validMerchantDestination(area,category))throw Error('Bitte Händler, Bereich und Kategorie prüfen.');
    context.repository.view.Einstellungen??={};
    context.repository.view.Einstellungen.haendlerRegeln=[...merchantRules().filter(r=>normalizeMerchantName(r.merchant)!==key),{merchant:name,area,category}];
  }
  function merchantRuleStatus(text) {const el=document.getElementById('merchantRuleStatus');if(el)el.textContent=text;}
  function updateMerchantRuleCategories(value='') {
    const area=document.getElementById('merchantRuleArea')?.value,select=document.getElementById('merchantRuleCategory');if(!select)return;
    select.innerHTML='<option value="">Kategorie auswählen</option>'+merchantCategories(area).map(c=>`<option value="${dependencies.escapeHtml(c)}">${dependencies.escapeHtml(c)}</option>`).join('');
    select.value=merchantCategories(area).includes(value)?value:'';
  }
  function resetMerchantRuleForm() {
    editingMerchantKey=null;document.getElementById('merchantRuleName').value='';document.getElementById('merchantRuleArea').value='';updateMerchantRuleCategories();
    document.getElementById('merchantRuleSave').textContent='Zuordnung speichern';
  }
  function openMerchantSettings() {dependencies.show('settingsMerchantView');resetMerchantRuleForm();merchantRuleStatus('');renderMerchantRules();}
  function saveMerchantRule() {
    const oldKey=editingMerchantKey;
    try {rememberMerchantRule(document.getElementById('merchantRuleName').value,document.getElementById('merchantRuleArea').value,document.getElementById('merchantRuleCategory').value);}
    catch(error){merchantRuleStatus(error.message);return false;}
    if(oldKey&&oldKey!==normalizeMerchantName(document.getElementById('merchantRuleName').value))context.repository.view.Einstellungen.haendlerRegeln=merchantRules().filter(r=>normalizeMerchantName(r.merchant)!==oldKey);
    if(dependencies.speichern()===false){merchantRuleStatus('Zuordnung konnte nicht gespeichert werden. Bitte erneut versuchen.');return false;}
    resetMerchantRuleForm();renderMerchantRules();merchantRuleStatus('Zuordnung gespeichert. Sie gilt für kommende Zahlungen.');return true;
  }
  function editMerchantRule(index) {
    const row=merchantRules().sort((a,b)=>a.merchant.localeCompare(b.merchant,'de'))[index];if(!row)return;
    editingMerchantKey=normalizeMerchantName(row.merchant);document.getElementById('merchantRuleName').value=row.merchant;document.getElementById('merchantRuleArea').value=row.area;
    updateMerchantRuleCategories(row.category);document.getElementById('merchantRuleSave').textContent='Zuordnung speichern';merchantRuleStatus('Beim Speichern wird die Zuordnung für diesen Händlernamen ersetzt.');document.getElementById('merchantRuleName').focus();
  }
  function deleteMerchantRule(index) {
    const row=merchantRules().sort((a,b)=>a.merchant.localeCompare(b.merchant,'de'))[index];if(!row||!confirm(`Zuordnung für „${row.merchant}“ löschen?`))return;
    context.repository.view.Einstellungen.haendlerRegeln=merchantRules().filter(r=>normalizeMerchantName(r.merchant)!==normalizeMerchantName(row.merchant));
    if(dependencies.speichern()===false){merchantRuleStatus('Löschen fehlgeschlagen. Bitte erneut versuchen.');return;}
    resetMerchantRuleForm();renderMerchantRules();merchantRuleStatus('Eigene Zuordnung gelöscht. Bekannte Händler werden wieder automatisch erkannt.');
  }
  function renderMerchantRules() {
    const el=document.getElementById('merchantRuleList');if(!el)return;
    const rows=merchantRules().sort((a,b)=>a.merchant.localeCompare(b.merchant,'de'));
    el.innerHTML=rows.length?rows.map((r,i)=>`<div class="merchant-rule"><div><strong>${dependencies.escapeHtml(r.merchant)}</strong><div class="settings-note">${r.area} → ${dependencies.escapeHtml(r.category)}</div></div><div class="merchant-rule-actions"><button type="button" onclick="editMerchantRule(${i})" aria-label="Zuordnung bearbeiten">✎</button><button type="button" onclick="deleteMerchantRule(${i})" aria-label="Zuordnung löschen">×</button></div></div>`).join(''):'<p class="settings-note">Noch keine eigenen Zuordnungen gespeichert.</p>';
    const known=document.getElementById('merchantBuiltinList');if(known)known.innerHTML=BUILTINS.map(r=>`<div class="merchant-rule"><div><strong>${dependencies.escapeHtml(r.names)}</strong><div class="settings-note">${r.area} → ${dependencies.escapeHtml(r.category)}</div></div></div>`).join('');
  }
  return { normalizeMerchantName, merchantCategories, validMerchantDestination, merchantDestination, rememberMerchantRule, updateMerchantRuleCategories, openMerchantSettings, saveMerchantRule, editMerchantRule, deleteMerchantRule, renderMerchantRules };
});
