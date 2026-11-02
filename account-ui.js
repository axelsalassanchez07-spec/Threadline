/* THREADLINE V1.4 account menu. Keeps the existing cloud-sync engine as sole Supabase session owner. */
(() => {
'use strict';
const actions=document.querySelector('.top-actions');
if(!actions)return;
const escapeText=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const root=document.createElement('div');
root.id='tl-account-root';
root.innerHTML='<button id="tl-account-button" class="tl-account-trigger" type="button" aria-label="Account menu" aria-haspopup="true" aria-expanded="false"><span id="tl-account-avatar" class="tl-avatar">?</span><span id="tl-account-trigger-name" class="tl-trigger-text">Account</span></button><div id="tl-account-dropdown" hidden><div id="tl-account-summary"></div><div id="tl-account-methods"></div><div class="tl-account-section"><div class="tl-account-heading">Cloud storage</div><div id="tl-account-cloud-slot"></div></div><div id="tl-account-bottom"></div><div id="tl-account-message" role="status" aria-live="polite"></div></div>';
actions.appendChild(root);
const $=id=>document.getElementById(id);
let busy=false;
const api=()=>window.ThreadlineCloud||null;
const currentUser=()=>api()?.getUser?.()||null;
function message(value,isError=false){
  const node=$('tl-account-message');
  node.className=value?'tl-account-status'+(isError?' error':''):'';
  node.textContent=value;
}
function openMenu(open){
  $('tl-account-dropdown').hidden=!open;
  $('tl-account-button').setAttribute('aria-expanded',String(open));
  if(open)void updateMenu();
}
function providerText(provider){return provider==='github'?'GitHub':provider==='google'?'Google':String(provider).replace(/\b\w/g,c=>c.toUpperCase())}
async function identityList(){
  const user=currentUser();
  const el=$('tl-account-methods');
  if(!user){el.innerHTML='';return;}
  const client=api()?.getClient?.();
  if(!client){el.innerHTML='<div class="tl-account-text">Sign-in connection unavailable.</div>';return;}
  let identities=user.identities||[];
  try{
    const r=await client.auth.getUserIdentities();
    if(!r.error&&Array.isArray(r.data?.identities))identities=r.data.identities;
  }catch(e){/* use cached identities */}
  if(currentUser()?.id!==user.id)return;
  const connected=new Set(identities.map(x=>x.provider));
  el.innerHTML='<div class="tl-account-section"><div class="tl-account-heading">Sign-in methods</div>'+
    ['github','google'].map(provider=>connected.has(provider)
      ? '<div class="tl-account-action" style="cursor:default"><span>'+providerText(provider)+'</span><span class="tl-account-connected">Connected ✓</span></div>'
      : '<button class="tl-account-action" data-tl-link="'+provider+'" type="button"><span>Connect '+providerText(provider)+'</span><span>↗</span></button>').join('')+
    '<div class="tl-account-text">Connecting a login method while signed in keeps your wardrobe under the same account.</div></div>';
}
async function updateMenu(){
  const user=currentUser();
  const logged=!!user;
  $('tl-account-avatar').className='tl-avatar'+(logged?' signed':'');
  const label=String(user?.user_metadata?.full_name||user?.user_metadata?.name||user?.user_metadata?.user_name||'').trim();
  $('tl-account-avatar').textContent=logged?(label?label[0].toUpperCase():'✓'):'◌';
  $('tl-account-trigger-name').textContent=logged?'My account':'Sign in';
  const name=label||user?.email?.split('@')[0]||'Your account';
  $('tl-account-summary').innerHTML=logged
    ? '<div class="tl-account-title">Hello, '+escapeText(name)+'</div><div class="tl-account-sub">'+escapeText(user.email||'Account connected')+'</div>'
    : '<div class="tl-account-title">Your style, your way.</div><div class="tl-account-sub">Browsing as guest · saved only in this browser</div>';
  const cloudSlot=$('tl-account-cloud-slot');
  if(!logged){
    $('tl-account-methods').innerHTML='';
    $('tl-account-bottom').innerHTML='<div class="tl-account-section"><a class="tl-account-action primary" href="./auth.html">Sign in or create an account <span>→</span></a><p class="tl-account-text">You can explore looks without signing in. Your guest items are saved locally, not synced.</p></div>';
    if(!cloudSlot.querySelector('#threadline-cloud'))cloudSlot.innerHTML='<p class="tl-account-text">Sign in to back up and sync your wardrobe between devices.</p>';
  }else{
    $('tl-account-bottom').innerHTML='<div class="tl-account-section"><button class="tl-account-action" type="button" data-tl-action="profile">View my style profile <span>→</span></button><button class="tl-account-action" type="button" data-tl-action="logout">Sign out <span>↗</span></button><p class="tl-account-text">Signing out clears this device’s synced wardrobe cache, while your cloud backup remains in Supabase.</p></div>';
    void identityList();
  }
}
$('tl-account-button').addEventListener('click',()=>openMenu($('tl-account-dropdown').hidden));
root.addEventListener('click',async event=>{
  const link=event.target.closest('[data-tl-link]')?.dataset.tlLink;
  const action=event.target.closest('[data-tl-action]')?.dataset.tlAction;
  if(link){
    if(busy)return;
    const client=api()?.getClient?.();
    if(!client||!currentUser()){message('Please sign in before linking another login method.',true);return;}
    busy=true;message('Connecting '+providerText(link)+'…');
    try{
      const {error}=await client.auth.linkIdentity({provider:link,options:{redirectTo:location.origin+location.pathname}});
      if(error)throw error;
      message('Complete the authorization in the provider window.');
    }catch(e){message('Could not connect '+providerText(link)+': '+(e.message||e),true);}
    finally{busy=false;}
  }
  if(action==='profile'){
    const button=document.querySelector('[data-nav="profile"]');
    if(button)button.click();openMenu(false);
  }
  if(action==='logout'){
    const button=document.querySelector('#threadline-cloud [data-cloud="logout"]');
    if(button){button.click();openMenu(false);}else message('Cloud controls are still loading. Try again.',true);
  }
});
document.addEventListener('click',e=>{if(!root.contains(e.target))openMenu(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')openMenu(false);});
window.addEventListener('threadline-cloud-updated',()=>{if(!$('tl-account-dropdown').hidden)void updateMenu();else{
  const u=currentUser();$('tl-account-trigger-name').textContent=u?'My account':'Sign in';
  $('tl-account-avatar').className='tl-avatar'+(u?' signed':'');
  const name=u?.user_metadata?.full_name||u?.user_metadata?.user_name||'';
  $('tl-account-avatar').textContent=u?(name?name[0].toUpperCase():'✓'):'◌';
}});
void updateMenu();
})();