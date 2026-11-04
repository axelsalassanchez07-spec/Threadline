/* THREADLINE V1.6 LAB — isolated browser-only workspace. Nothing is sent to Supabase. */
export const STORE='threadline_v16_lab_records';
export const CATEGORIES=['Tops','Outerwear','Bottoms','Shoes','Accessories'];
export const COLORS=['black','white','cream','gray','charcoal','navy','blue','brown','beige','tan','olive','green','burgundy','red'];
export const FITS=['Unknown','Regular','Relaxed','Straight','Oversized','Structured'];
export const TYPES={
 Tops:['tee','graphic tee','oxford shirt','button-up','rugby shirt','knit polo','hoodie','sweater','shirt','other top'],
 Outerwear:['chore jacket','denim jacket','bomber jacket','leather jacket','blazer','cardigan','track jacket','coat','overshirt','other layer'],
 Bottoms:['jeans','wide-leg trousers','pleated trousers','chinos','cargo pants','shorts','skirt','other bottoms'],
 Shoes:['retro sneakers','sneakers','loafers','boots','dress shoes','sandals','other shoes'],
 Accessories:['cap','hat','belt','bag','watch','scarf','other accessory']
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
 const n=String(name||'').toLowerCase().replace(/[_-]/g,' ');
 const rules=[
  [/cap|hat|beanie|scarf|belt|watch|bag|backpack/, 'Accessories','cap'],
  [/sneaker|trainer|shoe|boot|loafer|sandal/, 'Shoes','sneakers'],
  [/jacket|blazer|coat|bomber|cardigan|overshirt/, 'Outerwear','other layer'],
  [/jean|pants|trouser|cargo|chino|short|skirt|denim bottom/, 'Bottoms','jeans'],
  [/hoodie|shirt|tee|top|polo|sweater|rugby|jersey/, 'Tops','tee']
 ];
 const found=rules.find(r=>r[0].test(n));
 let category=found?.[1]||'Tops',kind=found?.[2]||'other top';
 const match=TYPES[category].find(t=>n.includes(t));
 if(match)kind=match;
 if(n.includes('cap'))kind='cap';
 if(n.includes('hoodie'))kind='hoodie';
 if(n.includes('bomber'))kind='bomber jacket';
 if(n.includes('boot'))kind='boots';
 if(n.includes('loafer'))kind='loafers';
 const color=COLORS.find(c=>new RegExp('\\b'+c+'\\b').test(n));
 const words=n.replace(/\.(jpe?g|png|webp|heic)$/,'').replace(/\b(img|image|photo|dsc|whatsapp|screenshot|camera|copy)\b/g,'').replace(/[0-9]+/g,'').trim();
 return {name:words.length>3?words.split(' ').filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1)).join(' '):'Untitled garment',category,kind,color,fit:'Unknown',tags:[],uncertain:!found};
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
