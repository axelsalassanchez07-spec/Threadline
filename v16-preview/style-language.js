/* Reusable, free, deterministic fashion-language helper. No image inference or network calls. */
(()=>{
'use strict';
/* V1.6 LAB: transparent, editable phrase-to-fashion vocabulary helper.
 * This is a dictionary/heuristic translator of the USER'S WORDS, not visual AI.
 */
const RULES=[
 {re:/\b(baggy|very loose|flowy|wide[- ]leg|wide pants|roomy pants|loose trousers|big pants|loose jeans)\b/i,tags:['wide-leg','relaxed'],label:'relaxed, wide-leg proportions'},
 {re:/\b(loose fitting|loose fit|roomy fit|relaxed fit|easy fitting|not tight)\b/i,tags:['relaxed'],label:'relaxed fit'},
 {re:/\b(short jacket|cropped jacket|shorter jacket|cropped top|cropped coat|at the waist|waist length|waist-length)\b/i,tags:['cropped'],label:'cropped upper-body proportions'},
 {re:/\b(big hoodie|oversized|oversize|extra large sweater|huge sweatshirt|boxy|boxy fit)\b/i,tags:['oversized'],label:'oversized or boxy silhouette'},
 {re:/\b(blazer|suit|suiting|dress pants|pleated trousers|tailored|smart casual|dressy|elegant|sharp outfit|polished)\b/i,tags:['tailored'],label:'relaxed or structured tailoring'},
 {re:/\b(fitted|sharp lines|well fitted|structured|strong shoulders|structured shoulders)\b/i,tags:['structured'],label:'structured tailoring'},
 {re:/\b(layers|layered|layering|shirt over|jacket over|on top of|underneath)\b/i,tags:['layered'],label:'intentional layering'},
 {re:/\b(simple|clean look|clean outfit|understated|not flashy|subtle|basic|minimal|minimalist|neat)\b/i,tags:['minimal'],label:'understated, minimal styling'},
 {re:/\b(old school|old-school|retro|throwback|vintage|90s|80s|thrifted|heritage)\b/i,tags:['vintage'],label:'retro or vintage-inspired details'},
 {re:/\b(utility|workwear|carpenter|chore jacket|cargo|lots of pockets|functional pockets|durable)\b/i,tags:['workwear'],label:'workwear/utility references'},
 {re:/\b(football shirt|jersey|track jacket|athletic|sporty|sportswear|running shoes|sports)\b/i,tags:['sporty'],label:'athletic or retro-sport influences'},
 {re:/\b(streetwear|skater|skate style|urban look|street style)\b/i,tags:['streetwear'],label:'streetwear cues'},
 {re:/\b(preppy|ivy|collegiate|rugby shirt|polo and chinos|school style)\b/i,tags:['preppy'],label:'ivy/preppy styling'},
 {re:/\b(denim|blue jeans|jean jacket|jeans|raw denim)\b/i,tags:['denim'],label:'denim as a key texture'},
 {re:/\b(all black|one color|same color|matching shades|all white|monochromatic|monochrome|tonal outfit|tonal dressing)\b/i,tags:['monochrome'],label:'tonal or monochromatic palette'},
 {re:/\b(earthy|earth tones|brown and green|olive and brown|khaki|natural colors|earth colors)\b/i,tags:['earth tones'],label:'earth-toned palette'},
 {re:/\b(color contrast|contrasting|pop of color|bright accent|bold color|color blocking)\b/i,tags:['contrasting colors'],label:'color contrast or accent styling'},
 {re:/\b(textured|texture|corduroy|chunky knit|suede|leather|fleece)\b/i,tags:['textured'],label:'texture-driven combination'},
 {re:/\b(techwear|technical|performance fabric|gorpcore|outdoor gear)\b/i,tags:['technical'],label:'technical/outdoor-inspired details'},
 {re:/\b(unexpected|unusual|avant-garde|experimental|different|bold shape)\b/i,tags:['experimental'],label:'experimental combinations'},
 {re:/\b(formal|business attire|black tie|dress clothes)\b/i,tags:['formal'],label:'formal dressing'}
];
function interpretStyleDescription(input){
 const text=String(input||'').trim().slice(0,1200),seen=new Set(),observations=[];
 if(!text)return{tags:[],summary:'Describe what you like about the look, in your own words.',observations:[],source:'text-rules'};
 for(const rule of RULES){
  if(!rule.re.test(text))continue;
  for(const t of rule.tags)seen.add(t);
  if(!observations.includes(rule.label))observations.push(rule.label);
 }
 const tags=[...seen],summary=observations.length?
   'Possible fashion terms: '+observations.slice(0,5).join('; ')+'.':
   'I could not confidently translate that description yet. You can still save your words, select a few cues manually, or mention the garment, fit, colors or layering.';
 return{tags,summary,observations,source:'text-rules'};
}

window.ThreadlineStyleLanguage={interpretStyleDescription};
})();
