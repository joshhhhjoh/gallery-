/* v3.4 Hard Save — localStorage primary + JSON backup on Save */
(() => {
  const LSK = 'J_GALLERY_V34';
  const saveStatus = document.getElementById('saveStatus');
  const logBox = document.getElementById('log');
  const log = (...a) => { const d=document.createElement('div'); d.textContent=a.map(String).join(' '); logBox.appendChild(d); logBox.scrollTop=logBox.scrollHeight; };
  window.addEventListener('error', e => log('Error:', e.message||e.error));

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

  let items = [];

  init();

  function loadLS(){
    try{
      const raw = localStorage.getItem(LSK);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      // rehydrate data URLs to show immediately
      for (const it of obj.items){
        if (it.src && typeof it.src === 'string'){
          it.dataURL = it.src; // keep dataURL form
        }
      }
      return obj;
    }catch(e){ log('parse fail', e); return null; }
  }
  function saveLS(obj){
    try{
      localStorage.setItem(LSK, JSON.stringify(obj));
      saveStatus.textContent = 'Saved locally';
    }catch(e){
      saveStatus.textContent = 'Save failed (storage full?)';
      log('localStorage save error', e);
    }
  }

  async function init(){
    const obj = loadLS();
    if (obj){
      galleryTitle.value = obj.title || 'J Gallery';
      items = obj.items || [];
    } else {
      galleryTitle.value = 'J Gallery';
      items = [];
    }
    render();
  }

  // Events
  upPhotos.onchange = e => addFiles(e.target.files);
  upCam.onchange = e => addFiles(e.target.files);
  exportBtn.onclick = doExport;
  importJson.onchange = doImport;
  newBtn.onclick = async () => {
    if (!confirm('Start a new, empty gallery?')) return;
    items = []; persist(); render();
  };
  search.oninput = render;
  galleryTitle.oninput = () => persist();
  saveNow.onclick = async () => { persist(true); };

  async function addFiles(fileList){
    const files = [...(fileList||[])];
    let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
    for (const f of files){
      const { fullDataURL, thumbDataURL } = await compressToDataURLs(f, 2200, 0.85, 800, 0.82);
      const it = { id: crypto.randomUUID(), order: ++order, title: f.name.replace(/\\.[^.]+$/, ''), desc:'', tags:[], dataURL: thumbDataURL, full: fullDataURL };
      items.push(it);
    }
    render(); // show instantly
    persist();
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

      img.src = it.dataURL || it.full || '';
      t.value = it.title || '';
      d.value = it.desc || '';
      g.value = (it.tags || []).join(', ');

      t.oninput = () => { it.title = t.value; persist(); };
      d.oninput = () => { it.desc = d.value; persist(); };
      g.oninput = () => { it.tags = g.value.split(',').map(s=>s.trim()).filter(Boolean); persist(); };

      up.onclick = () => { it.order = Math.max(0,(it.order||0)-1); render(); persist(); };
      down.onclick = () => { it.order = (it.order||0)+1; render(); persist(); };
      rm.onclick = () => { if (!confirm('Remove this image?')) return; items = items.filter(x=>x.id!==it.id); render(); persist(); };
      rp.onclick = () => {
        const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
        inp.onchange = async ev => {
          const f = ev.target.files?.[0]; if (!f) return;
          const { fullDataURL, thumbDataURL } = await compressToDataURLs(f, 2200, 0.85, 800, 0.82);
          it.full = fullDataURL; it.dataURL = thumbDataURL; render(); persist();
        };
        inp.click();
      };

      grid.appendChild(node);
    }
  }

  // SAVE: to localStorage and auto-backup download if forced or first save
  let firstSaveDone = false;
  function persist(forceDownload=false){
    const out = { title: galleryTitle.value || 'J Gallery', items: items.map(it => ({ id: it.id, order: it.order, title: it.title, desc: it.desc, tags: it.tags, src: it.full || it.dataURL })) };
    saveLS(out);
    if (forceDownload || !firstSaveDone){
      firstSaveDone = true;
      downloadJSON(out, (out.title || 'gallery') + '.json');
    }
  }

  function downloadJSON(obj, filename){
    try{
      const a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(obj, null, 2));
      a.download = filename;
      a.click();
      saveStatus.textContent = 'Saved + backup downloaded';
    }catch(e){ log('download fail', e); }
  }

  async function doExport(){
    const out = { title: galleryTitle.value || 'J Gallery', items: items.map(it => ({ id: it.id, title: it.title, desc: it.desc, tags: it.tags, src: it.full || it.dataURL })) };
    downloadJSON(out, (out.title || 'gallery') + '.json');
  }

  async function doImport(e){
    try{
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text(); const obj = JSON.parse(text);
      if (!Array.isArray(obj.items)) throw new Error('Invalid JSON');
      items = [];
      let order = 0;
      for (const it of obj.items){
        const src = it.src || '';
        items.push({ id: it.id || crypto.randomUUID(), order: ++order, title: it.title||'', desc: it.desc||'', tags: Array.isArray(it.tags)?it.tags:[], full: src, dataURL: src });
      }
      render(); persist(true);
      e.target.value='';
    }catch(err){ alert('Import failed: ' + (err.message||err)); }
  }

  // Image helpers -> data URLs
  async function compressToDataURLs(fileOrBlob, fullMax, fullQ, thumbMax, thumbQ){
    const full = await compressImage(fileOrBlob, fullMax, fullQ);
    const thumb = await compressImage(fileOrBlob, thumbMax, thumbQ);
    const fullDataURL = await blobToDataURL(full);
    const thumbDataURL = await blobToDataURL(thumb);
    return { fullDataURL, thumbDataURL };
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
    const img = await blobToImage(fileOrBlob);
    const canvas = drawToCanvas(img, maxSize);
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    return blob || fileOrBlob;
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