/* Explicit outfit-slot rules — no more than one garment per category. */
export const SLOT_LABELS={Tops:'TOP',Bottoms:'BOTTOM',Shoes:'SHOES',Outerwear:'OPTIONAL LAYER',Accessories:'OPTIONAL ACCESSORY'};
export const REQUIRED_SLOTS=['Tops','Bottoms','Shoes'];
export function categoryConfirmed(item){
 if(!item||!SLOT_LABELS[item.category])return false;
 if(item.demo===true)return true;
 return item.verifiedCategory===true&&typeof item.kind==='string'&&item.kind.trim().length>0;
}
export function validateOutfitPieces(items){
 const counts=new Map(),ids=new Set();
 if(!Array.isArray(items))return {ok:false,reason:'Not a list of pieces'};
 for(const piece of items){
  if(!categoryConfirmed(piece))return {ok:false,reason:'Unverified or unknown category'};
  if(ids.has(piece.id))return {ok:false,reason:'A garment was added twice'};
  ids.add(piece.id);counts.set(piece.category,(counts.get(piece.category)||0)+1);
 }
 for(const required of REQUIRED_SLOTS)if(counts.get(required)!==1)return{ok:false,reason:'Need exactly one '+required.toLowerCase()+' piece'};
 for(const optional of ['Outerwear','Accessories'])if((counts.get(optional)||0)>1)return {ok:false,reason:'Only one '+optional.toLowerCase()+' piece is allowed'};
 return {ok:true,reason:''};
}
