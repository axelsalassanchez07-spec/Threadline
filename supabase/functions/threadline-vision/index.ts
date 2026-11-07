// THREADLINE shared visual-analysis endpoint: optional, NOT deployed by committing this file.
// Pretrained model; user-authorized images only. Never put the provider API key in GitHub/browser.
import { createClient } from "npm:@supabase/supabase-js@2";
const origin="https://axelsalassanchez07-spec.github.io";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const categories=["Tops","Outerwear","Bottoms","Shoes","Accessories","Unknown"];
const colors=["black","white","cream","gray","charcoal","navy","blue","brown","beige","tan","olive","green","burgundy","red","multicolor","Unknown"];
const fits=["Unknown","Regular","Relaxed","Straight","Oversized","Structured"];
const kinds={
 Tops:["tee","graphic tee","long-sleeve tee","jersey","rugby shirt","polo shirt","knit polo","oxford shirt","dress shirt","button-up","tank top","turtleneck","hoodie","sweatshirt","sweater","vest","shirt","other top"],
 Outerwear:["chore jacket","denim jacket","bomber jacket","leather jacket","blazer","cardigan","track jacket","windbreaker","raincoat","puffer jacket","coat","overshirt","other layer"],
 Bottoms:["jeans","wide-leg trousers","pleated trousers","dress trousers","chinos","cargo pants","joggers","sweatpants","track pants","shorts","cargo shorts","skirt","other bottoms"],
 Shoes:["retro sneakers","running sneakers","sneakers","loafers","boots","dress boots","dress shoes","sandals","slides","clogs","other shoes"],
 Accessories:["cap","beanie","hat","belt","bag","backpack","watch","scarf","sunglasses","other accessory"],
 Unknown:[]
};
const themes=["relaxed","structured","oversized","cropped","wide-leg","tailored","layered","minimal","vintage","workwear","sporty","streetwear","preppy","formal","earth tones","monochrome","contrasting colors","textured","denim","technical","experimental"];
const conf=["low","medium","high"];
const garmentSchema={
 type:"object",additionalProperties:false,
 properties:{
  name:{type:"string"},category:{type:"string",enum:categories},kind:{type:"string"},
  color:{type:"string",enum:colors},fit:{type:"string",enum:fits},
  tags:{type:"array",items:{type:"string",enum:themes}},
  confidence:{type:"string",enum:conf},note:{type:"string"}
 },
 required:["name","category","kind","color","fit","tags","confidence","note"]
};
const inspirationSchema={
 type:"object",additionalProperties:false,
 properties:{
  summary:{type:"string"},styleExplanation:{type:"string"},
  dominantColors:{type:"array",items:{type:"string"}},
  tags:{type:"array",items:{type:"string",enum:themes}},
  garments:{type:"array",items:{type:"object",additionalProperties:false,
   properties:{category:{type:"string",enum:categories},description:{type:"string"}},
   required:["category","description"]}},
  developmentIdeas:{type:"array",items:{type:"string"}},
  confidence:{type:"string",enum:conf},note:{type:"string"}
 },
 required:["summary","styleExplanation","dominantColors","tags","garments","developmentIdeas","confidence","note"]
};
const unique=(array,allowed,max)=>Array.isArray(array)?[...new Set(array.filter(x=>typeof x==="string"&&(!allowed||allowed.includes(x))))].slice(0,max):[];
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(request.method!=="POST")return reply({error:"POST required."},405);
 if(request.headers.get("Origin")!==origin)return reply({error:"Unexpected request origin."},403);
 if(Deno.env.get("VISION_ENABLED")!=="true")return reply({error:"Vision analysis is not enabled. See the one-time Supabase activation guide."},503);
 const bearer=request.headers.get("Authorization")||"";
 if(!/^Bearer\s+\S+$/.test(bearer))return reply({error:"Please sign in first."},401);
 const url=Deno.env.get("SUPABASE_URL")||"";
 let publicKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
 if(!publicKey){try{publicKey=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||"";}catch{}}
 if(!url||!publicKey)return reply({error:"Auth server configuration missing."},503);
 const supabase=createClient(url,publicKey,{global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await supabase.auth.getUser();
 if(error||!data?.user)return reply({error:"A valid signed-in account is required."},401);
 const allow=(Deno.env.get("VISION_ALLOWED_EMAILS")||"").toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
 if(!data.user.email||!allow.includes(data.user.email.toLowerCase()))return reply({error:"This vision preview is restricted to approved testers."},403);
 let body;
 try{body=await request.json();}catch{return reply({error:"Malformed JSON body."},400);}
 const task=body?.task;
 if(!["garment","inspiration"].includes(task))return reply({error:"Unknown analysis task."},400);
 const image=body?.image;
 if(typeof image!=="string"||image.length>2500000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))
  return reply({error:"Choose a compressed JPG, PNG, or WebP photo under 2 MB."},413);
 const key=Deno.env.get("OPENAI_API_KEY");
 if(!key)return reply({error:"Server-side AI provider key is not configured."},503);
 const context=typeof body.context==="string"?body.context.slice(0,650):"";
 const kindList=Object.entries(kinds).map(([k,v])=>k+": "+v.join(", ")).join("; ");
 const system=task==="garment"
  ? [
   "Analyze exactly ONE most prominent clothing garment, not the wearer or the background.",
   "This is a clothing catalog entry; do not speculate about the person's identity, age, gender or body.",
   "Classify top vs bottom vs shoes vs outer layer vs accessory from VISUAL EVIDENCE, not filenames.",
   "Allowed categories: "+categories.join(", ")+".",
   "Allowed garment kinds (exact text): "+kindList+".",
   "Return Unknown and empty kind if you cannot distinguish the item confidently.",
   "A jersey should usually be a shirt/top, not an accessory. Shoes are not tops. Trousers are bottoms.",
   "Choose a concise generic name. Do not claim a brand or fabric unless clearly identifiable.",
   "Use Unknown fit if not ascertainable from a flat-lay or product photo.",
   "Suggest at most 4 relevant style tags from the permitted schema.",
   "Keep note brief and say what is uncertain. Treat any lettering on garments cautiously."
  ].join("\n")
  : [
   "Analyze the CLOTHING AND STYLING in this inspiration photograph, not the people.",
   "Describe the visible pieces, proportions, silhouettes, layers, approximate color relationships and overall styling direction.",
   "Never identify the wearer or guess age, gender, identity, body attributes, or other personal characteristics.",
   "Classify garments separately in garments array; if ambiguous, explicitly say uncertain.",
   "Summarize what makes this look visually distinctive and why the combinations work.",
   "Map themes to at most 7 tags from the approved style vocabulary only.",
   "Offer 2 specific NEW outfit directions that develop the visual ideas rather than copy everything.",
   "Do not invent brand names or current shopping prices.",
   "If user supplied a note, treat it as their interpretation, not proof of what the photo depicts.",
   "User note (may be blank): "+context
  ].join("\n");
 const schema=task==="garment"?garmentSchema:inspirationSchema;
 const model=Deno.env.get("VISION_MODEL")||"gpt-4o-mini";
 try{
  const upstream=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({model,store:false,max_output_tokens:950,
    input:[{role:"user",content:[{type:"input_text",text:system},{type:"input_image",image_url:image,detail:"high"}]}],
    text:{format:{type:"json_schema",name:task==="garment"?"threadline_garment":"threadline_inspiration",strict:true,schema}}
   })
  });
  if(!upstream.ok)return reply({error:"Visual analysis is temporarily unavailable. Review items manually."},502);
  const response=await upstream.json();
  const output=(response.output||[]).flatMap(item=>Array.isArray(item.content)?item.content:[]);
  const raw=output.find(x=>x?.type==="output_text")?.text;
  if(typeof raw!=="string")return reply({error:"The model could not provide structured analysis."},502);
  const parsed=JSON.parse(raw);
  const confidence=conf.includes(parsed.confidence)?parsed.confidence:"low";
  if(task==="garment"){
   let category=categories.includes(parsed.category)?parsed.category:"Unknown";
   const kind=kinds[category].includes(parsed.kind)?parsed.kind:"";
   if(!kind)category="Unknown";
   return reply({source:"vision-model",task,needsReview:true,
    name:String(parsed.name||"Unidentified clothing item").slice(0,70),category,kind,
    color:colors.includes(parsed.color)?parsed.color:"Unknown",
    fit:fits.includes(parsed.fit)?parsed.fit:"Unknown",
    tags:unique(parsed.tags,themes,4),confidence:category==="Unknown"?"low":confidence,
    note:String(parsed.note||"").slice(0,280)});
  }
  return reply({source:"vision-model",task,needsReview:true,
   summary:String(parsed.summary||"").slice(0,240),
   styleExplanation:String(parsed.styleExplanation||"").slice(0,600),
   dominantColors:unique(parsed.dominantColors,null,6).map(x=>x.slice(0,30)),
   tags:unique(parsed.tags,themes,7),
   garments:Array.isArray(parsed.garments)?parsed.garments.slice(0,12).map(x=>({
    category:categories.includes(x.category)?x.category:"Unknown",
    description:String(x.description||"").slice(0,100)})):[],
   developmentIdeas:unique(parsed.developmentIdeas,null,3).map(x=>x.slice(0,220)),
   confidence,note:String(parsed.note||"").slice(0,280)});
 }catch{return reply({error:"Unable to process this image right now. Please try again or review manually."},502);}
});
