/* v3.5 — JSON-first + Fullscreen Viewer */
(() => {
  const LSK = 'J_GALLERY_V35';
  const saveStatus = document.getElementById('saveStatus');
  const logBox = document.getElementById('log');
  const log = (...a) => { const d=document.createElement('div'); d.textContent=a.map(String).join(' '); logBox.appendChild(d); logBox.scrollTop=logBox.scrollHeight; };

  const grid = document.getElementById('grid');
  const tmpl = document.getElementById('cardTemplate');
  const sessionName = document.getElementById('sessionName');
  const galleryTitle = document.getElementById('galleryTitle');
  const count = document.getElementById('count');
  const search = document.getElementById('search');
  const upPhotos = document.getElementById('uploadPhotos');
  const upCam = document.getElementById('uploadCamera');
  const importJson = document.getElementById('importJson');
  const appendJson = document.getElementById('appendJson');
  const exportAllBtn = document.getElementById('exportAll');
  const exportSelBtn = document.getElementById('exportSelected');
  const newBtn = document.getElementById('newGallery');
  const saveNow = document.getElementById('saveNow');
  const selectAll = document.getElementById('selectAll');
  const clearSel = document.getElementById('clearSel');

  // Viewer refs
  const viewer = document.getElementById('viewer');
  const vImg = viewer.querySelector('.v-img');
  const vPrev = viewer.querySelector('.v-prev');
  const vNext = viewer.querySelector('.v-next');
  const vClose = viewer.querySelector('.v-close');
  const vCount = viewer.querySelector('.v-count');

  let items = [];
  let selected = new Set();
  let filtered = []; // last-render order
  let viewIndex = -1;

  window.addEventListener('error', e => log('Error:', e.message||e.error));

  init();

  function loadLS(){
    try{
      const raw = localStorage.getItem(LSK);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      for (const it of obj.items){ if (it.src) it.full = it.dataURL = it.src; delete it.src; }
      sessionName.value = obj.session || '';
      galleryTitle.value = obj.title || 'J Gallery';
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
  function nowStamp(){
    const d = new Date();
    const pad = n => (n<10?'0':'')+n;
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }

  async function init(){
    const obj = loadLS();
    if (obj){ items = obj.items || []; } else { galleryTitle.value = 'J Gallery'; sessionName.value=''; items = []; }
    render();
  }

  // Events
  upPhotos.onchange = e => addFiles(e.target.files);
  upCam.onchange = e => addFiles(e.target.files);
  exportAllBtn.onclick = () => doExport(items);
  exportSelBtn.onclick = () => {
    const arr = items.filter(it => selected.has(it.id));
    if (!arr.length){ alert('No items selected'); return; }
    doExport(arr);
  };
  importJson.onchange = e => doImport(e, /*append*/false);
  appendJson.onchange = e => doImport(e, /*append*/true);
  newBtn.onclick = () => { if (!confirm('New empty gallery?')) return; items = []; selected.clear(); persist(true); render(); };
  search.oninput = render;
  galleryTitle.oninput = () => persist();
  sessionName.oninput = () => persist();
  saveNow.onclick = () => persist(true);
  selectAll.onclick = () => { items.forEach(it => selected.add(it.id)); render(); };
  clearSel.onclick = () => { selected.clear(); render(); };

  async function addFiles(fileList){
    const files = [...(fileList||[])];
    let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
    for (const f of files){
      const { fullDataURL, thumbDataURL } = await compressToDataURLs(f, 2200, 0.85, 800, 0.82);
      const it = { id: crypto.randomUUID(), order: ++order, title: f.name.replace(/\\.[^.]+$/, ''), desc:'', tags:[], dataURL: thumbDataURL, full: fullDataURL };
      items.push(it);
    }
    render();
    persist();
  }

  function render(){
    const q = (search.value || '').toLowerCase();
    filtered = q ? items.filter(it => (it.title + it.desc + (it.tags||[]).join(' ')).toLowerCase().includes(q)) : items.slice();
    filtered.sort((a,b) => (a.order||0)-(b.order||0));
    count.textContent = filtered.length + ' / ' + items.length;
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
      const pick = node.querySelector('.pick');

      img.src = it.dataURL || it.full || '';
      img.dataset.id = it.id; // for viewer
      img.style.cursor = 'zoom-in';
      img.onclick = () => openViewerById(it.id);

      t.value = it.title || '';
      d.value = it.desc || '';
      g.value = (it.tags || []).join(', ');
      pick.checked = selected.has(it.id);
      pick.onchange = () => { if (pick.checked) selected.add(it.id); else selected.delete(it.id); };

      t.oninput = () => { it.title = t.value; persist(); };
      d.oninput = () => { it.desc = d.value; persist(); };
      g.oninput = () => { it.tags = g.value.split(',').map(s=>s.trim()).filter(Boolean); persist(); };

      up.onclick = () => { it.order = Math.max(0,(it.order||0)-1); render(); persist(); };
      down.onclick = () => { it.order = (it.order||0)+1; render(); persist(); };
      rm.onclick = () => { if (!confirm('Remove this image?')) return; const idx = items.findIndex(x=>x.id===it.id); if (idx>=0) items.splice(idx,1); selected.delete(it.id); render(); persist(); };
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

  function persist(forceDownload=false){
    const out = { session: sessionName.value || '', title: galleryTitle.value || 'J Gallery', items: items.map(it => ({ id: it.id, order: it.order, title: it.title, desc: it.desc, tags: it.tags, src: it.full || it.dataURL })) };
    saveLS(out);
    if (forceDownload){
      const base = (sessionName.value || galleryTitle.value || 'gallery').replace(/\\s+/g,'_');
      multiDownload(out, `${base}_${nowStamp()}.json`);
    }
  }

  function doExport(arr){
    const out = { session: sessionName.value || '', title: galleryTitle.value || 'J Gallery', items: arr.map(it => ({ id: it.id, order: it.order, title: it.title, desc: it.desc, tags: it.tags, src: it.full || it.dataURL })) };
    const base = (sessionName.value || galleryTitle.value || 'gallery').replace(/\\s+/g,'_');
    multiDownload(out, `${base}_${nowStamp()}.json`);
  }

  // Export splitter (~4.5MB chunks)
  function multiDownload(obj, baseName){
    const text = JSON.stringify(obj, null, 2);
    const max = 4.5 * 1024 * 1024;
    if (text.length <= max){ downloadText(text, baseName); return; }
    const arr = obj.items; let part=1, start=0;
    while (start < arr.length){
      let end = start, size = 0; const chunk = { session: obj.session, title: obj.title, items: [] };
      while (end < arr.length){
        const cand = JSON.stringify(arr[end]);
        if (size + cand.length + 64 > max) break;
        chunk.items.push(arr[end]); size += cand.length; end++;
      }
      downloadText(JSON.stringify(chunk, null, 2), baseName.replace(/\\.json$/, `-part${part}.json`));
      part++; start=end;
    }
  }
  function downloadText(text, filename){
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    a.click();
    saveStatus.textContent = 'Saved + file downloaded';
  }

  async function doImport(e, append){
    try{
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text(); const obj = JSON.parse(text);
      if (!Array.isArray(obj.items)) throw new Error('Invalid JSON');
      if (!append){ items = []; selected.clear(); sessionName.value = obj.session || sessionName.value; galleryTitle.value = obj.title || galleryTitle.value; }
      let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
      for (const it of obj.items){
        items.push({ id: it.id || crypto.randomUUID(), order: ++order, title: it.title||'', desc: it.desc||'', tags: Array.isArray(it.tags)?it.tags:[], full: it.src || '', dataURL: it.src || '' });
      }
      render(); persist();
      e.target.value='';
    }catch(err){ alert('Import failed: ' + (err.message||err)); }
  }

  // ----- Fullscreen viewer logic -----
  function openViewerById(id){
    const idx = filtered.findIndex(it => it.id === id);
    if (idx < 0) return;
    openViewerAt(idx);
  }
  function openViewerAt(idx){
    if (!filtered.length) return;
    viewIndex = (idx + filtered.length) % filtered.length;
    const it = filtered[viewIndex];
    vImg.src = it.full || it.dataURL || '';
    vCount.textContent = (viewIndex+1) + ' / ' + filtered.length;
    viewer.classList.add('on');
    viewer.setAttribute('aria-hidden','false');
  }
  function closeViewer(){
    viewer.classList.remove('on');
    viewer.setAttribute('aria-hidden','true');
    viewIndex = -1;
  }
  function next(){ if (!filtered.length) return; openViewerAt(viewIndex+1); }
  function prev(){ if (!filtered.length) return; openViewerAt(viewIndex-1); }

  vNext.onclick = next;
  vPrev.onclick = prev;
  vClose.onclick = closeViewer;
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) closeViewer();
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (!viewer.classList.contains('on')) return;
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') closeViewer();
  });

  // Swipe support
  let touchX = 0, touchY = 0, swiping = false;
  const SWIPE_THRESHOLD = 40;
  viewer.addEventListener('touchstart', (e) => {
    if (!viewer.classList.contains('on')) return;
    const t = e.touches[0]; touchX = t.clientX; touchY = t.clientY; swiping = true;
  }, {passive:true});
  viewer.addEventListener('touchmove', (e) => {
    if (viewer.classList.contains('on')) e.preventDefault();
  }, {passive:false});
  viewer.addEventListener('touchend', (e) => {
    if (!swiping) return; swiping = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD){
      if (dx < 0) next(); else prev();
    }
  });

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