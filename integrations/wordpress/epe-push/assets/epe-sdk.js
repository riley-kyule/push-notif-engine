(function () {
  'use strict';

  var config = window.ExoticPushEngineConfig || {};

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return;
  }

  function decodeBase64Url(value) {
    var normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    var padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    var raw = atob(normalized + padding);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
  }

  function detectBrowser() {
    var ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Unknown';
  }

  function detectDeviceType() {
    var ua = navigator.userAgent;
    if (/iPad|Tablet/.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone/.test(ua)) return 'mobile';
    return 'desktop';
  }

  function registerAndSubscribe() {
    if (!config.apiUrl || !config.siteKey || !config.vapidPublicKey) {
      return Promise.resolve();
    }

    var serviceWorkerUrl = config.serviceWorkerUrl || '/push-sw.js';

    return navigator.serviceWorker.register(serviceWorkerUrl, { scope: '/' }).then(function (registration) {
      if (Notification.permission === 'denied') {
        return;
      }

      var permissionPromise = Notification.permission === 'default'
        ? Notification.requestPermission()
        : Promise.resolve(Notification.permission);

      return permissionPromise.then(function (permission) {
        if (permission !== 'granted') {
          return;
        }

        return registration.pushManager.getSubscription().then(function (existing) {
          if (existing) return existing;
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeBase64Url(config.vapidPublicKey),
          });
        }).then(function (subscription) {
          var subJson = subscription.toJSON();
          var keys = subJson.keys || {};

          var payload = {
            siteId: config.siteKey,
            browser: detectBrowser(),
            deviceType: detectDeviceType(),
            language: (navigator.language || 'en').slice(0, 10),
            subscriptionEndpoint: subscription.endpoint,
            p256dhKey: keys.p256dh || null,
            authKey: keys.auth || null,
          };

          return fetch(config.apiUrl + '/api/subscribers/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        });
      });
    }).catch(function () {
      return undefined;
    });
  }

  window.addEventListener('load', function () {
    registerAndSubscribe().catch(function () {
      return undefined;
    });
  });
})();
