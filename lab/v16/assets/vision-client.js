/* THREADLINE LAB shared vision client. Explicit opt-in and authenticated server calls only.
 * The secret provider API key never belongs in this file. Backend is NOT deployed by a GitHub merge.
 */
const projectUrl="https://vkyzbsxabwhplpuctajz.supabase.co";
const publishable="sb_publishable_aK72PAYSXalQd04SIeGTPw_F2Dqaw5P";
let authClient=null;
async function analyze(task,image,context=""){
 if(typeof image!=="string"||!/^data:image\/(?:jpeg|png|webp);base64,/.test(image))throw Error("Choose a valid JPG, PNG, or WebP image.");
 if(image.length>2500000)throw Error("The compressed image is too large. Choose a smaller photo.");
 if(!["garment","inspiration"].includes(task))throw Error("Unknown analysis type.");
 const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
 authClient ||=createClient(projectUrl,publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const {data,error:authError}=await authClient.auth.getUser();
 if(authError||!data?.user)throw Error("Sign into THREADLINE in another tab, then come back to the lab.");
 const {data:result,error}=await authClient.functions.invoke("threadline-vision",{
  body:{task,image,context:String(context||"").slice(0,650)}
 });
 if(error){
  let detail="";
  try{const response=await error.context?.json?.();detail=typeof response?.error==="string"?response.error:"";}catch{ /* show safe general error */ }
  if(error.context?.status===404)throw Error("The vision function is not deployed yet. Follow the one-time activation guide.");
  throw Error(detail||"The AI vision service is unavailable. It may need a one-time Supabase setup; your images remain in local drafts.");
 }
 if(!result||result.source!=="vision-model"||result.task!==task)
  throw Error("No valid image analysis returned. Continue reviewing manually.");
 return result;
}
export const classifyGarment=image=>analyze("garment",image);
export const analyzeInspiration=(image,description="")=>analyze("inspiration",image,description);
