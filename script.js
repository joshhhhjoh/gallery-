/* J//Gallery v3.2 — Crash-safe: compression + thumbs + lazy + virtualized */
(() => {
  const DB_NAME = 'josh_gallery_v3_2';
  const DB_VERSION = 2;
  const STORE_ITEMS = 'items';
  const STORE_META = 'meta';
  let db;

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)){
          const s = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
          s.createIndex('order', 'order', { unique:false });
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

  const grid = document.getElementById('grid');
  const tmpl = document.getElementById('cardTemplate');
  const uploadPhotos = document.getElementById('uploadPhotos');
  const uploadCamera = document.getElementById('uploadCamera');
  const importJson = document.getElementById('importJson');
  const count = document.getElementById('count');
  const search = document.getElementById('search');
  const exportBtn = document.getElementById('exportJson');
  const exportCompactBtn = document.getElementById('exportCompact');
  const newBtn = document.getElementById('newGallery');
  const addUrl = document.getElementById('addUrl');
  const galleryTitle = document.getElementById('galleryTitle');
  const saveTitle = document.getElementById('saveTitle');
  const sentinel = document.getElementById('sentinel');

  let items = [];
  let filtered = [];
  let rendered = 0;
  const BATCH = 24;

  init();
  async function init(){
    db = await openDB();
    const title = await getMeta('title');
    galleryTitle.value = title || 'J//Gallery v3.2';
    items = await listItems();
    if (!items.length){
      await addFromURL("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=60","City Night","Demo image. Replace me.",["city","night"]);
      await addFromURL("https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=60","Portrait","Demo image. Replace me.",["portrait"]);
      items = await listItems();
    }
    applyFilter();
    bindObservers();
  }

  bindPicker(uploadPhotos);
  bindPicker(uploadCamera);

  importJson.addEventListener('change', async e => {
    try{
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const obj = JSON.parse(text);
      if (!Array.isArray(obj.items)) throw new Error('Invalid JSON: expected { items: [] }');
      await clearItems();
      let order = 0;
      for (const it of obj.items){
        const id = it.id || crypto.randomUUID();
        const title = it.title || '';
        const desc = it.desc || '';
        const tags = Array.isArray(it.tags) ? it.tags : [];
        let fullBlob;
        if (it.src && it.src.startsWith('data:')) fullBlob = dataURLToBlob(it.src);
        else if (it.src) { try{ fullBlob = await fetch(it.src).then(r=>r.blob()); } catch{ fullBlob = new Blob(); } }
        else fullBlob = new Blob();
        const { full, thumb } = await compressBoth(fullBlob);
        await putItem({ id, order: order++, title, desc, tags, blobType: full.type, blob: full, thumbType: thumb.type, thumb });
      }
      items = await listItems();
      applyFilter();
      e.target.value = "";
      toast('Imported');
    }catch(err){
      alert('Import failed: ' + err.message);
    }
  });

  exportBtn.addEventListener('click', async () => {
    const out = { title: galleryTitle.value, items: [] };
    for (const it of filtered){
      const dataURL = await blobToDataURL(it.blob);
      out.items.push({ id: it.id, title: it.title, desc: it.desc, tags: it.tags, src: dataURL });
    }
    downloadJSON(out, (out.title || 'gallery') + '.json');
  });

  exportCompactBtn.addEventListener('click', async () => {
    const out = { title: galleryTitle.value + ' (compact)', items: [] };
    for (const it of filtered){
      const dataURL = await blobToDataURL(it.thumb || it.blob);
      out.items.push({ id: it.id, title: it.title, desc: it.desc, tags: it.tags, src: dataURL });
    }
    downloadJSON(out, (galleryTitle.value || 'gallery') + '_compact.json');
  });

  newBtn.addEventListener('click', async () => {
    if(!confirm("Start a new, empty gallery? You can re-import JSON later.")) return;
    await clearItems();
    items = await listItems();
    applyFilter();
  });

  addUrl.addEventListener('click', async () => {
    const url = prompt('Paste image URL');
    if (!url) return;
    await addFromURL(url.trim(), '', '', []);
    items = await listItems(); applyFilter();
  });

  saveTitle.addEventListener('click', async () => {
    await setMeta('title', galleryTitle.value || 'J//Gallery v3.2');
    toast('Title saved');
  });

  search.addEventListener('input', applyFilter);

  document.getElementById('retrofitThumbs').addEventListener('click', async () => {
    let i = 0;
    for (const it of items){
      if (!it.thumb){
        const { thumb, full } = await compressBoth(it.blob);
        if (full.size < it.blob.size * 0.98) it.blob = full, it.blobType = full.type;
        it.thumb = thumb; it.thumbType = thumb.type;
        await putItem(it);
      }
      i++;
      if (i % 10 === 0) await sleep(50);
    }
    items = await listItems(); applyFilter(); toast('Thumbnails created');
  });

  function bindPicker(input){
    if (!input) return;
    input.addEventListener('change', async e => {
      const files = [...(e.target.files || [])];
      let maxOrder = items.reduce((m, it) => Math.max(m, it.order || 0), 0);
      for (const file of files) {
        const id = crypto.randomUUID();
        const { full, thumb } = await compressBoth(file);
        await putItem({ id, order: ++maxOrder, title: file.name.replace(/\\.[^.]+$/, ''), desc: '', tags: [], blobType: full.type, blob: full, thumbType: thumb.type, thumb });
      }
      items = await listItems(); applyFilter();
      input.value = "";
    });
  }

  function applyFilter(){
    const q = (search.value || '').trim().toLowerCase();
    filtered = q ? items.filter(it => match(it, q)) : items.slice();
    rendered = 0;
    grid.innerHTML = '';
    count.textContent = `${filtered.length} / ${items.length}`;
    renderMore();
  }

  function renderMore(){
    const end = Math.min(filtered.length, rendered + BATCH);
    const frag = document.createDocumentFragment();
    for (let i = rendered; i < end; i++){
      const it = filtered[i];
      const node = tmpl.content.firstElementChild.cloneNode(true);
      const img = node.querySelector('.thumb');
      const t = node.querySelector('.title');
      const d = node.querySelector('.desc');
      const g = node.querySelector('.tags');
      const up = node.querySelector('.up');
      const down = node.querySelector('.down');
      const rm = node.querySelector('.remove');
      const rp = node.querySelector('.replace');

      img.dataset.id = it.id;
      img.alt = it.title || 'Image';

      t.value = it.title || '';
      d.value = it.desc || '';
      g.value = (it.tags || []).join(', ');

      t.oninput = async () => { it.title = t.value; await putItem(it); };
      d.oninput = async () => { it.desc = d.value; await putItem(it); };
      g.oninput = async () => { it.tags = splitTags(g.value); await putItem(it); };

      up.onclick = async () => { await move(it.id, -1); };
      down.onclick = async () => { await move(it.id, +1); };
      rm.onclick = async () => { if (!confirm('Remove this image?')) return; await deleteItem(it.id); items = await listItems(); applyFilter(); };
      rp.onclick = () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async e => {
          const f = e.target.files?.[0]; if (!f) return;
          const { full, thumb } = await compressBoth(f);
          it.blob = full; it.blobType = full.type; it.thumb = thumb; it.thumbType = thumb.type;
          await putItem(it);
          const tag = grid.querySelector('img.thumb[data-id="'+it.id+'"]');
          if (tag) { URL.revokeObjectURL(tag.src); tag.src = URL.createObjectURL(thumb); }
        };
        inp.click();
      };

      frag.appendChild(node);
    }
    grid.appendChild(frag);
    rendered = end;
    observeNewImages();
  }

  function bindObservers(){
    const io = new IntersectionObserver((entries) => {
      for (const e of entries){
        if (e.isIntersecting){ renderMore(); }
      }
    }, { rootMargin: '600px' });
    io.observe(document.getElementById('sentinel'));

    window._imgObserver = new IntersectionObserver((entries) => {
      for (const e of entries){
        const img = e.target;
        if (e.isIntersecting){
          const it = filtered.find(x => x.id === img.dataset.id);
          if (!it) continue;
          const blob = it.thumb || it.blob;
          const url = URL.createObjectURL(blob);
          img.src = url;
          img.onload = () => { URL.revokeObjectURL(url); };
          window._imgObserver.unobserve(img);
        }
      }
    }, { rootMargin: '800px' });
  }

  function observeNewImages(){
    const imgs = grid.querySelectorAll('img.thumb:not([data-observed])');
    imgs.forEach(img => { img.dataset.observed = '1'; window._imgObserver.observe(img); });
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
    const a = items[idx], b = items[target];
    const tmp = a.order; a.order = b.order; b.order = tmp;
    await putItem(a); await putItem(b);
    items = await listItems(); applyFilter();
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function downloadJSON(obj, filename){
    const text = JSON.stringify(obj, null, 2);
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    a.click();
  }

  async function compressBoth(fileOrBlob){
    const full = await compressImage(fileOrBlob, 2200, 0.85);
    const thumb = await compressImage(fileOrBlob, 800, 0.82);
    return { full, thumb };
  }

  function drawToCanvas(img, maxSize){
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d', { alpha: false, desynchronized: true });
    ctx.drawImage(img, 0, 0, cw, ch);
    return c;
  }

  async function compressImage(fileOrBlob, maxSize, quality){
    const type = 'image/jpeg';
    const img = await blobToImage(fileOrBlob);
    const canvas = drawToCanvas(img, maxSize);
    const blob = await canvasToBlob(canvas, type, quality);
    return blob || fileOrBlob;
  }

  function blobToImage(blob){
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality){
    return new Promise((resolve) => {
      if (canvas.toBlob){
        canvas.toBlob(b => resolve(b), type, quality);
      }else{
        const dataURL = canvas.toDataURL(type, quality);
        resolve(dataURLToBlob(dataURL));
      }
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

  window.addEventListener('error', (e) => {
    console.warn('Error:', e.error || e.message);
  });
})();