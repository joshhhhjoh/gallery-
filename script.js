/* Dual-save: IndexedDB primary + localStorage fallback + manual Save button */
(() => {
  const logBox = document.getElementById('log');
  const log = (...a) => { const d = document.createElement('div'); d.textContent = a.map(String).join(' '); logBox.appendChild(d); logBox.scrollTop = logBox.scrollHeight; };
  window.addEventListener('error', e => log('Error:', e.message || e.error));

  const saveStatus = document.getElementById('saveStatus');
  const isPrivate = (() => { try { return window.navigator && (window.safari && window.safari.privateBrowsing); } catch { return false; } })();

  // Storage backends
  const Backend = {
    idb: 'IndexedDB',
    ls: 'localStorage'
  };
  let backend = Backend.idb;

  // DB (IndexedDB)
  const DB = 'jg_v3_3_1'; const VER = 1;
  let db;
  function openDB(){
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => { db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  }
  function tx(name, mode, fn){
    return new Promise((res, rej) => {
      const t = db.transaction(name, mode);
      const s = t.objectStore(name);
      const out = fn(s);
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    });
  }
  const putIDB = it => tx('items','readwrite', s=>s.put(it));
  const delIDB = id => tx('items','readwrite', s=>s.delete(id));
  const clearIDB = () => tx('items','readwrite', s=>s.clear());
  const allIDB = () => tx('items','readonly', s=>new Promise((res,rej)=>{ const arr=[]; const r=s.openCursor(); r.onsuccess=e=>{ const c=e.target.result; if(c){ arr.push(c.value); c.continue(); } else res(arr); }; r.onerror=()=>rej(r.error);}));
  const setMetaIDB = (k,v)=>tx('meta','readwrite', s=>s.put({key:k,value:v}));
  const getMetaIDB = (k)=>tx('meta','readonly', s=>new Promise((res,rej)=>{ const r=s.get(k); r.onsuccess=()=>res(r.result?.value); r.onerror=()=>rej(r.error);}));

  // Fallback (localStorage): store JSON with data URLs (heavier, but works when IDB is blocked)
  const LSK = 'JG_V331_SAVE';
  async function saveToLocal(items, title){
    const out = { title, items: [] };
    for (const it of items){
      out.items.push({ id: it.id, order: it.order, title: it.title, desc: it.desc, tags: it.tags, src: await blobToDataURL(it.blob) });
    }
    try{ localStorage.setItem(LSK, JSON.stringify(out)); }catch(e){ log('localStorage save fail', e); }
  }
  function loadFromLocal(){
    try{
      const raw = localStorage.getItem(LSK);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      for (const it of obj.items){
        it.blob = dataURLToBlob(it.src); it.blobType = it.blob.type; delete it.src;
      }
      return obj;
    }catch(e){ log('localStorage parse fail', e); return null; }
  }
  function setBadge(text){ saveStatus.textContent = 'Saving: ' + text; }

  // UI refs
  const grid = document.getElementById('grid');
  const tmpl = document.getElementById('cardTemplate');
  const galleryTitle = document.getElementById('galleryTitle');
  const count = document.getElementById('count');
  const search = document.getElementById('search');
  const upPhotos = document.getElementById('uploadPhotos');
  const upCam = document.getElementById('uploadCamera');
  const importJson = document.getElementById('importJson');
  const exportBtn = document.getElementById('exportJson');
  const newBtn = document.getElementById('newGallery');
  const saveNow = document.getElementById('saveNow');

  // State
  let items = [];

  init();

  async function init(){
    // Try IndexedDB first
    try{
      await openDB();
      backend = Backend.idb;
      setBadge('IndexedDB');
      // Load from IDB, or fallback to localStorage copy if empty
      const t = await getMetaIDB('title');
      galleryTitle.value = t || 'J//Gallery';
      items = await allIDB();
      if (!items.length){
        const ls = loadFromLocal();
        if (ls){
          galleryTitle.value = ls.title || 'J//Gallery';
          items = [];
          let order = 0;
          for (const it of ls.items){
            const rec = { id: it.id || crypto.randomUUID(), order: ++order, title: it.title||'', desc: it.desc||'', tags: Array.isArray(it.tags)?it.tags:[], blobType: it.blob.type, blob: it.blob };
            await putIDB(rec); items.push(rec);
          }
          await setMetaIDB('title', galleryTitle.value);
        }
      }
      render();
    }catch(err){
      log('IndexedDB unavailable, falling back to localStorage', err);
      backend = Backend.ls;
      setBadge('localStorage');
      const ls = loadFromLocal() || { title: 'J//Gallery', items: [] };
      galleryTitle.value = ls.title;
      items = ls.items || [];
      render();
    }
  }

  // Events
  upPhotos.onchange = e => addFiles(e.target.files);
  upCam.onchange = e => addFiles(e.target.files);
  exportBtn.onclick = doExport;
  importJson.onchange = doImport;
  newBtn.onclick = async () => {
    if (!confirm('Start a new, empty gallery?')) return;
    if (backend === Backend.idb){ await clearIDB(); }
    items = []; await autosave();
    render();
  };
  search.oninput = render;
  galleryTitle.oninput = async () => { if (backend === Backend.idb) await setMetaIDB('title', galleryTitle.value); await autosave(); };
  saveNow.onclick = async () => { await autosave(true); toast('Saved'); };

  async function addFiles(fileList){
    const files = [...(fileList||[])];
    let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
    for (const f of files){
      const { full, thumb } = await compressBoth(f, 2200, 0.85, 800, 0.82);
      const it = { id: crypto.randomUUID(), order: ++order, title: f.name.replace(/\\.[^.]+$/, ''), desc:'', tags:[], blobType:full.type, blob:full, thumbType:thumb.type, thumb };
      items.push(it);
      if (backend === Backend.idb) await putIDB(it);
      await autosave();
    }
    render();
  }

  function render(){
    const q = (search.value || '').toLowerCase();
    const src = q ? items.filter(it => (it.title + it.desc + (it.tags||[]).join(' ')).toLowerCase().includes(q)) : items.slice();
    src.sort((a,b) => (a.order||0)-(b.order||0));
    count.textContent = src.length + ' / ' + items.length;
    grid.innerHTML = '';
    for (const it of src){
      const node = tmpl.content.firstElementChild.cloneNode(true);
      const img = node.querySelector('.thumb');
      const t = node.querySelector('.title');
      const d = node.querySelector('.desc');
      const g = node.querySelector('.tags');
      const up = node.querySelector('.up');
      const down = node.querySelector('.down');
      const rm = node.querySelector('.remove');
      const rp = node.querySelector('.replace');

      try {
        const url = URL.createObjectURL(it.thumb || it.blob);
        img.src = url;
        img.onload = () => { try{ URL.revokeObjectURL(url); }catch{} };
      } catch(e){ log('img set fail', e); }

      t.value = it.title || '';
      d.value = it.desc || '';
      g.value = (it.tags || []).join(', ');

      t.oninput = async () => { it.title = t.value; await dirty(it); };
      d.oninput = async () => { it.desc = d.value; await dirty(it); };
      g.oninput = async () => { it.tags = g.value.split(',').map(s=>s.trim()).filter(Boolean); await dirty(it); };

      up.onclick = async () => { it.order = Math.max(0,(it.order||0)-1); await dirty(it,true); };
      down.onclick = async () => { it.order = (it.order||0)+1; await dirty(it,true); };
      rm.onclick = async () => { if (!confirm('Remove this image?')) return; if (backend===Backend.idb) await delIDB(it.id); items = items.filter(x=>x.id!==it.id); await autosave(); render(); };
      rp.onclick = () => {
        const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
        inp.onchange = async ev => {
          const f = ev.target.files?.[0]; if (!f) return;
          const { full, thumb } = await compressBoth(f, 2200, 0.85, 800, 0.82);
          it.blob = full; it.blobType = full.type; it.thumb = thumb; it.thumbType = thumb.type;
          await dirty(it);
        };
        inp.click();
      };

      grid.appendChild(node);
    }
  }

  async function dirty(it, rerender=false){
    if (backend === Backend.idb) await putIDB(it);
    await autosave();
    if (rerender){ items = backend===Backend.idb ? await allIDB() : items.slice().sort((a,b)=>(a.order||0)-(b.order||0)); render(); }
  }

  let saveT = null;
  async function autosave(force=false){
    clearTimeout(saveT);
    const run = async () => {
      if (backend === Backend.ls){
        await saveToLocal(items, galleryTitle.value || 'J//Gallery');
      } else {
        // keep a localStorage backup too (belt & suspenders)
        try{ await saveToLocal(items, galleryTitle.value || 'J//Gallery'); }catch{}
      }
    };
    if (force) return run();
    saveT = setTimeout(run, 250);
  }

  async function doExport(){
    const out = { title: galleryTitle.value, items: [] };
    for (const it of items){
      const dataURL = await blobToDataURL(it.blob);
      out.items.push({ id: it.id, title: it.title, desc: it.desc, tags: it.tags, src: dataURL });
    }
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(out, null, 2));
    a.download = (out.title || 'gallery') + '.json';
    a.click();
  }

  async function doImport(e){
    try{
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text(); const obj = JSON.parse(text);
      if (!Array.isArray(obj.items)) throw new Error('Invalid JSON');
      if (backend === Backend.idb) await clearIDB();
      items = [];
      let order = 0;
      for (const it of obj.items){
        const full = it.src && it.src.startsWith('data:') ? dataURLToBlob(it.src) : new Blob();
        const { full:fullC, thumb } = await compressBoth(full, 2200, 0.85, 800, 0.82);
        const rec = { id: it.id || crypto.randomUUID(), order: ++order, title: it.title||'', desc: it.desc||'', tags: Array.isArray(it.tags)?it.tags:[], blobType: fullC.type, blob: fullC, thumbType: thumb.type, thumb };
        if (backend === Backend.idb) await putIDB(rec);
        items.push(rec);
      }
      await autosave(true);
      render(); e.target.value='';
    }catch(err){ alert('Import failed: ' + (err.message||err)); }
  }

  // Image utils
  async function compressBoth(fileOrBlob, fullMax, fullQ, thumbMax, thumbQ){
    const full = await compressImage(fileOrBlob, fullMax, fullQ);
    const thumb = await compressImage(fileOrBlob, thumbMax, thumbQ);
    return { full, thumb };
  }
  function drawToCanvas(img, maxSize){
    const w = img.naturalWidth||img.width, h = img.naturalHeight||img.height;
    const scale = Math.min(1, maxSize / Math.max(w,h));
    const cw = Math.max(1, Math.round(w*scale)), ch = Math.max(1, Math.round(h*scale));
    const c = document.createElement('canvas'); c.width=cw; c.height=ch;
    const ctx = c.getContext('2d', { alpha:false, desynchronized:true });
    ctx.drawImage(img, 0, 0, cw, ch);
    return c;
  }
  async function compressImage(fileOrBlob, maxSize, quality){
    try{
      const img = await blobToImage(fileOrBlob);
      const canvas = drawToCanvas(img, maxSize);
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      return blob || fileOrBlob;
    }catch(e){ return fileOrBlob; }
  }
  function blobToImage(blob){
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => { try{ URL.revokeObjectURL(url); }catch{}; resolve(img); };
      img.onerror = () => resolve(new Image());
      img.src = url;
    });
  }
  function canvasToBlob(canvas, type, quality){
    return new Promise((resolve) => {
      if (canvas.toBlob) canvas.toBlob(b => resolve(b), type, quality);
      else resolve(dataURLToBlob(canvas.toDataURL(type, quality)));
    });
  }
  function blobToDataURL(blob){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(dataURL){
    const [h, b64] = dataURL.split(',');
    const mime = /data:(.*?);base64/.exec(h)?.[1] || 'application/octet-stream';
    const bin = atob(b64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i=0;i<len;i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function toast(msg){
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.position='fixed'; el.style.bottom='24px'; el.style.right='16px';
    el.style.padding='10px 12px'; el.style.border='1px solid #2a2a2a';
    el.style.background='#141414'; el.style.borderRadius='10px'; el.style.color='#fff';
    el.style.opacity='0'; el.style.transition='opacity .2s, transform .2s'; el.style.transform='translateY(6px)';
    el.style.zIndex='60';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{el.style.opacity='1'; el.style.transform='translateY(0)'});
    setTimeout(()=>{el.style.opacity='0'; el.style.transform='translateY(6px)'; setTimeout(()=>el.remove(),200)},1400);
  }
})();