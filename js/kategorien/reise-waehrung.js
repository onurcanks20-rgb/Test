Kostentracker.module({
 id:"js/kategorien/reise-waehrung.js",
 dependencies:["escapeHtml","speichern","renderReiseBudget","prepareReiseBudgetRate"],
 session:["aktuellesLand"],read:["ReisenMeta"],write:["ReisenMeta"],replace:false
}, (context, dependencies) => {
 "use strict";
 // Currency/territory snapshot: Unicode CLDR 48, effective 2026-10-12.
 // https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/currencyData.json
 const currencyCodes = ["AED", "AFN", "ALL", "AMD", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWG"];
 const regionCurrencies = {"AC": "SHP", "AD": "EUR", "AE": "AED", "AF": "AFN", "AG": "XCD", "AI": "XCD", "AL": "ALL", "AM": "AMD", "AO": "AOA", "AR": "ARS", "AS": "USD", "AT": "EUR", "AU": "AUD", "AW": "AWG", "AX": "EUR", "AZ": "AZN", "BA": "BAM", "BB": "BBD", "BD": "BDT", "BE": "EUR", "BF": "XOF", "BG": "EUR", "BH": "BHD", "BI": "BIF", "BJ": "XOF", "BL": "EUR", "BM": "BMD", "BN": "BND", "BO": "BOB", "BQ": "USD", "BR": "BRL", "BS": "BSD", "BV": "NOK", "BW": "BWP", "BY": "BYN", "BZ": "BZD", "CA": "CAD", "CC": "AUD", "CD": "CDF", "CF": "XAF", "CG": "XAF", "CH": "CHF", "CI": "XOF", "CK": "NZD", "CL": "CLP", "CM": "XAF", "CN": "CNY", "CO": "COP", "CR": "CRC", "CU": "CUP", "CV": "CVE", "CW": "XCG", "CX": "AUD", "CY": "EUR", "CZ": "CZK", "DE": "EUR", "DG": "USD", "DJ": "DJF", "DK": "DKK", "DM": "XCD", "DO": "DOP", "DZ": "DZD", "EA": "EUR", "EC": "USD", "EE": "EUR", "EG": "EGP", "EH": "MAD", "ER": "ERN", "ES": "EUR", "ET": "ETB", "EU": "EUR", "FI": "EUR", "FJ": "FJD", "FK": "FKP", "FM": "USD", "FO": "DKK", "FR": "EUR", "GA": "XAF", "GB": "GBP", "GD": "XCD", "GE": "GEL", "GF": "EUR", "GG": "GBP", "GH": "GHS", "GI": "GIP", "GL": "DKK", "GM": "GMD", "GN": "GNF", "GP": "EUR", "GQ": "XAF", "GR": "EUR", "GS": "GBP", "GT": "GTQ", "GU": "USD", "GW": "XOF", "GY": "GYD", "HK": "HKD", "HM": "AUD", "HN": "HNL", "HR": "EUR", "HU": "HUF", "IC": "EUR", "ID": "IDR", "IE": "EUR", "IL": "ILS", "IM": "GBP", "IN": "INR", "IO": "USD", "IQ": "IQD", "IR": "IRR", "IS": "ISK", "IT": "EUR", "JE": "GBP", "JM": "JMD", "JO": "JOD", "JP": "JPY", "KE": "KES", "KG": "KGS", "KH": "KHR", "KI": "AUD", "KM": "KMF", "KN": "XCD", "KP": "KPW", "KR": "KRW", "KW": "KWD", "KY": "KYD", "KZ": "KZT", "LA": "LAK", "LB": "LBP", "LC": "XCD", "LI": "CHF", "LK": "LKR", "LR": "LRD", "LT": "EUR", "LU": "EUR", "LV": "EUR", "LY": "LYD", "MA": "MAD", "MC": "EUR", "MD": "MDL", "ME": "EUR", "MF": "EUR", "MG": "MGA", "MH": "USD", "MK": "MKD", "ML": "XOF", "MM": "MMK", "MN": "MNT", "MO": "MOP", "MP": "USD", "MQ": "EUR", "MR": "MRU", "MS": "XCD", "MT": "EUR", "MU": "MUR", "MV": "MVR", "MW": "MWK", "MX": "MXN", "MY": "MYR", "MZ": "MZN", "NC": "XPF", "NE": "XOF", "NF": "AUD", "NG": "NGN", "NI": "NIO", "NL": "EUR", "NO": "NOK", "NP": "NPR", "NR": "AUD", "NU": "NZD", "NZ": "NZD", "OM": "OMR", "PE": "PEN", "PF": "XPF", "PG": "PGK", "PH": "PHP", "PK": "PKR", "PL": "PLN", "PM": "EUR", "PN": "NZD", "PR": "USD", "PT": "EUR", "PW": "USD", "PY": "PYG", "QA": "QAR", "RE": "EUR", "RO": "RON", "RS": "RSD", "RU": "RUB", "RW": "RWF", "SA": "SAR", "SB": "SBD", "SC": "SCR", "SD": "SDG", "SE": "SEK", "SG": "SGD", "SH": "SHP", "SI": "EUR", "SJ": "NOK", "SK": "EUR", "SL": "SLE", "SM": "EUR", "SN": "XOF", "SO": "SOS", "SR": "SRD", "SS": "SSP", "ST": "STN", "SV": "USD", "SX": "XCG", "SY": "SYP", "SZ": "SZL", "TA": "GBP", "TC": "USD", "TD": "XAF", "TF": "EUR", "TG": "XOF", "TH": "THB", "TJ": "TJS", "TK": "NZD", "TL": "USD", "TM": "TMT", "TN": "TND", "TO": "TOP", "TR": "TRY", "TT": "TTD", "TV": "AUD", "TW": "TWD", "TZ": "TZS", "UA": "UAH", "UG": "UGX", "UM": "USD", "US": "USD", "UY": "UYU", "UZ": "UZS", "VA": "EUR", "VC": "XCD", "VE": "VES", "VG": "USD", "VI": "USD", "VN": "VND", "VU": "VUV", "WF": "XPF", "WS": "WST", "XK": "EUR", "YE": "YER", "YT": "EUR", "ZA": "ZAR", "ZM": "ZMW"};
 const countryCurrencies = {"AC": ["SHP"], "AD": ["EUR"], "AE": ["AED"], "AF": ["AFN"], "AG": ["XCD"], "AI": ["XCD"], "AL": ["ALL"], "AM": ["AMD"], "AO": ["AOA"], "AR": ["ARS"], "AS": ["USD"], "AT": ["EUR"], "AU": ["AUD"], "AW": ["AWG"], "AX": ["EUR"], "AZ": ["AZN"], "BA": ["BAM"], "BB": ["BBD"], "BD": ["BDT"], "BE": ["EUR"], "BF": ["XOF"], "BG": ["EUR"], "BH": ["BHD"], "BI": ["BIF"], "BJ": ["XOF"], "BL": ["EUR"], "BM": ["BMD"], "BN": ["BND"], "BO": ["BOB"], "BQ": ["USD"], "BR": ["BRL"], "BS": ["BSD"], "BT": ["BTN", "INR"], "BV": ["NOK"], "BW": ["BWP"], "BY": ["BYN"], "BZ": ["BZD"], "CA": ["CAD"], "CC": ["AUD"], "CD": ["CDF"], "CF": ["XAF"], "CG": ["XAF"], "CH": ["CHF"], "CI": ["XOF"], "CK": ["NZD"], "CL": ["CLP"], "CM": ["XAF"], "CN": ["CNY"], "CO": ["COP"], "CR": ["CRC"], "CU": ["CUP"], "CV": ["CVE"], "CW": ["XCG"], "CX": ["AUD"], "CY": ["EUR"], "CZ": ["CZK"], "DE": ["EUR"], "DG": ["USD"], "DJ": ["DJF"], "DK": ["DKK"], "DM": ["XCD"], "DO": ["DOP"], "DZ": ["DZD"], "EA": ["EUR"], "EC": ["USD"], "EE": ["EUR"], "EG": ["EGP"], "EH": ["MAD"], "ER": ["ERN"], "ES": ["EUR"], "ET": ["ETB"], "EU": ["EUR"], "FI": ["EUR"], "FJ": ["FJD"], "FK": ["FKP"], "FM": ["USD"], "FO": ["DKK"], "FR": ["EUR"], "GA": ["XAF"], "GB": ["GBP"], "GD": ["XCD"], "GE": ["GEL"], "GF": ["EUR"], "GG": ["GBP"], "GH": ["GHS"], "GI": ["GIP"], "GL": ["DKK"], "GM": ["GMD"], "GN": ["GNF"], "GP": ["EUR"], "GQ": ["XAF"], "GR": ["EUR"], "GS": ["GBP"], "GT": ["GTQ"], "GU": ["USD"], "GW": ["XOF"], "GY": ["GYD"], "HK": ["HKD"], "HM": ["AUD"], "HN": ["HNL"], "HR": ["EUR"], "HT": ["HTG", "USD"], "HU": ["HUF"], "IC": ["EUR"], "ID": ["IDR"], "IE": ["EUR"], "IL": ["ILS"], "IM": ["GBP"], "IN": ["INR"], "IO": ["USD"], "IQ": ["IQD"], "IR": ["IRR"], "IS": ["ISK"], "IT": ["EUR"], "JE": ["GBP"], "JM": ["JMD"], "JO": ["JOD"], "JP": ["JPY"], "KE": ["KES"], "KG": ["KGS"], "KH": ["KHR"], "KI": ["AUD"], "KM": ["KMF"], "KN": ["XCD"], "KP": ["KPW"], "KR": ["KRW"], "KW": ["KWD"], "KY": ["KYD"], "KZ": ["KZT"], "LA": ["LAK"], "LB": ["LBP"], "LC": ["XCD"], "LI": ["CHF"], "LK": ["LKR"], "LR": ["LRD"], "LS": ["ZAR", "LSL"], "LT": ["EUR"], "LU": ["EUR"], "LV": ["EUR"], "LY": ["LYD"], "MA": ["MAD"], "MC": ["EUR"], "MD": ["MDL"], "ME": ["EUR"], "MF": ["EUR"], "MG": ["MGA"], "MH": ["USD"], "MK": ["MKD"], "ML": ["XOF"], "MM": ["MMK"], "MN": ["MNT"], "MO": ["MOP"], "MP": ["USD"], "MQ": ["EUR"], "MR": ["MRU"], "MS": ["XCD"], "MT": ["EUR"], "MU": ["MUR"], "MV": ["MVR"], "MW": ["MWK"], "MX": ["MXN"], "MY": ["MYR"], "MZ": ["MZN"], "NA": ["NAD", "ZAR"], "NC": ["XPF"], "NE": ["XOF"], "NF": ["AUD"], "NG": ["NGN"], "NI": ["NIO"], "NL": ["EUR"], "NO": ["NOK"], "NP": ["NPR"], "NR": ["AUD"], "NU": ["NZD"], "NZ": ["NZD"], "OM": ["OMR"], "PA": ["PAB", "USD"], "PE": ["PEN"], "PF": ["XPF"], "PG": ["PGK"], "PH": ["PHP"], "PK": ["PKR"], "PL": ["PLN"], "PM": ["EUR"], "PN": ["NZD"], "PR": ["USD"], "PS": ["ILS", "JOD"], "PT": ["EUR"], "PW": ["USD"], "PY": ["PYG"], "QA": ["QAR"], "RE": ["EUR"], "RO": ["RON"], "RS": ["RSD"], "RU": ["RUB"], "RW": ["RWF"], "SA": ["SAR"], "SB": ["SBD"], "SC": ["SCR"], "SD": ["SDG"], "SE": ["SEK"], "SG": ["SGD"], "SH": ["SHP"], "SI": ["EUR"], "SJ": ["NOK"], "SK": ["EUR"], "SL": ["SLE"], "SM": ["EUR"], "SN": ["XOF"], "SO": ["SOS"], "SR": ["SRD"], "SS": ["SSP"], "ST": ["STN"], "SV": ["USD"], "SX": ["XCG"], "SY": ["SYP"], "SZ": ["SZL"], "TA": ["GBP"], "TC": ["USD"], "TD": ["XAF"], "TF": ["EUR"], "TG": ["XOF"], "TH": ["THB"], "TJ": ["TJS"], "TK": ["NZD"], "TL": ["USD"], "TM": ["TMT"], "TN": ["TND"], "TO": ["TOP"], "TR": ["TRY"], "TT": ["TTD"], "TV": ["AUD"], "TW": ["TWD"], "TZ": ["TZS"], "UA": ["UAH"], "UG": ["UGX"], "UM": ["USD"], "US": ["USD"], "UY": ["UYU"], "UZ": ["UZS"], "VA": ["EUR"], "VC": ["XCD"], "VE": ["VES"], "VG": ["USD"], "VI": ["USD"], "VN": ["VND"], "VU": ["VUV"], "WF": ["XPF"], "WS": ["WST"], "XK": ["EUR"], "YE": ["YER"], "YT": ["EUR"], "ZA": ["ZAR"], "ZM": ["ZMW"], "ZW": ["ZWG", "USD"]};
 const countryNames = {"AC":"Ascension","AD":"Andorra","AE":"Vereinigte Arabische Emirate","AF":"Afghanistan","AG":"Antigua und Barbuda","AI":"Anguilla","AL":"Albanien","AM":"Armenien","AO":"Angola","AR":"Argentinien","AS":"Amerikanisch-Samoa","AT":"Österreich","AU":"Australien","AW":"Aruba","AX":"Ålandinseln","AZ":"Aserbaidschan","BA":"Bosnien und Herzegowina","BB":"Barbados","BD":"Bangladesch","BE":"Belgien","BF":"Burkina Faso","BG":"Bulgarien","BH":"Bahrain","BI":"Burundi","BJ":"Benin","BL":"St. Barthélemy","BM":"Bermuda","BN":"Brunei Darussalam","BO":"Bolivien","BQ":"Karibische Niederlande","BR":"Brasilien","BS":"Bahamas","BT":"Bhutan","BV":"Bouvetinsel","BW":"Botsuana","BY":"Belarus","BZ":"Belize","CA":"Kanada","CC":"Kokosinseln","CD":"Kongo-Kinshasa","CF":"Zentralafrikanische Republik","CG":"Kongo-Brazzaville","CH":"Schweiz","CI":"Côte d’Ivoire","CK":"Cookinseln","CL":"Chile","CM":"Kamerun","CN":"China","CO":"Kolumbien","CR":"Costa Rica","CU":"Kuba","CV":"Cabo Verde","CW":"Curaçao","CX":"Weihnachtsinsel","CY":"Zypern","CZ":"Tschechien","DE":"Deutschland","DG":"Diego Garcia","DJ":"Dschibuti","DK":"Dänemark","DM":"Dominica","DO":"Dominikanische Republik","DZ":"Algerien","EA":"Ceuta und Melilla","EC":"Ecuador","EE":"Estland","EG":"Ägypten","EH":"Westsahara","ER":"Eritrea","ES":"Spanien","ET":"Äthiopien","EU":"Europäische Union","FI":"Finnland","FJ":"Fidschi","FK":"Falklandinseln","FM":"Mikronesien","FO":"Färöer","FR":"Frankreich","GA":"Gabun","GB":"Vereinigtes Königreich","GD":"Grenada","GE":"Georgien","GF":"Französisch-Guayana","GG":"Guernsey","GH":"Ghana","GI":"Gibraltar","GL":"Grönland","GM":"Gambia","GN":"Guinea","GP":"Guadeloupe","GQ":"Äquatorialguinea","GR":"Griechenland","GS":"Südgeorgien und die Südlichen Sandwichinseln","GT":"Guatemala","GU":"Guam","GW":"Guinea-Bissau","GY":"Guyana","HK":"Sonderverwaltungsregion Hongkong","HM":"Heard und McDonaldinseln","HN":"Honduras","HR":"Kroatien","HT":"Haiti","HU":"Ungarn","IC":"Kanarische Inseln","ID":"Indonesien","IE":"Irland","IL":"Israel","IM":"Isle of Man","IN":"Indien","IO":"Britisches Territorium im Indischen Ozean","IQ":"Irak","IR":"Iran","IS":"Island","IT":"Italien","JE":"Jersey","JM":"Jamaika","JO":"Jordanien","JP":"Japan","KE":"Kenia","KG":"Kirgisistan","KH":"Kambodscha","KI":"Kiribati","KM":"Komoren","KN":"St. Kitts und Nevis","KP":"Nordkorea","KR":"Südkorea","KW":"Kuwait","KY":"Kaimaninseln","KZ":"Kasachstan","LA":"Laos","LB":"Libanon","LC":"St. Lucia","LI":"Liechtenstein","LK":"Sri Lanka","LR":"Liberia","LS":"Lesotho","LT":"Litauen","LU":"Luxemburg","LV":"Lettland","LY":"Libyen","MA":"Marokko","MC":"Monaco","MD":"Republik Moldau","ME":"Montenegro","MF":"St. Martin","MG":"Madagaskar","MH":"Marshallinseln","MK":"Nordmazedonien","ML":"Mali","MM":"Myanmar","MN":"Mongolei","MO":"Sonderverwaltungsregion Macau","MP":"Nördliche Marianen","MQ":"Martinique","MR":"Mauretanien","MS":"Montserrat","MT":"Malta","MU":"Mauritius","MV":"Malediven","MW":"Malawi","MX":"Mexiko","MY":"Malaysia","MZ":"Mosambik","NA":"Namibia","NC":"Neukaledonien","NE":"Niger","NF":"Norfolkinsel","NG":"Nigeria","NI":"Nicaragua","NL":"Niederlande","NO":"Norwegen","NP":"Nepal","NR":"Nauru","NU":"Niue","NZ":"Neuseeland","OM":"Oman","PA":"Panama","PE":"Peru","PF":"Französisch-Polynesien","PG":"Papua-Neuguinea","PH":"Philippinen","PK":"Pakistan","PL":"Polen","PM":"St. Pierre und Miquelon","PN":"Pitcairninseln","PR":"Puerto Rico","PS":"Palästinensische Autonomiegebiete","PT":"Portugal","PW":"Palau","PY":"Paraguay","QA":"Katar","RE":"Réunion","RO":"Rumänien","RS":"Serbien","RU":"Russland","RW":"Ruanda","SA":"Saudi-Arabien","SB":"Salomonen","SC":"Seychellen","SD":"Sudan","SE":"Schweden","SG":"Singapur","SH":"St. Helena","SI":"Slowenien","SJ":"Spitzbergen und Jan Mayen","SK":"Slowakei","SL":"Sierra Leone","SM":"San Marino","SN":"Senegal","SO":"Somalia","SR":"Suriname","SS":"Südsudan","ST":"São Tomé und Príncipe","SV":"El Salvador","SX":"Sint Maarten","SY":"Syrien","SZ":"Eswatini","TA":"Tristan da Cunha","TC":"Turks- und Caicosinseln","TD":"Tschad","TF":"Französische Süd- und Antarktisgebiete","TG":"Togo","TH":"Thailand","TJ":"Tadschikistan","TK":"Tokelau","TL":"Timor-Leste","TM":"Turkmenistan","TN":"Tunesien","TO":"Tonga","TR":"Türkei","TT":"Trinidad und Tobago","TV":"Tuvalu","TW":"Taiwan","TZ":"Tansania","UA":"Ukraine","UG":"Uganda","UM":"Amerikanische Überseeinseln","US":"USA","UY":"Uruguay","UZ":"Usbekistan","VA":"Vatikanstadt","VC":"St. Vincent und die Grenadinen","VE":"Venezuela","VG":"Britische Jungferninseln","VI":"Amerikanische Jungferninseln","VN":"Vietnam","VU":"Vanuatu","WF":"Wallis und Futuna","WS":"Samoa","XK":"Kosovo","YE":"Jemen","YT":"Mayotte","ZA":"Südafrika","ZM":"Sambia","ZW":"Simbabwe"};
 const currencySet = new Set(currencyCodes);
 const clean = name => String(name||'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('de-DE').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim();
 const countryAliases = new Map();
 const regionAliases = new Map();
 for(const region of Object.keys(countryNames)){regionAliases.set(clean(countryNames[region]),region);regionAliases.set(clean(region),region);}
 for (const locale of ['de','en','tr']) {
   let names;
   try { names = new Intl.DisplayNames([locale], {type:'region'}); } catch (_) { continue; }
   for (const region of Object.keys(regionCurrencies)) {
     countryAliases.set(clean(region), regionCurrencies[region]);
     countryAliases.set(clean(names.of(region)), regionCurrencies[region]);
     regionAliases.set(clean(names.of(region)),region);
   }
 }
 for (const [name,region] of Object.entries({turkei:'TR',turkiye:'TR',turkey:'TR',china:'CN','volksrepublik china':'CN','china festland':'CN','mainland china':'CN',usa:'US',uk:'GB',england:'GB',vae:'AE'})) {countryAliases.set(name,regionCurrencies[region]);regionAliases.set(name,region);}
 let currencyNames;
 try { currencyNames = new Intl.DisplayNames(['de'], {type:'currency'}); } catch (_) {}
 const nameOf = code => code==='CNY'?'Chinesischer Yuan (Renminbi)':currencyNames?.of(code) || code;
 const choices = Object.entries(countryCurrencies).flatMap(([country,codes])=>codes.map(currency=>({country,currency,key:country+':'+currency,name:countryNames[country]})));
 for(const currency of currencyCodes)if(!choices.some(c=>c.currency===currency))choices.push({country:'ZZ',currency,key:'ZZ:'+currency,name:'Weitere Währungen'});
 choices.sort((a,b)=>a.name.localeCompare(b.name,'de')||a.currency.localeCompare(b.currency));
 const choicesByKey=new Map(choices.map(choice=>[choice.key,choice]));
 function currencyFromChoice(value) { return choicesByKey.get(value)?.currency || (currencySet.has(value)?value:''); }
 function resolveCurrencyChoice(value,land='') {
   if(choicesByKey.has(value))return value;
   if(!currencySet.has(value))return '';
   const region=regionAliases.get(clean(land));
   if(region&&choicesByKey.has(region+':'+value))return region+':'+value;
   const preferred={EUR:'DE',USD:'US',GBP:'GB',CNY:'CN',TRY:'TR',JPY:'JP'}[value];
   if(preferred&&choicesByKey.has(preferred+':'+value))return preferred+':'+value;
   return choices.find(choice=>choice.currency===value)?.key||'';
 }
 function inferReiseCurrencyChoice(name) {
   const region=regionAliases.get(clean(name));
   const currencies=countryCurrencies[region];
   return currencies?.length===1?region+':'+currencies[0]:'';
 }
 let manualNewCurrency = false;
 function inferReiseCurrency(name) { return currencyFromChoice(inferReiseCurrencyChoice(name)); }
 function reiseCurrencyOptions(selected='', empty=true) {
   const selectedChoice=resolveCurrencyChoice(selected);
   return (empty ? '<option value="">Land / Währung wählen</option>' : '') + choices.map(choice =>
     `<option value="${choice.key}"${choice.key===selectedChoice?' selected':''}>${dependencies.escapeHtml(choice.name)} – ${choice.currency} · ${dependencies.escapeHtml(nameOf(choice.currency))}</option>`).join('');
 }
 function updateNewReiseCurrencySuggestion() {
   const select=document.getElementById('landCurrency');if(!select)return;
   const inferred=inferReiseCurrencyChoice(document.getElementById('landInput')?.value);
   if(manualNewCurrency&&!currencyFromChoice(select.value))manualNewCurrency=false;
   if(!manualNewCurrency) select.value=inferred;
   const hint=document.getElementById('landCurrencyHint');
   if(hint) hint.textContent=manualNewCurrency?'Deine Auswahl wird für diese Reise gespeichert.':inferred?'Passend zum Land vorgeschlagen. Du kannst die Währung ändern.':'Bitte die passende Währung auswählen.';
 }
 function markNewReiseCurrencyManual() { manualNewCurrency=!!document.getElementById('landCurrency')?.value;updateNewReiseCurrencySuggestion(); }
 function initReiseCurrencyChoice() {
   const select=document.getElementById('landCurrency');if(!select)return;
   const selected=resolveCurrencyChoice(select.value,document.getElementById('landInput')?.value);
   select.innerHTML=reiseCurrencyOptions(selected);select.value=selected;
   updateNewReiseCurrencySuggestion();
 }
 function resetNewReiseCurrency() { manualNewCurrency=false;const select=document.getElementById('landCurrency');if(select)select.value='';updateNewReiseCurrencySuggestion(); }
 function getNewReiseCurrency() {
   const code=document.getElementById('landCurrency')?.value||'';
   return currencyFromChoice(code)||(manualNewCurrency?'':inferReiseCurrency(document.getElementById('landInput')?.value));
 }
 function getNewReiseCurrencyCountry() {
   const key=resolveCurrencyChoice(document.getElementById('landCurrency')?.value,document.getElementById('landInput')?.value)||inferReiseCurrencyChoice(document.getElementById('landInput')?.value);
   const region=choicesByKey.get(key)?.country;return region&&region!=='ZZ'?region:'';
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
 function renderReiseCurrencySelector(editing = false) {
   const code=getReiseCurrency();
   const savedCountry=context.repository.view.ReisenMeta?.[context.session.aktuellesLand]?.currencyCountry;
   const key=resolveCurrencyChoice(savedCountry? savedCountry+':'+code:code,context.session.aktuellesLand);
   return `<div class="reise-currency-picker"><span aria-hidden="true">${code||'Währung'} ▾</span><select id="reiseCurrencySelect" class="reise-currency-compact" aria-label="Reisewährung nach Land auswählen" title="Reisewährung auswählen" ${editing ? '' : 'onchange="setReiseCurrency(this.value)"'}>${reiseCurrencyOptions(key)}</select></div>`;
 }
 function setReiseCurrency(value, persist = true) {
   const land=context.session.aktuellesLand, key=resolveCurrencyChoice(value,land),code=currencyFromChoice(key);
   if(!land||!code){dependencies.renderReiseBudget();return;}
   context.repository.view.ReisenMeta ||= {};
   context.repository.view.ReisenMeta[land] ||= {budget:0,von:'',bis:''};
   context.repository.view.ReisenMeta[land].currency=code;
   const region=choicesByKey.get(key)?.country;
   context.repository.view.ReisenMeta[land].currencyCountry=region==='ZZ'?'':region;
   if (!persist) return true;
   dependencies.speichern();
   dependencies.renderReiseBudget();
   dependencies.prepareReiseBudgetRate();
 }
 initReiseCurrencyChoice();
 return {inferReiseCurrency,reiseCurrencyOptions,updateNewReiseCurrencySuggestion,markNewReiseCurrencyManual,initReiseCurrencyChoice,resetNewReiseCurrency,getNewReiseCurrency,getNewReiseCurrencyCountry,getReiseCurrency,initExistingReiseCurrency,renderReiseCurrencySelector,setReiseCurrency};
});
