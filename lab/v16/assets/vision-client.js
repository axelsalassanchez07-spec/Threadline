/* V1.6 AI scanner client. Called ONLY when the user explicitly requests analysis.
 * Public Supabase key is safe to expose; the private model key belongs ONLY in Edge secrets.
 */
const projectUrl="https://vkyzbsxabwhplpuctajz.supabase.co";
const publishable="sb_publishable_aK72PAYSXalQd04SIeGTPw_F2Dqaw5P";
let authClient=null;
async function authedClient(){
 const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
 authClient ||=createClient(projectUrl,publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const {data,error}=await authClient.auth.getUser();
 if(error||!data?.user)throw Error("Sign in to THREADLINE in this browser before using AI recognition. You can still classify photos manually.");
 return authClient;
}
async function serviceCall(body){
 const client=await authedClient();
 const {data,error}=await client.functions.invoke("threadline-vision",{body});
 if(error){
  let message="";
  try{const detail=await error.context?.json?.();message=String(detail?.error||"");}catch{/* ignore */}
  throw Error(message||"The AI vision service is not deployed or available yet. Regular photo upload still works.");
 }
 return data;
}
export async function checkVisionReadiness(){
 const result=await serviceCall({task:"status"});
 if(result?.ready!==true)throw Error(result?.error||"AI recognition needs one-time Supabase activation.");
 return true;
}
export async function classifyGarment(image){
 if(typeof image!=="string"||!image.startsWith("data:image/"))throw Error("No garment image to analyze.");
 if(image.length>2500000)throw Error("Image is too large; choose a smaller photo.");
 const result=await serviceCall({task:"garment",image});
 if(!result||result.source!=="vision-model")throw Error("No valid vision result received. Continue with manual review.");
 return result;
}
