const $ = sel => document.querySelector(sel);
const toaster = $('#toaster');

function toast({type='info', title='پیام', msg=''}){
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="body">
    <div class="title">${title}</div>
    <div class="msg">${msg}</div>
  </div>
  <div class="close">✕</div>`;
  toaster.appendChild(el);
  const remove = () => { el.style.opacity = '0'; setTimeout(()=> el.remove(), 150); };
  el.querySelector('.close').onclick = remove;
  setTimeout(remove, 5500);
}

async function runProbes(){
  try{
    const s = await window.raoof.getSettings();
    const p = await window.raoof.netProbe(s.startUrl);
    toast({type: p.usesHTTPS ? 'success' : 'error', title:'HTTPS', msg: p.usesHTTPS ? 'اتصال با HTTPS است.' : 'آدرس شروع HTTPS نیست.'});
    toast({type: p.internetOK ? 'success' : 'error', title:'اتصال اینترنت', msg: p.internetOK ? 'اتصال اینترنت برقرار است.' : 'اتصال اینترنت برقرار نیست.'});
    const hp = p.hostProbe;
    if (hp.dnsResolved) toast({type:'success', title:'DNS', msg:'دامنه raoofictc.com resolve شد.'});
    else toast({type:'error', title:'DNS', msg: hp.error || 'عدم resolve دامنه.'});
    if (hp.serverUp) toast({type: hp.sslAuthorized ? 'success' : 'error', title:'سرور', msg: hp.sslAuthorized ? `سرور در دسترس (SSL معتبر، صادرکننده: ${hp.issuer || 'نامشخص'})` : 'سرور در دسترس ولی SSL نامعتبر است.'});
    else toast({type:'error', title:'سرور', msg:'عدم دریافت پاسخ از سرور.'});
  }catch(e){
    toast({type:'error', title:'Probes', msg:String(e)});
  }
}

(async function init(){
  try{ await runProbes(); }catch(e){}
  try {
    const v = await window.raoof.appVersion();
    $('#version').textContent = 'v' + v;
  } catch(e){}

  const settings = await window.raoof.getSettings();
  const startUrlInput = $('#startUrl');
  startUrlInput.value = settings.startUrl || '';

  startUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#launch').click();
  });

  
  // Launch button: open admin URL in modal webview (fallback to default if empty)
  $('#launch').onclick = async () => {
    try {
      const settingsNow = await window.raoof.getSettings();
      let url = (startUrlInput.value || settingsNow.startUrl || '').trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://raoofictc.com/wp-admin';
      }
      try { new URL(url); } catch { url = 'https://raoofictc.com/wp-admin'; }
      // Persist if user typed a new one
      if (startUrlInput.value && startUrlInput.value.trim() && startUrlInput.value.trim() !== settingsNow.startUrl) {
        await window.raoof.setSetting('startUrl', startUrlInput.value.trim());
      }
      modal.classList.remove('hidden');
      if (overlay) overlay.classList.remove('hidden');
      const st = document.getElementById('modalStatus'); if (st) st.textContent = 'در حال بارگذاری...';
      if (webview && webview.loadURL) {
        try { webview.loadURL(url); } catch { webview.src = url; }
      }
    } catch (e) {
      toast({type:'error', title:'خطای راه‌اندازی', msg: String(e)});
    }
  };
$('#saveUrl').onclick = async () => {
    const v = startUrlInput.value.trim();
    if(!/^https?:\/\//i.test(v)) return toast({type:'error', title:'خطا', msg:'آدرس باید با http/https شروع شود.'});
    await window.raoof.setSetting('startUrl', v);
    toast({type:'success', title:'ذخیره شد', msg:'آدرس شروع به‌روزرسانی شد.'});
  };

  $('#clearCache').onclick = async () => {
    await window.raoof.clearCache();
    toast({type:'success', title:'موفق', msg:'کش پاک شد.'});
  };

  $('#devtools').onclick = () => {
    toast({type:'info', title:'راهنما', msg:'برای DevTools از منوی App → DevTools استفاده کنید.'});
  };

  $('#quit').onclick = () => window.close();

  // Sidebar collapse/expand
  const openBtn = null; // removed duplicate
  const toggleBtn = $('#sidebarToggle');
  toggleBtn.onclick = () => {
    document.body.classList.toggle('collapsed');
    const collapsed = document.body.classList.contains('collapsed');
    // openBtn removed
  };
  openBtn.onclick = () => {
    document.body.classList.remove('collapsed');
    openBtn.classList.add('hidden');
  };

  // Fullscreen (window)
  $('#full').onclick = async () => {
    const isFull = await window.raoof.toggleFull();
    toast({type:'info', title:'نمایش', msg: isFull ? 'تمام‌صفحه فعال شد.' : 'تمام‌صفحه غیرفعال شد.'});
  };

  // Web-only fullscreen
  $('#webFull').onclick = async () => {
    const enable = !document.body.classList.contains('webfs');
    document.body.classList.toggle('webfs', enable);
    toast({type:'info', title:'وب', msg: enable ? 'وب فول‌اسکرین شد.' : 'وب به حالت عادی برگشت.'});
  };

  // Launch admin in webview
  const webview = $('#modalView');
  const overlay = $('#modalOverlay');
const modal = document.getElementById('adminModal');
const modalClose = document.getElementById('modalClose');
const modalFullscreen = document.getElementById('modalFullscreen');
if (modalClose) modalClose.onclick = () => { modal.classList.add('hidden'); try{ webview.loadURL('about:blank'); }catch(e){} };
if (modalFullscreen) modalFullscreen.onclick = () => { modal.classList.toggle('fullscreen'); };
if (webview) {
  webview.addEventListener('did-start-loading', () => {
    overlay.classList.remove('hidden');
    const st = document.getElementById('modalStatus'); if (st) st.textContent = 'در حال بارگذاری...';
  });
  webview.addEventListener('did-stop-loading', () => {
    overlay.classList.add('hidden');
    const st = document.getElementById('modalStatus'); if (st) st.textContent = 'آماده';
  });
  webview.addEventListener('did-fail-load', () => {
    overlay.classList.add('hidden');
    const st = document.getElementById('modalStatus'); if (st) st.textContent = 'خطا در بارگذاری';
    if (typeof toast==='function') toast({type:'error', title:'وب', msg:'بارگذاری ناموفق'});
  });
}


  let zoomFactor = 1.0;
  const applyZoom = () => webview.setZoomFactor(zoomFactor);

  $('#zoomIn').onclick = () => { zoomFactor = Math.min(3, zoomFactor + 0.1); applyZoom(); toast({type:'info', title:'Zoom', msg: `×${zoomFactor.toFixed(1)}`}); };
  $('#zoomOut').onclick = () => { zoomFactor = Math.max(0.5, zoomFactor - 0.1); applyZoom(); toast({type:'info', title:'Zoom', msg: `×${zoomFactor.toFixed(1)}`}); };
  $('#resetZoom').onclick = () => { zoomFactor = 1.0; applyZoom(); toast({type:'info', title:'Zoom', msg: 'ریست شد'}); };

  $('#launch').onclick = async () => {
    const s = await window.raoof.getSettings();
    const url = s.startUrl;
    $('#placeholder').style.display = 'none';
    webview.style.display = 'block';
    overlay.classList.remove('hidden');
    webview.src = url;
  };

  webview?.addEventListener('did-start-loading', () => {
    overlay.classList.remove('hidden');
  });
  webview?.addEventListener('did-stop-loading', () => {
    overlay.classList.add('hidden');
    try {
      const host = new URL(webview.getURL()).hostname;
      toast({type:'success', title:'آماده', msg:`بارگذاری شد: ${host}`});
    } catch {
      toast({type:'success', title:'آماده', msg:'صفحه بارگذاری شد.'});
    }
  });
  webview?.addEventListener('did-fail-load', (e) => {
    overlay.classList.add('hidden');
    toast({type:'error', title:'خطا', msg:`بارگذاری ناموفق (${e.errorCode}): ${e.validatedURL || ''}`});
  });

  // Probes on first online
  const triggerProbes = () => runProbes();
  if (navigator.onLine) triggerProbes();
  window.addEventListener('online', triggerProbes, { once: true });
})();


// === Sidebar toggle & WebView helpers ===
(() => {
  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
      const state = document.body.classList.contains('sidebar-collapsed');
      if (window.toast) { toast({type:'info', title:'منو', msg: state ? 'منو بسته شد.' : 'منو باز شد.'}); }
      // Force a relayout so <webview> redraws correctly
      const vw = document.getElementById('modalView');
      if (vw && vw.reload) { try { vw.reload(); } catch(e){} }
    });
  }
  // Ensure webview fills parent
  const vw = document.getElementById('modalView');
  if (vw) {
    const fit = () => { vw.style.height = `${vw.parentElement.clientHeight}px`; };
    window.addEventListener('resize', fit);
    setTimeout(fit, 0);
  }
})();
