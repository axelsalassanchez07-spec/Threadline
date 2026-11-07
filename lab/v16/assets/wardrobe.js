import {records,save,erase,photo,guessFilename,CATEGORIES,COLORS,FITS,TYPES,esc,uid,el,feedback,options,initNav} from './shared.js';
import {classifyGarment,checkVisionReadiness} from './vision-client.js';
initNav('wardrobe');
let drafts=[];
let busy=false;
const selectedDrafts=new Set();
const genericKind={Tops:'other top',Outerwear:'other layer',Bottoms:'other bottoms',Shoes:'other shoes',Accessories:'other accessory'};
function descriptiveName(x){return [x.color&&x.color!=='Unknown'?x.color:'',x.kind||x.category||'clothing item'].filter(Boolean).join(' ').replace(/\b\w/g,c=>c.toUpperCase());}
function quickCategory(row,cat){row.category=cat;row.kind=genericKind[cat]||'';row.categoryConfirmedByUser=false;row.verifiedCategory=false;row.uncertain=false;if(/^Unidentified item/i.test(row.name))row.name=descriptiveName(row);}
function assignVision(row,result){const category=CATEGORIES.includes(result.category)?result.category:'';row.category=category&&TYPES[category]?.includes(result.kind)?category:'';row.kind=row.category?result.kind:'';row.name=String(result.name||row.name).slice(0,70);row.color=COLORS.includes(result.color)?result.color:'Unknown';row.fit=FITS.includes(result.fit)?result.fit:'Unknown';row.tags=Array.isArray(result.tags)?result.tags.map(x=>String(x).toLowerCase()).slice(0,4):[];row.uncertain=result.confidence!=='high';row.visionNote=String(result.note||'Verify the suggestion.').slice(0,300);row.categoryConfirmedByUser=false;row.verifiedCategory=false;}

const nameFromFile=n=>n.replace(/\.[^.]+$/,'');
const field=(label,html)=>'<div class="field"><label>'+label+'</label>'+html+'</div>';
function draftCard(item){
 const valid=!!item.category&&!!TYPES[item.category]?.includes(item.kind);
 const checked=valid&&(item.categoryConfirmedByUser||item.verifiedCategory===true);
 const select=(key,values)=>'<select data-field="'+key+'">'+
  (key==='category'?'<option value="">Choose category</option>':key==='kind'?'<option value="">Choose type</option>':'')+options(values,item[key])+'</select>';
 return '<article class="review-item" data-draft="'+esc(item.id)+'"><div class="review-top">'+
  '<img class="thumb" src="'+item.image+'" alt="Uploaded garment">'+
  '<div><strong>'+esc(item.name)+'</strong><p class="small">'+(item.uncertain?'Uncertain category; please confirm it.':'Filename hint or reviewed category; check photo.')+'</p>'+
  '<span class="pill">Approximate pixel sample: '+esc(item.estimatedColor||'unavailable')+' (background may affect it)</span>'+
  (item.visionNote?'<p class="small"><strong>AI explanation:</strong> '+esc(item.visionNote)+'</p>':'')+'</div></div>'+
  '<div class="review-quickbar"><label><input type="checkbox" data-pick="1" '+(selectedDrafts.has(item.id)?'checked':'')+'> Select for batch actions</label><div class="tagset">'+
  CATEGORIES.map(cat=>'<button type="button" data-quick-category="'+esc(cat)+'" class="'+(item.category===cat?'active':'')+'">'+esc(cat)+'</button>').join('')+'</div></div>'+
  '<div class="field-grid">'+
  field('Name','<input data-field="name" value="'+esc(item.name)+'" maxlength="70"><button type="button" class="button-quiet" data-rename="1">Suggest name from selected type</button>')+
  field('Category',select('category',CATEGORIES))+
  field('Type',select('kind',TYPES[item.category]||[]))+
  field('Color',select('color',COLORS))+
  field('Fit',select('fit',FITS))+
  field('Style notes (optional)','<input data-field="tags" value="'+esc((item.tags||[]).join(', '))+'" placeholder="e.g. casual, cropped, layered">')+
  '</div><label class="row" style="margin:10px 0;font-size:12px;font-weight:650"><input type="checkbox" data-confirm="1" '+(checked?'checked':'')+(valid?'':'disabled')+' style="width:16px;height:16px;accent-color:#395b40"> I checked the category and type against the photo</label>'+
  '<div class="row between" style="margin-top:12px"><span class="small">Verify before saving</span><div class="row">'+
  '<button type="button" class="button-outline" data-ai="'+esc(item.id)+'">✨ Analyze with AI</button>'+
  '<button type="button" class="button-quiet" data-discard="'+esc(item.id)+'">Remove</button>'+
  '<button type="button" class="button-outline" data-save-one="'+esc(item.id)+'">Save item</button></div></div>'+
  '<p class="small" data-ai-message role="status" aria-live="polite"></p></article>';
}
function showDrafts(){
 el('draft-heading').textContent=drafts.length?'Review '+drafts.length+' clothing draft'+(drafts.length===1?'':'s'):'Upload clothing photos';
 el('review-grid').innerHTML=drafts.length?drafts.map(draftCard).join(''):'<div class="empty">Choose several pictures above. Each will get an editable draft here.</div>';
 el('save-all').disabled=!drafts.length||busy;
 const count=el('batch-selection-count');if(count)count.textContent=selectedDrafts.size+' selected of '+drafts.length;
 const bulk=el('bulk-category');if(bulk)bulk.disabled=!drafts.length;
}
async function showSaved(){
 const saved=await records('item:');
 const pending=saved.filter(x=>x.verifiedCategory!==true).length;
 el('saved-count').textContent=saved.length+' saved'+(pending?' · '+pending+' need review':'');
 const help=el('review-guidance');if(help)help.textContent=pending?pending+' earlier imported items need a confirmed category before the Stylist uses them. Choose Review all saved items, correct labels and Save all.':'All saved items have confirmed categories for the Stylist.';
 el('saved-grid').innerHTML=saved.length?saved.map(x=>'<article class="review-item"><div class="review-top"><img class="thumb-mini" src="'+x.image+'" alt=""><div><strong>'+esc(x.name)+'</strong><p class="small">'+esc(x.category||'Unconfirmed')+' · '+esc(x.kind||'Unconfirmed')+' · '+esc(x.color)+'</p>'+(x.verifiedCategory===true?'<span class="pill">Category confirmed</span>':'<span class="pill">Needs review — excluded from outfits</span>')+'<div class="tagset">'+(x.tags||[]).map(t=>'<span class="pill">'+esc(t)+'</span>').join('')+'</div></div></div><button class="button-outline" data-edit="'+esc(x.id)+'">Review / edit</button><button class="button-quiet" data-delete="'+esc(x.id)+'">Delete item</button></article>').join(''):'<div class="empty">No pieces saved to this lab yet.</div>';
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
   const pic=await photo(f,1100);
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
 const invalid=items.filter(x=>!x.category||!TYPES[x.category]?.includes(x.kind)||!String(x.name||'').trim()||!(x.categoryConfirmedByUser||x.verifiedCategory===true));
 if(invalid.length){feedback(invalid.length+' draft(s) need a category, type, name, and a checked confirmation that the photo matches the labels. Nothing was saved.',true);return;}
 for(const x of items){if(/^Unidentified item/i.test(x.name))x.name=[x.color!=='Unknown'?x.color:'',x.kind].filter(Boolean).join(' ').replace(/\\b\\w/g,c=>c.toUpperCase());}
 el('save-all').disabled=true;
 let count=0;
 for(const row of items){try{await save({...row,reviewed:true,verifiedCategory:true,categoryConfirmedByUser:true,verifiedAt:Date.now()});count++;drafts=drafts.filter(x=>x.id!==row.id);selectedDrafts.delete(row.id);}catch(e){feedback('Could not save all images: '+e.message,true);break;}}
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
 if(e.target.dataset.confirm){item.categoryConfirmedByUser=e.target.checked;return;}
 if(e.target.dataset.pick){if(e.target.checked)selectedDrafts.add(item.id);else selectedDrafts.delete(item.id);const count=el('batch-selection-count');if(count)count.textContent=selectedDrafts.size+' selected of '+drafts.length;return;}
 if(e.target.dataset.field==='kind'){item.categoryConfirmedByUser=false;item.verifiedCategory=false;const chk=row.querySelector('[data-confirm]');if(chk)chk.checked=false;return;}
 if(e.target.dataset.field==='category'){
   item.category=e.target.value;item.kind=genericKind[item.category]||'';item.categoryConfirmedByUser=false;item.verifiedCategory=false;const check=row.querySelector('[data-confirm]');if(check)check.checked=false;
   row.querySelector('[data-field="kind"]').innerHTML='<option value="">Choose type</option>'+options(TYPES[item.category]||[],item.kind);
 }
});
el('review-grid').addEventListener('click',e=>{
 const frame=e.target.closest('[data-draft]'),item=drafts.find(x=>x.id===frame?.dataset.draft);
 const quick=e.target.closest('[data-quick-category]');
 if(quick&&item){quickCategory(item,quick.dataset.quickCategory);showDrafts();return;}
 if(e.target.closest('[data-rename]')&&item){item.name=descriptiveName(item);showDrafts();return;}
 const ai=e.target.closest('[data-ai]');
 if(ai){
  const item=drafts.find(x=>x.id===ai.dataset.ai);if(!item)return;
  if(!confirm('Send this clothing photo to an AI vision provider through the authenticated Supabase function? The classification will only become a draft for your review.'))return;
  ai.disabled=true;ai.textContent='Analyzing…';
  void classifyGarment(item.image).then(result=>{
   assignVision(item,result);
   showDrafts();feedback('AI provided a '+result.confidence+'-confidence suggestion: '+item.visionNote+' Review every field before saving.');
  }).catch(err=>{ai.disabled=false;ai.textContent='✨ Analyze with AI';feedback('AI classification unavailable: '+(err.message||err),true);});
  return;
 }
 const del=e.target.closest('[data-discard]'),single=e.target.closest('[data-save-one]');
 if(del){drafts=drafts.filter(x=>x.id!==del.dataset.discard);selectedDrafts.delete(del.dataset.discard);showDrafts();}
 if(single){const row=drafts.find(x=>x.id===single.dataset.saveOne);if(row)void persist([row]);}
});
el('saved-grid').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit]');
 if(edit){const saved=(await records('item:')).find(x=>x.id===edit.dataset.edit);if(saved){drafts=drafts.filter(x=>x.id!==saved.id);drafts.unshift({...saved,estimatedColor:saved.estimatedColor||saved.color});showDrafts();el('review-grid').scrollIntoView({behavior:'smooth',block:'start'});feedback('Correct the saved item and save again. Its existing photo will remain.');}return;}
 const del=e.target.closest('[data-delete]');if(!del)return;
 if(!confirm('Delete this piece from the V1.6 lab?'))return;
 await erase(del.dataset.delete);await showSaved();feedback('Piece removed from the local test wardrobe.');
});
el('save-all').addEventListener('click',()=>void persist([...drafts]));
el('select-all-drafts')?.addEventListener('click',()=>{for(const x of drafts)selectedDrafts.add(x.id);showDrafts();});
el('clear-selection')?.addEventListener('click',()=>{selectedDrafts.clear();showDrafts();});
el('bulk-apply-category')?.addEventListener('click',()=>{
 const category=el('bulk-category')?.value;const chosen=drafts.filter(x=>selectedDrafts.has(x.id));
 if(!category||!chosen.length)return feedback('Select draft items and a category to apply.',true);
 if(!confirm('Assign '+category+' to '+chosen.length+' selected photos? Verify each photo and category before confirming the batch.'))return;
 chosen.forEach(x=>quickCategory(x,category));showDrafts();feedback('Assigned '+category+' to '+chosen.length+' drafts. Names and types remain editable. Confirm categories before saving.');
});
el('bulk-confirm-category')?.addEventListener('click',()=>{
 const chosen=drafts.filter(x=>selectedDrafts.has(x.id));
 if(!chosen.length)return feedback('Select at least one garment.',true);
 if(chosen.some(x=>!x.category||!TYPES[x.category]?.includes(x.kind)))return feedback('Some selected items need a category and garment type before confirmation.',true);
 if(!confirm('Confirm that you personally checked the photo and category/type for ALL '+chosen.length+' selected items? Only confirm photos you have reviewed.'))return;
 chosen.forEach(x=>{x.categoryConfirmedByUser=true;});showDrafts();feedback('Confirmed '+chosen.length+' selected items; you can now save them.');
});
el('bulk-ai')?.addEventListener('click',async()=>{
 const chosen=drafts.filter(x=>selectedDrafts.has(x.id));
 if(!chosen.length)return feedback('Select a few photos to analyze.',true);
 if(chosen.length>5)return feedback('Analyze at most five images per batch to control paid API use.',true);
 if(!confirm('Send '+chosen.length+' selected compressed clothing photos to the AI provider through your authenticated Supabase function? This uses paid API calls. Results stay editable and are NOT saved automatically.'))return;
 const btn=el('bulk-ai');btn.disabled=true;let success=0,failed=0;
 try{
  for(let i=0;i<chosen.length;i++){
   btn.textContent='Analyzing '+(i+1)+'/'+chosen.length+'…';
   try{assignVision(chosen[i],await classifyGarment(chosen[i].image));success++;}catch(err){failed++;if(i===0){feedback('AI is not available: '+(err.message||err),true);break;}}
  }
 }finally{btn.disabled=false;btn.textContent='Analyze selected with AI';showDrafts();}
 if(success)feedback(success+' draft(s) received AI suggestions; '+failed+' failed. Review each before saving.');
});
el('review-existing')?.addEventListener('click',async()=>{const saved=await records('item:');drafts=[...saved.map(x=>({...x,estimatedColor:x.estimatedColor||x.color})),...drafts.filter(x=>!saved.some(y=>y.id===x.id))];showDrafts();el('review-grid').scrollIntoView({behavior:'smooth'});feedback('Review existing imported items in one grid. Save all to update their labels while keeping their photos.');});

/* Camera works with user permission only. Capture JPEG still images, never record video. */
let activeStream=null;
const cameraBox=el('camera-box'),liveVideo=el('camera-video');
function stopCamera(){
 if(activeStream){activeStream.getTracks().forEach(track=>track.stop());activeStream=null;}
 if(liveVideo)liveVideo.srcObject=null;
 if(cameraBox)cameraBox.hidden=true;
}
el('camera-phone')?.addEventListener('change',e=>{void loadFiles(e.target.files);e.target.value='';});
el('camera-start')?.addEventListener('click',async()=>{
 if(!navigator.mediaDevices?.getUserMedia){feedback('Camera capture is unavailable here. Use the phone camera button or select existing photos.',true);return;}
 if(activeStream)return;
 const btn=el('camera-start');btn.disabled=true;
 try{
  activeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  liveVideo.srcObject=activeStream;cameraBox.hidden=false;
  await liveVideo.play();
  feedback('Camera ready. Capture one garment at a time; you can capture multiple items before stopping.');
 }catch(e){stopCamera();feedback('Camera unavailable or permission denied: '+(e.message||e)+'. Select existing photos instead.',true);}
 finally{btn.disabled=false;}
});
el('camera-stop')?.addEventListener('click',()=>{stopCamera();feedback('Camera stopped. No video was recorded or uploaded.');});
el('camera-snap')?.addEventListener('click',async()=>{
 if(!activeStream||!liveVideo.videoWidth)return feedback('Camera is not ready yet.',true);
 const canvas=document.createElement('canvas'),ratio=Math.min(1,1050/Math.max(liveVideo.videoWidth,liveVideo.videoHeight));
 canvas.width=Math.max(1,Math.round(liveVideo.videoWidth*ratio));
 canvas.height=Math.max(1,Math.round(liveVideo.videoHeight*ratio));
 canvas.getContext('2d').drawImage(liveVideo,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.83));
 if(!blob)return feedback('Photo capture failed.',true);
 const stamp=Date.now(),file=new File([blob],'camera-'+stamp+'.jpg',{type:'image/jpeg',lastModified:stamp});
 await loadFiles([file]);
 feedback('Captured one garment. Confirm its category in the drafts below, or scan another.');
});
window.addEventListener('pagehide',stopCamera);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});

showDrafts();showSaved().catch(e=>feedback('Browser storage unavailable: '+e.message,true));
