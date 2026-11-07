/* THREADLINE LAB optional vision client. No secret API keys in the browser.
 * Checks server readiness BEFORE requesting permission to send photos.
 */
const projectUrl="https://vkyzbsxabwhplpuctajz.supabase.co";
const publishable="sb_publishable_aK72PAYSXalQd04SIeGTPw_F2Dqaw5P";
let authClient=null;
async function authedClient(){
 const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
 authClient ||=createClient(projectUrl,publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const {data,error}=await authClient.auth.getUser();
 if(error||!data?.user)throw Error("Sign in to THREADLINE in this browser first. Manual review still works without signing in.");
 return authClient;
}
async function serviceCall(body){
 const client=await authedClient();
 const {data,error}=await client.functions.invoke("threadline-vision",{body});
 if(error){
  let detail="";
  try{const parsed=await error.context?.json?.();detail=typeof parsed?.error==="string"?parsed.error:"";}catch{/* default below */}
  if(error.context?.status===404)throw Error("The vision service has not been deployed in Supabase.");
  throw Error(detail||"The AI vision service is unavailable or needs one-time activation. You can still classify images manually.");
 }
 return data;
}
export async function checkVisionReadiness(){
 const status=await serviceCall({task:"status"});
 if(status?.ready!==true)throw Error(status?.error||"Visual AI needs a one-time Supabase deployment and provider-key setup.");
 return true;
}
async function analyze(task,image,context=""){
 if(typeof image!=="string"||!/^data:image\/(?:jpeg|png|webp);base64,/.test(image))throw Error("Choose a valid JPG, PNG, or WebP image.");
 if(image.length>2500000)throw Error("Compressed image is too large. Try a smaller photo.");
 if(!["garment","inspiration"].includes(task))throw Error("Unknown visual-analysis task.");
 const result=await serviceCall({task,image,context:String(context||"").slice(0,650)});
 if(!result||result.source!=="vision-model"||result.task!==task)
  throw Error("No structured visual result was returned. Continue reviewing manually.");
 return result;
}
export const classifyGarment=image=>analyze("garment",image);
export const analyzeInspiration=(image,description="")=>analyze("inspiration",image,description);
