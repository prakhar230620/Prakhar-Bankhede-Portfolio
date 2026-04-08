$mainPath = "js\main.js"
$content  = Get-Content $mainPath -Raw -Encoding UTF8

# Locate the BookReader block using unique boundary strings
$startTag = "/* ================================================================="
$endTag   = "})();" + [char]13 + [char]10 + [char]13 + [char]10 + "// -- Wire up all Reader buttons"

$startIdx = $content.IndexOf($startTag)

# Find the closing })(); that belongs to BookReader (search from startIdx)
$searchFrom = $startIdx + 10
$endTagShort = "// -- Wire up all Reader buttons"
$endIdx = $content.IndexOf($endTagShort, $searchFrom)

# endIdx now points to the comment — go back past })(); + newlines
$blockEnd = $endIdx
while ($blockEnd -gt $startIdx -and $content[$blockEnd-1] -ne ';') { $blockEnd-- }
# $blockEnd is now right after the })(); semicolon

Write-Host "Block starts at: $startIdx"
Write-Host "Block ends at  : $blockEnd"

$newBlock = @'
/* =================================================================
   BOOK READER — PageFlip (desktop) + Direct Canvas (mobile)
   Desktop: all pages pre-rendered to JPEG → PageFlip.loadFromImages()
            giving a real 3-D page-curl flip animation.
   Mobile : single-page direct canvas renderer (fast & reliable).
================================================================= */
const BookReader = (() => {
  let pdf           = null;
  let totalPages    = 0;
  let curPage       = 1;
  let busy          = false;
  let pageFlipInst  = null;   // St.PageFlip instance (desktop only)

  const $  = id => document.getElementById(id);

  /* ── helpers ─────────────────────────────────────────────── */
  function b64toU8(b64) {
    const raw = atob(b64);
    const u8  = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
    return u8;
  }

  function setMsg(html) { $('read-book').innerHTML = html; }
  function setLoading(txt) {
    setMsg('<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;color:#C9A96E;font-family:JetBrains Mono,monospace;font-size:.85rem">' +
           '<div class="reader-loader"></div><span>' + txt + '</span></div>');
  }

  /* ── state reset ─────────────────────────────────────────── */
  function resetState() {
    if (pageFlipInst) {
      try { pageFlipInst.destroy(); } catch(e) {}
      pageFlipInst = null;
    }
    const el = $('read-book');
    if (el) el.innerHTML = '';
    pdf = null; totalPages = 0; curPage = 1; busy = false;
  }

  /* ── overlay show / hide ─────────────────────────────────── */
  function showOverlay() {
    const r = $('book-reader');
    r.removeAttribute('hidden');
    r.offsetHeight;                  // force reflow → triggers CSS fade-in
    r.style.opacity       = '1';
    r.style.pointerEvents = 'auto';
    document.body.style.overflow = 'hidden';
  }

  function hideOverlay() {
    const r = $('book-reader');
    r.style.opacity       = '0';
    r.style.pointerEvents = 'none';
    document.body.style.overflow = '';
    resetState();                    // clean up everything immediately
    setTimeout(() => {
      r.setAttribute('hidden', '');
      r.style.opacity       = '';
      r.style.pointerEvents = '';
    }, 400);
  }

  /* ── PDF loading ─────────────────────────────────────────── */
  async function loadPDF(key) {
    setLoading('Loading book\u2026');
    const b64 = window.PDF_DATA && window.PDF_DATA[key];
    if (!b64) {
      setMsg('<div style="color:#C9A96E;padding:2rem;text-align:center">\u26a0\ufe0f Book data not found.</div>');
      return false;
    }
    try {
      const task = pdfjsLib.getDocument({
        data: b64toU8(b64),
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });
      pdf = await task.promise;
      totalPages = pdf.numPages;
      $('totalPagesNum').textContent = totalPages;
      return true;
    } catch(e) {
      console.error('PDF load error:', e);
      setMsg('<div style="color:#C9A96E;padding:2rem;text-align:center">\u26a0\ufe0f Failed to load book.</div>');
      return false;
    }
  }

  /* ── DESKTOP: pre-render all pages → JPEG → PageFlip ──────
     PageFlip.loadFromImages() is the ONLY reliable way to get
     the page-curl animation working with async PDF.js content.
     loadFromHTML() captures the DOM *before* pdf.js paints,
     so pages come out blank. loadFromImages() bypasses this.
  ─────────────────────────────────────────────────────────── */
  async function initDesktopReader() {
    const sp   = await pdf.getPage(1);
    const spv  = sp.getViewport({ scale: 1 });
    const ratio = spv.width / spv.height;

    // Fit one PAGE into half the container (side-by-side spread)
    const availH = window.innerHeight * 0.72;
    const availW = (window.innerWidth * 0.88) / 2;
    let pageH = availH, pageW = pageH * ratio;
    if (pageW > availW) { pageW = availW; pageH = pageW / ratio; }
    const pageW_i = Math.floor(pageW);
    const pageH_i = Math.floor(pageH);

    // Render resolution: 2× for crisp display
    const dpr   = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (pageW / spv.width) * dpr;

    // Pre-render every page to a JPEG data-URL
    const images = [];
    for (let i = 1; i <= totalPages; i++) {
      setLoading('Preparing book\u2026 ' + i + ' / ' + totalPages);
      const page = await pdf.getPage(i);
      const vp   = page.getViewport({ scale });
      const cv   = document.createElement('canvas');
      cv.width   = vp.width;
      cv.height  = vp.height;
      const ctx  = cv.getContext('2d');
      ctx.imageSmoothingEnabled  = true;
      ctx.imageSmoothingQuality  = 'high';
      // White background so JPEG has no transparent artefacts
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      images.push(cv.toDataURL('image/jpeg', 0.92));
    }

    // Clear container before PageFlip init
    const bookEl = $('read-book');
    bookEl.innerHTML = '';

    // Destroy any previous instance first
    if (pageFlipInst) { try { pageFlipInst.destroy(); } catch(e) {} pageFlipInst = null; }

    pageFlipInst = new St.PageFlip(bookEl, {
      width             : pageW_i,
      height            : pageH_i,
      size              : 'fixed',
      autoCenter        : true,
      drawShadow        : true,
      maxShadowOpacity  : 0.6,
      showCover         : true,   // first+last pages treated as covers
      mobileScrollSupport: false,
      usePortrait       : false,
      startPage         : 0,
    });

    /* Pass pre-rendered image array — reliable & instant */
    pageFlipInst.loadFromImages(images);

    pageFlipInst.on('flip', (e) => {
      curPage = e.data + 1;
      $('currentPageNum').textContent = curPage;
      $('prevPage').disabled = e.data === 0;
      $('nextPage').disabled = e.data >= totalPages - 1;
    });

    curPage = 1;
    $('currentPageNum').textContent = 1;
    $('prevPage').disabled  = true;
    $('nextPage').disabled  = totalPages <= 1;
  }

  /* ── MOBILE: direct single-page canvas renderer ──────────
     No PageFlip on mobile — it is unreliable at narrow widths.
     Simple prev/next with crisp canvas rendering instead.
  ─────────────────────────────────────────────────────────── */
  async function renderMobilePage(pageNum) {
    if (!pdf) return;
    setLoading('Rendering\u2026');

    const availW = window.innerWidth  * 0.94;
    const availH = window.innerHeight * 0.64;

    const sp   = await pdf.getPage(pageNum);
    const spv  = sp.getViewport({ scale: 1 });
    const ratio = spv.width / spv.height;
    let pW = availW, pH = pW / ratio;
    if (pH > availH) { pH = availH; pW = pH * ratio; }

    const dpr   = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (pW / spv.width) * dpr;
    const vp    = sp.getViewport({ scale });

    const bookEl = $('read-book');
    bookEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;';

    const slot = document.createElement('div');
    slot.style.cssText  =
      'background:#fff;border-radius:4px;overflow:hidden;flex-shrink:0;' +
      'width:' + pW + 'px;height:' + pH + 'px;' +
      'box-shadow:0 8px 36px rgba(0,0,0,.65);';

    const cv = document.createElement('canvas');
    cv.width  = vp.width;
    cv.height = vp.height;
    cv.style.cssText = 'width:' + pW + 'px;height:' + pH + 'px;display:block;';

    slot.appendChild(cv);
    wrap.appendChild(slot);
    bookEl.appendChild(wrap);

    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    await sp.render({ canvasContext: ctx, viewport: vp }).promise;

    curPage = pageNum;
    $('currentPageNum').textContent  = pageNum;
    $('prevPage').disabled = pageNum <= 1;
    $('nextPage').disabled = pageNum >= totalPages;
  }

  /* ── public API ───────────────────────────────────────────── */
  return {
    async open(key) {
      if (busy) return;
      busy = true;
      showOverlay();
      const ok = await loadPDF(key);
      if (!ok) { busy = false; return; }

      const isMobile = window.innerWidth < 900;
      if (isMobile) {
        await renderMobilePage(1);
      } else {
        await initDesktopReader();
      }
      busy = false;
    },

    close: hideOverlay,

    next() {
      if (window.innerWidth < 900) {
        if (!busy && curPage < totalPages) renderMobilePage(curPage + 1);
      } else {
        if (pageFlipInst) pageFlipInst.flipNext();
      }
    },

    prev() {
      if (window.innerWidth < 900) {
        if (!busy && curPage > 1) renderMobilePage(curPage - 1);
      } else {
        if (pageFlipInst) pageFlipInst.flipPrev();
      }
    }
  };
})();

'@

# Replace the block in the file content
$before = $content.Substring(0, $startIdx)
$after  = $content.Substring($blockEnd)

$result = $before + $newBlock + $after

[System.IO.File]::WriteAllText(
    (Resolve-Path $mainPath).Path,
    $result,
    [System.Text.UTF8Encoding]::new($false)
)

$finalLines = (Get-Content $mainPath).Count
Write-Host "SUCCESS — main.js now has $finalLines lines"
Write-Host "New block length: $($newBlock.Length) chars"
