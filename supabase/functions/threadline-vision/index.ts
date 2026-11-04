// THREADLINE vision inference — optional one-time deployment for signed-in users.
// NO credentials belong in GitHub or browser code. This function is NOT deployed by committing it.
import { createClient } from "npm:@supabase/supabase-js@2";

const origin="https://axelsalassanchez07-spec.github.io";
const cors={
 "Access-Control-Allow-Origin":origin,
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Vary":"Origin"
};
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const CATEGORY=["Tops","Outerwear","Bottoms","Shoes","Accessories","Unknown"];
const COLOR=["black","white","cream","gray","charcoal","navy","blue","brown","beige","tan","olive","green","burgundy","red","Unknown"];
const FIT=["Unknown","Regular","Relaxed","Straight","Oversized","Structured"];
const KINDS:Record<string,string[]>={
 Tops:["tee","graphic tee","oxford shirt","button-up","rugby shirt","knit polo","hoodie","sweater","shirt","other top"],
 Outerwear:["chore jacket","denim jacket","bomber jacket","leather jacket","blazer","cardigan","track jacket","coat","overshirt","other layer"],
 Bottoms:["jeans","wide-leg trousers","pleated trousers","chinos","cargo pants","shorts","skirt","other bottoms"],
 Shoes:["retro sneakers","sneakers","loafers","boots","dress shoes","sandals","other shoes"],
 Accessories:["cap","hat","belt","bag","watch","scarf","other accessory"],
 Unknown:[]
};
const schema={
 type:"object",additionalProperties:false,
 properties:{
  name:{type:"string"},
  category:{type:"string",enum:CATEGORY},
  kind:{type:"string"},
  color:{type:"string",enum:COLOR},
  fit:{type:"string",enum:FIT},
  tags:{type:"array",items:{type:"string"}},
  confidence:{type:"string",enum:["low","medium","high"]},
  note:{type:"string"}
 },
 required:["name","category","kind","color","fit","tags","confidence","note"]
};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"POST only"},405);
 if(req.headers.get("Origin")!==origin)return reply({error:"Unexpected origin"},403);
 if(Deno.env.get("VISION_ENABLED")!=="true")return reply({error:"Vision service not enabled. Follow the one-time setup guide."},503);
 const auth=req.headers.get("Authorization")||"";
 if(!/^Bearer\s+\S+$/.test(auth))return reply({error:"Please sign into THREADLINE first."},401);
 const url=Deno.env.get("SUPABASE_URL")||"";
 let publicKey="";
 try{publicKey=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}")["default"]||"";}catch{ /* fallback below */ }
 publicKey||=Deno.env.get("SUPABASE_ANON_KEY")||"";
 if(!url||!publicKey)return reply({error:"Authentication is not configured."},503);
 const client=createClient(url,publicKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser();
 if(error||!data.user)return reply({error:"Sign in required."},401);
 const allowed=(Deno.env.get("VISION_ALLOWED_EMAILS")||"").toLowerCase().split(",").map(x=>x.trim()).filter(Boolean);
 if(!allowed.length||!data.user.email||!allowed.includes(data.user.email.toLowerCase()))return reply({error:"This preview is limited to approved test accounts."},403);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return reply({error:"Malformed request."},400)}
 if(body.task!=="garment"||typeof body.image!=="string")return reply({error:"Provide one garment image."},400);
 // Cap per-request input size well below provider limits; don't send an entire photo album.
 const image=body.image;
 if(image.length>2500000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return reply({error:"Use a JPG/PNG/WebP image under 2 MB."},413);
 const apiKey=Deno.env.get("OPENAI_API_KEY");
 if(!apiKey)return reply({error:"The AI provider key is not configured on the server."},503);
 const prompt=[
  "Analyze the ONE prominent garment pictured for a personal wardrobe catalog.",
  "Ignore other garments/background. Never infer a brand or material if not visible.",
  "Category must be one of "+CATEGORY.join(", ")+".",
  "Kind must be chosen from: "+Object.entries(KINDS).map(([k,v])=>k+": "+v.join(", ")).join("; ")+".",
  "If garment isn't visible or category is uncertain, return category Unknown, kind empty, confidence low.",
  "Do not invent precise fit from a standalone item: use Unknown unless strongly evident.",
  "Name should be concise and descriptive, with no invented logos or labels.",
  "Choose at most four style tags; tags are suggestive not facts.",
  "In note, briefly explain what is visible and any uncertainty. Return JSON matching schema."
 ].join("\n");
 const model=Deno.env.get("VISION_MODEL")||"gpt-4o-mini";
 try{
  const result=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",
   headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
   body:JSON.stringify({model,store:false,max_output_tokens:350,
    input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"low"}]}],
    text:{format:{type:"json_schema",name:"threadline_garment",strict:true,schema}}
   })
  });
  if(!result.ok)return reply({error:"AI recognition is unavailable. Please use manual review."},502);
  const response=await result.json();
  const text=response.output?.flatMap((o:Record<string,unknown>)=>Array.isArray(o.content)?o.content:[])
    ?.find((o:Record<string,unknown>)=>o.type==="output_text")?.text;
  if(typeof text!=="string")return reply({error:"No garment classification returned."},502);
  const parsed=JSON.parse(text);
  const category=CATEGORY.includes(parsed.category)?parsed.category:"Unknown";
  const options=KINDS[category]||[];
  const kind=options.includes(parsed.kind)?parsed.kind:"";
  const confidence=["high","medium","low"].includes(parsed.confidence)?parsed.confidence:"low";
  return reply({source:"vision-model",name:String(parsed.name||"Unidentified clothing").slice(0,70),
    category:kind?category:"Unknown",kind,color:COLOR.includes(parsed.color)?parsed.color:"Unknown",
    fit:FIT.includes(parsed.fit)?parsed.fit:"Unknown",
    tags:Array.isArray(parsed.tags)?parsed.tags.filter((x:unknown)=>typeof x==="string").slice(0,4):[],
    confidence:kind?confidence:"low",note:String(parsed.note||"").slice(0,300),
    needsReview:true});
 }catch{return reply({error:"Unable to analyze image. Use manual review."},502)}
});
