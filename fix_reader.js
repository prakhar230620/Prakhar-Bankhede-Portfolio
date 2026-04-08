const fs   = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'main.js');
let content    = fs.readFileSync(filePath, 'utf8');

// Find the BookReader block
let bookReaderStart = -1;
let search = 0;
while (true) {
  const idx = content.indexOf('/* ===', search);
  if (idx === -1) break;
  if (content.substring(idx, idx + 200).includes('BOOK READER')) {
    bookReaderStart = idx;
    break;
  }
  search = idx + 5;
}

const wireUpStart = content.indexOf('// \u2500\u2500 Wire up all Reader buttons');

if (bookReaderStart === -1 || wireUpStart === -1) {
  console.error('Cannot find markers. bookReaderStart=' + bookReaderStart + ' wireUpStart=' + wireUpStart);
  process.exit(1);
}

console.log('Replacing BookReader block: chars', bookReaderStart, 'to', wireUpStart);

// ── IMAGE CATALOGUE ─────────────────────────────────────────────
// Maps each book key to an ordered array of page image paths.
// Paths are relative to the project root (served by the same origin).
const omnix1Pages = [];
for (let i = 1; i <= 22; i++) {
  omnix1Pages.push(`assets/Books/The_Dark_innovation_Omnix/Chapter_1/The Dark Innovation Omnix Chapter-1-${i}.png`);
}

const soch1Pages = [];
for (let i = 1; i <= 4; i++) {
  soch1Pages.push(`assets/Books/Soch_Pinjra_Or_Azadi/Chapter_1/Soch_Pinjra_Aazadi_Chapter1-${i}.png`);
}

// Check if Chapter 2 images exist
const soch2Dir = path.join(__dirname, 'assets', 'Books', 'Soch_Pinjra_Or_Azadi', 'Chapter_2');
const soch2Pages = [];
if (fs.existsSync(soch2Dir)) {
  const files = fs.readdirSync(soch2Dir).filter(f => /\.(png|jpg|jpeg)$/i.test(f)).sort((a,b)=>{
    const na = parseInt(a.match(/\d+/)?.[0]||0), nb = parseInt(b.match(/\d+/)?.[0]||0);
    return na - nb;
  });
  files.forEach(f => soch2Pages.push(`assets/Books/Soch_Pinjra_Or_Azadi/Chapter_2/${f}`));
}

const catalogue = {
  omnix1: omnix1Pages,
  soch1: soch1Pages,
  soch2: soch2Pages.length ? soch2Pages : soch1Pages, // fallback to ch1 if ch2 not ready
};

// Serialise as a JS object literal embedded inside the new BookReader code
const catalogueJSON = JSON.stringify(catalogue, null, 2);

const newBlock = `/* =================================================================
   BOOK READER — Image-based (PNG pages) + PageFlip animation
   No PDF.js needed. Pages are pre-exported PNGs stored under
   assets/Books/**. PageFlip handles the 3-D curl animation on
   desktop; mobile gets a smooth single-page view with pinch-zoom.
================================================================= */

/* ── Book page catalogues ────────────────────────────────────── */
const BOOK_PAGES = ${catalogueJSON};

const BookReader = (() => {
  let pages        = [];   // array of image URLs for current book
  let totalPages   = 0;
  let curPage      = 1;
  let busy         = false;
  let pageFlipInst = null;  // St.PageFlip instance (desktop only)

  // Zoom state (mobile)
  let zoomLevel    = 1.0;
  const ZOOM_MIN   = 1.0;
  const ZOOM_MAX   = 4.0;
  const ZOOM_STEP  = 0.5;

  const $el = id => document.getElementById(id);

  /* ── loading indicator ───────────────────────────────────── */
  function setLoading(txt) {
    $el('read-book').innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'height:100%;gap:14px;color:#C9A96E;font-family:JetBrains Mono,monospace;font-size:.85rem">' +
      '<div class="reader-loader"></div><span>' + txt + '</span></div>';
  }

  /* ── state reset ─────────────────────────────────────────── */
  function resetState() {
    if (pageFlipInst) {
      try { pageFlipInst.destroy(); } catch(e) {}
      pageFlipInst = null;
    }
    const el = $el('read-book');
    if (el) el.innerHTML = '';
    pages = [];
    totalPages = 0;
    curPage    = 1;
    zoomLevel  = 1.0;
    busy       = false;
  }

  /* ── overlay show/hide ───────────────────────────────────── */
  function showOverlay() {
    const r = $el('book-reader');
    r.removeAttribute('hidden');
    r.offsetHeight;
    r.style.opacity       = '1';
    r.style.pointerEvents = 'auto';
    document.body.style.overflow = 'hidden';
  }

  function hideOverlay() {
    const r = $el('book-reader');
    r.style.opacity       = '0';
    r.style.pointerEvents = 'none';
    document.body.style.overflow = '';
    resetState();
    setTimeout(() => {
      r.setAttribute('hidden', '');
      r.style.opacity       = '';
      r.style.pointerEvents = '';
    }, 400);
  }

  /* ── Preload images (parallel) ───────────────────────────── */
  function preloadImages(urls) {
    return Promise.all(urls.map(url => new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = url;
    })));
  }

  /* ── DESKTOP renderer — PageFlip + loadFromImages() ────────
     All page image URLs are given directly to PageFlip.
     No base64 conversion needed — PageFlip fetches via <img>.
  ─────────────────────────────────────────────────────────── */
  async function initDesktopReader() {
    setLoading('Loading book pages\u2026');
    // Preload first few pages eagerly, rest lazily
    await preloadImages(pages.slice(0, Math.min(3, pages.length)));

    // Compute display size
    const img0    = await new Promise(res => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res({ naturalWidth: 794, naturalHeight: 1123 }); // A4 fallback
      i.src = pages[0];
    });
    const ratio   = img0.naturalWidth / img0.naturalHeight;
    const availH  = window.innerHeight * 0.82;
    const availW  = (window.innerWidth  * 0.90) / 2;
    let pageH = availH, pageW = pageH * ratio;
    if (pageW > availW) { pageW = availW; pageH = pageW / ratio; }
    const pW = Math.floor(pageW);
    const pH = Math.floor(pageH);

    // Destroy old PageFlip
    if (pageFlipInst) { try { pageFlipInst.destroy(); } catch(e) {} pageFlipInst = null; }

    // Fresh host div for PageFlip every time
    const bookEl = $el('read-book');
    bookEl.innerHTML = '';
    const flipHost = document.createElement('div');
    flipHost.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
    bookEl.appendChild(flipHost);

    pageFlipInst = new St.PageFlip(flipHost, {
      width              : pW,
      height             : pH,
      size               : 'fixed',
      autoCenter         : true,
      drawShadow         : true,
      maxShadowOpacity   : 0.6,
      showCover          : true,
      mobileScrollSupport: false,
      usePortrait        : false,
      startPage          : 0,
    });

    // Pass image URL array directly — no base64 conversion, no blur!
    pageFlipInst.loadFromImages(pages);

    pageFlipInst.on('flip', (e) => {
      curPage = e.data + 1;
      $el('currentPageNum').textContent = curPage;
      $el('prevPage').disabled = e.data === 0;
      $el('nextPage').disabled = e.data >= totalPages - 1;
    });

    curPage = 1;
    $el('currentPageNum').textContent = 1;
    $el('prevPage').disabled  = true;
    $el('nextPage').disabled  = totalPages <= 1;
  }

  /* ── MOBILE renderer — single page + pinch/tap zoom ────────
     Shows one page at a time. User can zoom in/out with the
     zoom buttons or pinch gesture to read small text clearly.
  ─────────────────────────────────────────────────────────── */
  function renderMobilePage(pageNum, preserveZoom) {
    if (!pages.length) return;
    if (!preserveZoom) zoomLevel = 1.0;

    const bookEl  = $el('read-book');
    const availW  = window.innerWidth  * 0.96;
    const availH  = window.innerHeight * 0.78;

    bookEl.innerHTML = '';

    // Outer scroll container (scrollable when zoomed)
    const scroll = document.createElement('div');
    scroll.id    = 'rb-scroll';
    scroll.style.cssText =
      'width:100%;height:100%;overflow:auto;display:flex;' +
      'align-items:center;justify-content:center;-webkit-overflow-scrolling:touch;';
    bookEl.appendChild(scroll);

    const inner = document.createElement('div');
    inner.id    = 'rb-inner';
    inner.style.cssText = 'display:flex;align-items:center;justify-content:center;flex-shrink:0;';
    scroll.appendChild(inner);

    const img = document.createElement('img');
    img.src   = pages[pageNum - 1];
    img.alt   = 'Page ' + pageNum;
    img.style.cssText =
      'display:block;max-width:' + availW + 'px;max-height:' + availH + 'px;' +
      'width:auto;height:auto;' +
      'box-shadow:0 8px 36px rgba(0,0,0,.65);border-radius:4px;' +
      'transform-origin:center center;' +
      'transform:scale(' + zoomLevel + ');' +
      'transition:transform .2s ease;user-select:none;';
    inner.appendChild(img);

    // Zoom controls bar (floating above image)
    const zBar = document.createElement('div');
    zBar.id    = 'rb-zoombar';
    zBar.style.cssText =
      'position:absolute;bottom:5rem;right:1rem;' +
      'display:flex;flex-direction:column;gap:8px;z-index:20;';
    const btnStyle =
      'width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.15);' +
      'background:rgba(18,16,14,.85);color:#C9A96E;font-size:1.3rem;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:manipulation;';

    const zIn  = document.createElement('button');
    zIn.innerHTML  = '+';
    zIn.title      = 'Zoom in';
    zIn.style.cssText = btnStyle;
    zIn.onclick = () => { zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP); applyZoom(); };

    const zOut = document.createElement('button');
    zOut.innerHTML = '−';
    zOut.title     = 'Zoom out';
    zOut.style.cssText = btnStyle;
    zOut.onclick = () => { zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP); applyZoom(); };

    const zReset = document.createElement('button');
    zReset.innerHTML = '⤢';
    zReset.title     = 'Reset zoom';
    zReset.style.cssText = btnStyle;
    zReset.onclick = () => { zoomLevel = 1.0; applyZoom(); };

    zBar.appendChild(zIn);
    zBar.appendChild(zOut);
    zBar.appendChild(zReset);
    bookEl.style.position = 'relative';
    bookEl.appendChild(zBar);

    function applyZoom() {
      img.style.transform = 'scale(' + zoomLevel + ')';
    }

    // Native pinch-to-zoom (touch events)
    let lastDist = 0;
    scroll.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    scroll.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = dist - lastDist;
        if (Math.abs(delta) > 2) {
          zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel + delta * 0.01));
          applyZoom();
          lastDist = dist;
        }
      }
    }, { passive: true });

    curPage = pageNum;
    $el('currentPageNum').textContent  = pageNum;
    $el('prevPage').disabled = pageNum <= 1;
    $el('nextPage').disabled = pageNum >= totalPages;
  }

  /* ── public API ───────────────────────────────────────────── */
  return {
    async open(key) {
      if (busy) return;
      const catalogue = window.BOOK_PAGES || BOOK_PAGES;
      const pagePaths = catalogue[key];
      if (!pagePaths || !pagePaths.length) {
        console.error('BookReader: no pages found for key:', key);
        return;
      }
      busy = true;
      showOverlay();
      setLoading('Opening book\u2026');

      pages      = pagePaths;
      totalPages = pages.length;
      $el('totalPagesNum').textContent = totalPages;
      curPage    = 1;

      const isMobile = window.innerWidth < 900;
      if (isMobile) {
        renderMobilePage(1);
        busy = false;
      } else {
        await initDesktopReader();
        busy = false;
      }
    },

    close: hideOverlay,

    next() {
      const isMobile = window.innerWidth < 900;
      if (isMobile) {
        if (!busy && curPage < totalPages) renderMobilePage(curPage + 1, true);
      } else {
        if (pageFlipInst) pageFlipInst.flipNext();
      }
    },

    prev() {
      const isMobile = window.innerWidth < 900;
      if (isMobile) {
        if (!busy && curPage > 1) renderMobilePage(curPage - 1, true);
      } else {
        if (pageFlipInst) pageFlipInst.flipPrev();
      }
    },

    zoomIn()    { zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP); const img = document.querySelector('#rb-inner img'); if(img) img.style.transform = 'scale(' + zoomLevel + ')'; },
    zoomOut()   { zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP); const img = document.querySelector('#rb-inner img'); if(img) img.style.transform = 'scale(' + zoomLevel + ')'; },
    resetZoom() { zoomLevel = 1.0;                                         const img = document.querySelector('#rb-inner img'); if(img) img.style.transform = 'scale(1)'; },
  };
})();

`;

const before = content.substring(0, bookReaderStart);
const after  = content.substring(wireUpStart);

const result = before + newBlock + after;

fs.writeFileSync(filePath, result, 'utf8');
const finalLines = result.split('\n').length;
console.log('SUCCESS — main.js rewritten. Lines: ' + finalLines);
console.log('Catalogue pages — omnix1:', omnix1Pages.length, '| soch1:', soch1Pages.length, '| soch2:', soch2Pages.length);
