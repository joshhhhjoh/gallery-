/* josh-gal app.js — patched v3.9
   - Fix duplicate variable declarations causing SyntaxError on load
   - Expose render/applyPrefs from the IIFE so settings UI can call them safely
   - Add robust compressToDataURLs() for iPhone HEIC/large images
*/
(() => {
  'use strict';

  const LSK = 'J_GALLERY_V38';
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
  const allTagsList = document.getElementById('allTags');
  const tagFilters = document.getElementById('tagFilters');

  // Viewer refs
  const viewer = document.getElementById('viewer');
  const vImg = viewer?.querySelector('.v-img');
  const vPrev = viewer?.querySelector('.v-prev');
  const vNext = viewer?.querySelector('.v-next');
  const vClose = viewer?.querySelector('.v-close');
  const vCount = viewer?.querySelector('.v-count');
  const vFav = viewer?.querySelector('.v-fav');

  let items = [];
  let activeFavOnly = false;
  let selected = new Set();
  let filtered = []; // last-render order
  let viewIndex = -1;
  let activeTagFilter = null;

  // zoom/pan state (single declaration)
  let scale = 1, startScale = 1;
  let panX = 0, panY = 0;
  let lastTouches = [];
  let lastTapTime = 0;

  // swipe helpers
  let swipeStartX = 0, swipeStartY = 0;
  let navLock = false;
window.addEventListener('error', e => log('Error:', e.message||e.error));

  loadPrefs(); applyPrefs(); init();

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
      if (saveStatus) saveStatus.textContent = 'Saved locally';
    }catch(e){
      if (saveStatus) saveStatus.textContent = 'Save failed (storage full?)';
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
  upPhotos && (upPhotos.onchange = e => addFiles(e.target.files));
  upCam && (upCam.onchange = e => addFiles(e.target.files));
  exportAllBtn && (exportAllBtn.onclick = () => doExport(items));
  exportSelBtn && (exportSelBtn.onclick = () => {
    const arr = items.filter(it => selected.has(it.id));
    if (!arr.length){ alert('No items selected'); return; }
    doExport(arr);
  });
  importJson && (importJson.onchange = e => doImport(e, /*append*/false));
  appendJson && (appendJson.onchange = e => doImport(e, /*append*/true));
  newBtn && (newBtn.onclick = () => { if (!confirm('New empty gallery?')) return; items = []; selected.clear(); persist(true); render(); });
  search && (search.oninput = render);
  galleryTitle && (galleryTitle.oninput = () => persist());
  sessionName && (sessionName.oninput = () => persist());
  saveNow && (saveNow.onclick = () => persist(true));
  selectAll && (selectAll.onclick = () => { items.forEach(it => selected.add(it.id)); render(); });
  clearSel && (clearSel.onclick = () => { selected.clear(); render(); });

  function uniqueTags(){
    const set = new Set();
    for (const it of items){ (it.tags||[]).forEach(t=>set.add(t)); }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }
  function tagColor(tag){
    let h=0; for (let i=0;i<tag.length;i++) h = (h*31 + tag.charCodeAt(i)) % 360;
    return `hsl(${h} 90% 45%)`;
  }
  function refreshTagSuggestions(){
    if (!allTagsList) return;
    allTagsList.innerHTML = '';
    for (const t of uniqueTags()){
      const opt = document.createElement('option');
      opt.value = t;
      allTagsList.appendChild(opt);
    }
    if (!tagFilters) return;
    // tag filters row (h-scrollable)
    tagFilters.innerHTML = '';
    for (const t of uniqueTags()){
      const btn = document.createElement('button');
      btn.className = 'tagchip';
      btn.textContent = t;
      btn.style.borderColor = tagColor(t);
      btn.style.color = tagColor(t);
      if (activeTagFilter === t) { btn.style.background = '#151515'; }
      btn.onclick = () => { activeTagFilter = (activeTagFilter===t) ? null : t; render(); };
      tagFilters.appendChild(btn);
    }
    if (activeTagFilter){
      const clear = document.createElement('button');
      clear.className = 'btn sm';
      clear.textContent = 'Clear Tag Filter';
      clear.onclick = () => { activeTagFilter = null; render(); };
      tagFilters.appendChild(clear);
    }
  }

  // Image compression helper: works with HEIC on iOS by routing via createImageBitmap/canvas
  async function compressToDataURLs(file, fullMaxW=2200, fullQ=0.85, thumbMaxW=800, thumbQ=0.82){
    const blob = file;
    const bitmap = await createImageBitmap(blob).catch(async () => {
      // Fallback via <img>
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onerror = () => rej(new Error('read fail'));
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(blob);
      });
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('img load fail'));
        im.src = dataUrl;
      });
      // Draw into canvas from HTMLImageElement
      const cnv = document.createElement('canvas');
      cnv.width = img.naturalWidth || img.width;
      cnv.height = img.naturalHeight || img.height;
      const ctx = cnv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return await createImageBitmap(cnv);
    });

    const [fullURL, thumbURL] = await Promise.all([
      scaleBitmapToDataURL(bitmap, fullMaxW, fullQ),
      scaleBitmapToDataURL(bitmap, thumbMaxW, thumbQ)
    ]);
    return { fullDataURL: fullURL, thumbDataURL: thumbURL };
  }

  async function scaleBitmapToDataURL(bitmap, maxW, quality){
    const ratio = bitmap.width > maxW ? (maxW / bitmap.width) : 1;
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    // Safari supports image/webp; if not, fallback to image/jpeg
    let type = 'image/webp';
    let out = c.toDataURL(type, quality);
    if (!out || out.length < 32) { type = 'image/jpeg'; out = c.toDataURL(type, quality); }
    return out;
  }

  async function addFiles(fileList){
    const files = [...(fileList||[])];
    let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
    for (const f of files){
      const { fullDataURL, thumbDataURL } = await compressToDataURLs(f, 2200, 0.85, 800, 0.82);
      const it = { id: crypto.randomUUID(), order: ++order, title: f.name.replace(/\.[^.]+$/, ''), desc:'', tags:[], dataURL: thumbDataURL, full: fullDataURL, fav:false };
      items.push(it);
    }
    render();
    persist();
  }

  function render(){
    refreshTagSuggestions();
    const q = (search?.value || '').toLowerCase();
    filtered = items.filter(it => {
      const textMatch = (it.title + it.desc + (it.tags||[]).join(' ')).toLowerCase().includes(q);
      const tagMatch = activeTagFilter ? (it.tags||[]).includes(activeTagFilter) : true;
      const favMatch = activeFavOnly ? !!it.fav : true;
      return textMatch && tagMatch && favMatch;
    }).sort((a,b) => (a.order||0)-(b.order||0));

    if (count) count.textContent = filtered.length + ' / ' + items.length;
    if (!grid || !tmpl) return;
    grid.innerHTML = '';
    for (const it of filtered){
      const node = tmpl.content.firstElementChild.cloneNode(true);
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
      img.dataset.id = it.id; // for viewer
      img.style.cursor = 'zoom-in';
      img.onclick = () => openViewerById(it.id);

      favBtn.style.opacity = it.fav ? 1 : 0.5;
      favBtn.onclick = (ev) => { ev.stopPropagation(); it.fav = !it.fav; favBtn.style.opacity = it.fav?1:0.5; persist(); };

      t.value = it.title || '';
      d.value = it.desc || '';
      g.value = (it.tags || []).join(', ');
      g.oninput = () => { it.tags = g.value.split(',').map(s=>s.trim()).filter(Boolean); render(); persist(); };
      pick.checked = selected.has(it.id);
      pick.onchange = () => { if (pick.checked) selected.add(it.id); else selected.delete(it.id); };

      chips.innerHTML = '';
      for (const tg of (it.tags||[])){
        const chip = document.createElement('span');
        chip.className = 'tagchip';
        chip.textContent = tg;
        chip.style.borderColor = tagColor(tg);
        chip.style.color = tagColor(tg);
        chip.onclick = () => { activeTagFilter = tg; render(); };
        chips.appendChild(chip);
      }

      t.oninput = () => { it.title = t.value; persist(); };
      d.oninput = () => { it.desc = d.value; persist(); };

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
    const out = { session: sessionName?.value || '', title: galleryTitle?.value || 'J Gallery', items: items.map(it => ({ id: it.id, order: it.order, title: it.title, desc: it.desc, tags: it.tags, fav: !!it.fav, src: it.full || it.dataURL })) };
    saveLS(out);
    if (forceDownload){
      const base = (sessionName?.value || galleryTitle?.value || 'gallery').replace(/\s+/g,'_');
      multiDownload(out, `${base}_${nowStamp()}.json`);
    }
  }

  function doExport(arr){
    const out = { session: sessionName?.value || '', title: galleryTitle?.value || 'J Gallery', items: arr.map(it => ({ id: it.id, order: it.order, title: it.title, desc: it.desc, tags: it.tags, fav: !!it.fav, src: it.full || it.dataURL })) };
    const base = (sessionName?.value || galleryTitle?.value || 'gallery').replace(/\s+/g,'_');
    multiDownload(out, `${base}_${nowStamp()}.json`);
  }

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
      downloadText(JSON.stringify(chunk, null, 2), baseName.replace(/\.json$/, `-part${part}.json`));
      part++; start=end;
    }
  }
  function downloadText(text, filename){
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    a.click();
    if (saveStatus) saveStatus.textContent = 'Saved + file downloaded';
  }

  async function doImport(e, append){
    try{
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text(); const obj = JSON.parse(text);
      if (!Array.isArray(obj.items)) throw new Error('Invalid JSON');
      if (!append){ items = []; selected.clear(); sessionName.value = obj.session || sessionName.value; galleryTitle.value = obj.title || galleryTitle.value; }
      let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
      for (const it of obj.items){
        items.push({ id: it.id || crypto.randomUUID(), order: ++order, title: it.title||'', desc: it.desc||'', tags: Array.isArray(it.tags)?it.tags:[], fav: !!it.fav, full: it.src || '', dataURL: it.src || '' });
      }
      render(); persist();
      e.target.value='';
    }catch(err){ alert('Import failed: ' + (err.message||err)); }
  }

  // Viewer logic (pinch, double-tap, swipe, favorites)
  function openViewerById(id){
    const idx = filtered.findIndex(it => it.id === id);
    if (idx < 0) return;
    openViewerAt(idx);
  }

  let slideTimer = null;
  function startSlideshow(){ if (!prefs.slideshow) return; stopSlideshow(); slideTimer = setInterval(() => { next(); }, Math.max(800, prefs.slideMs||2500)); }
  function stopSlideshow(){ if (slideTimer){ clearInterval(slideTimer); slideTimer=null; } }

  function openViewerAt(idx){
    if (!viewer || !vImg || !vCount || !vFav) return;
    if (!filtered.length) return;
    viewIndex = (idx + filtered.length) % filtered.length;
    const it = filtered[viewIndex];
    vImg.src = it.full || it.dataURL || '';
    vCount.textContent = (viewIndex+1) + ' / ' + filtered.length;
    vFav.style.opacity = it.fav ? 1 : 0.5;
    resetZoom();
    viewer.classList.add('on','show');
    viewer.setAttribute('aria-hidden','false');
    startSlideshow();
  }
  function closeViewer(){
    if (!viewer) return;
    viewer.classList.remove('on','show');
    stopSlideshow();
    viewer.setAttribute('aria-hidden','true');
    viewIndex = -1;
  }
  function next(){ if (!filtered.length) return; openViewerAt(viewIndex+1); }
  function prev(){ if (!filtered.length) return; openViewerAt(viewIndex-1); }

  vNext && (vNext.onclick = next);
  vPrev && (vPrev.onclick = prev);
  vClose && (vClose.onclick = closeViewer);
  vFav && (vFav.onclick = () => { toggleFavCurrent(); });

  function toggleFavCurrent(){
    if (viewIndex<0) return;
    const it = filtered[viewIndex];
    it.fav = !it.fav;
    if (vFav) vFav.style.opacity = it.fav ? 1 : 0.5;
    persist();
    render();
  }

  document.addEventListener('keydown', (e) => {
    if (!viewer?.classList.contains('on')) return;
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') closeViewer();
  });

  function resetZoom(){ scale = 1; panX = panY = 0; applyTransform(); }
  function applyTransform(){ if (vImg) vImg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; }
  function distance(t1, t2){ const dx=t2.clientX - t1.clientX; const dy=t2.clientY - t1.clientY; return Math.hypot(dx,dy); }

  viewer?.addEventListener('touchstart', onTouchStart, {passive:false});
  viewer?.addEventListener('touchmove', onTouchMove, {passive:false});
  viewer?.addEventListener('touchend', onTouchEnd, {passive:false});

  function onTouchStart(e){
    if (!viewer?.classList.contains('on')) return;
    if (e.touches.length === 1){
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
      const now = Date.now();
      if (now - lastTapTime < 300){ e.preventDefault(); scale = (scale > 1) ? 1 : 2.0; panX = panY = 0; applyTransform(); }
      lastTapTime = now;
      lastTouches = [e.touches[0]];
    } else if (e.touches.length === 2){
      e.preventDefault();
      lastTouches = [e.touches[0], e.touches[1]];
      startScale = scale;
    }
  }
  function onTouchMove(e){
    if (!viewer?.classList.contains('on')) return;
    if (e.touches.length === 2){
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const [p1, p2] = lastTouches;
      const ds = distance(t1,t2) / distance(p1,p2);
      scale = Math.min(5, Math.max(1, startScale * ds));
      applyTransform();
    } else if (e.touches.length === 1 && scale > 1){
      e.preventDefault();
      const t = e.touches[0];
      const p = lastTouches[0] || t;
      panX += (t.clientX - p.clientX);
      panY += (t.clientY - p.clientY);
      lastTouches = [t];
      applyTransform();
    }
  }
  function onTouchEnd(e){
    if (!viewer?.classList.contains('on')) return;
    if (scale === 1 && e.changedTouches.length === 1){
      const t = e.changedTouches[0];
      const dx = t.clientX - swipeStartX;
      const dy = t.clientY - swipeStartY;
      const isHorizontal = Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy);
      if (isHorizontal && !navLock){
        navLock = true;
        stopSlideshow(); // prevent timer from double-advancing
        if (dx < 0) next(); else prev();
        e.preventDefault();
        setTimeout(()=>{ navLock = false; }, 220);
      }
    }
    lastTouches = [];
  }

  // ---- Settings / Preferences (keep in-scope) ----
  const LSK_PREFS = 'J_GALLERY_PREFS_V39';
  let prefs = {
    labels: 'auto',       // 'auto' | 'on' | 'off'
    cardMin: 240,         // px min for grid
    favFilter: false,     // show favorites-only toggle in filters
    slideshow: false,     // autoplay in viewer
    slideMs: 2500
  };
  function loadPrefs(){
    try{
      const raw = localStorage.getItem(LSK_PREFS);
      if (!raw) return;
      const obj = JSON.parse(raw);
      prefs = { ...prefs, ...obj };
    }catch{}
  }
  function savePrefs(){
    localStorage.setItem(LSK_PREFS, JSON.stringify(prefs));
  }
  function applyPrefs(){
    // Labels
    document.body.classList.remove('labels-on','labels-off');
    if (prefs.labels === 'on') document.body.classList.add('labels-on');
    else if (prefs.labels === 'off') document.body.classList.add('labels-off');
    // Grid min width
    document.documentElement.style.setProperty('--card-min', String(prefs.cardMin) + 'px');
    const gv = document.getElementById('prefGridVal'); if (gv) gv.textContent = String(prefs.cardMin);
    const sv = document.getElementById('prefSlideMsVal'); if (sv) sv.textContent = String(prefs.slideMs);
  }

  // Settings panel wiring (now safely in-scope)
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsClose = document.getElementById('settingsClose');

  settingsBtn?.addEventListener('click', () => { settingsPanel.classList.add('on'); settingsPanel.setAttribute('aria-hidden','false'); });
  settingsPanel?.querySelector('.backdrop')?.addEventListener('click', () => { settingsPanel.classList.remove('on'); settingsPanel.setAttribute('aria-hidden','true'); });
  settingsClose?.addEventListener('click', () => { settingsPanel.classList.remove('on'); settingsPanel.setAttribute('aria-hidden','true'); });

  const prefLabels = document.getElementById('prefLabels');
  const prefGrid = document.getElementById('prefGrid');
  const prefFavFilter = document.getElementById('prefFavFilter');
  const prefSlideshow = document.getElementById('prefSlideshow');
  const prefSlideMs = document.getElementById('prefSlideMs');

  const settingsExport = document.getElementById('settingsExport');
  const settingsImportInput = document.getElementById('settingsImportInput');
  const settingsClear = document.getElementById('settingsClear');

  function hydrateSettingsUI(){
    if (!prefLabels) return;
    prefLabels.value = prefs.labels;
    if (prefGrid) prefGrid.value = prefs.cardMin;
    if (prefFavFilter) prefFavFilter.checked = !!prefs.favFilter;
    if (prefSlideshow) prefSlideshow.checked = !!prefs.slideshow;
    if (prefSlideMs) prefSlideMs.value = prefs.slideMs;
    applyPrefs();
  }

  prefLabels?.addEventListener('change', () => { prefs.labels = prefLabels.value; savePrefs(); applyPrefs(); });
  prefGrid?.addEventListener('input', () => { prefs.cardMin = parseInt(prefGrid.value,10)||240; savePrefs(); applyPrefs(); });
  prefFavFilter?.addEventListener('change', () => { prefs.favFilter = !!prefFavFilter.checked; savePrefs(); render(); });
  prefSlideshow?.addEventListener('change', () => { prefs.slideshow = !!prefSlideshow.checked; savePrefs(); });
  prefSlideMs?.addEventListener('input', () => { prefs.slideMs = parseInt(prefSlideMs.value,10)||2500; savePrefs(); });

  // Export settings for other modules if needed
  window.__jgal = { render, applyPrefs, savePrefs, prefs };

  // hydrate now that DOM is ready
  hydrateSettingsUI();

})();