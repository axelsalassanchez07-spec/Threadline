import {records,save,erase,photo,guessFilename,CATEGORIES,COLORS,FITS,TYPES,esc,uid,el,feedback,options,initNav} from './shared.js';
import {classifyGarment} from './vision-client.js';
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
   '</div><label class="row" style="margin:10px 0;font-size:12px;font-weight:650"><input type="checkbox" data-confirm="1" '+((item.categoryConfirmedByUser||item.verifiedCategory===true)?'checked':'')+' style="width:16px;height:16px;accent-color:#395b40"> I checked this category and type against the photo</label><div class="row between" style="margin-top:12px"><span class="small">Verify before saving</span><div class="row"><button type="button" class="button-outline" data-ai="'+esc(item.id)+'">✨ Analyze with AI</button><button class="button-quiet" data-discard="'+item.id+'">Remove</button><button class="button-outline" data-save-one="'+item.id+'">Save item</button></div></div></article>';
}
function showDrafts(){
 el('draft-heading').textContent=drafts.length?'Review '+drafts.length+' clothing draft'+(drafts.length===1?'':'s'):'Upload clothing photos';
 el('review-grid').innerHTML=drafts.length?drafts.map(draftCard).join(''):'<div class="empty">Choose several pictures above. Each will get an editable draft here.</div>';
 el('save-all').disabled=!drafts.length||busy;
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
 const invalid=items.filter(x=>!x.category||!TYPES[x.category]?.includes(x.kind)||!String(x.name||'').trim()||!(x.categoryConfirmedByUser||x.verifiedCategory===true));
 if(invalid.length){feedback(invalid.length+' draft(s) need a category, type, name, and a checked confirmation that the photo matches the labels. Nothing was saved.',true);return;}
 for(const x of items){if(/^Unidentified item/i.test(x.name))x.name=[x.color!=='Unknown'?x.color:'',x.kind].filter(Boolean).join(' ').replace(/\\b\\w/g,c=>c.toUpperCase());}
 el('save-all').disabled=true;
 let count=0;
 for(const row of items){try{await save({...row,reviewed:true,verifiedCategory:true,categoryConfirmedByUser:true,verifiedAt:Date.now()});count++;drafts=drafts.filter(x=>x.id!==row.id);}catch(e){feedback('Could not save all images: '+e.message,true);break;}}
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
 if(e.target.dataset.field==='category'){
   item.category=e.target.value;item.kind=item.category?(TYPES[item.category]?.[0]||''):'';
   row.querySelector('[data-field="kind"]').innerHTML='<option value="">Choose type</option>'+options(TYPES[item.category]||[],item.kind);
 }
});
el('review-grid').addEventListener('click',e=>{
 const ai=e.target.closest('[data-ai]');
 if(ai){
  const item=drafts.find(x=>x.id===ai.dataset.ai);if(!item)return;
  if(!confirm('Send this clothing photo to an AI vision provider through the authenticated Supabase function? The classification will only become a draft for your review.'))return;
  ai.disabled=true;ai.textContent='Analyzing…';
  void classifyGarment(item.image).then(result=>{
   const category=CATEGORIES.includes(result.category)?result.category:'';
   item.category=category&&TYPES[category]?.includes(result.kind)?category:'';
   item.kind=item.category?result.kind:'';
   item.name=String(result.name||item.name).slice(0,70);
   item.color=COLORS.includes(result.color)?result.color:'Unknown';
   item.fit=FITS.includes(result.fit)?result.fit:'Unknown';
   item.tags=Array.isArray(result.tags)?result.tags.map(x=>String(x).toLowerCase()).slice(0,4):[];
   item.uncertain=result.confidence!=='high';
   item.visionNote=String(result.note||'Please check this suggestion.').slice(0,300);
   showDrafts();feedback('AI provided a '+result.confidence+'-confidence suggestion: '+item.visionNote+' Review every field before saving.');
  }).catch(err=>{ai.disabled=false;ai.textContent='✨ Analyze with AI';feedback('AI classification unavailable: '+(err.message||err),true);});
  return;
 }
 const del=e.target.closest('[data-discard]'),single=e.target.closest('[data-save-one]');
 if(del){drafts=drafts.filter(x=>x.id!==del.dataset.discard);showDrafts();}
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
