/* J Gallery — neat rebuild (v5.0) */
(() => {
  'use strict';

  // ----- DOM
  const els = {
    saveStatus: document.getElementById('saveStatus'),
    grid: document.getElementById('grid'),
    tmpl: document.getElementById('cardTemplate'),
    sessionName: document.getElementById('sessionName'),
    galleryTitle: document.getElementById('galleryTitle'),
    count: document.getElementById('count'),
    search: document.getElementById('search'),
    upPhotos: document.getElementById('uploadPhotos'),
    upCam: document.getElementById('uploadCamera'),
    importJson: document.getElementById('importJson'),
    appendJson: document.getElementById('appendJson'),
    exportAll: document.getElementById('exportAll'),
    exportSel: document.getElementById('exportSelected'),
    newBtn: document.getElementById('newGallery'),
    selectAll: document.getElementById('selectAll'),
    clearSel: document.getElementById('clearSel'),
    allTagsList: document.getElementById('allTags'),
    tagFilters: document.getElementById('tagFilters'),
    viewer: document.getElementById('viewer')
  };
  const v = {
    img: els.viewer?.querySelector('.v-img'),
    prev: els.viewer?.querySelector('.v-prev'),
    next: els.viewer?.querySelector('.v-next'),
    close: els.viewer?.querySelector('.v-close'),
    count: els.viewer?.querySelector('.v-count'),
    fav: els.viewer?.querySelector('.v-fav')
  };

  // ----- State
  const LSK = 'J_GALLERY_V50';
  let items = [];
  let selected = new Set();
  let filtered = [];
  let viewIndex = -1;
  let activeTagFilter = null;
  let activeFavOnly = false;

  // Zoom/pan
  let scale = 1, startScale = 1;
  let panX = 0, panY = 0;
  let lastTouches = [];
  let lastTapTime = 0;

  // Swipe
  let swipeStartX = 0, swipeStartY = 0;
  let navLock = false;

  // ----- Utils
  const nowStamp = () => {
    const d = new Date(), pad = n => (n<10?'0':'')+n;
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  };
  const uid = () => (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));

  const saveLS = () => {
    try {
      const out = { session: els.sessionName?.value || '', title: els.galleryTitle?.value || 'J Gallery', items };
      localStorage.setItem(LSK, JSON.stringify(out));
      if (els.saveStatus) els.saveStatus.textContent = 'Saved locally';
    } catch { if (els.saveStatus) els.saveStatus.textContent = 'Save failed'; }
  };
  const loadLS = () => {
    try {
      const raw = localStorage.getItem(LSK);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (els.sessionName) els.sessionName.value = obj.session || '';
      if (els.galleryTitle) els.galleryTitle.value = obj.title || 'J Gallery';
      return obj.items || null;
    } catch { return null; }
  };

  // ----- Image helpers
  async function fileToBitmap(file){
    try { return await createImageBitmap(file); }
    catch {
      const dataUrl = await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(fr.error||new Error('read fail')); fr.readAsDataURL(file); });
      const img = await new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>rej(new Error('img load')); im.src=dataUrl; });
      const c=document.createElement('canvas'); c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height;
      c.getContext('2d').drawImage(img,0,0); return await createImageBitmap(c);
    }
  }
  async function scaleBitmapToDataURL(bitmap, maxW, quality){
    const ratio = bitmap.width > maxW ? (maxW / bitmap.width) : 1;
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap,0,0,w,h);
    let out = c.toDataURL('image/webp', quality);
    if (!out || out.length < 32) out = c.toDataURL('image/jpeg', quality);
    return out;
  }
  async function compressToDataURLs(file, fullMaxW=2200, fullQ=0.85, thumbMaxW=800, thumbQ=0.82){
    const bmp = await fileToBitmap(file);
    const [fullURL, thumbURL] = await Promise.all([
      scaleBitmapToDataURL(bmp, fullMaxW, fullQ),
      scaleBitmapToDataURL(bmp, thumbMaxW, thumbQ)
    ]);
    return { fullDataURL: fullURL, thumbDataURL: thumbURL };
  }

  // ----- Core
  function render(){
    refreshTagUI();
    const q = (els.search?.value || '').toLowerCase();
    filtered = items.filter(it => {
      const textMatch = (it.title + it.desc + (it.tags||[]).join(' ')).toLowerCase().includes(q);
      const tagMatch = activeTagFilter ? (it.tags||[]).includes(activeTagFilter) : true;
      const favMatch = activeFavOnly ? !!it.fav : true;
      return textMatch && tagMatch && favMatch;
    }).sort((a,b)=> (a.order||0)-(b.order||0));
    if (els.count) els.count.textContent = filtered.length + ' / ' + items.length;
    if (!els.grid || !els.tmpl) return;
    els.grid.innerHTML = '';
    for (const it of filtered){
      const node = els.tmpl.content.firstElementChild.cloneNode(true);
      const img = node.querySelector('.thumb');
      const t = node.querySelector('.title');
      const d = node.querySelector('.desc');
      const g = node.querySelector('.tags');
      const chips = node.querySelector('.tagchips');
      const up = node.querySelector('.up');
      const down = node.querySelector('.down');
      const rm = node.querySelector('.remove');
      const rp = node.querySelector('.replace');
      const pick = node.querySelector('.pick');
      const favBtn = node.querySelector('.fav');

      img.src = it.dataURL || it.full || '';
      img.dataset.id = it.id;
      img.style.cursor = 'zoom-in';
      img.onclick = () => openViewerById(it.id);

      favBtn.style.opacity = it.fav ? 1 : 0.5;
      favBtn.onclick = (ev) => { ev.stopPropagation(); it.fav = !it.fav; favBtn.style.opacity = it.fav?1:0.5; saveLS(); };

      t.value = it.title || '';
      d.value = it.desc || '';
      g.value = (it.tags || []).join(', ');
      g.oninput = () => { it.tags = g.value.split(',').map(s=>s.trim()).filter(Boolean); render(); saveLS(); };
      pick.checked = selected.has(it.id);
      pick.onchange = () => { if (pick.checked) selected.add(it.id); else selected.delete(it.id); };

      chips.innerHTML = '';
      for (const tg of (it.tags||[])){
        const chip = document.createElement('span');
        chip.className = 'tagchip'; chip.textContent = tg;
        chip.style.borderColor = tagColor(tg); chip.style.color = tagColor(tg);
        chip.onclick = () => { activeTagFilter = tg; render(); };
        chips.appendChild(chip);
      }

      t.oninput = () => { it.title = t.value; saveLS(); };
      d.oninput = () => { it.desc = d.value; saveLS(); };
      up.onclick = () => { it.order = Math.max(0,(it.order||0)-1); render(); saveLS(); };
      down.onclick = () => { it.order = (it.order||0)+1; render(); saveLS(); };
      rm.onclick = () => { if (!confirm('Remove this image?')) return; const idx = items.findIndex(x=>x.id===it.id); if (idx>=0) items.splice(idx,1); selected.delete(it.id); render(); saveLS(); };
      rp.onclick = () => {
        const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
        inp.onchange = async ev => {
          const f = ev.target.files?.[0]; if (!f) return;
          const { fullDataURL, thumbDataURL } = await compressToDataURLs(f);
          it.full = fullDataURL; it.dataURL = thumbDataURL; render(); saveLS();
        };
        inp.click();
      };

      els.grid.appendChild(node);
    }
  }

  function tagColor(tag){ let h=0; for (let i=0;i<tag.length;i++) h=(h*31+tag.charCodeAt(i))%360; return `hsl(${h} 90% 45%)`; }
  function uniqueTags(){ const set=new Set(); for (const it of items){ (it.tags||[]).forEach(t=>set.add(t)); } return Array.from(set).sort((a,b)=>a.localeCompare(b)); }
  function refreshTagUI(){
    if (els.allTagsList){
      els.allTagsList.innerHTML='';
      uniqueTags().forEach(t=>{ const o=document.createElement('option'); o.value=t; els.allTagsList.appendChild(o); });
    }
    if (els.tagFilters){
      els.tagFilters.innerHTML='';
      uniqueTags().forEach(t=>{
        const btn=document.createElement('button'); btn.className='tagchip'; btn.textContent=t;
        const c=tagColor(t); btn.style.borderColor=c; btn.style.color=c;
        if (activeTagFilter===t) btn.style.background='#151515';
        btn.onclick=()=>{ activeTagFilter=(activeTagFilter===t)?null:t; render(); };
        els.tagFilters.appendChild(btn);
      });
      if (activeTagFilter){
        const clear=document.createElement('button'); clear.className='btn sm'; clear.textContent='Clear Tag Filter';
        clear.onclick=()=>{ activeTagFilter=null; render(); };
        els.tagFilters.appendChild(clear);
      }
    }
  }

  // ----- Export/Import/Persist
  function persist(forceDownload=false){
    saveLS();
    if (forceDownload){
      const base = (els.sessionName?.value || els.galleryTitle?.value || 'gallery').replace(/\s+/g,'_');
      const text = JSON.stringify({ session: els.sessionName?.value||'', title: els.galleryTitle?.value||'J Gallery', items }, null, 2);
      const a=document.createElement('a');
      a.href='data:application/json;charset=utf-8,'+encodeURIComponent(text);
      a.download = `${base}_${nowStamp()}.json`; a.click();
      if (els.saveStatus) els.saveStatus.textContent='Saved + file downloaded';
    }
  }
  function doExport(arr){
    const base = (els.sessionName?.value || els.galleryTitle?.value || 'gallery').replace(/\s+/g,'_');
    const text = JSON.stringify({ session: els.sessionName?.value||'', title: els.galleryTitle?.value||'J Gallery', items: arr }, null, 2);
    const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(text);
    a.download = `${base}_${nowStamp()}.json`; a.click();
  }
  async function doImport(e, append){
    try{
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text(); const obj = JSON.parse(text);
      if (!Array.isArray(obj.items)) throw new Error('Invalid JSON');
      if (!append){ items = []; selected.clear(); if (els.sessionName) els.sessionName.value = obj.session || els.sessionName?.value; if (els.galleryTitle) els.galleryTitle.value = obj.title || els.galleryTitle?.value; }
      let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
      
for (const it of obj.items){
        const id = it.id || uid();
        const title = it.title || '';
        const desc = it.desc || '';
        const tags = Array.isArray(it.tags) ? it.tags : [];
        const fav = !!it.fav;
        const full = it.full || it.dataURL || it.thumb || it.src || '';
        const dataURL = it.dataURL || it.thumb || it.full || it.src || '';
        items.push({ id, order: ++order, title, desc, tags, fav, full, dataURL });
      }

      render(); saveLS(); e.target.value='';
    }catch(err){ alert('Import failed: ' + (err.message||err)); }
  }

  // ----- Viewer
  function openViewerById(id){
    const idx = filtered.findIndex(it => it.id === id);
    if (idx < 0) return;
    openViewerAt(idx);
  }
  function openViewerAt(idx){
    if (!els.viewer || !v.img || !v.count || !v.fav) return;
    if (!filtered.length) return;
    viewIndex = (idx + filtered.length) % filtered.length;
    const it = filtered[viewIndex];
    v.img.src = it.full || it.dataURL || '';
    v.count.textContent = (viewIndex+1) + ' / ' + filtered.length;
    v.fav.style.opacity = it.fav ? 1 : 0.5;
    resetZoom();
    els.viewer.classList.add('on','show');
    els.viewer.setAttribute('aria-hidden','false');
  }
  function closeViewer(){
    if (!els.viewer) return;
    els.viewer.classList.remove('on','show');
    els.viewer.setAttribute('aria-hidden','true');
    viewIndex = -1;
  }
  function next(){ if (!filtered.length) return; openViewerAt(viewIndex+1); }
  function prev(){ if (!filtered.length) return; openViewerAt(viewIndex-1); }
  v.next && (v.next.onclick = next);
  v.prev && (v.prev.onclick = prev);
  v.close && (v.close.onclick = closeViewer);
  v.fav && (v.fav.onclick = () => { if (viewIndex<0) return; const it = filtered[viewIndex]; it.fav = !it.fav; v.fav.style.opacity = it.fav ? 1 : 0.5; saveLS(); render(); });

  // Double-tap zoom + pinch + swipe
  function resetZoom(){ scale = 1; panX = panY = 0; applyTransform(); }
  function clampPan(){
    if (!v.img) return;
    const rect = v.img.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const maxX = Math.max(0, (rect.width - vw)/2 + 40);
    const maxY = Math.max(0, (rect.height - vh)/2 + 40);
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }
  function applyTransform(){ clampPan(); if (v.img) v.img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; }
  const dist = (a,b)=>Math.hypot(b.clientX-a.clientX, b.clientY-a.clientY);

  els.viewer?.addEventListener('touchstart', onTouchStart, {passive:false});
  els.viewer?.addEventListener('touchmove', onTouchMove, {passive:false});
  els.viewer?.addEventListener('touchend', onTouchEnd, {passive:false});

  function onTouchStart(e){
    if (!els.viewer?.classList.contains('on')) return;
    if (e.touches.length === 1){
      const now = Date.now();
      if (now - lastTapTime < 300){ e.preventDefault(); scale = (scale > 1.1) ? 1 : 2.0; panX = panY = 0; applyTransform(); }
      lastTapTime = now;
      lastTouches = [e.touches[0]];
      swipeStartX = e.touches[0].clientX; swipeStartY = e.touches[0].clientY;
    } else if (e.touches.length === 2){
      e.preventDefault();
      lastTouches = [e.touches[0], e.touches[1]];
      startScale = scale;
    }
  }
  function onTouchMove(e){
    if (!els.viewer?.classList.contains('on')) return;
    if (e.touches.length === 2){
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const [p1, p2] = lastTouches;
      const ds = dist(p1,p2) ? dist(t1,t2) / dist(p1,p2) : 1;
      scale = Math.min(5, Math.max(1, startScale * ds));
      applyTransform();
    } else if (e.touches.length === 1 && scale > 1){
      e.preventDefault();
      const t = e.touches[0]; const p = lastTouches[0] || t;
      panX += (t.clientX - p.clientX); panY += (t.clientY - p.clientY);
      lastTouches = [t]; applyTransform();
    }
  }
  function onTouchEnd(e){
    if (!els.viewer?.classList.contains('on')) return;
    if (scale === 1 && e.changedTouches.length === 1){
      const t = e.changedTouches[0];
      const dx = t.clientX - swipeStartX; const dy = t.clientY - swipeStartY;
      const horiz = Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy);
      if (horiz && !navLock){ navLock = true; if (dx < 0) next(); else prev(); e.preventDefault(); setTimeout(()=>{ navLock=false; }, 220); }
    }
    lastTouches = [];
  }

  // ----- Events
  els.upPhotos && (els.upPhotos.onchange = e => addFiles(e.target.files));
  els.upCam && (els.upCam.onchange = e => addFiles(e.target.files));
  els.exportAll && (els.exportAll.onclick = () => doExport(items));
  els.exportSel && (els.exportSel.onclick = () => { const arr = items.filter(it => selected.has(it.id)); if (!arr.length){ alert('No items selected'); return; } doExport(arr); });
  els.importJson && (els.importJson.onchange = e => doImport(e, false));
  els.appendJson && (els.appendJson.onchange = e => doImport(e, true));
  els.newBtn && (els.newBtn.onclick = () => { if (!confirm('New empty gallery?')) return; items = []; selected.clear(); persist(true); render(); });
  els.search && (els.search.oninput = render);
  els.galleryTitle && (els.galleryTitle.oninput = () => persist());
  els.sessionName && (els.sessionName.oninput = () => persist());
  els.saveNow && (els.saveNow.onclick = () => persist(true));
  els.selectAll && (els.selectAll.onclick = () => { items.forEach(it => selected.add(it.id)); render(); });
  els.clearSel && (els.clearSel.onclick = () => { selected.clear(); render(); });

  // ----- Upload/add
  async function addFiles(fileList){
    const files = [...(fileList||[])];
    let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
    for (const f of files){
      try{
        const { fullDataURL, thumbDataURL } = await compressToDataURLs(f, 2200, 0.85, 800, 0.82);
        items.push({ id: uid(), order: ++order, title: f.name.replace(/\.[^.]+$/, ''), desc:'', tags:[], dataURL: thumbDataURL, full: fullDataURL, fav:false });
      }catch{
        const raw = await new Promise((res, rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(fr.error||new Error('read fail')); fr.readAsDataURL(f); });
        items.push({ id: uid(), order: ++order, title: f.name.replace(/\.[^.]+$/, ''), desc:'', tags:[], dataURL: raw, full: raw, fav:false });
      }
    }
    render(); saveLS();
  }

  // ----- Start
  (function init(){
    const ls = loadLS();
    if (ls) items = ls;
    render();
  })();

})();