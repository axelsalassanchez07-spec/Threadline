import {records,save,erase,photo,guessFilename,CATEGORIES,COLORS,FITS,TYPES,esc,uid,el,feedback,options,initNav} from './shared.js';
initNav('wardrobe');
let drafts=[];
let busy=false;
const nameFromFile=n=>n.replace(/\.[^.]+$/,'');
const field=(label,html)=>'<div class="field"><label>'+label+'</label>'+html+'</div>';
function draftCard(item){
 const select=(key,values)=>'<select data-field="'+key+'">'+(key==='category'?'<option value="">Choose category</option>':key==='kind'?'<option value="">Choose type</option>':'')+options(values,item[key])+'</select>';
 return '<article class="review-item" data-draft="'+esc(item.id)+'"><div class="review-top">'+
   '<img class="thumb" src="'+item.image+'" alt="Uploaded garment">'+
   '<div><strong>'+esc(item.name)+'</strong><p class="small">'+(item.uncertain?'Not recognized: choose category and type.':'Filename hints available: verify this item.')+'</p>'+
   '<span class="pill">Approximate pixel sample: '+esc(item.estimatedColor||'unavailable')+' (background may affect it)'+'</span></div></div>'+
   '<div class="field-grid">'+
   field('Name','<input data-field="name" value="'+esc(item.name)+'" maxlength="70">')+
   field('Category',select('category',CATEGORIES))+
   field('Type',select('kind',TYPES[item.category]||[]))+
   field('Color',select('color',['Unknown',...COLORS]))+
   field('Fit',select('fit',FITS))+
   field('Style notes (optional)','<input data-field="tags" value="'+esc((item.tags||[]).join(', '))+'" placeholder="e.g. casual, cropped, layered">')+
   '</div><div class="row between" style="margin-top:12px"><span class="small">Check category and type before saving</span><div class="row"><button class="button-quiet" data-discard="'+item.id+'">Remove</button><button class="button-outline" data-save-one="'+item.id+'">Save item</button></div></div></article>';
}
function showDrafts(){
 el('draft-heading').textContent=drafts.length?'Review '+drafts.length+' clothing draft'+(drafts.length===1?'':'s'):'Upload clothing photos';
 el('review-grid').innerHTML=drafts.length?drafts.map(draftCard).join(''):'<div class="empty">Choose several pictures above. Each will get an editable draft here.</div>';
 el('save-all').disabled=!drafts.length||busy;
}
async function showSaved(){
 const saved=await records('item:');
 el('saved-count').textContent=saved.length+' saved';
 el('saved-grid').innerHTML=saved.length?saved.map(x=>'<article class="review-item"><div class="review-top"><img class="thumb-mini" src="'+x.image+'" alt=""><div><strong>'+esc(x.name)+'</strong><p class="small">'+esc(x.category)+' · '+esc(x.kind)+' · '+esc(x.color)+'</p><div class="tagset">'+(x.tags||[]).map(t=>'<span class="pill">'+esc(t)+'</span>').join('')+'</div></div></div><button class="button-quiet" data-delete="'+esc(x.id)+'">Delete item</button></article>').join(''):'<div class="empty">No pieces saved to this lab yet.</div>';
}
async function loadFiles(fileList){
 if(busy)return;
 const files=Array.from(fileList).filter(f=>f.type.startsWith('image/')).slice(0,50);
 if(!files.length){feedback('Choose JPG, PNG, or WebP images.',true);return;}
 busy=true;el('file-input').disabled=true;el('save-all').disabled=true;
 const existing=await records('item:');
 const used=new Set([...existing,...drafts].map(x=>x.assetKey).filter(Boolean));
 let done=0,duplicates=0,failed=0;
 for(const f of files){
  const assetKey=f.name+'-'+f.size+'-'+f.lastModified;
  if(used.has(assetKey)){duplicates++;continue;}
  try{
   const pic=await photo(f);
   const suggestion=guessFilename(nameFromFile(f.name));
   const item={...suggestion,id:'item:'+uid(),name:suggestion.name==='Unidentified clothing item'?'Unidentified item '+(done+1):suggestion.name,color:suggestion.color||'Unknown',estimatedColor:pic.estimatedColor,
     tags:[],image:pic.src,assetKey,sourceName:f.name,createdAt:Date.now(),reviewed:true};
   drafts.push(item);used.add(assetKey);done++;
  }catch(e){failed++;}
  el('scan-progress').textContent=done+' ready for review · '+duplicates+' duplicates · '+failed+' unreadable';
 }
 busy=false;el('file-input').disabled=false;el('file-input').value='';
 showDrafts();
 feedback(done+' draft'+(done===1?'':'s')+' prepared. These are filename and approximate-color suggestions, NOT AI image identification. Verify categories and tags.');
}
async function persist(items){
 if(!items.length)return;
 const invalid=items.filter(x=>!x.category||!TYPES[x.category]?.includes(x.kind)||!String(x.name||'').trim());
 if(invalid.length){feedback(invalid.length+' draft(s) still need a category, type or name. Nothing was saved, to avoid incorrect outfit suggestions.',true);return;}
 for(const x of items){if(/^Unidentified item/i.test(x.name))x.name=[x.color!=='Unknown'?x.color:'',x.kind].filter(Boolean).join(' ').replace(/\\b\\w/g,c=>c.toUpperCase());}
 el('save-all').disabled=true;
 let count=0;
 for(const row of items){try{await save({...row,reviewed:true});count++;drafts=drafts.filter(x=>x.id!==row.id);}catch(e){feedback('Could not save all images: '+e.message,true);break;}}
 showDrafts();await showSaved();feedback(count+' clothing piece'+(count===1?'':'s')+' saved to the isolated lab on this browser.');
}
el('file-input').addEventListener('change',e=>void loadFiles(e.target.files));
el('dropzone').addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
el('dropzone').addEventListener('drop',e=>{e.preventDefault();void loadFiles(e.dataTransfer.files)});
el('review-grid').addEventListener('input',e=>{
 const item=drafts.find(x=>x.id===e.target.closest('[data-draft]')?.dataset.draft);
 if(!item||!e.target.dataset.field)return;
 const key=e.target.dataset.field;item[key]=key==='tags'?e.target.value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean):e.target.value;
});
el('review-grid').addEventListener('change',e=>{
 const row=e.target.closest('[data-draft]'),item=drafts.find(x=>x.id===row?.dataset.draft);
 if(!item)return;
 if(e.target.dataset.field==='category'){
   item.category=e.target.value;item.kind=item.category?(TYPES[item.category]?.[0]||''):'';
   row.querySelector('[data-field="kind"]').innerHTML='<option value="">Choose type</option>'+options(TYPES[item.category]||[],item.kind);
 }
});
el('review-grid').addEventListener('click',e=>{
 const del=e.target.closest('[data-discard]'),single=e.target.closest('[data-save-one]');
 if(del){drafts=drafts.filter(x=>x.id!==del.dataset.discard);showDrafts();}
 if(single){const row=drafts.find(x=>x.id===single.dataset.saveOne);if(row)void persist([row]);}
});
el('saved-grid').addEventListener('click',async e=>{
 const del=e.target.closest('[data-delete]');if(!del)return;
 if(!confirm('Delete this piece from the V1.6 lab?'))return;
 await erase(del.dataset.delete);await showSaved();feedback('Piece removed from the local test wardrobe.');
});
el('save-all').addEventListener('click',()=>void persist([...drafts]));
showDrafts();showSaved().catch(e=>feedback('Browser storage unavailable: '+e.message,true));
