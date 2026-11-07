import {records,save,erase,photo,THEMES,esc,uid,el,feedback,themeCounts,initNav} from './shared.js';
import {interpretStyleDescription} from './fashion-language.js';
import {analyzeInspiration} from './vision-client.js';
initNav('inspiration');
let drafts=[],busy=false;
function themeButtons(row){
 return '<div class="tagset">'+THEMES.map(t=>'<button type="button" class="'+((row.tags||[]).includes(t)?'active':'')+'" data-theme="'+esc(t)+'">'+esc(t)+'</button>').join('')+'</div>';
}
function visionResultMarkup(row){
 const a=row.aiAnalysis;if(!a)return '';
 return '<div class="analysis-result"><strong>AI photo interpretation · '+esc(a.confidence||'uncertain')+' confidence</strong>'+
  '<p class="small">'+esc(a.summary||'')+'</p>'+
  '<p class="small"><strong>Why this look works:</strong> '+esc(a.styleExplanation||'')+'</p>'+
  (a.garments?.length?'<p class="small"><strong>Visible pieces:</strong> '+a.garments.map(g=>esc(g.description)).join(' · ')+'</p>':'')+
  (a.developmentIdeas?.length?'<p class="small"><strong>Ideas to try:</strong></p><ul>'+a.developmentIdeas.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':'')+
  '<p class="small">Review these suggestions before adding them to your inspiration profile.</p></div>';
}
function draftCard(row){
 return '<article class="review-item" data-draft="'+esc(row.id)+'"><div class="review-top"><img class="thumb" src="'+row.image+'" alt="Saved inspiration preview"><div style="flex:1"><div class="field"><label>Reference name</label><input data-field="name" value="'+esc(row.name)+'" maxlength="70"></div><p class="small">Estimated image palette: '+esc(row.estimatedColor)+' (may reflect the background)</p></div></div>'+
 '<div class="field"><label>What attracted you to this look?</label><textarea data-field="notes" placeholder="Optional, but helpful: what silhouette, garment or styling idea do you like?">'+esc(row.notes||'')+'</textarea></div>'+
 '<div class="row between" style="margin:10px 0"><button type="button" class="button-outline" data-translate="1">Translate my description into fashion terms</button><button type="button" class="button" data-vision-inspo="1">✨ Interpret the photo with AI</button></div>'+ '<div class="summary" data-interpreted="1">'+esc(row.interpretation||'Write what you like in everyday language, then translate it into optional fashion terms.')+'</div>'+ visionResultMarkup(row)+'<p class="small">Review suggested style cues; remove or add anything before saving.</p>'+themeButtons(row)+
 '<div class="row between" style="margin-top:12px"><button class="button-quiet" data-discard="'+row.id+'">Remove</button><button class="button-outline" data-save-one="'+row.id+'">Save inspiration</button></div></article>';
}
function showDrafts(){
 el('review-grid').innerHTML=drafts.length?drafts.map(draftCard).join(''):'<div class="empty">Upload a set of inspiration photos or screenshots. Add details that explain why you saved each look.</div>';
 el('save-all').disabled=!drafts.length||busy;
 el('draft-total').textContent=drafts.length+' to review';
}
async function paintPatterns(){
 const data=await records('inspo:');const tally=themeCounts(data);
 el('inspo-count').textContent=data.length+' references';
 const max=Math.max(1,...tally.map(x=>x.count));
 el('pattern-panel').innerHTML=tally.length?
  '<p class="small">Patterns across saved tags and notes, including any AI photo cues you explicitly reviewed and saved.</p>'+tally.slice(0,12).map(x=>
    '<div class="signal"><span>'+esc(x.label)+'</span><span class="small">'+x.count+' of '+data.length+'</span></div><div class="bar" style="margin:-3px 0 13px"><div style="width:'+Math.round(x.count/data.length*100)+'%"></div></div>'
  ).join(''):'<div class="empty">Your recurring inspiration signals will appear here after you tag a few looks.</div>';
 el('saved-grid').innerHTML=data.length?data.map(row=>
  '<article class="review-item"><div class="review-top"><img class="thumb-mini" src="'+row.image+'" alt=""><div><strong>'+esc(row.name)+'</strong><p class="small">'+esc(row.notes||'No notes yet')+'</p></div></div><div class="tagset">'+(row.tags||[]).map(t=>'<span class="pill">'+esc(t)+'</span>').join('')+'</div><p class="small">'+esc(row.interpretation||'')+'</p>'+visionResultMarkup(row)+'<div class="row between" style="margin-top:12px"><a class="button-outline" href="../stylist/?inspo='+encodeURIComponent(row.id)+'">Develop this look →</a><button class="button-outline" data-edit="'+row.id+'">Edit notes</button><button class="button-quiet" data-delete="'+row.id+'">Delete</button></div></article>'
 ).join(''):'<div class="empty">Your saved references will appear here.</div>';
}
async function load(files){
 if(busy)return;const list=Array.from(files).filter(x=>x.type.startsWith('image/')).slice(0,40);
 if(!list.length)return feedback('Choose images to add.',true);
 busy=true;el('files').disabled=true;let success=0,failed=0;
 for(const file of list){
  try{
   const p=await photo(file,1050);
   drafts.push({id:'inspo:'+uid(),name:file.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ').slice(0,70)||'Inspiration',
     notes:'',tags:[],estimatedColor:p.estimatedColor,image:p.src,createdAt:Date.now()});success++;
  }catch(e){failed++;}
  el('upload-progress').textContent=success+' images processed · '+failed+' failed';
 }
 busy=false;el('files').disabled=false;el('files').value='';showDrafts();
 feedback(success+' references ready. Images are stored only in this browser. Select what attracted you; AI photo analysis is optional and requires a one-time secured service setup.');
}
async function persist(rows){
 let n=0;
 for(const row of rows){try{await save(row);drafts=drafts.filter(x=>x.id!==row.id);n++;}catch(e){feedback('Saving failed: '+e.message,true);break;}}
 showDrafts();await paintPatterns();feedback(n+' inspiration'+(n===1?'':'s')+' saved. The pattern panel now reflects your board.');
}
el('files').addEventListener('change',e=>void load(e.target.files));
el('dropzone').addEventListener('dragover',e=>e.preventDefault());
el('dropzone').addEventListener('drop',e=>{e.preventDefault();void load(e.dataTransfer.files);});
el('review-grid').addEventListener('input',e=>{
 const row=drafts.find(x=>x.id===e.target.closest('[data-draft]')?.dataset.draft);
 if(row&&e.target.dataset.field)row[e.target.dataset.field]=e.target.value;
});
el('review-grid').addEventListener('click',e=>{
 const row=drafts.find(x=>x.id===e.target.closest('[data-draft]')?.dataset.draft);
 if(!row)return;
 const ai=e.target.closest('[data-vision-inspo]');
 if(ai){
  if(!confirm('Send this inspiration photo and your optional description to the AI provider through Supabase? This will create editable suggestions, not save them automatically.'))return;
  ai.disabled=true;ai.textContent='Interpreting photo…';
  void analyzeInspiration(row.image,row.notes||'').then(result=>{
   row.tags=[...new Set([...(row.tags||[]),...(Array.isArray(result.tags)?result.tags.filter(x=>THEMES.includes(x)):[])])];
   row.aiAnalysis={
    summary:String(result.summary||'').slice(0,240),styleExplanation:String(result.styleExplanation||'').slice(0,600),
    confidence:result.confidence,dominantColors:Array.isArray(result.dominantColors)?result.dominantColors.slice(0,6):[],
    garments:Array.isArray(result.garments)?result.garments.slice(0,12):[],
    developmentIdeas:Array.isArray(result.developmentIdeas)?result.developmentIdeas.slice(0,3):[]
   };
   showDrafts();feedback('Photo interpretation returned. Review the analysis and correct any tags before saving.');
  }).catch(err=>{ai.disabled=false;ai.textContent='✨ Interpret the photo with AI';feedback('AI photo interpretation unavailable: '+(err.message||err),true);});
  return;
 }
 const translate=e.target.closest('[data-translate]');
 if(translate){const result=interpretStyleDescription(row.notes||'');row.tags=[...new Set([...(row.tags||[]),...result.tags])];row.interpretation=result.summary;const card=e.target.closest('[data-draft]');card.querySelector('[data-interpreted]').textContent=result.summary;card.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',row.tags.includes(b.dataset.theme)));feedback(result.tags.length?'Suggested '+result.tags.length+' editable cues from your words. Confirm or adjust them.':'No clear fashion terms found yet. Try describing the shape, layers, colors, or a specific garment.');return;}
 const theme=e.target.closest('[data-theme]')?.dataset.theme;
 if(theme){row.tags=row.tags.includes(theme)?row.tags.filter(x=>x!==theme):[...row.tags,theme];e.target.classList.toggle('active',row.tags.includes(theme));return;}
 if(e.target.closest('[data-discard]')){drafts=drafts.filter(x=>x.id!==row.id);showDrafts();}
 if(e.target.closest('[data-save-one]'))void persist([row]);
});
el('saved-grid').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit]');
 if(edit){const row=(await records('inspo:')).find(x=>x.id===edit.dataset.edit);if(row){drafts=drafts.filter(x=>x.id!==row.id);drafts.unshift({...row});showDrafts();el('review-grid').scrollIntoView({behavior:'smooth',block:'start'});feedback('Edit the description and suggested cues, then save the same inspiration again.');}return;}
 const key=e.target.closest('[data-delete]')?.dataset.delete;
 if(!key)return;
 if(!confirm('Remove this inspiration from the V1.6 test board?'))return;
 await erase(key);await paintPatterns();feedback('Inspiration removed.');
});
el('save-all').addEventListener('click',()=>void persist([...drafts]));
showDrafts();paintPatterns().catch(e=>feedback('Could not load lab data: '+e.message,true));
