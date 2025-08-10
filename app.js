  const LSK = 'J_GALLERY_V38';
  const saveStatus = document.getElementById('saveStatus');
  const logBox = document.getElementById('log');
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
  const viewer = document.getElementById('viewer');
  const vImg = viewer.querySelector('.v-img');
  const vPrev = viewer.querySelector('.v-prev');
  const vNext = viewer.querySelector('.v-next');
  const vClose = viewer.querySelector('.v-close');
  const vCount = viewer.querySelector('.v-count');
  const vFav = viewer.querySelector('.v-fav');
  let items = [];
let activeFavOnly = false;
  let selected = new Set();
  let filtered = []; // last-render order
  let viewIndex = -1;
  let activeTagFilter = null;
  let scale = 1, startScale = 1;
  let panX = 0, panY = 0;
  let lastTouches = [];
  let lastTapTime = 0;
    const pad = n => (n<10?'0':'')+n;
    const arr = items.filter(it => selected.has(it.id));
      const opt = document.createElement('option');
      const btn = document.createElement('button');
      const clear = document.createElement('button');
    let order = items.reduce((m, it) => Math.max(m, it.order||0), 0);
      const { fullDataURL, thumbDataURL } = await compressToDataURLs(f, 2200, 0.85, 800, 0.82);
      const it = { id: crypto.randomUUID(), order: ++order, title: f.name.replace(/\.[^.]+$/, ''), desc:'', tags:[], dataURL: thumbDataURL, full: fullDataURL, fav:false };
      const favMatch = activeFavOnly ? !!it.fav : true;
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
        const chip = document.createElement('span');
        const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
          const f = ev.target.files?.[0]; if (!f) return;
          const { fullDataURL, thumbDataURL } = await compressToDataURLs(f, 2200, 0.85, 800, 0.82);
    const max = 4.5 * 1024 * 1024;
    const arr = obj.items; let part=1, start=0;
      let end = start, size = 0; const chunk = { session: obj.session, title: obj.title, items: [] };
        const cand = JSON.stringify(arr[end]);
let slideTimer = null;
    const it = filtered[viewIndex];
    const it = filtered[viewIndex];
      const now = Date.now();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const [p1, p2] = lastTouches;
      const ds = distance(t1,t2) / distance(p1,p2);
      const t = e.touches[0];
      const p = lastTouches[0] || t;
      const t = e.changedTouches[0];
      const last = lastTouches[0];
        const dx = t.clientX - last.clientX;
const LSK_PREFS = 'J_GALLERY_PREFS_V39';
let prefs = {
  const gv = document.getElementById('prefGridVal'); if (gv) gv.textContent = String(prefs.cardMin);
  const sv = document.getElementById('prefSlideMsVal'); if (sv) sv.textContent = String(prefs.slideMs);
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const settingsClose = document.getElementById('settingsClose');
const prefLabels = document.getElementById('prefLabels');
const prefGrid = document.getElementById('prefGrid');
const prefFavFilter = document.getElementById('prefFavFilter');
const prefSlideshow = document.getElementById('prefSlideshow');
const prefSlideMs = document.getElementById('prefSlideMs');
const settingsExport = document.getElementById('settingsExport');
const settingsImportInput = document.getElementById('settingsImportInput');
const settingsClear = document.getElementById('settingsClear');
  const a = document.createElement('a');
  const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    const obj = JSON.parse(text);
    const filters = document.querySelector('.filters');
  const btn = document.createElement('button');

  const log = (...a) => { const d=document.createElement('div'); d.textContent=a.map(String).join(' '); logBox.appendChild(d); logBox.scrollTop=logBox.scrollHeight; };

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
  function saveLS(obj){
    try{
      localStorage.setItem(LSK, JSON.stringify(obj));
      saveStatus.textContent = 'Saved locally';
    }catch(e){
      saveStatus.textContent = 'Save failed (storage full?)';
      log('localStorage save error', e);
    }
  function nowStamp(){
    const d = new Date();
  async function init(){
    const obj = loadLS();
  function uniqueTags(){
    const set = new Set();
  function tagColor(tag){
    let h=0; for (let i=0;i<tag.length;i++) h = (h*31 + tag.charCodeAt(i)) % 360;
  function refreshTagSuggestions(){
    allTagsList.innerHTML = '';
  async function addFiles(fileList){
    const files = [...(fileList||[])];
  function render(){
    refreshTagSuggestions();
    const q = (search.value || '').toLowerCase();
    filtered = items.filter(it => {
      const textMatch = (it.title + it.desc + (it.tags||[]).join(' ')).toLowerCase().includes(q);
      const tagMatch = activeTagFilter ? (it.tags||[]).includes(activeTagFilter) : true;
  function persist(forceDownload=false){
    const out = { session: sessionName.value || '', title: galleryTitle.value || 'J Gallery', items: items.map(it => ({ id: it.id, order: it.order, title: it.title, desc: it.desc, tags: it.tags, fav: !!it.fav, src: it.full || it.dataURL })) };
      const base = (sessionName.value || galleryTitle.value || 'gallery').replace(/\s+/g,'_');
      multiDownload(out, `${base}_${nowStamp()}.json`);
  function doExport(arr){
    const out = { session: sessionName.value || '', title: galleryTitle.value || 'J Gallery', items: arr.map(it => ({ id: it.id, order: it.order, title: it.title, desc: it.desc, tags: it.tags, fav: !!it.fav, src: it.full || it.dataURL })) };
    const base = (sessionName.value || galleryTitle.value || 'gallery').replace(/\s+/g,'_');
    multiDownload(out, `${base}_${nowStamp()}.json`);
  function multiDownload(obj, baseName){
    const text = JSON.stringify(obj, null, 2);
  function downloadText(text, filename){
    const a = document.createElement('a');
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
  function openViewerById(id){
    const idx = filtered.findIndex(it => it.id === id);
function startSlideshow(){ if (!prefs.slideshow) return; stopSlideshow(); slideTimer = setInterval(() => { next(); }, Math.max(800, prefs.slideMs||2500)); }
function stopSlideshow(){ if (slideTimer){ clearInterval(slideTimer); slideTimer=null; } }

function openViewerAt(idx){
    if (!filtered.length) return;
  function closeViewer(){
    viewer.classList.remove('on','show');
  function next(){ if (!filtered.length) return; openViewerAt(viewIndex+1); }
  function prev(){ if (!filtered.length) return; openViewerAt(viewIndex-1); }

  function toggleFavCurrent(){
    if (viewIndex<0) return;
  function resetZoom(){ scale = 1; panX = panY = 0; applyTransform(); }
  function applyTransform(){ vImg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; }
  function distance(t1, t2){ const dx=t2.clientX - t1.clientX; const dy=t2.clientY - t1.clientY; return Math.hypot(dx,dy); }

  function onTouchStart(e){
    if (!viewer.classList.contains('on')) return;
  function onTouchMove(e){
    if (!viewer.classList.contains('on')) return;
  function onTouchEnd(e){
    if (!viewer.classList.contains('on')) return;
function loadPrefs(){
  try{
    const raw = localStorage.getItem(LSK_PREFS);
    if (!raw) return;
    const obj = JSON.parse(raw);
    prefs = { ...prefs, ...obj };
  }catch{}
function savePrefs(){
  localStorage.setItem(LSK_PREFS, JSON.stringify(prefs));
function applyPrefs(){
  // Labels
function hydrateSettingsUI(){
  if (!prefLabels) return;
function renderFavToggle(){
  let host = document.getElementById('filtersFavHost');

/* v3.8 — same logic as 3.7 + icons + mixed layout */
(() => {
  // Viewer refs
  // zoom/pan state
  window.addEventListener('error', e => log('Error:', e.message||e.error));
  loadPrefs(); applyPrefs(); init();
  }
  }
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }
    if (obj){ items = obj.items || []; } else { galleryTitle.value = 'J Gallery'; sessionName.value=''; items = []; }
    render();
  }
  // Events
  upPhotos.onchange = e => addFiles(e.target.files);
  upCam.onchange = e => addFiles(e.target.files);
  exportAllBtn.onclick = () => doExport(items);
  exportSelBtn.onclick = () => {
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
    for (const it of items){ (it.tags||[]).forEach(t=>set.add(t)); }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }
    return `hsl(${h} 90% 45%)`;
  }
    for (const t of uniqueTags()){
      opt.value = t;
      allTagsList.appendChild(opt);
    }
    // tag filters row (h-scrollable)
    tagFilters.innerHTML = '';
    for (const t of uniqueTags()){
      btn.className = 'tagchip';
      btn.textContent = t;
      btn.style.borderColor = tagColor(t);
      btn.style.color = tagColor(t);
      if (activeTagFilter === t) { btn.style.background = '#151515'; }
      btn.onclick = () => { activeTagFilter = (activeTagFilter===t) ? null : t; render(); };
      tagFilters.appendChild(btn);
    }
    if (activeTagFilter){
      clear.className = 'btn sm';
      clear.textContent = 'Clear Tag Filter';
      clear.onclick = () => { activeTagFilter = null; render(); };
      tagFilters.appendChild(clear);
    }
  }
    for (const f of files){
      items.push(it);
    }
    render();
    persist();
  }
      return textMatch && tagMatch && favMatch;
    }).sort((a,b) => (a.order||0)-(b.order||0));
    count.textContent = filtered.length + ' / ' + items.length;
    renderFavToggle();
    grid.innerHTML = '';
    for (const it of filtered){
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
        inp.onchange = async ev => {
          it.full = fullDataURL; it.dataURL = thumbDataURL; render(); persist();
        };
        inp.click();
      };
      grid.appendChild(node);
    }
  }
    saveLS(out);
    if (forceDownload){
    }
  }
  }
    if (text.length <= max){ downloadText(text, baseName); return; }
    while (start < arr.length){
      while (end < arr.length){
        if (size + cand.length + 64 > max) break;
        chunk.items.push(arr[end]); size += cand.length; end++;
      }
      downloadText(JSON.stringify(chunk, null, 2), baseName.replace(/\.json$/, `-part${part}.json`));
      part++; start=end;
    }
  }
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    a.click();
    saveStatus.textContent = 'Saved + file downloaded';
  }
  }
  // Viewer logic (pinch, double-tap, swipe, favorites)
    if (idx < 0) return;
    openViewerAt(idx);
  }
    viewIndex = (idx + filtered.length) % filtered.length;
    vImg.src = it.full || it.dataURL || '';
    vCount.textContent = (viewIndex+1) + ' / ' + filtered.length;
    vFav.style.opacity = it.fav ? 1 : 0.5;
    resetZoom();
    viewer.classList.add('on','show');
    viewer.setAttribute('aria-hidden','false');
    startSlideshow();
  }
    stopSlideshow();
    viewer.setAttribute('aria-hidden','true');
    viewIndex = -1;
  }
  vNext.onclick = next;
  vPrev.onclick = prev;
  vClose.onclick = closeViewer;
  vFav.onclick = () => { toggleFavCurrent(); };
    it.fav = !it.fav;
    vFav.style.opacity = it.fav ? 1 : 0.5;
    persist();
    render();
  }
  document.addEventListener('keydown', (e) => {
    if (!viewer.classList.contains('on')) return;
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') closeViewer();
  });
  viewer.addEventListener('touchstart', onTouchStart, {passive:false});
  viewer.addEventListener('touchmove', onTouchMove, {passive:false});
  viewer.addEventListener('touchend', onTouchEnd, {passive:false});
    if (e.touches.length === 1){
      if (now - lastTapTime < 300){ e.preventDefault(); scale = (scale > 1) ? 1 : 2.0; panX = panY = 0; applyTransform(); }
      lastTapTime = now;
      lastTouches = [e.touches[0]];
    } else if (e.touches.length === 2){
      e.preventDefault();
      lastTouches = [e.touches[0], e.touches[1]];
      startScale = scale;
    }
  }
    if (e.touches.length === 2){
      e.preventDefault();
      scale = Math.min(5, Math.max(1, startScale * ds));
      applyTransform();
    } else if (e.touches.length === 1 && scale > 1){
      e.preventDefault();
      panX += (t.clientX - p.clientX);
      panY += (t.clientY - p.clientY);
      lastTouches = [t];
      applyTransform();
    }
  }
    if (scale === 1 && e.changedTouches.length === 1){
      if (last){
        if (Math.abs(dx) > 40){ if (dx < 0) next(); else prev(); }
      }
    }
    lastTouches = [];
  }
})();
// --- Settings / Preferences ---
  labels: 'auto',       // 'auto' | 'on' | 'off'
  cardMin: 240,         // px min for grid
  favFilter: false,     // show favorites-only toggle in filters
  slideshow: false,     // autoplay in viewer
  slideMs: 2500
};
}
}
// Apply prefs to DOM/CSS
  document.body.classList.remove('labels-on','labels-off');
  if (prefs.labels === 'on') document.body.classList.add('labels-on');
  else if (prefs.labels === 'off') document.body.classList.add('labels-off');
  // Grid min width
  document.documentElement.style.setProperty('--card-min', prefs.cardMin + 'px');
  // Favorites filter control visibility handled in render()
  // Slideshow speed used in viewer
}
// Settings panel wiring
settingsBtn?.addEventListener('click', () => { settingsPanel.classList.add('on'); settingsPanel.setAttribute('aria-hidden','false'); });
settingsPanel?.querySelector('.backdrop')?.addEventListener('click', () => { settingsPanel.classList.remove('on'); settingsPanel.setAttribute('aria-hidden','true'); });
settingsClose?.addEventListener('click', () => { settingsPanel.classList.remove('on'); settingsPanel.setAttribute('aria-hidden','true'); });
// Controls
  prefLabels.value = prefs.labels;
  prefGrid.value = prefs.cardMin;
  prefFavFilter.checked = !!prefs.favFilter;
  prefSlideshow.checked = !!prefs.slideshow;
  prefSlideMs.value = prefs.slideMs;
  applyPrefs();
}
prefLabels?.addEventListener('change', () => { prefs.labels = prefLabels.value; savePrefs(); applyPrefs(); });
prefGrid?.addEventListener('input', () => { prefs.cardMin = parseInt(prefGrid.value,10)||240; savePrefs(); applyPrefs(); });
prefFavFilter?.addEventListener('change', () => { prefs.favFilter = !!prefFavFilter.checked; savePrefs(); render(); });
prefSlideshow?.addEventListener('change', () => { prefs.slideshow = !!prefSlideshow.checked; savePrefs(); });
prefSlideMs?.addEventListener('input', () => { prefs.slideMs = parseInt(prefSlideMs.value,10)||2500; savePrefs(); applyPrefs(); });
settingsExport?.addEventListener('click', () => {
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(prefs,null,2));
  a.download = 'gallery_settings.json'; a.click();
});
settingsImportInput?.addEventListener('change', async (e) => {
  try{
    prefs = { ...prefs, ...obj };
    savePrefs(); hydrateSettingsUI(); render();
    alert('Settings imported');
  }catch(err){ alert('Failed to import settings: '+(err.message||err)); }
  e.target.value='';
});
settingsClear?.addEventListener('click', () => {
  if (!confirm('Clear all local data (images + settings)? This cannot be undone.')) return;
  localStorage.removeItem(LSK); // gallery data
  localStorage.removeItem(LSK_PREFS); // settings
  items = []; selected = new Set(); render();
  alert('Cleared. Reloading...'); location.reload();
});
// Add a favorites-only toggle to filters if enabled
  if (!host){
    host = document.createElement('div');
    host.id = 'filtersFavHost';
    filters?.appendChild(host);
  }
  host.innerHTML = '';
  if (!prefs.favFilter) return;
  btn.className = 'btn sm';
  btn.textContent = (activeFavOnly ? 'All items' : 'Favorites only');
  btn.onclick = () => { activeFavOnly = !activeFavOnly; render(); };
  host.appendChild(btn);
}