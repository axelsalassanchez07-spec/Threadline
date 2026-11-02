/* THREADLINE V1.4 Auth landing — public browser credentials only. */
(() => {
'use strict';
const url='https://vkyzbsxabwhplpuctajz.supabase.co';
const key='sb_publishable_aK72PAYSXalQd04SIeGTPw_F2Dqaw5P';
const $=id=>document.getElementById(id);
const notice=(text,error=false)=>{const el=$('notice');el.textContent=text;el.className=text?'notice'+(error?' error':''):'';};
const appRoot=new URL('./',location.href).href;
if(!window.supabase?.createClient){notice('Sign-in service could not load. Check your internet connection and reload the page.',true);return;}
const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let pending=false;
const pendingState=v=>{pending=v;for(const id of ['google','github'])$(id).disabled=v;document.querySelector('.send').disabled=v;};
async function oauth(provider){
  if(pending)return;
  pendingState(true);notice('');
  try{
    const {error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:appRoot}});
    if(error)throw error;
  }catch(e){notice('Could not start '+provider+' sign-in: '+(e.message||e),true);pendingState(false);}
}
$('google').addEventListener('click',()=>oauth('google'));
$('github').addEventListener('click',()=>oauth('github'));
$('email-form').addEventListener('submit',async e=>{
  e.preventDefault();if(pending)return;
  const email=$('email').value.trim();
  if(!email)return;
  pendingState(true);notice('');
  try{
    const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:appRoot,shouldCreateUser:true}});
    if(error)throw error;
    notice('Check your inbox for a sign-in link. You can return to this tab after opening it.');
  }catch(e){notice('Email sign-in unavailable: '+(e.message||e),true);}finally{pendingState(false);}
});
$('sign-out').addEventListener('click',async()=>{
  if(!confirm('Sign out of this device? Cloud data will remain stored in Supabase.'))return;
  const {error}=await client.auth.signOut();
  if(error){notice(error.message,true);return;}
  $('user-ready').style.display='none';$('sign-in-ui').style.display='block';notice('Signed out.'); 
});
client.auth.getUser().then(({data,error})=>{
  if(error){notice('You can continue with a sign-in method below.');return;}
  if(data?.user){$('sign-in-ui').style.display='none';$('user-ready').style.display='block';}
}).catch(e=>notice('Could not check the sign-in session: '+e.message,true));
})();