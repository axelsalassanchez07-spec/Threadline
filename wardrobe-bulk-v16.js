/* THREADLINE V1.6 — integrated wardrobe photo review and optional AI.
 * Works with the existing main-app IndexedDB items store and Supabase sync hooks.
 * AI runs only when requested. Cloud sync uses the existing write hooks.
 */
(()=>{
'use strict';
const oldWardrobe=renderWardrobe;
let drafts=[],seen=new Set(),busy=false;
const defaults={Tops:'other top',Bottoms:'other bottoms',Outerwear:'other layer',Shoes:'other shoes',Accessories:'other accessory'};
function text(s){return esc(String(s??''))}
function nameFor(x){return [(x.color&&x.color!=='Unknown'?x.color:''),x.kind||x.category||'Clothing item'].filter(Boolean).join(' ').replace(/\b\w/g,c=>c.toUpperCase())}
function opts(vals,selected,placeholder=''){
 return (placeholder?'<option value="">'+text(placeholder)+'</option>':'')+vals.map(v=>'<option value="'+text(v)+'" '+(v===selected?'selected':'')+'>'+text(v)+'</option>').join('');
}
function listHTML(){
 return drafts.length?drafts.map(x=>{
  const kinds=x.category?[...new Set([...(kindOpts(x.category,x.kind).match(/value="[^"]*"/g)||[]).map(m=>m.slice(7,-1)),x.kind].filter(Boolean))]:[];
  // Use the same garment kinds as the main wardrobe form.
  const typeSelect=x.category?'<option value="">Choose type</option>'+kindOpts(x.category,x.kind):'<option value="">Choose category first</option>';
  const colors=['Unknown',...Object.keys(COLORS)].filter((v,i,a)=>a.indexOf(v)===i);
  return '<article class="v16-draft" data-v16-id="'+text(x.id)+'">'+
   '<div class="v16-draft-photo"><img src="'+x.image+'" alt="Clothing photo"></div>'+
   '<div class="v16-draft-form"><div class="button-row">'+CATEGORY.map(c=>'<button type="button" class="btn btn-ghost btn-small" data-v16-quick="'+c+'">'+c+'</button>').join('')+'</div><label class="v16-check"><input type="checkbox" data-v16-select="1" '+(x.selected?'checked':'')+'> Select for batch edit</label>'+
   '<div class="v16-fields"><label>Name<input class="input" data-v16-field="name" maxlength="70" value="'+text(x.name)+'"></label>'+
   '<label>Category<select class="select" data-v16-field="category">'+opts(CATEGORY,x.category,'Choose category')+'</select></label>'+
   '<label>Type<select class="select" data-v16-field="kind" '+(!x.category?'disabled':'')+'>'+typeSelect+'</select></label>'+
   '<label>Color<select class="select" data-v16-field="color">'+opts(colors,x.color)+'</select></label>'+
   '<label>Fit<select class="select" data-v16-field="fit">'+opts(['Unknown','Regular','Relaxed','Straight','Structured','Oversized'],x.fit)+'</select></label>'+
   '<label>Style notes (optional)<input class="input" data-v16-field="tags" value="'+text(x.tags.join(', '))+'" placeholder="casual, layered, sporty"></label></div>'+
   '<label class="v16-check"><input type="checkbox" data-v16-confirm="1" '+(x.confirmed?'checked':'')+' '+(!ThreadlineDiscovery.TYPES[x.category]?.includes(x.kind)?'disabled':'')+'> I checked the category and type against this photo</label>'+
   '<p class="small muted" role="status">'+text(x.visionNote||'')+'</p><div class="v16-draft-actions"><button type="button" class="btn btn-ghost btn-small" data-v16-ai="local">Try free local AI</button><button type="button" class="btn btn-ghost btn-small" data-v16-ai="cloud">Cloud AI</button><button type="button" class="btn btn-primary btn-small" data-v16-save-one="1">Save this piece</button><button type="button" class="btn btn-ghost btn-small" data-v16-rename="1">Suggest descriptive name</button>'+
   '<button type="button" class="btn btn-ghost btn-small" data-v16-remove="1">Remove</button></div></div></article>';
 }).join(''):'<p class="muted">Select photos above to create editable clothing drafts. Each photo should show one garment.</p>';
}
function refreshModal(){
 const root=document.querySelector('#v16-bulk-modal');if(!root)return;
 const list=root.querySelector('#v16-draft-list');if(list)list.innerHTML=listHTML();
 const amount=root.querySelector('#v16-total');if(amount)amount.textContent=drafts.length+' draft'+(drafts.length===1?'':'s');
 const btn=root.querySelector('#v16-save-all');if(btn)btn.disabled=busy||!drafts.length;
}
function notify(msg,bad=false){
 const el=document.querySelector('#v16-bulk-message');
 if(el){el.textContent=msg;el.className='v16-message '+(bad?'v16-message-bad':'');}
}
function modalHTML(){
 return '<div id="v16-bulk-modal" class="v16-bulk"><p class="small muted">Add multiple garments to your real THREADLINE wardrobe. Edit labels directly or request an AI suggestion. Local AI runs on this device; cloud AI uses provider credits. Review every suggestion before saving. Saved pieces use your existing account sync.</p>'+
 '<div class="v16-upload"><label class="btn btn-primary">Choose up to 20 clothing photos <input id="v16-bulk-files" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label>'+
 '<label class="btn btn-ghost">Take photo on phone <input id="v16-camera-file" type="file" accept="image/*" capture="environment" hidden></label></div>'+
 '<div class="v16-bulk-toolbar"><div class="v16-bulk-row"><strong id="v16-total">0 drafts</strong><button type="button" class="btn btn-ghost btn-small" data-v16-select-all="1">Select all</button>'+
 '<button type="button" class="btn btn-ghost btn-small" data-v16-clear="1">Clear selection</button></div>'+
 '<div class="v16-bulk-row"><select id="v16-bulk-category" class="select">'+opts(CATEGORY,'','Category for selected')+'</select>'+
 '<button type="button" class="btn btn-ghost btn-small" data-v16-batch="1">Assign category</button>'+
 '<button type="button" class="btn btn-ghost btn-small" data-v16-confirm-selected="1">Confirm reviewed</button></div></div>'+
 '<div id="v16-bulk-message" class="v16-message" role="status">Select photos or review saved pieces. Confirm their category and type before saving.</div>'+
 '<div id="v16-draft-list" class="v16-draft-list"></div>'+
 '<div class="modal-footer"><button class="btn btn-ghost" type="button" data-v16-cancel="1">Cancel</button>'+
 '<button class="btn btn-primary" id="v16-save-all" type="button" data-v16-save="1" disabled>Add confirmed pieces</button></div></div>';
}
function openBulk(review=false){
 drafts=review?state.items.filter(x=>!x.demo).map(x=>({...x,tags:x.tags||[],selected:false,confirmed:false})):[];
 seen=new Set();busy=false;openModal(review?'Review your wardrobe':'Add clothing photos',modalHTML(),true);refreshModal();
}
async function addFiles(list){
 if(busy)return;const files=Array.from(list||[]).filter(x=>x.type.startsWith('image/')).slice(0,20);
 if(!files.length)return notify('Choose JPG, PNG, or WebP photos.',true);
 busy=true;notify('Preparing photos for review…');
 let added=0,fail=0,duplicates=0;
 for(const file of files){
  const signature=file.name+'-'+file.size+'-'+file.lastModified;
  if(seen.has(signature)){duplicates++;continue;}
  try{
   const image=await compressPhoto(file);
   const n=drafts.length+1;
   drafts.push({id:uid(),image,name:'Clothing item '+n,category:'',kind:'',color:'Unknown',fit:'Unknown',tags:[],selected:false,confirmed:false});
   seen.add(signature);added++;
  }catch(e){fail++;}
 }
 busy=false;refreshModal();
 notify(added+' photo(s) ready. '+(duplicates?duplicates+' duplicate(s) ignored. ':'')+(fail?fail+' failed. ':'')+'Select category and type, then confirm the photo matches.');
}
function findRow(event){const id=event.target.closest('[data-v16-id]')?.dataset.v16Id;return drafts.find(x=>x.id===id)}
async function saveAll(rows=drafts){
 if(busy||!rows.length)return;
 const invalid=rows.filter(x=>!ThreadlineDiscovery.TYPES[x.category]?.includes(x.kind)||!x.name.trim()||!x.confirmed);
 if(invalid.length)return notify(invalid.length+' draft(s) need a name, valid category and type, and your confirmation. Nothing has been added.',true);
 if(!confirm('Save '+rows.length+' reviewed clothing items to your wardrobe? Existing pieces will be updated, keeping their photos. This can sync through your account.'))return;
 busy=true;refreshModal();let added=0;
 try{
  for(const d of rows){
   await write('items',{...state.items.find(x=>x.id===d.id),id:d.id,image:d.image,name:d.name.trim().slice(0,70),category:d.category,kind:d.kind,
    color:d.color||'Unknown',fit:d.fit||'Unknown',tags:d.tags,verifiedCategory:true,createdAt:d.createdAt||Date.now(),demo:false});
   added++;
  }
  drafts=drafts.filter(d=>!rows.includes(d));await refresh();state.generated=[];render();if(drafts.length){refreshModal();notify(added+' pieces saved. Review the remaining drafts.');}else{closeModal();toast(added+' pieces saved to your wardrobe.');}
 }catch(e){await refresh();render();notify('Saved '+added+' items before the error: '+(e.message||e)+'. Check your wardrobe before retrying.',true);}
 finally{busy=false;}
}
renderWardrobe=function(){
 let html=oldWardrobe();
 const addition='<section class="v16-feature"><div class="v16-feature-head"><div><span class="v16-kicker">NEW IN V1.6</span>'+
 '<h2>Build your wardrobe faster</h2><p>Add many clothing photos in one batch. Review labels together, take a phone photo, or try optional AI suggestions.</p></div>'+
 '<div class="button-row"><button type="button" class="btn btn-primary" data-v16-open-bulk="1">Add photos / camera →</button><button type="button" class="btn btn-ghost" data-v16-review="1">Review saved clothing</button></div></div><p class="small muted">'+state.items.filter(x=>!x.demo&&!ThreadlineDiscovery.validItem(x)).length+' items have conflicting or unconfirmed types and are excluded from discovery until reviewed.</p></section>';
 const after='<div class="toolbar">';
 return html.includes(after)?html.replace(after,addition+after):addition+html;
};
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.v16Review){openBulk(true);return}
 if(b.dataset.v16OpenBulk){openBulk();return}
 if(b.dataset.v16Cancel){closeModal();return}
 if(!document.querySelector('#v16-bulk-modal')||busy)return;
 if(b.dataset.v16SelectAll){drafts.forEach(x=>x.selected=true);refreshModal();return}
 if(b.dataset.v16Clear){drafts.forEach(x=>x.selected=false);refreshModal();return}
 if(b.dataset.v16Batch){
  const category=document.querySelector('#v16-bulk-category')?.value,selected=drafts.filter(x=>x.selected);
  if(!category||!selected.length)return notify('Select photos and a category first.',true);
  if(!confirm('Assign '+category+' to '+selected.length+' selected photos? You will still need to verify each one.'))return;
  selected.forEach(x=>{x.category=category;x.kind=defaults[category];x.confirmed=false;x.name=nameFor(x);});
  refreshModal();notify('Category assigned. Check types and confirm photos before saving.');return;
 }
 if(b.dataset.v16ConfirmSelected){
  const selected=drafts.filter(x=>x.selected);
  if(!selected.length)return notify('Select photos to confirm.',true);
  if(selected.some(x=>!x.category||!x.kind))return notify('Select a category and garment type for every chosen photo first.',true);
  if(!confirm('Have you checked all '+selected.length+' selected garment photos and their categories/types?'))return;
  selected.forEach(x=>x.confirmed=true);refreshModal();notify('The selected categories were confirmed by you.');return;
 }
 const x=findRow(e);if(x){
  if(b.dataset.v16Quick){x.category=b.dataset.v16Quick;x.kind=defaults[x.category];x.confirmed=false;if(/^(other |clothing item)/i.test(x.name))x.name=nameFor(x);refreshModal();return}
  if(b.dataset.v16SaveOne){void saveAll([x]);return}
  if(b.dataset.v16Ai){
   const modal=document.getElementById('v16-bulk-modal');busy=true;refreshModal();notify('Preparing AI suggestion…');
   void (async()=>{
    try{
     let image=x.image;
     if(image&&!image.startsWith('data:')){const res=await fetch(image);if(!res.ok)throw Error('Could not load this saved photo. Upload it again.');image=await compressPhoto(await res.blob());}
     const result=b.dataset.v16Ai==='local'?await ThreadlineVision.local(image,m=>{if(document.getElementById('v16-bulk-modal')===modal)notify(m);}):await ThreadlineVision.cloud('garment',image);
     if(!result){notify('Analysis cancelled.');return;}
     if(document.getElementById('v16-bulk-modal')!==modal)return;
     const valid=ThreadlineDiscovery.TYPES[result.category]?.includes(result.kind);
     x.category=valid?result.category:'';x.kind=valid?result.kind:'';
     if(valid)x.name=result.name||nameFor(x);
     if(result.source!=='local-clip'){
      x.color=result.color||'Unknown';x.fit=result.fit||'Unknown';x.tags=result.tags||[];
     }
     x.confirmed=false;x.visionNote=result.note||'Check the AI suggestion before saving.';
     notify('Suggestion received. Check the category and type against the photo.');
    }catch(err){notify(err.message||String(err),true);}
    finally{busy=false;if(document.getElementById('v16-bulk-modal')===modal)refreshModal();}
   })();return;
  }
  if(b.dataset.v16Remove){drafts=drafts.filter(d=>d!==x);refreshModal();return}
  if(b.dataset.v16Rename){x.name=nameFor(x);refreshModal();return}
 }
 if(b.dataset.v16Save){void saveAll();}
});
document.addEventListener('change',e=>{
 const el=e.target,root=el.closest('#v16-bulk-modal');if(!root||busy)return;
 if(el.id==='v16-bulk-files'||el.id==='v16-camera-file'){void addFiles(el.files).then(()=>{el.value='';});return}
 const x=findRow(e);if(!x)return;
 if(el.dataset.v16Select){x.selected=el.checked;return}
 if(el.dataset.v16Confirm){x.confirmed=!!el.checked&&!!x.category&&!!x.kind;return}
 if(el.dataset.v16Field){
  const key=el.dataset.v16Field;
  if(key==='tags')x.tags=el.value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean).slice(0,12);
  else x[key]=el.value;
  if(key==='category'){x.kind=defaults[x.category]||'';x.confirmed=false;if(/^(other |clothing item)/i.test(x.name))x.name=nameFor(x);refreshModal();}
  else if(key==='kind'){x.confirmed=false;if(/^(other |clothing item)/i.test(x.name))x.name=nameFor(x);refreshModal();}
 }
});
document.addEventListener('input',e=>{
 const el=e.target;if(busy||!el.closest('#v16-bulk-modal')||!el.dataset.v16Field)return;
 const x=findRow(e);if(!x)return;const key=el.dataset.v16Field;
 if(key==='name')x.name=el.value;
 if(key==='tags')x.tags=el.value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean).slice(0,12);
});
})();
