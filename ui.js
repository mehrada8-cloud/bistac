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

  // Modal controls
  const modal = document.getElementById('adminModal');
  const modalClose = document.getElementById('modalClose');
  const modalFullscreen = document.getElementById('modalFullscreen');
  modalClose.onclick = () => { modal.classList.add('hidden'); try { webview.loadURL('about:blank'); } catch(e){} };
  modalFullscreen.onclick = () => { modal.classList.toggle('fullscreen'); };

  // WebView events
  webview.addEventListener('did-start-loading', () => {
    overlay.classList.remove('hidden');
    document.getElementById('modalStatus').textContent = 'در حال بارگذاری...';
  });
  webview.addEventListener('did-stop-loading', () => {
    overlay.classList.add('hidden');
    document.getElementById('modalStatus').textContent = 'آماده';
  });
  webview.addEventListener('did-fail-load', (e) => {
    overlay.classList.add('hidden');
    document.getElementById('modalStatus').textContent = 'خطا در بارگذاری';
    toast({type:'error', title:'وب', msg: 'بارگذاری ناموفق: ' + (e && (e.errorDescription||e.errorCode))});
  });

  const overlay = $('#loadingOverlay');

  let zoomFactor = 1.0;
  const applyZoom = () => webview.setZoomFactor(zoomFactor);

  $('#zoomIn').onclick = () => { zoomFactor = Math.min(3, zoomFactor + 0.1); applyZoom(); toast({type:'info', title:'Zoom', msg: `×${zoomFactor.toFixed(1)}`}); };
  $('#zoomOut').onclick = () => { zoomFactor = Math.max(0.5, zoomFactor - 0.1); applyZoom(); toast({type:'info', title:'Zoom', msg: `×${zoomFactor.toFixed(1)}`}); };
  $('#resetZoom').onclick = () => { zoomFactor = 1.0; applyZoom(); toast({type:'info', title:'Zoom', msg: 'ریست شد'}); };

  $('#launch').onclick = async () => {
    const s = await window.raoof.getSettings();
    const url = s.startUrl;
    document.getElementById('adminModal').classList.remove('hidden');
    // shown via modal
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
      const vw = document.getElementById('view');
      if (vw && vw.reload) { try { vw.reload(); } catch(e){} }
    });
  }
  // Ensure webview fills parent
  const vw = document.getElementById('view');
  if (vw) {
    const fit = () => { vw.style.height = `${vw.parentElement.clientHeight}px`; };
    window.addEventListener('resize', fit);
    setTimeout(fit, 0);
  }
})();
