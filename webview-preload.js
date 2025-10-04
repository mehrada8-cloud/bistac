// webview-preload.js
// Runs in the isolated world of the <webview>.
// Keep minimal to avoid CSP issues.
(() => {
  // Forward console messages to host page if needed
  console.log('[webview-preload] injected');
})();