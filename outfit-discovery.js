/* THREADLINE V1.5 — exploration-first discovery, budget-aware combinations and rated outfit archive.
 * Uses only real retailer catalog products plus pieces the user explicitly added to their closet.
 * Extends existing shopping state without deleting any earlier saved looks or ratings.
 */
(() => {
'use strict';
const storeKey='threadline_shop_v11';
const previousShopSeed=shopSeed;
const previousRenderShop=renderShop;
const previousShopHandleClick=shopHandleClick;

try{
  const stored=JSON.parse(localStorage.getItem(storeKey)||'{}');
  shopState.selected=typeof stored.selected==='string'?stored.selected:shopState.selected;
  shopState.customLook=stored.customLook||null;
  shopState.recent=Array.isArray(stored.recent)?stored.recent:[];
  shopState.generation=Number.isInteger(stored.generation)?stored.generation:0;
}catch(e){shopState.customLook=null;shopState.recent=[];}
if(shopState.selected==='discovery'&&!shopState.customLook)shopState.selected='utility';

shopSeed=function(){
  return shopState.selected==='discovery'&&shopState.customLook?shopState.customLook:previousShopSeed();
};
shopStore=function(){
  // Backward-compatible payload; kept in the same key for cloud and local persistence.
  try{localStorage.setItem(storeKey,JSON.stringify({
    swaps:shopState.swaps,ownedProductIds:shopState.ownedProductIds,
    saved:shopState.saved,budget:shopState.budget,inspirationId:shopState.inspirationId,
    ratings:shopState.ratings,selected:shopState.selected,customLook:shopState.customLook,
    recent:shopState.recent||[],generation:shopState.generation
  }));}catch(e){/* guest browser may disallow persistence */}
};

function sig(ids){return ids.slice().sort().join('|')}
function roster(type){
  const catalog=SHOP_PRODUCTS.filter(p=>p.type===type).map(p=>({ ...p,owned:shopState.ownedProductIds.includes(p.id)}));
  const category=({top:'Tops',bottom:'Bottoms',shoe:'Shoes',outer:'Outerwear'})[type];
  const closet=state.items.filter(x=>x.category===category&&!x.demo).slice(0,10).map(x=>({
    id:'closet:'+x.id,type,kind:x.kind||'',name:x.name,color:x.color||'neutral',
    price:0,owned:true,tags:x.tags||[],fit:x.fit||'',store:'Your closet'
  }));
  return [...closet,...catalog];
}
function priceOf(items){return items.reduce((sum,p)=>sum+(p.owned?0:Number(p.price)||0),0)}
function colorHarmony(items){
  const colors=items.map(x=>String(x.color||'').toLowerCase()).filter(Boolean);
  const uniq=new Set(colors);
  const neutrals=new Set(['black','white','gray','grey','navy','cream','beige','brown','denim','khaki','olive']);
  let score=3;
  if(uniq.size<=3)score+=3;
  if(uniq.size===1)score+=1;
  score+=colors.filter(c=>neutrals.has(c)).length*0.5;
  return score;
}
function learnedScore(items){
  const ids=new Set(items.map(p=>p.id));
  const rated=shopState.ratings.slice(-130);
  let score=0, examples=0;
  for(const r of rated){
    if(!Array.isArray(r.items))continue;
    const overlap=r.items.filter(id=>ids.has(id)).length;
    if(overlap===0)continue;
    const weight=r.rating==='love'?0.9:r.rating==='maybe'?0.18:r.rating==='skip'?-0.9:0;
    score+=weight*(overlap+(overlap>=2?1.2:0));
    examples++;
  }
  return Math.max(-9,Math.min(9,score/Math.max(1,Math.sqrt(examples))));
}
function scoreCandidate(items,ref,budget){
  const price=priceOf(items);
  const reference=ref?items.reduce((sum,p)=>sum+matchProductToReference(p,ref),0):0;
  const rating=learnedScore(items);
  const fitNotes=items.filter(x=>/relax|loose|wide|oversized/i.test(String(x.fit))).length;
  let score=11+colorHarmony(items)+Math.min(18,reference*0.40)+rating;
  // Favor variety and layering, without making either mandatory.
  score+=new Set(items.flatMap(x=>(x.tags||[]).slice(0,2))).size*0.24;
  score+=fitNotes>0&&fitNotes<items.length?1.1:0;
  if(items.length===4)score+=0.4;
  if(budget>0)score+=price<=budget?Math.max(0,2-(price/budget)): -Math.min(18,(price-budget)/Math.max(budget,25)*12);
  // Explore first; learning is a gentle influence, not a lock onto preset styles.
  score+=(Math.random()-0.5)*8;
  return {items,ids:items.map(p=>p.id),price,score,signature:sig(items.map(p=>p.id))};
}
function generatedName(items){
  const top=items.find(p=>p.type==='top'),bottom=items.find(p=>p.type==='bottom');
  const outer=items.find(p=>p.type==='outer'),shoe=items.find(p=>p.type==='shoe');
  const colors=[...new Set(items.map(x=>x.color).filter(Boolean))];
  const colorDescription=colors.slice(0,2).map(x=>x[0].toUpperCase()+x.slice(1)).join(' & ');
  const kind=outer?.kind||top?.kind||'Mixed wardrobe';
  const cap=String(kind).replace(/\b\w/g,x=>x.toUpperCase());
  return colorDescription?cap+' · '+colorDescription:cap+' · Mixed textures';
}
function generatedDescription(items){
  const top=items.find(p=>p.type==='top'),bottom=items.find(p=>p.type==='bottom');
  const outer=items.find(p=>p.type==='outer'),shoe=items.find(p=>p.type==='shoe');
  const pieces=[outer?.name,top?.name,bottom?.name,shoe?.name].filter(Boolean);
  return 'A fresh combination of '+pieces.join(', ')+'. The proportions, colors and mix of garments are intended as a starting point—swap anything to make it yours.';
}
function selectCandidate(){
  const tops=roster('top'),bottoms=roster('bottom'),shoes=roster('shoe');
  const outerwear=[null,...roster('outer')];
  const rated=new Set(shopState.ratings.map(r=>r.signature));
  const recent=new Set(shopState.recent||[]);
  const current=sig(shopLineIds());
  const ref=shopReference(),budget=Number(shopState.budget)||0;
  const under=[],over=[];
  let cheapest=Infinity,scanned=0;
  for(const top of tops)for(const bottom of bottoms)for(const shoe of shoes)for(const outer of outerwear){
    const items=outer?[outer,top,bottom,shoe]:[top,bottom,shoe];
    const signature=sig(items.map(p=>p.id));
    if(rated.has(signature)||signature===current)continue;
    const candidate=scoreCandidate(items,ref,budget);
    scanned++;
    if(candidate.price<cheapest)cheapest=candidate.price;
    const list=candidate.price<=budget?under:over;
    if(recent.has(signature))candidate.score-=30;
    list.push(candidate);
  }
  const candidates=under.length?under:over;
  if(!candidates.length)return null;
  candidates.sort(under.length?(a,b)=>b.score-a.score||(a.price-b.price):(a,b)=>a.price-b.price||b.score-a.score);
  // If nothing fits the limit, prioritize the cheapest alternatives rather than pretending we found a budget match.
  // After a large session, older *unrated* looks can be explored again.
  const window=candidates.slice(0,Math.min(under.length?22:4,candidates.length));
  const pick=window[Math.floor(Math.pow(Math.random(),1.6)*window.length)];
  return {pick,withinBudget:under.length>0,cheapest,scanned};
}
shopGenerateInspired=function(){
  const found=selectCandidate();
  if(!found){
    toast('Every available catalog combination has been rated. Add new wardrobe pieces or expand the product catalog.');
    return null;
  }
  const {pick,withinBudget,cheapest}=found;
  const oldId=shopState.selected;
  shopState.selected='discovery';
  shopState.customLook={
    id:'discovery',name:generatedName(pick.items),
    tagline:withinBudget?'A new combination within your selected shopping budget':'Closest fresh looks using the available catalog',
    formula:generatedDescription(pick.items),pieces:pick.ids
  };
  // Swaps are stored under a stable discovery key; generated combinations replace the previous suggestion.
  shopState.swaps.discovery=pick.ids;
  shopState.swapSlot=-1;
  shopState.generation=(shopState.generation||0)+1;
  shopState.recent=[...(shopState.recent||[]),pick.signature].slice(-65);
  shopStore();
  if(!withinBudget){
    toast('No unrated combination is within '+shopMoney(shopState.budget)+'. Lowest available estimate: '+shopMoney(cheapest)+'. Your displayed look may exceed the limit.');
  }
  return shopState.customLook;
};

shopRateLook=function(value){
  if(!['love','maybe','skip'].includes(value))return;
  const pieces=shopLineIds();
  if(pieces.length<3)return;
  const signature=sig(pieces);
  const seed=shopSeed();
  const previous=shopState.ratings.find(r=>r.signature===signature);
  const entry={
    ...previous,signature,items:pieces.slice(),seed:shopState.selected,
    name:seed.name,formula:seed.formula,tagline:seed.tagline,
    amount:shopAmount(),rating:value,createdAt:Date.now()
  };
  shopState.ratings=shopState.ratings.filter(r=>r.signature!==signature);
  shopState.ratings.push(entry);
  shopStore();
  shopGenerateInspired();
  render();
  toast(value==='love'?'Loved look archived; discovering something different.':value==='skip'?'Skipped look archived and removed from future suggestions.':'Maybe archived; trying a fresh direction.');
};
function archiveMarkup(){
  const rows=(shopState.ratings||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!rows.length)return '<div class="section-head"><div><h2>Outfit archive</h2><p>Every Love, Maybe and Skip is stored here and guides what comes next.</p></div></div><div class="note">Rate an outfit to start your archive. Previously rated looks stay out of automatic suggestions.</div>';
  const ratingLabel={love:'♥ Loved',maybe:'○ Maybe',skip:'× Skipped'};
  return '<div class="section-head" id="tl-outfit-archive"><div><h2>Outfit archive</h2><p>'+rows.length+' rated combinations · archive keeps your feedback and avoids exact repeats.</p></div></div>'+
   '<div class="tl-archive-grid">'+rows.map((look,index)=>{
     const products=(look.items||[]).map(id=>shopResolved(id)).filter(Boolean);
     const price=Number.isFinite(look.amount)?look.amount:priceOf(products);
     return '<article class="tl-archive-card">'+
       '<div class="tl-archive-images">'+products.slice(0,4).map(p=>'<div>'+shopPhoto(p)+'</div>').join('')+'</div>'+
       '<div class="tl-archive-body"><span class="tl-archive-tag '+esc(look.rating)+'">'+(ratingLabel[look.rating]||'Rated')+'</span>'+
       '<h3>'+esc(look.name||'Explored combination')+'</h3>'+
       '<p>'+products.map(x=>esc(x.name)).join(' · ')+'</p>'+
       '<div class="tl-archive-bottom"><span>'+shopMoney(price)+' at rating · '+new Date(look.createdAt||Date.now()).toLocaleDateString()+'</span>'+
       '<button class="btn btn-ghost btn-small" data-tl-archive-open="'+index+'">View again</button></div></div></article>';
   }).join('')+'</div>';
}
renderShop=function(embedded=false){
  let view=previousRenderShop(embedded);
  const originalSelect='<select id="shop-look" class="select">';
  if(view.includes(originalSelect)){
    view=view.replace(originalSelect,originalSelect+'<option value="discovery" '+(shopState.selected==='discovery'?'selected':'')+'>Fresh discoveries</option>');
  }
  view=view.replace('Your answer influences future combinations; a Maybe keeps the idea open.','Each rating is added to your archive. Exact rated combinations are excluded from automatic future suggestions; the generator still explores broadly.');
  view=view.replace('Your outfit ratings are saved locally in this browser.','Your ratings are stored in your archive and can sync when you are signed in.');
  view=view.replace('Shopping budget</label>','Target shopping budget</label>');
  view=view.replace('Find less expensive options ↻','Generate within budget ↻');
  return view+archiveMarkup();
};
shopHandleClick=function(el){
  if(el.dataset.shopBudgetfit){
    shopGenerateInspired();render();return true;
  }
  return previousShopHandleClick(el);
};
document.addEventListener('change',e=>{
  if(e.target?.id==='shop-budget'){
    shopGenerateInspired();render();
  }
});
document.addEventListener('click',e=>{
  const key=e.target.closest('[data-tl-archive-open]')?.dataset.tlArchiveOpen;
  if(key===undefined)return;
  const rows=(shopState.ratings||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const row=rows[Number(key)];if(!row?.items?.length)return;
  shopState.selected='discovery';
  shopState.customLook={id:'discovery',name:row.name||'Archived outfit',tagline:'From your rated archive',formula:row.formula||'An outfit you previously rated.',pieces:row.items.slice()};
  shopState.swaps.discovery=row.items.slice();shopState.swapSlot=-1;
  shopStore();render();
  document.querySelector('.shop-look-meta')?.scrollIntoView({behavior:'smooth',block:'start'});
});
// Display the generator's new behavior immediately without touching the existing wardrobe.
if(state.route==='shop'||state.route==='studio')render();
})();