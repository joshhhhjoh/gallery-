/* J//Gallery v3.3 — Offline stable. IndexedDB only. No network. */
(() => {
  // Logger
  const logBox = document.getElementById('log');
  const log = (...a) => { const d = document.createElement('div'); d.textContent = a.map(String).join(' '); logBox.appendChild(d); logBox.scrollTop = logBox.scrollHeight; };
  document.getElementById('toggleLog').onclick = () => logBox.classList.toggle('show');
  window.addEventListener('error', e => log('Error:', e.message || e.error));

  // DB
  const DB = 'jg_v3_3_offline'; const VER = 1;
  let db;
  openDB().then(() => log('DB ready')).catch(e => log('DB fail', e));
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
  const put = it => tx('items','readwrite', s => s.put(it));
  const del = id => tx('items','readwrite', s => s.delete(id));
  const clearAll = () => tx('items','readwrite', s => s.clear());
  const all = () => tx('items','readonly', s => new Promise((res, rej) => {
    const arr = []; const r = s.openCursor();
    r.onsuccess = e => { const c = e.target.result; if (c){ arr.push(c.value); c.continue(); } else res(arr); };
    r.onerror = () => rej(r.error);
  }));
  const setMeta = (k,v)=>tx('meta','readwrite', s=>s.put({key:k,value:v}));
  const getMeta = (k)=>tx('meta','readonly', s=>new Promise((res,rej)=>{ const r=s.get(k); r.onsuccess=()=>res(r.result?.value); r.onerror=()=>rej(r.error);}));

  // UI
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

  // State
  let items = [];

  init();
  async function init(){
    try{
      galleryTitle.value = await getMeta('title') || 'J//Gallery';
      items = await all();
      render();
    }catch(e){ log('Init error', e); }
  }

  // Events
  upPhotos.onchange = e => addFiles(e.target.files);
  upCam.onchange = e => addFiles(e.target.files);
  exportBtn.onclick = doExport;
  importJson.onchange = doImport;
  newBtn.onclick = async () => {
    if (!confirm('Start a new, empty gallery?')) return;
    await clearAll(); items = []; render();
  };
  search.oninput = render;
  galleryTitle.oninput = () => setMeta('title', galleryTitle.value);

  async function addFiles(fileList){
    const files = [...(fileList||[])];
    let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
    for (const f of files){
      const { full, thumb } = await compressBoth(f, 2200, 0.85, 800, 0.82);
      const it = { id: crypto.randomUUID(), order: ++order, title: f.name.replace(/\.[^.]+$/, ''), desc:'', tags:[], blobType:full.type, blob:full, thumbType:thumb.type, thumb };
      await put(it); items.push(it);
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

      t.oninput = async () => { it.title = t.value; await put(it); };
      d.oninput = async () => { it.desc = d.value; await put(it); };
      g.oninput = async () => { it.tags = g.value.split(',').map(s=>s.trim()).filter(Boolean); await put(it); };

      up.onclick = async () => { it.order = Math.max(0,(it.order||0)-1); await put(it); items = await all(); render(); };
      down.onclick = async () => { it.order = (it.order||0)+1; await put(it); items = await all(); render(); };
      rm.onclick = async () => { if (!confirm('Remove this image?')) return; await del(it.id); items = items.filter(x=>x.id!==it.id); render(); };
      rp.onclick = () => {
        const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
        inp.onchange = async ev => {
          const f = ev.target.files?.[0]; if (!f) return;
          const { full, thumb } = await compressBoth(f, 2200, 0.85, 800, 0.82);
          it.blob = full; it.blobType = full.type; it.thumb = thumb; it.thumbType = thumb.type;
          await put(it); render();
        };
        inp.click();
      };

      grid.appendChild(node);
    }
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
      await clearAll(); items = [];
      let order = 0;
      for (const it of obj.items){
        const full = it.src && it.src.startsWith('data:') ? dataURLToBlob(it.src) : new Blob();
        const { full:fullC, thumb } = await compressBoth(full, 2200, 0.85, 800, 0.82);
        const rec = { id: it.id || crypto.randomUUID(), order: ++order, title: it.title||'', desc: it.desc||'', tags: Array.isArray(it.tags)?it.tags:[], blobType: fullC.type, blob: fullC, thumbType: thumb.type, thumb };
        await put(rec); items.push(rec);
      }
      render(); e.target.value='';
    }catch(err){ log('Import error', err.message||err); alert('Import failed: '+(err.message||err)); }
  }

  // Image helpers
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
    }catch(e){ log('compress fail', e); return fileOrBlob; }
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
})();