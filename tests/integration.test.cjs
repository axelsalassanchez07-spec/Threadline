const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function app(){
 const listeners={};const elements=new Map();const get=s=>{if(!elements.has(s))elements.set(s,{textContent:'',innerHTML:'',style:{},dataset:{},addEventListener(){},scrollIntoView(){},focus(){},closest(){return null;},querySelector(){return null;}});return elements.get(s);};
 const document={querySelector:get,querySelectorAll:()=>[],getElementById:id=>get('#'+id),body:{style:{}},addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)};
 const c={document,console,structuredClone,localStorage:{getItem:()=>null,setItem(){}},setTimeout:()=>0,clearTimeout(){},navigator:{},crypto:{randomUUID:()=>Math.random().toString()},confirm:()=>false,scrollTo(){},addEventListener(){}};c.window=c;
 vm.createContext(c);
 let inline=fs.readFileSync('index.html','utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);/g,'');
 vm.runInContext(inline,c);
 for(const file of ['discovery-engine.js','outfit-discovery.js','style-language.js','vision-v16.js','wardrobe-bulk-v16.js','style-v16.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
 return {c,listeners,get,run:s=>vm.runInContext(s,c)};
}
test('main app loads all extensions and renders integrated wardrobe and stylist',()=>{let a=app();assert(a.run('renderWardrobe()').includes('Review saved clothing'));assert(a.run('renderShop()').includes('Explore three directions'));assert(a.run('renderShop()').includes('13 items'));});
test('three-direction click works with real app state and renders distinct tops',()=>{const a=app();a.get('#v16-style-prompt').value='';a.get('#v16-creativity').value='Balanced';const b={dataset:{v16Three:'1'}};for(const fn of a.listeners.click)fn({target:{closest:()=>b}});const html=a.run('renderShop()');assert.equal((html.match(/data-v16-use-direction=/g)||[]).length,3);assert(!html.includes('palette uses Unknown'));assert(html.includes('How to wear it:'));});
test('inconsistent existing garment is excluded, review can open without clearing it',()=>{const a=app();a.run("state.items=[{id:'bad',name:'Other Shoes',category:'Bottoms',kind:'other shoes',tags:[],image:'',color:'Unknown'}]");assert(a.run('renderWardrobe()').includes('1 items have conflicting'));const b={dataset:{v16Review:'1'}};for(const fn of a.listeners.click)fn({target:{closest:()=>b}});assert.equal(a.run('state.items.length'),1);assert(a.get('#modal-root').innerHTML.includes('Review your wardrobe'));});
test('cloud AI fails clearly for guests without invoking a provider',async()=>{const a=app();await assert.rejects(a.c.ThreadlineVision.cloud('garment','data:image/jpeg;base64,AA=='),/Sign in/);});
