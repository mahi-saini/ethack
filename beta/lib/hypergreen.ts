export const dimensions = [
 {key:'footprint', name:'Environmental footprint', short:'Footprint', description:'Sector-relative emissions intensity, water and waste. Keep absolute impacts visible.', weight:30},
 {key:'transition',name:'Transition progress',short:'Transition',description:'Actual reductions, credible targets and disclosed investment plans. Promises and results stay separate.',weight:30},
 {key:'resilience',name:'Financial resilience',short:'Resilience',description:'Cash flow, leverage and the capacity to finance a transition.',weight:20},
 {key:'stewardship',name:'People & governance',short:'Stewardship',description:'Worker safety, oversight and documented environmental compliance.',weight:20},
] as const;
export type Company = {draft?:{version:string;asOf:string;observedScores:(number|null)[];coverage:number;confidence:string;inputs:Record<string,unknown>[];limitations:string[]};evidence?:{records:number;collections:number};ticker:string; name:string; sector:string; cik:string; scores:(number|null)[]; intensity:number|null; reduction:number|null; coverage:number; target:string; year:number; availableDate:string; source:string};
const raw: [string,string,string,string,number[],number|null,number|null,number,string][] = [
 ['MSFT','Microsoft','Technology','0000789019',[87,92,91,84],14,-22,96,'Validated'],
 ['AAPL','Apple','Technology','0000320193',[90,88,94,80],9,-28,94,'Validated'],
 ['ETN','Eaton','Industrials','0001551182',[76,89,84,85],63,-19,92,'Validated'],
 ['NEE','NextEra Energy','Utilities','0000753308',[64,93,77,82],210,-24,92,'Committed'],
 ['ADBE','Adobe','Technology','0000796343',[92,83,86,88],7,-18,95,'Validated'],
 ['WM','Waste Management','Industrials','0000823768',[55,82,80,83],320,-12,89,'Validated'],
 ['JCI','Johnson Controls','Industrials','0000833444',[80,87,74,85],54,-21,88,'Validated'],
 ['XOM','Exxon Mobil','Energy','0000034088',[23,38,89,60],580,-4,87,'Committed'],
 ['JPM','JPMorgan Chase','Financials','0000019617',[70,58,90,73],8,-9,78,'Committed'],
 ['UNH','UnitedHealth Group','Health Care','0000731766',[77,65,82,68],22,-10,82,'Committed'],
 ['PG','Procter & Gamble','Consumer Staples','0000080424',[72,80,87,86],86,-16,91,'Validated'],
 ['AMZN','Amazon','Consumer Discretionary','0001018724',[61,78,88,62],47,-8,88,'Committed'],
 ['LIN','Linde','Materials','0001707925',[52,78,83,80],390,-13,93,'Validated'],
 ['PLD','Prologis','Real Estate','0001045609',[86,86,78,85],18,-25,90,'Validated'],
 ['VZ','Verizon','Communication Services','0000732712',[78,81,72,76],26,-17,86,'Validated'],
 ['DUK','Duke Energy','Utilities','0001326160',[44,70,73,78],440,-14,90,'Committed'],
 ['CAT','Caterpillar','Industrials','0000018230',[48,54,86,74],150,-7,82,'Committed'],
 ['FSLR','First Solar','Technology','0001274494',[78,91,76,83],88,-23,88,'Validated'],
 ['ENPH','Enphase Energy','Technology','0001463101',[85,88,70,79],24,-20,83,'Committed'],
 ['CSCO','Cisco','Technology','0000858877',[89,85,87,88],12,-26,95,'Validated'],
 ['KO','Coca-Cola','Consumer Staples','0000021344',[62,73,83,75],110,-11,86,'Validated'],
 ['NUE','Nucor','Materials','0000073309',[60,72,86,79],480,-15,91,'Committed'],
 ['TSLA','Tesla','Consumer Discretionary','0001318605',[70,79,74,47],95,-6,76,'None disclosed'],
 ['GEV','GE Vernova','Industrials','0001996810',[64,88,70],null,null,61,'Committed'],
];
export const demoCompanies:Company[] = raw.map(([ticker,name,sector,cik,scores,intensity,reduction,coverage,target])=>({ticker,name,sector,cik,scores:[...scores,...Array(4-scores.length).fill(null)],intensity,reduction,coverage,target,year:2025,availableDate:'2026-06-30',source:'HyperGreen synthetic demonstration'}));
export function score(c:Company,weights:number[]) {const total=weights.reduce((a,b)=>a+b,0);const eligible=weights.reduce((a,w,i)=>a+(c.scores[i]!==null?w:0),0);return !total || eligible/total<.7 ? null : Math.round(weights.reduce((a,w,i)=>a+(c.scores[i]??0)*w,0)/eligible);}
export function download(name:string,content:string,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function toCSV(rows:Record<string,unknown>[]) {if(!rows.length)return '';const keys=Object.keys(rows[0]);const cell=(x:unknown)=>{const value=typeof x==='string'&&/^[=+\-@\t\r]/.test(x)?"'"+x:String(x??'');return '"'+value.replaceAll('"','""')+'"';};return [keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\n');}
