/* THREADLINE V1.6 — non-AI inspiration-driven personal stylist.
 * Uses saved user text/ratings and actual catalog or wardrobe entries.
 * Does NOT interpret image pixels, invent retailer inventory, or call paid APIs.
 */
(()=>{
'use strict';
const baseShop=renderShop,baseInspo=renderInspiration,baseInspoModal=inspoModal,baseReference=shopReference,baseMatch=matchProductToReference;
let directions=[];
const interpret=txt=>window.ThreadlineStyleLanguage?.interpretStyleDescription(txt)||{tags:[],summary:'Describe what you like in everyday language.',observations:[]};
const safe=s=>esc(String(s??''));
const modes=['Familiar','Balanced','Experimental'];
const sampleBrands=[
 ['Relaxed tailoring','pleated trousers knit polo loafers'],
 ['Sporty collegiate','rugby shirt straight jeans retro sneakers'],
 ['Workwear utility','chore jacket cargo trousers boots'],
 ['Vintage streetwear','denim jacket wide leg jeans retro sneakers'],
 ['Technical casual','track jacket relaxed trousers running sneakers']
];
function mode(){return modes.includes(state.prefs.v16Creativity)?state.prefs.v16Creativity:'Balanced'}
function profile(){
 const counts=new Map(),recent=new Map();
 const sorted=[...state.inspos].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 sorted.forEach((row,i)=>{
  const words=[row.note,row.style,row.pieces].filter(Boolean).join(' ');
  const labels=new Set(interpret(words).tags);
  labels.forEach(tag=>{counts.set(tag,(counts.get(tag)||0)+1);if(i<6)recent.set(tag,(recent.get(tag)||0)+1)});
 });
 const byCount=a=>[...a].sort((x,y)=>y[1]-x[1]);
 return {all:byCount(counts),recent:byCount(recent)};
}
function profileMarkup(){
 const p=profile();
 const chips=(rows,max=8)=>rows.length?rows.slice(0,max).map(([tag,n])=>'<span class="v16-chip">'+safe(tag)+' <small>'+n+'</small></span>').join(''):'<span class="small muted">Save and describe a few references to start recognizing recurring styling details.</span>';
 return '<section class="v16-feature v16-profile"><div class="v16-feature-head"><div><span class="v16-kicker">YOUR INSPIRATION BOARD</span><h2>Your style is evolving</h2>'+
 '<p>THREADLINE compares the details you describe across your inspiration notes. These are suggestions, not permanent labels or claims that an AI examined the photos.</p></div>'+
 '<button class="btn btn-primary" data-v16-explore-board="1">Develop outfit ideas →</button></div>'+
 '<div class="v16-signals"><div><strong>Across your board</strong><div class="v16-chip-list">'+chips(p.all)+'</div></div>'+
 '<div><strong>From your newest references</strong><div class="v16-chip-list">'+chips(p.recent)+'</div></div></div></section>';
}
renderInspiration=function(){
 let view=baseInspo();
 view=view.replace('Image matching in V1:','How inspiration works in V1.6:');
 view=view.replace('Automatic visual item detection is planned for a later version.','Describe what attracts you in everyday language. THREADLINE can suggest fashion terminology and use those details to shape new looks. Optional cloud AI can suggest image details for you to review.');
 const marker='<div class="inspo-grid">';
 return view.includes(marker)?view.replace(marker,profileMarkup()+marker):view+profileMarkup();
};
function updateHelp(){
 const note=document.getElementById('inspo-note'),target=document.getElementById('v16-language-feedback');
 if(!note||!target)return;
 const value=interpret(note.value);
 target.textContent=value.summary;
 const tags=document.getElementById('v16-language-tags');
 if(tags)tags.innerHTML=value.tags.map(t=>'<span class="v16-chip">'+safe(t)+'</span>').join('');
}
inspoModal=function(){
 baseInspoModal();
 const note=document.getElementById('inspo-note');
 if(!note)return;
 const wrapper=note.closest('.field');if(!wrapper)return;
 wrapper.insertAdjacentHTML('afterend','<div class="v16-language">'+
 '<strong>Describe the look in your own words</strong><p><button type="button" class="btn btn-ghost btn-small" data-v16-inspo-ai="1">Suggest details from photo · cloud AI</button></p><p id="v16-inspo-ai-status" role="status"></p>'+
 '<p class="small muted">Example: “I like baggy trousers, a short jacket and retro shoes.” THREADLINE suggests editable fashion terms from the words you provide—it does not examine the image.</p>'+
 '<div class="button-row"><button class="btn btn-ghost btn-small" type="button" data-v16-translate="1">Translate my description</button>'+
 '<button class="btn btn-ghost btn-small" type="button" data-v16-append="1">Use suggested cues</button></div>'+
 '<div id="v16-language-feedback" class="small muted">Describe what you like, then translate it into styling cues.</div>'+
 '<div id="v16-language-tags" class="v16-chip-list"></div></div>');
};
function boardText(){
 const p=profile();return p.all.slice(0,7).map(([tag])=>tag).join(', ');
}
shopReference=function(){
 const current=baseReference(),typed=String(state.prefs.v16Prompt||'').trim(),styleProfile=boardText();
 if(!current&&!typed&&!styleProfile)return null;
 const ref=current?{...current}:{id:'v16-board',colors:'',pieces:'',note:'',style:''};
 const txt=[ref.note,ref.style,typed,styleProfile].filter(Boolean).join(' ');
 const t=interpret(txt).tags;
 const existingPieces=String(ref.pieces||'');
 // Feed semantic cues into existing, budget-aware V1.5 ranking, without inventing a visual analysis.
 ref.note=[txt,t.join(' ')].filter(Boolean).join(' ');
 ref.pieces=[existingPieces,typed].filter(Boolean).join(', ');
 return ref;
};
matchProductToReference=function(product,reference){
 let score=baseMatch(product,reference);
 if(!reference)return score;
 const cues=interpret([reference.note,reference.pieces].join(' ')).tags;
 score+=Math.min(10,(product.tags||[]).filter(tag=>cues.includes(tag)).length*3);
 const factor=mode()==='Familiar'?1.35:mode()==='Experimental'?.48:1;
 return score*factor;
};
function signalsSummary(){
 const p=profile();return p.all.length?p.all.slice(0,5).map(([s])=>s).join(', '):'No repeated inspiration details yet';
}
function matchImage(){
 const selected=state.inspos.find(x=>x.id===shopState.inspirationId);
 const show=selected?[selected]:state.inspos.slice(-2);
 return show.length?'<div class="v16-reference-strip"><strong>Saved inspiration reference photos</strong><div class="v16-ref-images">'+show.filter(x=>x.image).map(x=>'<img loading="lazy" src="'+safe(x.image)+'" alt="'+safe(x.title)+'" onerror="this.style.display=\'none\'">').join('')+'</div><p class="small muted">The picture is a visual reference for you; matching uses your written notes, not AI image interpretation.</p></div>':'';
}
function controls(){
 const active=mode(),prompt=state.prefs.v16Prompt||'';
 const recent=shopState.ratings.slice(-7).filter(x=>x.rating==='love').length;
 return '<section class="v16-feature v16-stylist-controls"><div class="v16-feature-head"><div><span class="v16-kicker">PERSONAL STYLIST · V1.6</span><h2>Get dressed from an idea</h2>'+
 '<p>Use what you own, your saved inspiration and retailer examples. Choose a direction, then use the plain-language styling tip to put it together.</p></div></div>'+
 '<div class="v16-stylist-grid"><label class="v16-field">Describe the look you want to explore<textarea class="textarea" id="v16-style-prompt" rows="3" placeholder="I like loose pants and a cropped jacket, but want a more polished outfit...">'+safe(prompt)+'</textarea></label>'+
 '<div><label class="v16-field">Creativity level<select class="select" id="v16-creativity">'+modes.map(x=>'<option value="'+x+'" '+(x===active?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<p class="small muted">'+(active==='Familiar'?'Start near what you love and vary individual garments.':active==='Experimental'?'Give unfamiliar combinations a better chance.':'Balance your preferences with less familiar proportions, layers and styles.')+'</p>'+
 '<p class="small muted">Board signals: '+safe(signalsSummary())+' · '+recent+' recently loved looks</p></div></div>'+
 '<p class="small muted">Available retailer references: '+SHOP_PRODUCTS.length+' items · '+SHOP_PRODUCTS.filter(x=>x.type==='top').length+' tops. More brands only help when they add different garments. Prices are reference estimates; confirm at the store.</p>'+
 '<div class="button-row"><button class="btn btn-primary" data-v16-three="1">Explore three directions</button>'+
 '<button class="btn btn-ghost" data-v16-save-preferences="1">Save styling preferences</button></div>'+
 matchImage()+'</section>';
}
function pType(cat){return({top:'Top',bottom:'Bottom',shoe:'Shoes',outer:'Optional layer'})[cat]||cat}
function productTile(p){
 const pic=shopPhoto(p);
 const cost=p.owned?'Owned':Number.isFinite(p.price)?shopMoney(p.price)+' reference':'Price unavailable';
 return '<div class="v16-piece"><div class="v16-piece-photo">'+pic+'</div><span class="v16-slot">'+safe(pType(p.type))+'</span>'+
 '<strong>'+safe(/^(other |clothing item)/i.test(p.name||'')?p.kind:p.name)+'</strong><small>'+safe(cost)+'</small>'+
 (p.url?'<a href="'+safe(p.url)+'" target="_blank" rel="noopener noreferrer">View at store ↗</a>':'<span class="small muted">From your wardrobe</span>')+'</div>';
}
function similarSearch(p){
 const q=[p.color,p.kind,'clothing'].filter(Boolean).join(' ');
 return 'https://www.google.com/search?tbm=shop&q='+encodeURIComponent(q);
}
function cardHTML(result,i){
 const items=result.pieces.map(shopResolved).filter(Boolean);
 const styles={Recreate:'Keep the strongest inspiration signals and familiar garment choices.',Reinterpret:'Keep some familiar elements while changing proportions, textures or footwear.',Explore:'Try a less familiar mix of wardrobe and retailer options.'};
 const amount=items.reduce((v,p)=>v+(p.owned?0:Number(p.price)||0),0);
 const top=items.find(x=>x.type==='top'),bottom=items.find(x=>x.type==='bottom'),shoes=items.find(x=>x.type==='shoe'),outer=items.find(x=>x.type==='outer');
 const detail=ThreadlineDiscovery.describe(items);
 const explain=detail.why+' How to wear it: '+detail.tip;
 const outfitQuery=items.map(x=>x.kind).filter(Boolean).join(' ')+' outfit street style';
 const fullOutfitSearch='https://www.google.com/search?tbm=isch&q='+encodeURIComponent(outfitQuery);
 const links=items.filter(x=>!x.owned).slice(0,3).map(p=>'<a href="'+safe(similarSearch(p))+'" target="_blank" rel="noopener noreferrer">Find similar '+safe(p.kind)+' ↗</a>').join(' · ');
 return '<article class="v16-direction"><span class="v16-kicker">'+safe(result.direction)+'</span><h3>'+safe(result.name)+'</h3>'+
 '<p class="small muted">'+styles[result.direction]+'</p><p class="small muted">'+safe(explain)+'</p>'+
 '<div class="v16-products">'+items.map(productTile).join('')+'</div>'+
 '<p class="small muted">One top, one bottom, one pair of shoes; a jacket is optional. Images show individual items, not a rendered full outfit.</p>'+
 '<p class="v16-direction-cost">Estimated to buy: '+shopMoney(amount)+(amount>shopState.budget?' · exceeds your budget':' · within your budget')+'</p>'+
 '<div class="v16-shopping-search"><a href="'+safe(fullOutfitSearch)+'" target="_blank" rel="noopener noreferrer">See full-outfit photo references ↗</a><div style="margin-top:5px">'+(links||'All pieces are from your wardrobe.')+'</div></div>'+
 '<button class="btn btn-primary btn-small" data-v16-use-direction="'+i+'">Use this combination</button></article>';
}
function directionHTML(){
 return directions.length?'<section id="v16-directions" class="v16-feature"><div class="v16-feature-head"><div><span class="v16-kicker">THREE WAYS TO DEVELOP AN IDEA</span><h2>Recreate · Reinterpret · Explore</h2>'+
 '<p>Real garments from your wardrobe or the limited retailer catalog. Shopping searches are alternatives—not extra clothing to wear at the same time.</p></div></div>'+
 '<div class="v16-directions">'+directions.map(cardHTML).join('')+'</div></section>':'';
}
renderShop=function(embedded=false){
 let html=baseShop(embedded);
 const panel=controls();
 const spot='<div class="shop-intro">';
 html=html.includes(spot)?html.replace(spot,panel+spot):panel+html;
 return html+directionHTML();
};
function setLook(d){
 if(!d)return;
 shopState.selected='discovery';
 shopState.customLook={id:'discovery',name:d.name,tagline:'Inspired by your style profile · '+d.direction,formula:d.formula,pieces:d.pieces.slice()};
 shopState.swaps.discovery=d.pieces.slice();
 shopState.swapSlot=-1;shopStore();render();
}
function saveSettings(){
 const textarea=document.querySelector('#v16-style-prompt');
 const select=document.querySelector('#v16-creativity');
 if(textarea)state.prefs.v16Prompt=textarea.value.trim().slice(0,600);
 if(select)state.prefs.v16Creativity=modes.includes(select.value)?select.value:'Balanced';
}
async function persistSettings(){
 saveSettings();await persistPrefs();render();toast('Your styling direction and creativity setting were saved for cloud sync.');
}
function generateDirections(){
 saveSettings();
 const originalMode=state.prefs.v16Creativity,initial={
  selected:shopState.selected,customLook:shopState.customLook,discovery:(shopState.swaps.discovery||[]).slice()
 };
 const collected=[],seen=new Set();
 for(const direction of ['Recreate','Reinterpret','Explore']){
  state.prefs.v16Creativity=direction==='Recreate'?'Familiar':direction==='Explore'?'Experimental':'Balanced';
  let look=null,attempts=0;
  do{
   look=shopGenerateInspired({accepted:collected.map(x=>x.pieces.map(shopResolved).filter(Boolean)),silent:true});attempts++;
   if(!look)break;
   const ids=(shopState.swaps.discovery||look.pieces||[]).slice();
   const fingerprint=ids.sort().join('|');
   const shape=ids.map(id=>shopResolved(id)).filter(Boolean).filter(x=>['bottom','shoe'].includes(x.type)).map(x=>x.kind).join('|');
   // Never dress up a near-identical silhouette as a genuinely new direction.
   if(!seen.has(shape)&&!seen.has(fingerprint)){
    collected.push({...look,direction,pieces:(shopState.swaps.discovery||look.pieces).slice()});
    seen.add(shape);seen.add(fingerprint);break;
   }
  }while(attempts<1);
 }
 state.prefs.v16Creativity=originalMode;
 directions=collected;
 if(collected.length){setLook(collected[0]);if(collected.length<3)toast('Only '+collected.length+' genuinely different outfit direction(s) found in your current catalog and closet. Different top, bottom and shoe types would open more options.');const anchor=document.getElementById('v16-directions');if(anchor)anchor.scrollIntoView({behavior:'smooth',block:'start'});}
 else{
  shopState.selected=initial.selected;shopState.customLook=initial.customLook;shopState.swaps.discovery=initial.discovery;shopStore();render();
  toast('No more unrated combinations in this catalog. Add clothing or try a new inspiration.');
 }
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.v16InspoAi){
  const form=document.getElementById('inspo-form'),message=document.getElementById('v16-inspo-ai-status');
  if(!form)return; b.disabled=true;message.textContent='Checking cloud AI…';
  void ThreadlineVision.cloud('inspiration',form.dataset.photo,document.getElementById('inspo-note').value).then(r=>{
   if(!r){message.textContent='Analysis cancelled.';return;}
   document.getElementById('inspo-colors').value=(r.dominantColors||[]).join(', ');
   document.getElementById('inspo-pieces').value=(r.garments||[]).map(x=>x.description).join(', ');
   const note=document.getElementById('inspo-note');note.value=[note.value,r.summary,r.styleExplanation,(r.tags||[]).join(', ')].filter(Boolean).join('\n');
   message.textContent='AI suggestions added to this draft. Check the details before saving.';
  }).catch(e=>message.textContent=e.message).finally(()=>b.disabled=false);return;
 }
 if(b.dataset.v16Translate){
  updateHelp();return;
 }
 if(b.dataset.v16Append){
  const note=document.getElementById('inspo-note');if(!note)return;
  const r=interpret(note.value);if(!r.tags.length)return toast('Describe a fit, garment or colors to identify styling cues first.');
  const suffix='Style cues: '+r.tags.join(', ');
  if(!note.value.toLowerCase().includes('style cues:'))note.value=note.value.trim()+'\n'+suffix;
  updateHelp();toast('Fashion terms added to your inspiration notes. You can edit them before saving.');return;
 }
 if(b.dataset.v16ExploreBoard){
  state.route='studio';state.studioMode='discover';shopState.inspirationId='';
  render();window.scrollTo(0,0);return;
 }
 if(b.dataset.v16SavePreferences){void persistSettings();return;}
 if(b.dataset.v16Three){generateDirections();return;}
 if(b.dataset.v16UseDirection!==undefined){
  const d=directions[Number(b.dataset.v16UseDirection)];
  setLook(d);toast('This exact outfit is selected. The shopping references are examples, not additional outfit pieces.');
  return;
 }
});
document.addEventListener('change',e=>{
 if(e.target.id==='v16-creativity'){
  saveSettings();void persistPrefs().then(()=>render());return;
 }
});
})();
