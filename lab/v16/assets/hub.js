import {records,save,clearLab,el,feedback,initNav} from './shared.js';
initNav('home');
async function refresh(){
 const all=await records();
 for(const [name,prefix] of [['items','item:'],['insp','inspo:'],['rated','rating:']]){
   const node=el('count-'+name);if(node)node.textContent=all.filter(x=>x.id.startsWith(prefix)).length;
 }
}
el('export-lab')?.addEventListener('click',async()=>{
 try{
  const payload={format:'threadline-v16-lab',version:1,exportedAt:new Date().toISOString(),records:await records()};
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='threadline-v16-lab-backup.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('Test workspace exported. The file contains local clothing and inspiration photos; keep it private.');
 }catch(e){feedback('Export failed: '+e.message,true)}
});
el('import-lab')?.addEventListener('change',async e=>{
 const f=e.target.files?.[0];if(!f)return;
 if(f.size>60*1024*1024){feedback('Snapshot is too large (60 MB limit).',true);return;}
 try{
  const payload=JSON.parse(await f.text());
  if(payload?.format!=='threadline-v16-lab'||!Array.isArray(payload.records))throw Error('Not a THREADLINE V1.6 lab export');
  if(payload.records.length>1000)throw Error('Too many records for this lab');
  if(!confirm('Import '+payload.records.length+' test records? Existing records with matching IDs will be replaced.'))return;
  const allowed=['item:','inspo:','rating:','meta:'];
  let count=0;
  for(const x of payload.records){
    if(!x||typeof x.id!=='string'||!allowed.some(p=>x.id.startsWith(p)))continue;
    await save(x);count++;
  }
  await refresh();feedback('Imported '+count+' test records. Open the three labs to use the shared data.');
 }catch(err){feedback('Import failed: '+err.message,true)}finally{e.target.value='';}
});
el('clear-lab')?.addEventListener('click',async()=>{
 if(!confirm('Delete ALL V1.6 lab wardrobe photos, references and outfit ratings from this browser? Your live THREADLINE account and Supabase wardrobe are not affected.'))return;
 await clearLab();await refresh();feedback('Lab reset. Production THREADLINE data remains unchanged.');
});
refresh().catch(e=>feedback('Local lab storage is unavailable: '+e.message,true));
