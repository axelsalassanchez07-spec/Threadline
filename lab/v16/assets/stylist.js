import {records,save,erase,themeCounts,esc,uid,el,feedback,initNav} from './shared.js';
import {interpretStyleDescription} from './fashion-language.js';
import {matchesForGarment,findSimilarUrl} from './retailer-refs.js';
initNav('stylist');
const DEMO=[
 ['top1','Tops','tee','white','Regular',['minimal','casual']],
 ['top2','Tops','rugby shirt','navy','Regular',['preppy','sporty','vintage']],
 ['top3','Tops','knit polo','cream','Structured',['tailored','minimal']],
 ['top4','Tops','hoodie','gray','Oversized',['streetwear','relaxed']],
 ['bottom1','Bottoms','wide-leg trousers','charcoal','Relaxed',['wide-leg','tailored']],
 ['bottom2','Bottoms','cargo pants','olive','Relaxed',['workwear','streetwear']],
 ['bottom3','Bottoms','jeans','blue','Straight',['denim','vintage']],
 ['bottom4','Bottoms','chinos','beige','Regular',['preppy','minimal']],
 ['shoe1','Shoes','loafers','brown','Regular',['tailored','formal']],
 ['shoe2','Shoes','retro sneakers','white','Regular',['sporty','vintage']],
 ['shoe3','Shoes','boots','black','Structured',['workwear','streetwear']],
 ['shoe4','Shoes','sneakers','charcoal','Regular',['technical','sporty']],
 ['layer1','Outerwear','bomber jacket','olive','Regular',['cropped','streetwear']],
 ['layer2','Outerwear','blazer','navy','Structured',['tailored','formal']],
 ['layer3','Outerwear','denim jacket','blue','Regular',['vintage','denim']],
 ['layer4','Outerwear','track jacket','red','Relaxed',['sporty','retro']],
 ['accessory1','Accessories','cap','white','Regular',['sporty','streetwear']]
].map(([id,category,kind,color,fit,tags])=>({id:'demo:'+id,category,kind,color,fit,tags,name:'Demo · '+kind[0].toUpperCase()+kind.slice(1),demo:true}));
let wardrobe=[],inspirations=[],ratings=[],current=[],recent=[],refId='',creativity='Balanced';
const sig=rows=>rows.map(x=>x.id).slice().sort().join('|');
const silhouette=rows=>[rows.find(x=>x.category==='Tops')?.fit,rows.find(x=>x.category==='Bottoms')?.kind,rows.find(x=>x.category==='Outerwear')?.kind,rows.find(x=>x.category==='Shoes')?.kind].filter(Boolean).join('|');
function rowTags(r){
 return new Set([...(r.tags||[]),...String(r.kind||'').toLowerCase().split(/\s+/),String(r.fit||'').toLowerCase(),String(r.color||'').toLowerCase()]);
}
function desired(){
 const selected=inspirations.find(x=>x.id===refId);
 if(selected)return [...new Set([...(selected.tags||[]),...interpretStyleDescription(selected.notes||'').tags])];
 const learned=inspirations.flatMap(x=>[...(x.tags||[]),...interpretStyleDescription(x.notes||'').tags]);
 const counts=new Map();learned.forEach(t=>counts.set(t,(counts.get(t)||0)+1));
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,7).map(x=>x[0]);
}
function score(rows,direction,references,liked,skipped){
 const tags=rows.flatMap(x=>[...rowTags(x)]);
 const match=references.reduce((n,t)=>n+tags.filter(a=>t.includes(a)||a.includes(t)).length,0);
 const owned=rows.filter(x=>!x.demo).length;
 const signature=sig(rows),shape=silhouette(rows);
 const recentIds=recent.slice(-12),pastRatings=[...liked,...skipped];
 const sameness=recentIds.filter(x=>x.signature===signature).length*130+
   recentIds.filter(x=>x.shape===shape).length*14+
   recentIds.reduce((n,x)=>n+(x.ids||[]).filter(id=>rows.some(y=>y.id===id)).length,0)*1.5;
 const neutral=new Set(['black','white','cream','gray','charcoal','navy','brown','beige','tan','olive']);
 const neutralCount=rows.filter(x=>neutral.has(x.color)).length;
 const coherence=(neutralCount>=rows.length-1?4:0)+(new Set(rows.map(x=>x.color)).size<=3?2:0);
 let feedbackScore=0;
 for(const r of pastRatings.slice(-80)){
  let overlap=(r.ids||[]).filter(id=>rows.some(x=>x.id===id)).length;
  feedbackScore+=(r.value==='love'?1:-1)*overlap*.5;
 }
 const originality=(new Set(rows.flatMap(x=>x.tags||[])).size)*.65;
 const bias=creativity==='Familiar'?1.8:creativity==='Experimental'?.35:1;
 const focus=direction==='Recreate'?3.0:direction==='Reinterpret'?1.5:.35;
 return coherence+owned*2+match*bias*focus+originality*(direction==='Explore'?2:1)+feedbackScore-sameness+
  (Math.random()-.5)*(direction==='Explore'?17:8);
}
function candidates(){
 // Use actually uploaded clothing for a category whenever available; demo pieces only fill missing categories.
 const by=type=>{const owned=wardrobe.filter(x=>x.category===type);return owned.length?owned:DEMO.filter(x=>x.category===type)};
 const tops=by('Tops'),bottoms=by('Bottoms'),shoes=by('Shoes'),layers=[null,...by('Outerwear')],access=[null,...by('Accessories')];
 const pool=[];
 for(const t of tops)for(const b of bottoms)for(const shoe of shoes)for(const layer of layers){
  if(Math.random()>.65)continue;
  const extra=access[Math.floor(Math.random()*access.length)];
  const pieces=[t,b,shoe,...(layer?[layer]:[]),...(extra?[extra]:[])];
  if(new Set(pieces.map(x=>x.id)).size!==pieces.length)continue;
  pool.push({id:'outfit:'+uid(),items:pieces,signature:sig(pieces),shape:silhouette(pieces)});
 }
 return pool;
}
function chooseLooks(){
 const pool=candidates(),references=desired();
 const liked=ratings.filter(x=>x.value==='love'),skipped=ratings.filter(x=>x.value==='skip');
 let used=new Set(ratings.map(x=>x.signature)),out=[],shapes=new Set();
 for(const dir of ['Recreate','Reinterpret','Explore']){
  const candidates=pool.filter(x=>!used.has(x.signature))
    .map(x=>({...x,points:score(x.items,dir,references,liked,skipped)-(shapes.has(x.shape)?22:0)}))
    .sort((a,b)=>b.points-a.points);
  if(!candidates.length)break;
  const pick=candidates[Math.floor(Math.random()*Math.min(9,candidates.length))];
  pick.direction=dir;
  pick.notes=(dir==='Recreate'?'Closely reflects your current inspiration cues.':dir==='Reinterpret'?'Keeps some familiar styling details while changing the formula.':'Pushes toward a different silhouette, layering or garment mix.')+
    (references.length?' Signals: '+references.slice(0,4).join(', ')+'.':' Add inspiration references for more relevant guidance.');
  out.push(pick);used.add(pick.signature);shapes.add(pick.shape);
 }
 return out;
}
function pieceView(x){
 const matches=matchesForGarment(x),reference=matches[0];
 const picture=x.image?'<img loading="lazy" src="'+esc(x.image)+'" alt="'+esc(x.name)+'">':
   reference?.image?'<img loading="lazy" src="'+esc(reference.image)+'" alt="Similar catalog example: '+esc(reference.name)+'">':
   '<div class="placeholder">'+esc(x.kind||'Unidentified item')+'</div>';
 return '<div class="piece">'+picture+
   '<span>'+esc(x.name)+'<br>'+esc(x.color||'Unknown')+' · '+esc(x.fit||'Unknown')+'</span>'+
   (reference&&!x.image?'<span class="retailer-note">Example product photo, not this exact item</span>':'')+'</div>';
}
function shoppingReferences(o){
 const seen=new Set(),examples=[];
 for(const x of o.items){
  const ref=matchesForGarment(x)[0];
  if(!ref||seen.has(ref.id))continue;seen.add(ref.id);examples.push(ref);
 }
 const shopping=examples.slice(0,4).map(p=>
   '<a class="retailer-example" href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">'+
   (p.image?'<img loading="lazy" src="'+esc(p.image)+'" alt="'+esc(p.name)+'">':'')+
   '<span>'+esc(p.name)+'<small>'+esc(p.store)+' · saved price reference '+(Number.isFinite(p.price)?'$'+Number(p.price).toFixed(2):'not available')+'</small></span></a>'
 ).join('');
 const similar=o.items.filter(x=>x.category!=='Accessories').map(x=>
   '<a href="'+esc(findSimilarUrl(x))+'" target="_blank" rel="noopener noreferrer">Find '+esc(x.kind||x.category)+' ↗</a>'
 ).join(' · ');
 const lookQuery=o.items.map(x=>x.kind).filter(Boolean).join(' ')+' outfit styling references';
 const photoSearch='https://www.google.com/search?tbm=isch&q='+encodeURIComponent(lookQuery);
 return '<div class="retailer-section"><strong>See styling references and find similar pieces</strong>'+
   '<p class="small">Retailer examples below come from the original limited catalog; these are not live listings and might not exactly match the generated garments.</p>'+
   (shopping?'<div class="retailer-grid">'+shopping+'</div>':'<p class="small">No sufficiently similar image exists in the starter catalog for these garments.</p>')+
   '<div class="shopping-search"><a href="'+esc(photoSearch)+'" target="_blank" rel="noopener noreferrer">See full-outfit photo ideas ↗</a> · '+similar+'</div></div>';
}
function inspirationPreview(){
 const selected=inspirations.find(x=>x.id===refId);
 const examples=selected?[selected]:inspirations.slice(0,2);
 if(!examples.length)return '';
 return '<div class="inspo-reference"><strong>Your saved inspiration (reference, not an outfit render)</strong>'+
    '<div class="inspo-reference-images">'+examples.map(x=>'<img loading="lazy" src="'+esc(x.image)+'" alt="'+esc(x.name)+'">').join('')+'</div>'+
    '<p class="small">'+examples.map(x=>esc(x.name)).join(' · ')+'</p></div>';
}
function card(o){
 return '<article class="outfit"><span class="eyebrow">'+esc(o.direction||'Archived')+' · '+(o.items.some(x=>x.demo)?'includes demonstration pieces':'from your wardrobe')+'</span>'+
 '<h3>'+esc(o.items.find(x=>x.category==='Outerwear')?.kind||o.items[0]?.kind||'Outfit')+' + '+esc(o.items.find(x=>x.category==='Bottoms')?.kind||'bottoms')+'</h3>'+
 inspirationPreview()+
 '<div class="outfit-pieces">'+o.items.map(pieceView).join('')+'</div><p>'+esc(o.notes||'This outfit was generated from saved clothing and styling cues.')+'</p>'+
 shoppingReferences(o)+
 '<div class="row" style="margin-top:13px"><button class="button" data-rating="love" data-outfit="'+esc(o.id)+'">♥ Love</button><button class="button-outline" data-rating="maybe" data-outfit="'+esc(o.id)+'">○ Maybe</button><button class="button-outline" data-rating="skip" data-outfit="'+esc(o.id)+'">× Skip</button></div></article>';
}
function render(){
 el('looks').innerHTML=current.length?current.map(card).join(''):'<div class="empty">Generate your first three directions.</div>';
 el('look-status').textContent='Using '+wardrobe.length+' lab wardrobe pieces, '+inspirations.length+' inspiration references, and '+ratings.length+' previous ratings.';
 el('creativity-name').textContent=creativity;
 const counts=themeCounts(inspirations);
 el('signals').innerHTML=counts.length?counts.slice(0,7).map(x=>'<span class="pill">'+esc(x.label)+' · '+x.count+'</span>').join(''):'<span class="small">Add references in Inspiration Intelligence to personalize these suggestions.</span>';
 el('archive-count').textContent=ratings.length+' rated';
 el('archive').innerHTML=ratings.length?ratings.slice().reverse().map(x=>
 '<div class="panel" style="margin-bottom:10px"><div class="row between"><strong>'+esc(x.value==='love'?'♥ Loved':x.value==='maybe'?'○ Maybe':'× Skipped')+'</strong><span class="small">'+new Date(x.createdAt).toLocaleDateString()+'</span></div>'+
 '<p class="small">'+x.items.map(v=>esc(v.name)).join(' · ')+'</p><button class="button-quiet" data-delete-rating="'+x.id+'">Remove rating</button></div>'
 ).join(''):'<div class="empty">Rate outfits to build your feedback archive.</div>';
}
async function load(){
 [wardrobe,inspirations,ratings]=await Promise.all([records('item:'),records('inspo:'),records('rating:')]);
 const meta=(await records('meta:')).find(x=>x.id==='meta:stylist');
 recent=Array.isArray(meta?.recent)?meta.recent:[];
 const sel=new URLSearchParams(location.search).get('inspo');
 refId=inspirations.find(x=>x.id===sel)?.id||'';
 el('reference').innerHTML='<option value="">Use my whole Inspiration Board</option>'+inspirations.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
 el('reference').value=refId;
 render();
}
async function generate(){
 current=chooseLooks();
 if(!current.length)feedback('All available combinations have been rated. Add more wardrobe pieces or remove older test ratings.',true);
 else{
  recent.push(...current.map(x=>({signature:x.signature,shape:x.shape,ids:x.items.map(y=>y.id)})));
  recent=recent.slice(-35);await save({id:'meta:stylist',recent,createdAt:Date.now()});
  feedback('Generated '+current.length+' different outfit directions. Photos from your wardrobe are shown when available; demo garments are labeled.');
 }
 render();
}
el('generate').addEventListener('click',()=>void generate());
el('reference').addEventListener('change',e=>{refId=e.target.value;void generate();});
document.querySelectorAll('[data-creativity]').forEach(b=>b.addEventListener('click',()=>{
 creativity=b.dataset.creativity;
 document.querySelectorAll('[data-creativity]').forEach(x=>x.classList.toggle('active',x===b));
 void generate();
}));
el('looks').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-rating]');if(!btn)return;
 const look=current.find(x=>x.id===btn.dataset.outfit);if(!look)return;
 const row={id:'rating:'+uid(),value:btn.dataset.rating,signature:look.signature,shape:look.shape,
  ids:look.items.map(x=>x.id),items:look.items,notes:look.notes,createdAt:Date.now()};
 await save(row);ratings.push(row);current=current.filter(x=>x.id!==look.id);
 feedback('Outfit rated '+btn.dataset.rating+'. Feedback will gently influence new ideas rather than restricting your options.');
 render();
});
el('archive').addEventListener('click',async e=>{
 const id=e.target.closest('[data-delete-rating]')?.dataset.deleteRating;if(!id)return;
 await erase(id);ratings=ratings.filter(x=>x.id!==id);render();
});
load().then(()=>generate()).catch(e=>feedback('Lab storage issue: '+e.message,true));
