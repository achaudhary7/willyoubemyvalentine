/**
 * Cookie Consent Manager
 *
 * Loads Google Analytics only after user consent.
 */
(function() {
  var CONSENT_KEY = 'cookieConsent';

  function loadScript(src, attrs) {
    var script = document.createElement('script');
    script.src = src;
    if (attrs) {
      Object.keys(attrs).forEach(function(key) {
        script[key] = attrs[key];
      });
    }
    document.head.appendChild(script);
  }

  function injectStyles() {
    if (document.getElementById('cookieConsentStyles')) return;
    var style = document.createElement('style');
    style.id = 'cookieConsentStyles';
    style.textContent =
      '#cookieConsent{position:fixed;bottom:16px;left:16px;right:16px;max-width:920px;margin:0 auto;background:#ffffff;color:#333;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,0.15);padding:14px 18px;z-index:9999;display:none}' +
      '#cookieConsent .consent-row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}' +
      '#cookieConsent .consent-actions{display:flex;gap:10px}' +
      '#cookieConsent .consent-actions button{border:0;border-radius:20px;padding:8px 16px;font-weight:600;cursor:pointer}' +
      '#cookieConsent .btn-accept{background:#ff6b9d;color:#fff}' +
      '#cookieConsent .btn-decline{background:#f3f4f6;color:#111}' +
      '#cookieConsent a{color:#ff6b9d;text-decoration:none;font-weight:600}' +
      '@media (max-width:640px){#cookieConsent{padding:12px 14px}#cookieConsent .consent-actions{width:100%;justify-content:flex-end}}';
    document.head.appendChild(style);
  }

  function injectBanner() {
    if (document.getElementById('cookieConsent')) return;
    var banner = document.createElement('div');
    banner.id = 'cookieConsent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<div class="consent-row">' +
      '<div>We use cookies for analytics to improve the site experience. <a href="/privacy/">Privacy Policy</a></div>' +
      '<div class="consent-actions">' +
      '<button class="btn-decline" type="button">Decline</button>' +
      '<button class="btn-accept" type="button">Accept</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(banner);

    var declineBtn = banner.querySelector('.btn-decline');
    var acceptBtn = banner.querySelector('.btn-accept');
    if (declineBtn) declineBtn.addEventListener('click', function() { enableConsent('denied'); });
    if (acceptBtn) acceptBtn.addEventListener('click', function() { enableConsent('granted'); });
  }

  function enableConsent(mode) {
    try {
      localStorage.setItem(CONSENT_KEY, mode);
    } catch (e) {
      // If storage is blocked, still proceed for this session
    }

    if (mode === 'granted') {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag(){ dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', 'G-HDVZBTE0GC', { 'anonymize_ip': true });

      loadScript('https://www.googletagmanager.com/gtag/js?id=G-HDVZBTE0GC', { async: true });
    }

    var banner = document.getElementById('cookieConsent');
    if (banner) banner.style.display = 'none';
  }

  function initConsent() {
    injectStyles();
    injectBanner();

    var banner = document.getElementById('cookieConsent');
    var stored = null;
    try {
      stored = localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      stored = null;
    }

    if (stored === 'granted') {
      enableConsent('granted');
      return;
    }
    if (stored === 'denied') {
      if (banner) banner.style.display = 'none';
      return;
    }
    if (banner) banner.style.display = 'block';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConsent);
  } else {
    initConsent();
  }
})();
