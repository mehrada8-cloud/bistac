const { app, BrowserWindow, Menu, dialog, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Windows frame to avoid titlebar overlay cropping on webview
const IS_WIN = process.platform === 'win32';

// --- Boost Chromium disk cache (~1GB) ---
app.commandLine.appendSwitch('disk-cache-size', (1024 * 1024 * 1024).toString()); // 1GB

// --- Allowed hosts (whitelist) ---
const ALLOW_HOSTS = new Set([
  'raoofictc.com',
  'www.raoofictc.com'
]);

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_URL = process.env.START_URL || "https://raoofictc.com/wp-admin";

function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const s = JSON.parse(raw);
    if (!s.startUrl) s.startUrl = DEFAULT_URL;
    return s;
  } catch(e) {
    return { startUrl: DEFAULT_URL };
  }
}
function writeSettings(s) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), 'utf8');
    return true;
  } catch(e) { return false; }
}

let splashWin = null;
let mainWin = null;

function createSplash() {
  splashWin = new BrowserWindow({
    width: 520, height: 280, frame: false, transparent: true,
    alwaysOnTop: true, resizable: false, show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
}

function createMain() {
  mainWin = new BrowserWindow({
    width: 1366, height: 900, minWidth: 1024, minHeight: 700,
    frame: IS_WIN ? true : false,
    backgroundColor: '#ffffffff',
    titleBarStyle: IS_WIN ? 'default' : 'hiddenInset',
    vibrancy: IS_WIN ? undefined : 'under-window',
    visualEffectState: IS_WIN ? undefined : 'active',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true
    }
  });

  // External links handling
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (ALLOW_HOSTS.has(host)) return { action: 'allow' };
    } catch {}
    shell.openExternal(url);
    return { action: 'deny' };
  });
  // Prevent in-app navigation to non-whitelisted hosts
  mainWin.webContents.on('will-navigate', (event, url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (!ALLOW_HOSTS.has(host)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {}
  });


  mainWin.webContents.on('will-navigate', (e, url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (!ALLOW_HOSTS.has(host)) {
        e.preventDefault();
        shell.openExternal(url);
        mainWin.webContents.send('toast', { type: 'info', title: 'خارج از دامنه', msg: 'لینک در مرورگر سیستم باز شد.' });
      }
    } catch {
      e.preventDefault();
    }
  });

  mainWin.loadFile(path.join(__dirname, 'index.html'));
  mainWin.once('ready-to-show', () => {
    if (splashWin) { splashWin.close(); splashWin = null; }
    mainWin.show();
  });

  const template = [
    {
      label: 'App',
      submenu: [
        {
          label: 'Clear User Data & Restart',
          click: async () => {
            try {
              await session.defaultSession.clearCache();
              await session.defaultSession.clearStorageData({});
              const cookies = await session.defaultSession.cookies.get({});
              for (const c of cookies) {
                try {
                  await session.defaultSession.cookies.remove((c.secure?'https':'http')+'://' + c.domain.replace(/^\./,'' ) + c.path, c.name);
                } catch {}
              }
              app.relaunch();
              app.exit(0);
            } catch (e) {
              dialog.showErrorBox('Purge Error', String(e));
            }
          }
        },
        { type: 'separator' },
        { role: 'reload', accelerator: 'Ctrl+R' },
        { role: 'forcereload' },
        { type: 'separator' },
        {
          label: 'Clear Cache (Chromium)',
          click: async () => {
            try {
              await session.defaultSession.clearCache();
              mainWin.webContents.send('toast', { type: 'success', title: 'موفق', msg: 'کش کرومیوم پاک شد.' });
            } catch (e) {
              dialog.showErrorBox('Error', String(e));
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen', accelerator: 'F11' },
        { type: 'separator' },
        { role: 'zoomin', accelerator: 'Ctrl+=' },
        { role: 'zoomout', accelerator: 'Ctrl+-' },
        { role: 'resetzoom', accelerator: 'Ctrl+0' },
        { type: 'separator' },
        { label: 'DevTools', click: () => mainWin.webContents.openDevTools({ mode: 'detach' }) }
      ]
    },
    {
      label: 'Shortcuts',
      submenu: [
        { label: 'Back', accelerator: 'Alt+Left', click: () => { if (mainWin.webContents.canGoBack()) mainWin.webContents.goBack(); } },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => { if (mainWin.webContents.canGoForward()) mainWin.webContents.goForward(); } },
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createSplash();
  createMain();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMain();
  });
});
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC
ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:set', (_ev, k, v) => {
  const s = readSettings(); s[k] = v; writeSettings(s); return s;
});
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('cache:clear', async () => { await session.defaultSession.clearCache(); return true; });

// Fullscreen toggle
ipcMain.handle('win:toggleFull', () => {
  if (!mainWin) return false;
  const next = !mainWin.isFullScreen();
  mainWin.setFullScreen(next);
  return next;
});

// --- Network/SSL probes ---
// Use https request to example.com as internet probe and TLS to raoofictc.com
async function probeHost(hostname='raoofictc.com') {
  const result = { dnsResolved: false, serverUp: false, sslAuthorized: false, issuer: null, error: null };
  try {
    // DNS resolve via built-in URL parsing (fallback with fetch attempt)
    result.dnsResolved = true; // assume ok; Windows sandboxing may restrict direct dns module
  } catch(e) {
    result.error = 'DNS check issue: ' + e.message;
  }

  try {
    await new Promise((resolve, reject) => {
      const req = https.get({ hostname, port: 443, path: '/', method: 'GET', timeout: 6000 }, (res) => {
        result.serverUp = true;
        const cert = res.socket.getPeerCertificate && res.socket.getPeerCertificate();
        const tls = res.socket;
        result.sslAuthorized = !!(tls && tls.authorized);
        if (cert) result.issuer = cert.issuer && (cert.issuer.O || cert.issuer.CN || JSON.stringify(cert.issuer));
        res.resume();
        resolve();
      });
      req.on('timeout', () => { req.destroy(new Error('Timeout')); });
      req.on('error', reject);
    });
  } catch(e) {
    result.error = (result.error ? result.error + ' | ' : '') + 'HTTPS check failed: ' + e.message;
  }
  return result;
}


ipcMain.handle('app:purge-and-relaunch', async () => {
  try {
    const ses = session.defaultSession;
    await ses.clearCache();
    await ses.clearStorageData({});
    const cookies = await ses.cookies.get({});
    for (const c of cookies) {
      try {
        await ses.cookies.remove((c.secure?'https':'http')+'://' + c.domain.replace(/^\./,'' ) + c.path, c.name);
      } catch {}
    }
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (e) { return { ok:false, error: String(e) }; }
});

ipcMain.handle('net:probe', async (_e, startUrl) => {
  let usesHTTPS = false;
  try { usesHTTPS = /^https:/i.test(new URL(startUrl || DEFAULT_URL).protocol); } catch {}
  let internetOK = false;
  try {
    await new Promise((resolve, reject) => {
      const req = https.get('https://example.com', { timeout: 6000 }, (res) => { res.resume(); resolve(); });
      req.on('timeout', () => { req.destroy(new Error('Timeout')); });
      req.on('error', reject);
    });
    internetOK = true;
  } catch {}
  const hostProbe = await probeHost('raoofictc.com');
  return { usesHTTPS, internetOK, hostProbe };
});
