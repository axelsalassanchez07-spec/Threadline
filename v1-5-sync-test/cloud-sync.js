/* THREADLINE cloud sync (opt-in). Browser-only JS, backed by Supabase Auth, Database + private Storage.
 * Frontend contains only public project URL and publishable key. No secrets or privileged credentials.
 * First migration is a deliberate action, never an automatic overwrite.
 */
(() => {
  'use strict';
  const PROJECT_URL = 'https://vkyzbsxabwhplpuctajz.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_aK72PAYSXalQd04SIeGTPw_F2Dqaw5P';
  const BUCKET = 'threadline-images';
  // Isolated cloud test: never write the production user's threadline_state row.
  const LINKED_KEY = 'threadline_v15_sync_linked_user';
  const DIRTY_KEY = 'threadline_v15_sync_dirty';
  const LAST_SYNC_KEY = 'threadline_v15_sync_last';
  const stores = ['items', 'inspos', 'saved', 'feedback', 'prefs'];
  const guard = { client:null, user:null, linked:false, busy:false, applying:false, error:'', status:'Cloud not connected', lastRemote:null, timer:null, job:Promise.resolve(), photoCache:new Map(), revision:0, allowReplaceOnce:false };

  const html = value => String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  // Account UI listens to this event; the cloud engine owns the single Supabase session.
  window.ThreadlineCloud={getClient:()=>guard.client,getUser:()=>guard.user,getStatus:()=>guard.status};
  const status = message => { guard.status = message; showToolbar(); window.dispatchEvent(new Event('threadline-cloud-updated')); };
  const localGet = k => {try{return localStorage.getItem(k)}catch{return null}};
  const localSet = (k,v) => {try{localStorage.setItem(k,v)}catch{}};
  const localDelete = k => {try{localStorage.removeItem(k)}catch{}};
  const syncTime = value => value ? new Date(value).toLocaleString() : 'Not yet synced';
  const isDataImage = value => typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(value);

  function showToolbar(){
    const root = document.getElementById('threadline-cloud');
    if (!root) return;
    if (!guard.client) {
      root.innerHTML = '<div class="tl-cloud-head"><strong>☁ Cloud sync</strong><span>Cloud library unavailable. THREADLINE still works locally.</span></div>';
      return;
    }
    const buttons = !guard.user
      ? '<button class="btn btn-primary btn-small" data-cloud="login">Sign in with GitHub</button>'
      : guard.linked
        ? '<button class="btn btn-ghost btn-small" data-cloud="download">Restore cloud → this device</button><button class="btn btn-ghost btn-small" data-cloud="upload">Replace cloud with this device</button><button class="btn btn-primary btn-small" data-cloud="sync">Sync now</button><button class="btn btn-ghost btn-small" data-cloud="logout">Sign out</button>'
        : '<button class="btn btn-primary btn-small" data-cloud="download">Use saved cloud data</button><button class="btn btn-ghost btn-small" data-cloud="upload">Use this browser’s data</button><button class="btn btn-ghost btn-small" data-cloud="logout">Sign out</button>';
    const current = guard.user ? `Signed in · ${html(guard.user.email || guard.user.user_metadata?.user_name || 'GitHub account')}` : 'Not signed in · local data only';
    root.innerHTML = `<div class="tl-cloud-head"><div><strong>☁ Cloud sync</strong><div class="tl-cloud-sub">${current} · ${html(guard.status)}</div>${guard.linked?`<div class="tl-cloud-sub">Last successful sync: ${html(syncTime(localGet(LAST_SYNC_KEY)))}</div>`:''}${guard.error?`<div class="tl-cloud-error">${html(guard.error)}</div>`:''}</div><div class="tl-cloud-actions">${buttons}</div></div>`;
    root.querySelectorAll('button').forEach(button => button.disabled = guard.busy);
  }

  function markDirty(){
    if (guard.applying || !guard.user || !guard.linked) return;
    guard.revision++;
    localSet(DIRTY_KEY,'1');
    status('Changes not yet synced');
    clearTimeout(guard.timer);
    guard.timer = setTimeout(() => { void scheduleUpload(); }, 1100);
  }
  function installWriteHooks(){
    const originalWrite = write, originalDrop = drop, originalReset = resetStore, originalShopStore = shopStore;
    write = async (...args) => {let result = await originalWrite(...args); markDirty(); return result;};
    drop = async (...args) => {let result = await originalDrop(...args); markDirty(); return result;};
    resetStore = async (...args) => {let result = await originalReset(...args); markDirty(); return result;};
    shopStore = (...args) => {let result = originalShopStore(...args); markDirty(); return result;};
    return {originalWrite,originalDrop,originalReset,originalShopStore};
  }
  let hooks;
  function storedSnapshot(){
    return {
      schemaVersion:1,
      items:state.items.filter(x=>!x.demo).map(x=>({...x})),
      inspos:state.inspos.map(x=>({...x})),
      saved:state.saved.map(x=>({...x})),
      feedback:state.feedback.map(x=>({...x})),
      prefs:{...state.prefs},
      shoppingV11:{swaps:{...shopState.swaps},ownedProductIds:[...shopState.ownedProductIds],saved:[...shopState.saved],budget:shopState.budget,inspirationId:shopState.inspirationId,ratings:[...shopState.ratings],selected:shopState.selected,customLook:shopState.customLook||null,recent:[...(shopState.recent||[])],generation:shopState.generation||0}
    };
  }
  async function turnPhotoIntoPath(obj, group){
    const row = {...obj};
    if (isDataImage(row.image)){
      const dataUrl = row.image;
      const blob = await (await fetch(dataUrl)).blob();
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const hex = [...new Uint8Array(digest)].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('');
      const mime = ['image/jpeg','image/png','image/webp'].includes(blob.type) ? blob.type : 'image/jpeg';
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const name = `${guard.user.id}/v15-test/${group}/${encodeURIComponent(String(row.id))}-${hex}.${ext}`;
      if (!guard.photoCache.has(name)){
        const {error} = await guard.client.storage.from(BUCKET).upload(name, blob, {contentType:mime,upsert:true});
        if (error) throw new Error(`Photo upload failed (${group}): ${error.message}`);
        guard.photoCache.set(name,true);
      }
      row.cloudImagePath = name;
    }
    // Never put private signed URLs or base64 photo data in the JSON database record.
    row.image = '';
    return row;
  }
  async function makeCloudData(){
    // Re-read persisted changes; don't race the caller's refresh() after form submission.
    await refresh();
    const snapshot = storedSnapshot();
    snapshot.items = await Promise.all(snapshot.items.map(x=>turnPhotoIntoPath(x,'wardrobe')));
    snapshot.inspos = await Promise.all(snapshot.inspos.map(x=>turnPhotoIntoPath(x,'inspiration')));
    return snapshot;
  }
  async function doUpload(){
    if (!guard.user || !guard.linked || guard.applying) return;
    guard.busy = true; guard.error=''; status('Uploading changes…');
    try {
      const before = guard.revision;
      const data = await makeCloudData();
      // Prevent an out-of-date browser from silently replacing a newer cloud snapshot.
      const remote = await fetchCloud();
      if (remote?.updated_at && !guard.allowReplaceOnce && (!guard.lastRemote || new Date(remote.updated_at).getTime() > new Date(guard.lastRemote).getTime() + 1000)) {
        throw new Error('Newer cloud data exists. Use Restore cloud → this device or explicitly choose Replace cloud with this device.');
      }
      const updatedAt = new Date().toISOString();
      const result = await guard.client.from('threadline_v15_test_state').upsert({user_id:guard.user.id,data,updated_at:updatedAt},{onConflict:'user_id'});
      if (result.error) throw result.error;
      guard.lastRemote = updatedAt;
      if (guard.revision === before) localDelete(DIRTY_KEY);
      else { localSet(DIRTY_KEY,'1'); clearTimeout(guard.timer); guard.timer=setTimeout(()=>{void scheduleUpload()},1500); }
      localSet(LAST_SYNC_KEY,updatedAt);
      status('Synced across your devices');
    } catch (e){
      guard.error = e.message || String(e);
      localSet(DIRTY_KEY,'1');
      status('Could not sync · data remains in this browser');
    } finally {guard.allowReplaceOnce=false;guard.busy=false;showToolbar();}
  }
  function scheduleUpload(){
    // Serialize uploads: one record per user, never let an earlier save finish after a newer one.
    guard.job = guard.job.then(doUpload, doUpload);
    return guard.job;
  }
  async function fetchCloud(){
    const {data,error} = await guard.client.from('threadline_v15_test_state').select('data,updated_at').eq('user_id',guard.user.id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function hydrateRow(row){
    const copy = {...row};
    if (copy.cloudImagePath){
      const {data,error}=await guard.client.storage.from(BUCKET).createSignedUrl(copy.cloudImagePath, 60*60*24*7);
      if (error) throw new Error(`Photo access failed: ${error.message}`);
      copy.image = data.signedUrl;
    }
    return copy;
  }
  async function doDownload(){
    guard.busy=true;guard.applying=true;guard.error='';status('Restoring cloud backup…');
    try{
      const row = await fetchCloud();
      if (!row?.data || !Array.isArray(row.data.items)) throw new Error('No cloud wardrobe found. Choose “Use this browser’s data” to create your first backup.');
      const data = row.data;
      const items = await Promise.all(data.items.map(hydrateRow));
      const inspos = await Promise.all((data.inspos||[]).map(hydrateRow));
      for (const store of stores) await hooks.originalReset(store);
      for (const [store,rows] of [['items',items],['inspos',inspos],['saved',data.saved||[]],['feedback',data.feedback||[]]]){
        for (const obj of rows) if(obj && typeof obj.id === 'string') await hooks.originalWrite(store,obj);
      }
      await hooks.originalWrite('prefs',{...defaultPrefs,...(data.prefs||{}),id:'user'});
      const shop = data.shoppingV11 || {};
      shopState.swaps=shop.swaps||{};shopState.ownedProductIds=shop.ownedProductIds||[];
      shopState.saved=shop.saved||[];shopState.ratings=shop.ratings||[];
      shopState.budget=Number.isFinite(shop.budget)?shop.budget:250;
      shopState.inspirationId=shop.inspirationId||'';
      shopState.selected=shop.selected||'utility';
      shopState.customLook=shop.customLook||null;
      if(shopState.selected==='discovery'&&!shopState.customLook)shopState.selected='utility';
      shopState.recent=Array.isArray(shop.recent)?shop.recent:[];
      shopState.generation=Number.isInteger(shop.generation)?shop.generation:0;
      hooks.originalShopStore();
      await refresh(); state.generated=[];
      guard.lastRemote=row.updated_at||null;
      guard.linked=true;localSet(LINKED_KEY,guard.user.id);localDelete(DIRTY_KEY);localSet(LAST_SYNC_KEY,new Date().toISOString());
      status('Cloud wardrobe loaded');render();
    } catch(e){guard.error=e.message||String(e);status('Cloud restore failed · local data unchanged where possible');}
    finally{guard.busy=false;guard.applying=false;showToolbar();}
  }
  let clearingPrivateCache=null;
  async function clearPrivateCache(){
    // Coalesce concurrent SIGNED_OUT events and menu actions into one cleanup.
    // Signed-out browsing must never reveal an authenticated user's cached wardrobe.
    if(clearingPrivateCache)return clearingPrivateCache;
    clearingPrivateCache=(async()=>{
      guard.applying=true;
      try{
        for(const store of stores)await hooks.originalReset(store);
        await hooks.originalWrite('prefs',{...defaultPrefs,id:'user'});
        shopState.swaps={};shopState.ownedProductIds=[];shopState.saved=[];shopState.ratings=[];
        shopState.budget=250;shopState.inspirationId='';shopState.selected='utility';
        shopState.customLook=null;shopState.recent=[];shopState.generation=0;
        hooks.originalShopStore();
        localDelete(LINKED_KEY);localDelete(DIRTY_KEY);localDelete(LAST_SYNC_KEY);
        await refresh();state.generated=[];render();
      }finally{guard.applying=false;}
    })();
    try{await clearingPrivateCache;}finally{clearingPrivateCache=null;}
  }
  async function attachUser(user){
    clearTimeout(guard.timer);
    guard.user=user;
    guard.error='';
    guard.linked=!!user&&localGet(LINKED_KEY)===user.id;
    if (!user){if(localGet(LINKED_KEY))await clearPrivateCache();status('Guest mode — browser-only saving');return;}
    status(guard.linked?'Checking your cloud data…':'Checking for a saved cloud wardrobe…');
    if(!guard.linked){
      try{
        const remote=await fetchCloud();
        guard.lastRemote=remote?.updated_at||null;
        status(remote?.data?'Cloud wardrobe found — use saved cloud data on this device':'No cloud wardrobe yet — upload this browser to start');
      }catch(e){guard.error=e.message||String(e);status('Could not check cloud wardrobe');}
    }
    // On a known device, always fetch the latest cloud data, unless local changes failed to sync.
    if(guard.linked){
      if(localGet(DIRTY_KEY)==='1') {status('Unsynced local changes — choose which version to keep');return;}
      await doDownload();
    }
  }
  async function begin(){
    const root=document.createElement('section');
    root.id='threadline-cloud';root.setAttribute('aria-label','Private cloud synchronization');
    const accountSlot=document.getElementById('tl-account-cloud-slot');
    if(accountSlot){accountSlot.replaceChildren(root)}
    else document.querySelector('.topline')?.insertAdjacentElement('afterend',root);
    if (!window.supabase?.createClient){showToolbar();return;}
    guard.client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    hooks=installWriteHooks();
    showToolbar();
    document.getElementById('threadline-cloud').addEventListener('click',async event=>{
      const name=event.target.closest('[data-cloud]')?.dataset.cloud;
      if(!name||guard.busy)return;
      try{
        if(name==='login'){
          const {error}=await guard.client.auth.signInWithOAuth({provider:'github',options:{redirectTo:location.origin+location.pathname}});
          if(error)throw error;
        }else if(name==='logout'){
          if(localGet(DIRTY_KEY)==='1'){guard.error='You have unsynced local changes. Sync and verify your cloud backup before signing out.';status('Sign-out paused to protect unsaved changes');return;}
          if(!confirm('Sign out and clear synced wardrobe data from this browser? Your cloud backup will stay in Supabase.'))return;
          const {error}=await guard.client.auth.signOut();if(error)throw error;
          await clearPrivateCache();
          await attachUser(null);
        }else if(name==='download'){
          if(!confirm('Replace this browser’s THREADLINE wardrobe, inspiration, saved outfits and preferences with your cloud version? Export a local backup first if needed.'))return;
          await doDownload();
        }else if(name==='upload'){
          if(!confirm('Replace the existing THREADLINE cloud snapshot with the contents of this browser? This may overwrite edits made on another device.'))return;
          guard.linked=true;guard.allowReplaceOnce=true;localSet(LINKED_KEY,guard.user.id);localSet(DIRTY_KEY,'1');
          await scheduleUpload();
        }else if(name==='sync'){
          localSet(DIRTY_KEY,'1');await scheduleUpload();
        }
      }catch(e){guard.error=e.message||String(e);status('Cloud action failed');}
    });
    const {data,error}=await guard.client.auth.getUser();
    if(error){status('Local mode — sign in to sync');return;}
    await attachUser(data?.user||null);
    guard.client.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){void attachUser(null);}
      // OAuth callback reloads the page; getUser above loads an authenticated user on boot.
      if(event==='SIGNED_IN' && !guard.user) setTimeout(()=>{void guard.client.auth.getUser().then(({data})=>attachUser(data?.user||null));},0);
    });
  }
  // Existing inline app script has already started its async init().
  // UI injection doesn't depend on the local DB, but cloud loads wait for init to finish.
  const startup=async()=>{
    for(let i=0;i<80&&!document.getElementById('view')?.innerHTML;i++)await new Promise(r=>setTimeout(r,50));
    await begin();
  };
  void startup().catch(err=>{console.error('THREADLINE cloud initialization:',err);});
})();