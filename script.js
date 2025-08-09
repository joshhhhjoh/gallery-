/* J//Gallery v3 — IndexedDB for large galleries */
(() => {
  // --- IndexedDB helpers ---
  const DB_NAME = 'josh_gallery_v3';
  const DB_VERSION = 1;
  const STORE_ITEMS = 'items';
  const STORE_META = 'meta';
  let db;

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)){
          const s = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
          s.createIndex('order', 'order', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)){
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function tx(storeName, mode, fn){
    if (!db) db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      const res = fn(store);
      t.oncomplete = () => resolve(res);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const putItem = (item) => tx(STORE_ITEMS, 'readwrite', s => s.put(item));
  const deleteItem = (id) => tx(STORE_ITEMS, 'readwrite', s => s.delete(id));
  const clearItems = () => tx(STORE_ITEMS, 'readwrite', s => s.clear());
  const listItems = () => tx(STORE_ITEMS, 'readonly', s => {
    return new Promise((resolve, reject) => {
      const arr = [];
      const idx = s.index('order');
      const req = idx.openCursor();
      req.onsuccess = e => {
        const cur = e.target.result;
        if (cur){ arr.push(cur.value); cur.continue(); }
        else resolve(arr);
      };
      req.onerror = () => reject(req.error);
    });
  });
  const setMeta = (key, value) => tx(STORE_META, 'readwrite', s => s.put({ key, value }));
  const getMeta = (key) => tx(STORE_META, 'readonly', s => new Promise((res, rej) => {
    const r = s.get(key); r.onsuccess = () => res(r.result?.value); r.onerror = () => rej(r.error);
  }));

  // --- UI refs ---
  const grid = document.getElementById('grid');
  const tmpl = document.getElementById('cardTemplate');
  const uploadPhotos = document.getElementById('uploadPhotos');
  const uploadCamera = document.getElementById('uploadCamera');
  const importJson = document.getElementById('importJson');
  const count = document.getElementById('count');
  const search = document.getElementById('search');
  const exportBtn = document.getElementById('exportJson');
  const newBtn = document.getElementById('newGallery');
  const addUrl = document.getElementById('addUrl');
  const galleryTitle = document.getElementById('galleryTitle');
  const saveTitle = document.getElementById('saveTitle');

  // --- Init ---
  let items = [];
  init();
  async function init(){
    db = await openDB();
    const title = await getMeta('title');
    galleryTitle.value = title || 'J//Gallery v3';
    items = await listItems();
    if (!items.length){
      // Seed demo items (external URLs only, not blobs) just to show layout
      await addFromURL("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=60","City Night","Demo image. Replace me.",["city","night"]);
      await addFromURL("https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=60","Portrait","Demo image. Replace me.",["portrait"]);
      items = await listItems();
    }
    render();
  }

  // --- Bindings ---
  bindPicker(uploadPhotos, false);
  bindPicker(uploadCamera, false); // camera capture is in HTML

  importJson.addEventListener('change', async e => {
    try{
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const obj = JSON.parse(text);
      if (!Array.isArray(obj.items)) throw new Error('Invalid JSON: expected { items: [] }');
      // Clear and import
      await clearItems();
      let order = 0;
      for (const it of obj.items){
        const id = it.id || crypto.randomUUID();
        const title = it.title || '';
        const desc = it.desc || '';
        const tags = Array.isArray(it.tags) ? it.tags : [];
        let blob;
        if (it.src && it.src.startsWith('data:')){
          blob = dataURLToBlob(it.src);
        } else if (it.src){
          // fetch remote to blob (best effort)
          try{ blob = await fetch(it.src).then(r => r.blob()); } catch{ blob = new Blob() }
        } else {
          blob = new Blob();
        }
        await putItem({ id, order: order++, title, desc, tags, blobType: blob.type, blob });
      }
      items = await listItems();
      render();
      toast('Imported');
      e.target.value = "";
    }catch(err){
      alert('Import failed: ' + err.message);
    }
  });

  exportBtn.addEventListener('click', async () => {
    // Build JSON with data URLs so it’s portable
    const out = { title: galleryTitle.value, items: [] };
    for (const it of items){
      const dataURL = await blobToDataURL(it.blob);
      out.items.push({ id: it.id, title: it.title, desc: it.desc, tags: it.tags, src: dataURL });
    }
    const text = JSON.stringify(out, null, 2);
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = (out.title || 'gallery') + '.json';
    a.click();
  });

  newBtn.addEventListener('click', async () => {
    if(!confirm("Start a new, empty gallery? You can re-import JSON later.")) return;
    await clearItems();
    items = await listItems();
    render();
  });

  addUrl.addEventListener('click', async () => {
    const url = prompt('Paste image URL');
    if (!url) return;
    await addFromURL(url.trim(), '', '', []);
    items = await listItems(); render();
  });

  saveTitle.addEventListener('click', async () => {
    await setMeta('title', galleryTitle.value || 'J//Gallery v3');
    toast('Title saved');
  });

  search.addEventListener('input', render);

  function bindPicker(input){
    if (!input) return;
    input.addEventListener('change', async e => {
      const files = [...(e.target.files || [])];
      let maxOrder = items.reduce((m, it) => Math.max(m, it.order || 0), 0);
      for (const file of files) {
        const id = crypto.randomUUID();
        const blob = file;
        await putItem({ id, order: ++maxOrder, title: file.name.replace(/\\.[^.]+$/, ''), desc: '', tags: [], blobType: blob.type, blob });
      }
      items = await listItems(); render();
      input.value = "";
    });
  }

  async function addFromURL(url, title='', desc='', tags=[]){
    let blob;
    try{
      blob = await fetch(url, { mode: 'cors' }).then(r => r.blob());
    }catch{
      blob = new Blob(); // fallback
    }
    const order = (items.reduce((m, it) => Math.max(m, it.order||0), 0) || 0) + 1;
    await putItem({ id: crypto.randomUUID(), order, title, desc, tags, blobType: blob.type, blob });
  }

  // --- Render ---
  async function render(){
    const q = search.value.trim().toLowerCase();
    const filtered = q ? items.filter(it => match(it, q)) : items;
    grid.innerHTML = '';
    for (const it of filtered){
      const node = tmpl.content.firstElementChild.cloneNode(true);
      const img = node.querySelector('.thumb');
      const t = node.querySelector('.title');
      const d = node.querySelector('.desc');
      const g = node.querySelector('.tags');
      const up = node.querySelector('.up');
      const down = node.querySelector('.down');
      const rm = node.querySelector('.remove');
      const rp = node.querySelector('.replace');

      img.src = URL.createObjectURL(it.blob);
      img.onload = () => URL.revokeObjectURL(img.src);

      t.value = it.title || '';
      d.value = it.desc || '';
      g.value = (it.tags || []).join(', ');

      t.oninput = async () => { it.title = t.value; await putItem(it); };
      d.oninput = async () => { it.desc = d.value; await putItem(it); };
      g.oninput = async () => { it.tags = splitTags(g.value); await putItem(it); };

      up.onclick = async () => { await move(it.id, -1); };
      down.onclick = async () => { await move(it.id, +1); };
      rm.onclick = async () => {
        if (!confirm('Remove this image?')) return;
        await deleteItem(it.id);
        items = await listItems(); render();
      };
      rp.onclick = () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async e => {
          const f = e.target.files?.[0]; if (!f) return;
          it.blob = f; it.blobType = f.type; await putItem(it);
          items = await listItems(); render();
        };
        inp.click();
      };

      grid.appendChild(node);
    }
    count.textContent = `${filtered.length} / ${items.length}`;
  }

  function splitTags(str){ return str.split(',').map(s => s.trim()).filter(Boolean); }
  function match(it, q){
    const hay = [it.title||'', it.desc||'', ...(it.tags||[])].join(' ').toLowerCase();
    return hay.includes(q);
  }

  async function move(id, delta){
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    const target = Math.max(0, Math.min(items.length - 1, idx + delta));
    if (target === idx) return;
    // swap order
    const a = items[idx], b = items[target];
    const tmp = a.order; a.order = b.order; b.order = tmp;
    await putItem(a); await putItem(b);
    items = await listItems(); render();
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

  // crypto.randomUUID polyfill
  if (!('crypto' in window) || !('randomUUID' in crypto)) {
    window.crypto = window.crypto || {};
    crypto.randomUUID = function() {
      const s = [], hex = '0123456789abcdef';
      for (let i=0;i<36;i++) s[i] = hex[Math.floor(Math.random()*16)];
      s[14] = '4';
      s[19] = hex[(parseInt(s[19],16)&0x3)|0x8];
      s[8]=s[13]=s[18]=s[23]='-';
      return s.join('');
    };
  }

  // Toast
  function toast(msg){
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.position='fixed'; el.style.bottom='24px'; el.style.right='16px';
    el.style.padding='12px 14px'; el.style.border='1px solid #2a2a2a';
    el.style.background='#141414'; el.style.borderRadius='12px'; el.style.color='#fff';
    el.style.opacity='0'; el.style.transition='opacity .2s, transform .2s'; el.style.transform='translateY(6px)';
    el.style.zIndex='5';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{el.style.opacity='1'; el.style.transform='translateY(0)'});
    setTimeout(()=>{el.style.opacity='0'; el.style.transform='translateY(6px)'; setTimeout(()=>el.remove(),200)},1400);
  }
})();