import {readFile,writeFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('lib/research/manifest.json','utf8')),summary={};
for(const c of manifest.collections){const index=JSON.parse(await readFile('public/research-data/'+c.index,'utf8'));for(const [key,count] of Object.entries(index.companyCounts)){if(!key.startsWith('CIK:')||!count)continue;const s=summary[key.slice(4)]??={records:0,collections:0};s.records+=count;s.collections++;}}
await writeFile('lib/research/company-evidence.json',JSON.stringify(summary));
console.log('Indexed source availability for',Object.keys(summary).length,'issuers. Counts include overlapping source views and candidate links.');
