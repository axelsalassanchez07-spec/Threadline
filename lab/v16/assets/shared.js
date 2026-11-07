/* THREADLINE V1.6 LAB — isolated browser-only workspace. Nothing is sent to Supabase. */
export const STORE='threadline_v16_lab_records';
export const CATEGORIES=['Tops','Outerwear','Bottoms','Shoes','Accessories'];
export const COLORS=['Unknown','black','white','cream','gray','charcoal','navy','blue','brown','beige','tan','olive','green','burgundy','red','multicolor'];
export const FITS=['Unknown','Regular','Relaxed','Straight','Oversized','Structured'];
export const TYPES={
 Tops:['tee','graphic tee','long-sleeve tee','jersey','rugby shirt','polo shirt','knit polo','oxford shirt','dress shirt','button-up','tank top','turtleneck','hoodie','sweatshirt','sweater','vest','shirt','other top'],
 Outerwear:['chore jacket','denim jacket','bomber jacket','leather jacket','blazer','cardigan','track jacket','windbreaker','raincoat','puffer jacket','coat','overshirt','other layer'],
 Bottoms:['jeans','wide-leg trousers','pleated trousers','dress trousers','chinos','cargo pants','joggers','sweatpants','track pants','shorts','cargo shorts','skirt','other bottoms'],
 Shoes:['retro sneakers','running sneakers','sneakers','loafers','boots','dress boots','dress shoes','sandals','slides','clogs','other shoes'],
 Accessories:['cap','beanie','hat','belt','bag','backpack','watch','scarf','sunglasses','other accessory']
};
export const THEMES=['relaxed','structured','oversized','cropped','wide-leg','tailored','layered','minimal','vintage','workwear','sporty','streetwear','preppy','formal','earth tones','monochrome','contrasting colors','textured','denim','technical','experimental'];
export const el=id=>document.getElementById(id);
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid=()=>crypto.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
let handle=null;
export function db(){
 if(handle)return handle;
 handle=new Promise((res,rej)=>{
   const req=indexedDB.open(STORE,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('records'))req.result.createObjectStore('records',{keyPath:'id'});};
   req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);
 });
 return handle;
}
export async function records(prefix=''){
 const database=await db();
 return new Promise((resolve,reject)=>{
  const tx=database.transaction('records','readonly'),q=tx.objectStore('records').getAll();
  q.onsuccess=()=>resolve(q.result.filter(x=>x.id.startsWith(prefix)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)));
  q.onerror=()=>reject(q.error);
 });
}
export async function save(row){const database=await db();return new Promise((res,rej)=>{const tx=database.transaction('records','readwrite');tx.objectStore('records').put(row);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
export async function erase(id){const database=await db();return new Promise((res,rej)=>{const tx=database.transaction('records','readwrite');tx.objectStore('records').delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
export async function clearLab(){const database=await db();return new Promise((res,rej)=>{const tx=database.transaction('records','readwrite');tx.objectStore('records').clear();tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
export function feedback(text,bad=false){const box=el('status');if(!box)return;box.textContent=text;box.className='status '+(bad?'bad':'good');}
export function photo(file,maxSize=700){
 return new Promise((res,rej)=>{
  if(!file?.type.startsWith('image/'))return rej(Error('Choose a supported image file.'));
  if(file.size>25*1024*1024)return rej(Error('Image exceeds 25 MB.'));
  const url=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{
   try{
    const ratio=Math.min(1,maxSize/Math.max(image.naturalWidth,image.naturalHeight));
    const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(image.naturalWidth*ratio));cv.height=Math.max(1,Math.round(image.naturalHeight*ratio));
    const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#faf9f6';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(image,0,0,cv.width,cv.height);
    // This is approximate pixel sampling, NOT garment recognition: backgrounds can dominate.
    const patch=ctx.getImageData(Math.floor(cv.width*.25),Math.floor(cv.height*.25),Math.max(1,Math.floor(cv.width*.5)),Math.max(1,Math.floor(cv.height*.5))).data;
    let r=0,g=0,b=0,total=0;
    for(let j=0;j<patch.length;j+=64){let R=patch[j],G=patch[j+1],B=patch[j+2];if(R>246&&G>246&&B>246)continue;r+=R;g+=G;b+=B;total++;}
    const rgb=total?[r/total,g/total,b/total]:[220,220,220];
    res({src:cv.toDataURL('image/jpeg',.75),estimatedColor:nearestColor(rgb)});
   }catch(e){rej(e)}finally{URL.revokeObjectURL(url);}
  };image.onerror=()=>{URL.revokeObjectURL(url);rej(Error('Image could not be decoded.'))};image.src=url;
 });
}
const palette={black:[40,42,43],white:[235,234,231],cream:[220,208,182],gray:[146,149,150],charcoal:[85,88,91],navy:[54,70,93],blue:[96,132,172],brown:[131,95,73],beige:[194,174,142],tan:[180,147,113],olive:[112,124,91],green:[72,118,93],burgundy:[130,58,72],red:[180,78,68]};
function nearestColor(rgb){return Object.keys(palette).sort((a,b)=>distance(rgb,palette[a])-distance(rgb,palette[b]))[0];}
function distance(a,b){return a.reduce((sum,n,i)=>sum+(n-b[i])**2,0);}
export function guessFilename(name){
 // Never guess clothing type or a readable name from an opaque camera filename.
 // These are FILE-NAME hints, not computer-vision predictions.
 const input=String(name||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
 const n=input.toLowerCase();
 const rules=[
  {re:/\b(baseball cap|cap|beanie|hat|scarf|belt|watch|bag|backpack)\b/,category:'Accessories',kind:'cap'},
  {re:/\b(sneakers?|trainers?|shoes?|boots?|loafers?|sandals?|heels?)\b/,category:'Shoes',kind:'sneakers'},
  {re:/\b(jacket|blazer|coat|bomber|cardigan|overshirt|parka)\b/,category:'Outerwear',kind:'other layer'},
  {re:/\b(jeans?|pants?|trousers?|cargo|chinos?|shorts?|skirt|leggings)\b/,category:'Bottoms',kind:'other bottoms'},
  {re:/\b(hoodie|shirt|tee|tshirt|t-shirt|polo|sweater|rugby|jersey|blouse|top)\b/,category:'Tops',kind:'other top'}
 ];
 const found=rules.find(r=>r.re.test(n));
 const category=found?.category||'';
 let kind=found?.kind||'';
 if(category){
  kind=TYPES[category].find(type=>n.includes(type))||kind;
  if(/\bjeans?\b/.test(n))kind='jeans';
  if(/\bboots?\b/.test(n))kind='boots';
  if(/\bloafers?\b/.test(n))kind='loafers';
  if(/\bcaps?\b/.test(n))kind='cap';
  if(/\bhoodie\b/.test(n))kind='hoodie';
  if(/\bbomber\b/.test(n))kind='bomber jacket';
  if(/\bwide[- ]leg\b/.test(n)&&category==='Bottoms')kind='wide-leg trousers';
 }
 const color=COLORS.find(c=>new RegExp('\\b'+c+'\\b').test(n))||'Unknown';
 const title=kind?[(color==='Unknown'?'':color),kind].filter(Boolean).join(' ').replace(/\b\w/g,c=>c.toUpperCase()):'Unidentified clothing item';
 return {name:title,category,kind,color,fit:'Unknown',tags:[],uncertain:!found,source:'filename-hint'};
}
export function themeCounts(inspirations){
 const counts=new Map();
 for(const row of inspirations){
  const unique=new Set([...(row.tags||[]),...THEMES.filter(t=>String(row.notes||'').toLowerCase().includes(t))]);
  unique.forEach(t=>counts.set(t,(counts.get(t)||0)+1));
 }
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count}));
}
export const options=(values,selected)=>values.map(x=>'<option value="'+esc(x)+'" '+(x===selected?'selected':'')+'>'+esc(x)+'</option>').join('');
export function initNav(active){
 document.querySelectorAll('[data-lab-nav]').forEach(a=>{if(a.dataset.labNav===active)a.setAttribute('aria-current','page')});
}
