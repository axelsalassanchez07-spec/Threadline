/* Uses the main app's existing authenticated session; never includes a secret key. */
(()=>{
'use strict';
async function call(body){
 const client=window.ThreadlineCloud?.getClient();
 if(!client||!window.ThreadlineCloud?.getUser())throw Error('Sign in to THREADLINE to use cloud AI. Local AI and manual review work without an account.');
 const {data,error}=await client.functions.invoke('threadline-vision',{body});
 if(error){let detail='';try{detail=(await error.context?.json?.())?.error||'';}catch{}throw Error(detail||'Cloud AI is unavailable. Check provider credits or use local AI.');}
 if(data?.error)throw Error(data.error);return data;
}
async function cloud(task,image,context=''){
 if(!/^data:image\/(jpeg|png|webp);base64,/.test(image||''))throw Error('Choose a JPG, PNG or WebP photo first.');
 if(image.length>2500000)throw Error('Choose a smaller photo.');
 const status=await call({task:'status'});
 if(!status?.ready)throw Error('Cloud AI needs its server configuration completed.');
 // Configuration does not prove available balance or model access.
 if(!confirm('Send this photo to the configured cloud AI provider? This uses API credits. Configuration is present, but available credit cannot be checked here. You can review the suggestion before saving.'))return null;
 const result=await call({task,image,context:String(context).slice(0,650)});
 if(result?.source!=='vision-model'||result.task!==task)throw Error('The service did not return a valid analysis.');
 return result;
}
let localBusy=false;
async function local(image,progress=()=>{}){
 if(localBusy)throw Error('A local analysis is already running.');
 if(!/^data:image\/(jpeg|png|webp);base64,/.test(image||''))throw Error('Upload a photo first.');
 if(!confirm('Try experimental on-device AI? It downloads a large model from Hugging Face (potentially hundreds of MB), then analyzes this photo in your browser without an API fee or photo upload. It can be slow or inaccurate.'))return null;
 localBusy=true;
 return new Promise((resolve,reject)=>{
  let worker,timer;
  const finish=(err,result)=>{clearTimeout(timer);worker?.terminate();localBusy=false;err?reject(err):resolve(result);};
  try{
   worker=new Worker(new URL('local-vision-worker.js',document.baseURI),{type:'module'});
   timer=setTimeout(()=>finish(Error('Local AI timed out. Manual review is still available.')),240000);
   worker.onmessage=({data})=>{if(data.progress)progress(data.progress);else if(data.error)finish(Error(data.error));else finish(null,data.result);};
   worker.onerror=()=>finish(Error('This browser could not start the local AI worker.'));
   worker.postMessage({image,types:ThreadlineDiscovery.TYPES});
  }catch(e){finish(e);}
 });
}
window.ThreadlineVision={cloud,local};
})();
