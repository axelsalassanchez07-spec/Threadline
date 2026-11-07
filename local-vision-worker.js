// Optional on-device classifier. Images never leave this worker for inference.
let classifier;
const categories={Tops:'a shirt or sweater',Bottoms:'pants, shorts or a skirt',Outerwear:'a jacket or coat',Shoes:'a pair of shoes',Accessories:'a clothing accessory',Unknown:'an image without a clearly visible single garment'};
self.onmessage=async({data})=>{
 try{
  const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
  env.allowLocalModels=false;
  env.backends.onnx.wasm.numThreads=1;
  classifier ||= await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress')self.postMessage({progress:'Downloading AI model: '+Math.round(p.progress||0)+'% of '+p.file});}});
  const ranked=await classifier(data.image,Object.values(categories));
  const best=ranked[0],second=ranked[1];
  const category=Object.keys(categories).find(k=>categories[k]===best.label)||'Unknown';
  // Relative similarity is not calibrated confidence. Abstain on weak/ambiguous results.
  if(category==='Unknown'||best.score<.35||best.score-second.score<.12){self.postMessage({result:{category:'Unknown',kind:'',confidence:'low',note:'The local model could not clearly distinguish the garment. Please choose its category.',source:'local-clip'}});return;}
  const kinds=data.types[category]||[];
  const names=kinds.filter(x=>!x.startsWith('other ')).map(x=>'a photo of '+x);
  const types=await classifier(data.image,names);
  const kind=types[0]?.label.replace('a photo of ','')||'';
  self.postMessage({result:{category,kind,name:kind,color:'Unknown',fit:'Unknown',tags:[],confidence:'medium',source:'local-clip',note:'Experimental local suggestion. Check the photo; color, fit and fabric were not inferred.'}});
 }catch(e){classifier=null;self.postMessage({error:'Local AI could not load or run on this device. Try another browser or review manually. '+String(e.message||e).slice(0,160)});}
};
