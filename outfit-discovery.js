/* THREADLINE V1.5 — exploration-first discovery, budget-aware combinations and rated outfit archive.
 * Uses only real retailer catalog products plus pieces the user explicitly added to their closet.
 * Extends existing shopping state without deleting any earlier saved looks or ratings.
 */
(() => {
'use strict';
const storeKey='threadline_shop_v11';
const previousShopSeed=shopSeed;
const previousRenderShop=renderShop;
const previousRenderSaved=renderSaved;
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
  const closet=state.items.filter(x=>x.category===category&&ThreadlineDiscovery.validItem(x)).map(x=>({
    id:'closet:'+x.id,type,kind:x.kind||'',name:x.name,color:x.color||'neutral',
    price:0,owned:true,tags:x.tags||[],fit:x.fit||'',store:'Your closet'
  }));
  return [...closet,...catalog];
}
function priceOf(items){return items.reduce((sum,p)=>sum+(p.owned?0:Number(p.price)||0),0)}
function selectCandidate(options={}){
 const ref=shopReference();
 return ThreadlineDiscovery.choose({rosters:Object.fromEntries(['top','bottom','shoe','outer'].map(t=>[t,roster(t)])),
  budget:Number(shopState.budget)||0,ratings:shopState.ratings,recent:shopState.recent||[],current:shopLineIds(),
  accepted:options.accepted||[],creativity:state.prefs.v16Creativity,match:p=>Math.min(10,matchProductToReference(p,ref))});
}
shopGenerateInspired=function(options={}){
  const found=selectCandidate(options);
  if(!found){
    if(!options.silent)toast('No sufficiently different combination is available. Review wardrobe labels or add different garment types.');
    return null;
  }
  const {pick,withinBudget,cheapest}=found;
  const oldId=shopState.selected;
  shopState.selected='discovery';
  shopState.customLook={
    id:'discovery',name:ThreadlineDiscovery.describe(pick.items).name,
    tagline:withinBudget?'A new combination within your selected shopping budget':'Closest fresh looks using the available catalog',
    formula:ThreadlineDiscovery.describe(pick.items).why,pieces:pick.ids
  };
  // Swaps are stored under a stable discovery key; generated combinations replace the previous suggestion.
  shopState.swaps.discovery=pick.ids;
  shopState.swapSlot=-1;
  shopState.generation=(shopState.generation||0)+1;
  shopState.recent=[...(shopState.recent||[]),pick.signature].slice(-65);
  shopStore();
  if(!withinBudget&&!options.silent){
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
renderSaved=function(){return previousRenderSaved()+archiveMarkup();};
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
  if(el.dataset.shopSave){
    const template=shopSeed();
    const snapshot=shopState.selected==='discovery'?{...shopState.customLook,pieces:shopLineIds()}:null;
    shopState.saved.push({
      id:uid(),seed:shopState.selected,name:template.name,lines:shopLineIds(),
      amount:shopAmount(),savedAt:Date.now(),customLook:snapshot
    });
    shopStore();render();toast('Exact outfit saved to your shopping looks.');
    return true;
  }
  if(el.dataset.shopLoadsaved){
    const saved=shopState.saved.find(r=>r.id===el.dataset.shopLoadsaved);
    if(!saved)return true;
    shopState.selected=saved.seed||'utility';
    if(shopState.selected==='discovery'){
      shopState.customLook=saved.customLook||{id:'discovery',name:saved.name||'Saved discovery',tagline:'Saved shopping outfit',formula:'A saved outfit from your earlier discoveries.',pieces:saved.lines.slice()};
    }
    shopState.swaps[shopState.selected]=saved.lines.slice();
    shopState.swapSlot=-1;shopStore();render();return true;
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
  state.route='shop';shopStore();render();
  document.querySelector('.shop-look-meta')?.scrollIntoView({behavior:'smooth',block:'start'});
});
// Display the generator's new behavior immediately without touching the existing wardrobe.
if(state.route==='shop'||state.route==='studio')render();
})();