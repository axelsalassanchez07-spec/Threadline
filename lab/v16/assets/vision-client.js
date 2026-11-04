/* V1.6 AI scanner client. Called ONLY when the user explicitly requests analysis.
 * Public Supabase key is safe to expose; the private model key belongs ONLY in Edge secrets.
 */
const projectUrl="https://vkyzbsxabwhplpuctajz.supabase.co";
const publishable="sb_publishable_aK72PAYSXalQd04SIeGTPw_F2Dqaw5P";
let authClient=null;
export async function classifyGarment(image){
 if(typeof image!=="string"||!image.startsWith("data:image/"))throw Error("No garment image to analyze.");
 if(image.length>2500000)throw Error("Image is too large; choose a smaller photo.");
 const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
 authClient ||=createClient(projectUrl,publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const {data,error:authError}=await authClient.auth.getUser();
 if(authError||!data?.user)throw Error("Sign into your existing THREADLINE account in another tab, then return here to analyze your photo.");
 const {data:result,error}=await authClient.functions.invoke("threadline-vision",{body:{task:"garment",image}});
 if(error){
  let extra="";
  try{const body=await error.context?.json?.();extra=body?.error||"";}catch{/* no extra */}
  throw Error(extra||"Vision service is not deployed or available yet. Follow the one-time Supabase setup guide.");
 }
 if(!result||result.source!=="vision-model")throw Error("No valid vision result received. Continue with manual review.");
 return result;
}
