Kostentracker.module({
 id:"js/kategorien/reise-waehrung.js",
 dependencies:["escapeHtml","speichern","renderReiseBudget"],
 session:["aktuellesLand"],read:["ReisenMeta"],write:["ReisenMeta"],replace:false
}, (context, dependencies) => {
 "use strict";
 // Currency/territory snapshot: Unicode CLDR 48, effective 2026-10-12.
 // https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/currencyData.json
 const currencyCodes = ["AED", "AFN", "ALL", "AMD", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWG"];
 const regionCurrencies = {"AC": "SHP", "AD": "EUR", "AE": "AED", "AF": "AFN", "AG": "XCD", "AI": "XCD", "AL": "ALL", "AM": "AMD", "AO": "AOA", "AR": "ARS", "AS": "USD", "AT": "EUR", "AU": "AUD", "AW": "AWG", "AX": "EUR", "AZ": "AZN", "BA": "BAM", "BB": "BBD", "BD": "BDT", "BE": "EUR", "BF": "XOF", "BG": "EUR", "BH": "BHD", "BI": "BIF", "BJ": "XOF", "BL": "EUR", "BM": "BMD", "BN": "BND", "BO": "BOB", "BQ": "USD", "BR": "BRL", "BS": "BSD", "BV": "NOK", "BW": "BWP", "BY": "BYN", "BZ": "BZD", "CA": "CAD", "CC": "AUD", "CD": "CDF", "CF": "XAF", "CG": "XAF", "CH": "CHF", "CI": "XOF", "CK": "NZD", "CL": "CLP", "CM": "XAF", "CN": "CNY", "CO": "COP", "CR": "CRC", "CU": "CUP", "CV": "CVE", "CW": "XCG", "CX": "AUD", "CY": "EUR", "CZ": "CZK", "DE": "EUR", "DG": "USD", "DJ": "DJF", "DK": "DKK", "DM": "XCD", "DO": "DOP", "DZ": "DZD", "EA": "EUR", "EC": "USD", "EE": "EUR", "EG": "EGP", "EH": "MAD", "ER": "ERN", "ES": "EUR", "ET": "ETB", "EU": "EUR", "FI": "EUR", "FJ": "FJD", "FK": "FKP", "FM": "USD", "FO": "DKK", "FR": "EUR", "GA": "XAF", "GB": "GBP", "GD": "XCD", "GE": "GEL", "GF": "EUR", "GG": "GBP", "GH": "GHS", "GI": "GIP", "GL": "DKK", "GM": "GMD", "GN": "GNF", "GP": "EUR", "GQ": "XAF", "GR": "EUR", "GS": "GBP", "GT": "GTQ", "GU": "USD", "GW": "XOF", "GY": "GYD", "HK": "HKD", "HM": "AUD", "HN": "HNL", "HR": "EUR", "HU": "HUF", "IC": "EUR", "ID": "IDR", "IE": "EUR", "IL": "ILS", "IM": "GBP", "IN": "INR", "IO": "USD", "IQ": "IQD", "IR": "IRR", "IS": "ISK", "IT": "EUR", "JE": "GBP", "JM": "JMD", "JO": "JOD", "JP": "JPY", "KE": "KES", "KG": "KGS", "KH": "KHR", "KI": "AUD", "KM": "KMF", "KN": "XCD", "KP": "KPW", "KR": "KRW", "KW": "KWD", "KY": "KYD", "KZ": "KZT", "LA": "LAK", "LB": "LBP", "LC": "XCD", "LI": "CHF", "LK": "LKR", "LR": "LRD", "LT": "EUR", "LU": "EUR", "LV": "EUR", "LY": "LYD", "MA": "MAD", "MC": "EUR", "MD": "MDL", "ME": "EUR", "MF": "EUR", "MG": "MGA", "MH": "USD", "MK": "MKD", "ML": "XOF", "MM": "MMK", "MN": "MNT", "MO": "MOP", "MP": "USD", "MQ": "EUR", "MR": "MRU", "MS": "XCD", "MT": "EUR", "MU": "MUR", "MV": "MVR", "MW": "MWK", "MX": "MXN", "MY": "MYR", "MZ": "MZN", "NC": "XPF", "NE": "XOF", "NF": "AUD", "NG": "NGN", "NI": "NIO", "NL": "EUR", "NO": "NOK", "NP": "NPR", "NR": "AUD", "NU": "NZD", "NZ": "NZD", "OM": "OMR", "PE": "PEN", "PF": "XPF", "PG": "PGK", "PH": "PHP", "PK": "PKR", "PL": "PLN", "PM": "EUR", "PN": "NZD", "PR": "USD", "PT": "EUR", "PW": "USD", "PY": "PYG", "QA": "QAR", "RE": "EUR", "RO": "RON", "RS": "RSD", "RU": "RUB", "RW": "RWF", "SA": "SAR", "SB": "SBD", "SC": "SCR", "SD": "SDG", "SE": "SEK", "SG": "SGD", "SH": "SHP", "SI": "EUR", "SJ": "NOK", "SK": "EUR", "SL": "SLE", "SM": "EUR", "SN": "XOF", "SO": "SOS", "SR": "SRD", "SS": "SSP", "ST": "STN", "SV": "USD", "SX": "XCG", "SY": "SYP", "SZ": "SZL", "TA": "GBP", "TC": "USD", "TD": "XAF", "TF": "EUR", "TG": "XOF", "TH": "THB", "TJ": "TJS", "TK": "NZD", "TL": "USD", "TM": "TMT", "TN": "TND", "TO": "TOP", "TR": "TRY", "TT": "TTD", "TV": "AUD", "TW": "TWD", "TZ": "TZS", "UA": "UAH", "UG": "UGX", "UM": "USD", "US": "USD", "UY": "UYU", "UZ": "UZS", "VA": "EUR", "VC": "XCD", "VE": "VES", "VG": "USD", "VI": "USD", "VN": "VND", "VU": "VUV", "WF": "XPF", "WS": "WST", "XK": "EUR", "YE": "YER", "YT": "EUR", "ZA": "ZAR", "ZM": "ZMW"};
 const currencySet = new Set(currencyCodes);
 const clean = name => String(name||'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('de-DE').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim();
 const countryAliases = new Map();
 for (const locale of ['de','en','tr']) {
   let names;
   try { names = new Intl.DisplayNames([locale], {type:'region'}); } catch (_) { continue; }
   for (const region of Object.keys(regionCurrencies)) {
     countryAliases.set(clean(region), regionCurrencies[region]);
     countryAliases.set(clean(names.of(region)), regionCurrencies[region]);
   }
 }
 for (const [name,region] of Object.entries({turkei:'TR',turkiye:'TR',turkey:'TR',usa:'US',uk:'GB',england:'GB',vae:'AE'})) countryAliases.set(name,regionCurrencies[region]);
 let currencyNames;
 try { currencyNames = new Intl.DisplayNames(['de'], {type:'currency'}); } catch (_) {}
 const nameOf = code => currencyNames?.of(code) || code;
 const ordered = [...currencyCodes].sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'de'));
 let manualNewCurrency = false;
 function inferReiseCurrency(name) { return countryAliases.get(clean(name)) || ''; }
 function reiseCurrencyOptions(selected='', empty=true) {
   return (empty ? '<option value="">Währung wählen</option>' : '') + ordered.map(code =>
     `<option value="${code}"${code===selected?' selected':''}>${code} · ${dependencies.escapeHtml(nameOf(code))}</option>`).join('');
 }
 function updateNewReiseCurrencySuggestion() {
   const select=document.getElementById('landCurrency');if(!select)return;
   const inferred=inferReiseCurrency(document.getElementById('landInput')?.value);
   if(!manualNewCurrency) select.value=inferred;
   const hint=document.getElementById('landCurrencyHint');
   if(hint) hint.textContent=manualNewCurrency?'Deine Auswahl wird für diese Reise gespeichert.':inferred?'Passend zum Land vorgeschlagen. Du kannst die Währung ändern.':'Bitte die passende Währung auswählen.';
 }
 function markNewReiseCurrencyManual() { manualNewCurrency=!!document.getElementById('landCurrency')?.value;updateNewReiseCurrencySuggestion(); }
 function initReiseCurrencyChoice() {
   const select=document.getElementById('landCurrency');if(!select)return;
   const selected=currencySet.has(select.value)?select.value:'';
   select.innerHTML=reiseCurrencyOptions(selected);select.value=selected;
   updateNewReiseCurrencySuggestion();
 }
 function resetNewReiseCurrency() { manualNewCurrency=false;const select=document.getElementById('landCurrency');if(select)select.value='';updateNewReiseCurrencySuggestion(); }
 function getNewReiseCurrency() {
   const code=document.getElementById('landCurrency')?.value||'';
   return currencySet.has(code)?code:manualNewCurrency?'':inferReiseCurrency(document.getElementById('landInput')?.value);
 }
 function getReiseCurrency(land=context.session.aktuellesLand) {
   const saved=context.repository.view.ReisenMeta?.[land]?.currency;
   return currencySet.has(saved)?saved:inferReiseCurrency(land);
 }
 function initExistingReiseCurrency(land) {
   if(currencySet.has(context.repository.view.ReisenMeta?.[land]?.currency))return;
   const proposed=inferReiseCurrency(land);if(!proposed)return;
   context.repository.view.ReisenMeta ||= {};
   context.repository.view.ReisenMeta[land] ||= {budget:0,von:'',bis:''};
   context.repository.view.ReisenMeta[land].currency=proposed;
   dependencies.speichern();
 }
 function renderReiseCurrencySelector() {
   const code=getReiseCurrency();
   return `<select id="reiseCurrencySelect" class="reise-currency-compact" aria-label="Reisewährung" title="Reisewährung auswählen" onchange="setReiseCurrency(this.value)">${reiseCurrencyOptions(code)}</select>`;
 }
 function setReiseCurrency(code) {
   const land=context.session.aktuellesLand;if(!land||!currencySet.has(code)){dependencies.renderReiseBudget();return;}
   context.repository.view.ReisenMeta ||= {};
   context.repository.view.ReisenMeta[land] ||= {budget:0,von:'',bis:''};
   context.repository.view.ReisenMeta[land].currency=code;
   dependencies.speichern();
   // On quota failure the repository rolls back; render the restored selection.
   dependencies.renderReiseBudget();
 }
 initReiseCurrencyChoice();
 return {inferReiseCurrency,reiseCurrencyOptions,updateNewReiseCurrencySuggestion,markNewReiseCurrencyManual,initReiseCurrencyChoice,resetNewReiseCurrency,getNewReiseCurrency,getReiseCurrency,initExistingReiseCurrency,renderReiseCurrencySelector,setReiseCurrency};
});
