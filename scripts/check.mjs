import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(dir,e.name)):path.join(dir,e.name)))).flat();}
const all=await files(dist);let imports=0;
for(const file of all.filter(f=>f.endsWith('.js'))){
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(check.stderr);
  const source=await readFile(file,'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
    const spec=match[1];const target=spec==='three'?path.join(dist,'vendor','three.module.js'):spec.startsWith('three/addons/')?path.join(dist,'vendor','addons',spec.slice(13)):spec.startsWith('.')?path.resolve(path.dirname(file),spec):null;
    if(!target)throw new Error('Unexpected external import: '+spec);await access(target);imports++;
  }
}
const html=await readFile(path.join(dist,'index.html'),'utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw new Error('Duplicate HTML IDs');
const main=await readFile(path.join(dist,'main.js'),'utf8');
for(const match of main.matchAll(/\$\('#([\w-]+)(?:[\s.#>][^']*)?'\)/g))if(!ids.includes(match[1])&&match[1]!=='reload')throw new Error('Missing UI ID '+match[1]);
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await access(path.resolve(dist,match[1].split('?')[0]));
console.log(`Static checks passed: ${all.length} files, ${imports} resolved module imports, ${ids.length} unique UI IDs.`);
