/* Pure outfit selection and validation. No network, images or persistent state. */
(function(root){
'use strict';
const TYPES={Tops:['tee','graphic tee','long-sleeve tee','jersey','rugby shirt','polo shirt','knit polo','oxford shirt','dress shirt','button-up','tank top','turtleneck','hoodie','sweatshirt','crewneck','collegiate sweatshirt','sweater','vest','shirt','other top'],Outerwear:['chore jacket','utility jacket','varsity jacket','denim jacket','bomber jacket','leather jacket','blazer','cardigan','track jacket','windbreaker','raincoat','puffer jacket','coat','overshirt','sweater','other layer'],Bottoms:['jeans','wide-leg trousers','pleated trousers','dress trousers','chinos','cargo pants','carpenter pants','joggers','sweatpants','track pants','shorts','cargo shorts','skirt','other bottoms'],Shoes:['retro sneakers','running sneakers','sneakers','loafers','boots','dress boots','dress shoes','sandals','slides','clogs','other shoes'],Accessories:['cap','beanie','hat','belt','bag','backpack','watch','scarf','sunglasses','other accessory']};
const slots=['top','bottom','shoe','outer'];
const typeFor={Tops:'top',Bottoms:'bottom',Shoes:'shoe',Outerwear:'outer',Accessories:'accessory'};
const signature=items=>items.map(x=>typeof x==='string'?x:x.id).sort().join('|');
const knownColor=c=>!!c&&!/^(unknown|neutral)$/i.test(c);
function validItem(x){return !!x&&!x.demo&&TYPES[x.category]?.includes(x.kind)&&x.verifiedCategory!==false;}
function family(x){
 if(!x)return 'none';
 const k=x.kind||'';
 if(/sneakers/.test(k))return 'sneakers';
 if(/tee/.test(k))return 'tee';
 if(/trousers/.test(k))return 'trousers';
 return k;
}
function distance(a,b){return slots.reduce((n,s)=>n+(family(a.find(x=>x.type===s))!==family(b.find(x=>x.type===s))?1:0),0);}
function validOutfit(items){return ['top','bottom','shoe'].every(t=>items.filter(x=>x.type===t).length===1)&&items.filter(x=>x.type==='outer').length<=1&&items.every(x=>slots.includes(x.type))&&new Set(items.map(x=>x.id)).size===items.length;}
function describe(items){
 const top=items.find(x=>x.type==='top'),bottom=items.find(x=>x.type==='bottom'),shoe=items.find(x=>x.type==='shoe'),outer=items.find(x=>x.type==='outer');
 const tailored=/trousers|chinos|skirt/.test(bottom?.kind||'');
 const sporty=/rugby|jersey|sweat|hoodie/.test(top?.kind||'');
 const sharp=/loafers|dress/.test(shoe?.kind||'');
 const name=sporty&&tailored?'Sport with a polished finish':sharp?'Everyday, a little smarter':outer&&/chore|utility|denim/.test(outer.kind)?'Easy utility layers':tailored?'Relaxed and put together':'Simple off-duty';
 let why=tailored?'The '+bottom.kind+' give the outfit a more polished base.':'The '+(bottom?.kind||'bottoms')+' keep the base casual.';
 why+=' '+(sharp?'The '+shoe.kind+' sharpen the finish.':/sneaker/.test(shoe?.kind||'')?'Sneakers keep the outfit easy to wear.':'The '+(shoe?.kind||'shoes')+' change the feel of the outfit.');
 if(outer)why+=' The '+outer.kind+' adds a separate layer; wear it open to show the top.';
 else why+=' Keeping it to three pieces gives the top room to stand out.';
 const colors=[...new Set(items.map(x=>x.color).filter(knownColor))];
 if(colors.length)why+=' Known colors: '+colors.join(', ')+'.';
 if(items.some(x=>!knownColor(x.color)))why+=' Check the unconfirmed colors against your photos before wearing this.';
 const tip=/Relaxed|Oversized/.test(bottom?.fit||'')?'Try a front tuck to show where the top ends and the wider pants begin.':'Try it on and check that the hem sits neatly above your shoes.';
 return {name,why,tip};
}
function choose({rosters,budget=0,ratings=[],recent=[],current=[],accepted=[],match=()=>0,random=Math.random,creativity='Balanced'}){
 if(['top','bottom','shoe'].some(t=>!rosters[t]?.length))return null;
 const r={...rosters,outer:[null,...(rosters.outer||[])]};
 const rated=new Set(ratings.map(x=>x.signature||signature(x.items||[])));
 const excluded=new Set([signature(current),...accepted.map(signature),...rated]);
 const recents=recent.slice(-12).map(s=>new Set(s.split('|')));
 const seen=new Set(),candidates=[];
 function add(items){
  if(!validOutfit(items))return;
  const sig=signature(items);if(seen.has(sig)||excluded.has(sig))return;seen.add(sig);
  // Different product IDs alone do not make three meaningfully different directions.
  if(accepted.some(a=>family(items.find(x=>x.type==='top'))===family(a.find(x=>x.type==='top'))||(family(items.find(x=>x.type==='bottom'))===family(a.find(x=>x.type==='bottom'))&&family(items.find(x=>x.type==='shoe'))===family(a.find(x=>x.type==='shoe')))||distance(items,a)<2||items.filter(x=>a.some(y=>y.id===x.id)).length>1))return;
  const price=items.reduce((n,x)=>n+(x.owned?0:Number(x.price)||0),0);
  let score=items.reduce((n,x)=>n+match(x),0)*(creativity==='Experimental'?.35:.65);
  const tags=new Map();items.forEach(x=>(x.tags||[]).forEach(t=>tags.set(t,(tags.get(t)||0)+1)));
  // Shared styling details create coherence; unrelated labels aren't a reward.
  score+=[...tags.values()].filter(n=>n>=2).length*1.5;
  const cols=new Set(items.map(x=>x.color).filter(knownColor));score+=cols.size<=3?2:0;
  for(let i=0;i<recents.length;i++){
   const overlap=items.filter(x=>recents[i].has(x.id)).length;
   score-=overlap*(i+1)/recents.length*2;
   if(overlap>=3)score-=10;
  }
  for(const rating of ratings.slice(-60)){
   const overlap=items.filter(x=>(rating.items||[]).includes(x.id)).length;
   score+=Math.min(2,overlap)*({love:.3,maybe:0,skip:-.6}[rating.rating]||0);
  }
  score+=random()*2;
  candidates.push({items,ids:items.map(x=>x.id),signature:sig,price,score});
 }
 const total=r.top.length*r.bottom.length*r.shoe.length*r.outer.length;
 if(total<=80000){for(const a of r.top)for(const b of r.bottom)for(const c of r.shoe)for(const d of r.outer)add(d?[d,a,b,c]:[a,b,c]);}
 else{
  // Bounded search for large wardrobes; every top participates, not only the first ten items.
  for(let i=0;i<20000;i++){const a=r.top[i%r.top.length],b=r.bottom[Math.floor(random()*r.bottom.length)],c=r.shoe[Math.floor(random()*r.shoe.length)],d=r.outer[Math.floor(random()*r.outer.length)];add(d?[d,a,b,c]:[a,b,c]);}
 }
 const under=candidates.filter(x=>x.price<=budget);
 const pool=under.length?under:candidates;
 pool.sort(under.length?(a,b)=>b.score-a.score||a.price-b.price:(a,b)=>a.price-b.price||b.score-a.score);
 if(!pool.length)return null;
 return {pick:pool[0],withinBudget:!!under.length,cheapest:Math.min(...candidates.map(x=>x.price)),scanned:candidates.length};
}
root.ThreadlineDiscovery={TYPES,typeFor,validItem,validOutfit,signature,family,distance,describe,choose};
})(typeof window==='undefined'?globalThis:window);
