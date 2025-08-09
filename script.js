/* J//Gallery v2 — iPhone-friendly uploads + modern UI */
(() => {
  const KEY = "joshGalleryData";
  const grid = document.getElementById('grid');
  const tmpl = document.getElementById('cardTemplate');
  const uploadInput = document.getElementById('uploadInput');
  const importJson = document.getElementById('importJson');
  const count = document.getElementById('count');
  const search = document.getElementById('search');
  const exportBtn = document.getElementById('exportJson');
  const saveBtn = document.getElementById('saveLocal');
  const newBtn = document.getElementById('newGallery');
  const addUrl = document.getElementById('addUrl');
  const dockUrl = document.getElementById('dockUrl');
  const dockExport = document.getElementById('dockExport');
  const galleryTitle = document.getElementById('galleryTitle');

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lbTitle = document.getElementById('lightboxTitle');
  const lbDesc = document.getElementById('lightboxDesc');

  let data = loadLocal() || sampleData();
  galleryTitle.value = data.title || "Gallery";
  render();

  // iPhone-friendly: visible <label for="uploadInput"> triggers native sheet (Photos/Camera/Browse)
  uploadInput.addEventListener('change', async e => {
    const files = [...(e.target.files || [])];
    for (const file of files) {
      const src = await fileToDataURL(file);
      pushItem({ src, title: file.name.replace(/\.[^.]+$/, ''), desc: '', tags: [] });
    }
    uploadInput.value = "";
  });

  document.getElementById('importJson').addEventListener('change', async e => {
    try{
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const obj = JSON.parse(text);
      validate(obj);
      data = obj;
      galleryTitle.value = data.title || "Gallery";
      render(); autosave();
      e.target.value = "";
      toast("Imported JSON");
    }catch(err){
      alert('Import failed: ' + err.message);
    }
  });

  exportBtn.addEventListener('click', () => doExport());
  dockExport.addEventListener('click', () => doExport());

  saveBtn.addEventListener('click', () => {
    saveLocal();
    toast("Saved locally");
  });

  newBtn.addEventListener('click', () => {
    if(!confirm("Start a new, empty gallery? You can re-import JSON later.")) return;
    data = { title: "New Gallery", items: [] };
    galleryTitle.value = data.title;
    render(); autosave();
  });

  function askUrl(){
    const url = prompt('Paste image URL');
    if (!url) return;
    pushItem({ src: url.trim(), title: '', desc: '', tags: [] });
  }
  addUrl.addEventListener('click', askUrl);
  dockUrl.addEventListener('click', askUrl);

  search.addEventListener('input', render);
  galleryTitle.addEventListener('input', () => { data.title = galleryTitle.value; autosave(); });

  // Lightbox
  lightboxClose.addEventListener('click', () => lightbox.hidden = true);
  lightbox.addEventListener('click', (e) => { if(e.target === lightbox) lightbox.hidden = true; });

  function doExport(){
    const out = JSON.stringify(data, null, 2);
    const blob = new Blob([out], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (data.title || 'gallery') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // --- Rendering ---
  function render(){
    grid.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    const items = q ? data.items.filter(it => match(it, q)) : data.items;

    for (const item of items){
      const node = tmpl.content.firstElementChild.cloneNode(true);
      const img = node.querySelector('.thumb');
      const title = node.querySelector('.title');
      const desc = node.querySelector('.desc');
      const tags = node.querySelector('.tags');
      const remove = node.querySelector('.remove');
      const replaceBtn = node.querySelector('.replace');
      const moveBtn = node.querySelector('.move');

      img.src = item.src;
      img.alt = item.title || "Image";
      img.onclick = () => openLightbox(item);

      title.value = item.title || '';
      desc.value = item.desc || '';
      tags.value = (item.tags || []).join(', ');

      title.oninput = () => { item.title = title.value; autosave(); updateLightboxIfOpen(item); };
      desc.oninput = () => { item.desc = desc.value; autosave(); updateLightboxIfOpen(item); };
      tags.oninput = () => { item.tags = splitTags(tags.value); autosave(); };

      remove.onclick = () => {
        if (!confirm('Remove this image?')) return;
        data.items = data.items.filter(x => x.id !== item.id);
        render(); autosave();
      };

      replaceBtn.onclick = () => {
        // Make a temporary file input to guarantee iOS sheet
        const tmp = document.createElement('input');
        tmp.type = 'file';
        tmp.accept = 'image/*,image/heic,image/heif';
        tmp.capture = 'environment';
        tmp.onchange = async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const src = await fileToDataURL(file);
          item.src = src; autosave(); render();
        };
        tmp.click();
      };

      // Drag sorting
      node.addEventListener('dragstart', ev => {
        node.classList.add('dragging');
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', item.id);
      });
      node.addEventListener('dragend', () => node.classList.remove('dragging'));
      moveBtn.addEventListener('touchstart', () => {});

      grid.appendChild(node);
    }
    count.textContent = `${items.length} / ${data.items.length}`;

    // Drop logic
    grid.ondragover = e => {
      e.preventDefault();
      const after = getDragAfterElement(grid, e.clientY);
      const dragging = grid.querySelector('.card.dragging');
      if (!dragging) return;
      if (after == null) grid.appendChild(dragging);
      else grid.insertBefore(dragging, after);
    };
    grid.ondrop = e => {
      e.preventDefault();
      const domSrcs = Array.from(grid.querySelectorAll('.card .thumb')).map(i => i.src);
      data.items.sort((a,b) => domSrcs.indexOf(a.src) - domSrcs.indexOf(b.src));
      autosave(); render();
    };
  }

  function openLightbox(item){
    lightboxImg.src = item.src;
    lbTitle.textContent = item.title || '';
    lbDesc.textContent = item.desc || '';
    lightbox.hidden = false;
  }
  function updateLightboxIfOpen(item){
    if (lightbox.hidden) return;
    // Best-effort update if the visible image matches
    if (lightboxImg.src && lightboxImg.src === item.src){
      lbTitle.textContent = item.title || '';
      lbDesc.textContent = item.desc || '';
    }
  }

  function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll('.card:not(.dragging)')];
    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // --- Helpers ---
  function pushItem({src, title, desc, tags}){
    data.items.push({ id: crypto.randomUUID(), src, title, desc, tags });
    render(); autosave();
  }
  function match(it, q){
    const hay = [it.title||'', it.desc||'', ...(it.tags||[])].join(' ').toLowerCase();
    return hay.includes(q);
  }
  function splitTags(str){
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }
  function fileToDataURL(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function validate(obj){
    if (typeof obj !== 'object' || !obj.items || !Array.isArray(obj.items)) throw new Error('Invalid shape: expected { title, items: [] }');
    for (const it of obj.items){
      if (typeof it.src !== 'string') throw new Error('Each item needs a string "src"');
      if (!it.id) it.id = crypto.randomUUID();
      it.tags = Array.isArray(it.tags) ? it.tags : [];
      it.title = it.title || '';
      it.desc = it.desc || '';
    }
    obj.title = obj.title || 'J//Gallery';
  }
  function saveLocal(){
    localStorage.setItem(KEY, JSON.stringify(data));
  }
  function loadLocal(){
    try{
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  }
  function autosave(){
    clearTimeout(autosave._t);
    autosave._t = setTimeout(saveLocal, 250);
  }
  function toast(msg){
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.position='fixed'; el.style.bottom='84px'; el.style.right='16px';
    el.style.padding='10px 12px'; el.style.border='1px solid #2a2a2a';
    el.style.background='#141414'; el.style.borderRadius='10px'; el.style.color='#fff';
    el.style.opacity='0'; el.style.transition='opacity .2s, transform .2s'; el.style.transform='translateY(6px)';
    el.style.zIndex='60';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{el.style.opacity='1'; el.style.transform='translateY(0)'});
    setTimeout(()=>{el.style.opacity='0'; el.style.transform='translateY(6px)'; setTimeout(()=>el.remove(),200)},1400);
  }
  function sampleData(){
    return {
      title: "J//Gallery",
      items: [
        {
          id: crypto.randomUUID(),
          src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=60",
          title: "City Night",
          desc: "Demo image. Replace me.",
          tags: ["city","night"]
        },
        {
          id: crypto.randomUUID(),
          src: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=60",
          title: "Portrait",
          desc: "Demo image. Replace me.",
          tags: ["portrait"]
        }
      ]
    };
  }
})();