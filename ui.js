/* ui.js — patched 2.4.3 */
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);

    const launchBtn     = $('launch');
    const startUrlInput = $('startUrl');
    const modal         = $('modal');
    const modalOverlay  = $('modalOverlay');
    const modalStatus   = $('modalStatus');
    const webview       = $('modalView');

    const hamburgerBtn  = $('hamburger');
    const collapseBtn   = $('collapse'); // will be removed (optional)

    if (collapseBtn) {
      collapseBtn.style.display = 'none';
      try { collapseBtn.remove(); } catch {}
    }

    const safeToast = (opt) => {
      try { window.toast ? window.toast(opt) : console.log(opt); } catch {}
    };

    const getSettings = async () => {
      try { return await window.raoof.getSettings(); } catch { return {}; }
    };
    const setSetting = async (k, v) => {
      try { await window.raoof.setSetting(k, v); } catch {}
    };

    const DEFAULT_URL = 'https://raoofictc.com/wp-admin';
    const resolveAdminUrl = async () => {
      const st = await getSettings();
      let url = (startUrlInput?.value || st.startUrl || '').trim();
      if (!url) return DEFAULT_URL;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      try { new URL(url); return url; } catch { return DEFAULT_URL; }
    };

    const showModal = () => {
      if (modal) modal.classList.remove('hidden');
      if (modalOverlay) modalOverlay.classList.remove('hidden');
      if (modalStatus) modalStatus.textContent = 'در حال بارگذاری...';
    };
    const hideModalOverlay = () => {
      if (modalOverlay) modalOverlay.classList.add('hidden');
    };

    if (webview) {
      if (!webview.src) webview.src = 'about:blank';
      webview.addEventListener('did-start-loading', () => {
        if (modalStatus) modalStatus.textContent = 'در حال بارگذاری...';
        if (modalOverlay) modalOverlay.classList.remove('hidden');
      });
      webview.addEventListener('did-stop-loading', () => {
        if (modalStatus) modalStatus.textContent = 'آماده';
        hideModalOverlay();
      });
      webview.addEventListener('did-fail-load', () => {
        if (modalStatus) modalStatus.textContent = 'خطا در بارگذاری';
        hideModalOverlay();
        safeToast({ type:'error', title:'خطا', msg:'بارگذاری ناموفق بود.' });
      });

      const closeBtn = $('modalClose');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          if (modal) modal.classList.add('hidden');
        });
      }
    }

    if (launchBtn) {
      launchBtn.addEventListener('click', async () => {
        try {
          if (startUrlInput && startUrlInput.value && startUrlInput.value.trim()) {
            await setSetting('startUrl', startUrlInput.value.trim());
          }
          const targetUrl = await resolveAdminUrl();
          showModal();
          if (webview?.loadURL) {
            try { await webview.loadURL(targetUrl); }
            catch { webview.src = targetUrl; }
          } else if (webview) {
            webview.src = targetUrl;
          } else {
            safeToast({ type:'info', title:'باز کردن در مرورگر', msg: targetUrl });
            window.raoof.openExternal?.(targetUrl);
          }
        } catch (err) {
          safeToast({ type:'error', title:'خطای راه‌اندازی', msg: String(err) });
        }
      });
    }

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-open');
      });
    }
  });
})();
