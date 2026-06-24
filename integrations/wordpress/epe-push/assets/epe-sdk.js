(function () {
  "use strict";

  var config = window.ExoticPushEngineConfig || {};
  var state = {
    launcher: null,
    tray: null,
    trayItems: [],
    bellOffset: 20,
  };

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return;
  }

  function decodeBase64Url(value) {
    var normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    var padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    var raw = atob(normalized + padding);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
  }

  function detectBrowser() {
    var ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return "Edge";
    if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return "Chrome";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Safari\//.test(ua)) return "Safari";
    return "Unknown";
  }

  function detectDeviceType() {
    var ua = navigator.userAgent;
    if (/iPad|Tablet/.test(ua)) return "tablet";
    if (/Mobi|Android|iPhone/.test(ua)) return "mobile";
    return "desktop";
  }

  function getSiteKey() {
    return config.siteKey || "site";
  }

  function getDismissKey() {
    return "epe:prompt:dismissed:" + getSiteKey();
  }

  function getUnsubscribedKey() {
    return "epe:subscription:unsubscribed:" + getSiteKey();
  }

  function shouldSuppressPrompt() {
    var delayDays = Number(config.optInPromptRepromptDelayDays || 0);
    if (!delayDays) {
      return false;
    }

    try {
      var raw = window.localStorage.getItem(getDismissKey());
      if (!raw) {
        return false;
      }

      var dismissedAt = Number(raw);
      if (!dismissedAt) {
        return false;
      }

      return Date.now() - dismissedAt < delayDays * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  function markPromptDismissed() {
    try {
      window.localStorage.setItem(getDismissKey(), String(Date.now()));
    } catch {
      return;
    }
  }

  function clearPromptDismissed() {
    try {
      window.localStorage.removeItem(getDismissKey());
    } catch {
      return;
    }
  }

  function isUnsubscribedLocally() {
    try {
      return window.localStorage.getItem(getUnsubscribedKey()) === "1";
    } catch {
      return false;
    }
  }

  function markLocallyUnsubscribed() {
    try {
      window.localStorage.setItem(getUnsubscribedKey(), "1");
    } catch {
      return;
    }
  }

  function clearLocalUnsubscribe() {
    try {
      window.localStorage.removeItem(getUnsubscribedKey());
    } catch {
      return;
    }
  }

  function clampLimit(value) {
    var parsed = Number(value || 3);
    if (!parsed || parsed < 1) {
      return 3;
    }
    return Math.min(parsed, 10);
  }

  function getBellAvoidanceOffset() {
    var offset = 0;
    var nodes = document.body ? document.body.querySelectorAll("*") : [];

    for (var i = 0; i < nodes.length; i++) {
      var element = nodes[i];
      if (!element || !element.getBoundingClientRect) {
        continue;
      }

      if (element.classList && element.classList.contains("epe-optin-launcher")) {
        continue;
      }
      if (element.classList && element.classList.contains("epe-notification-tray")) {
        continue;
      }

      var style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        continue;
      }

      if (style.position !== "fixed" && style.position !== "sticky") {
        continue;
      }

      var rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      if (rect.right <= 0 || rect.left >= viewportWidth) {
        continue;
      }

      // Only treat an element as a "bottom bar" we need to avoid if it's
      // actually anchored flush against the bottom edge -- not merely
      // overlapping the bottom-left region. Tall fixed elements (off-canvas
      // nav drawers, full-height overlays many themes leave in the DOM at
      // opacity:0 rather than display:none) satisfy the old, looser check
      // and were pushing the bell's offset up by nearly a full viewport
      // height, landing it near the top of the page or off-screen entirely.
      var isFlushToBottom = Math.abs(viewportHeight - rect.bottom) <= 24;
      var intersectsBottomLeft = rect.left <= 140 && isFlushToBottom;
      if (!intersectsBottomLeft) {
        continue;
      }

      offset = Math.max(offset, Math.max(0, viewportHeight - rect.top) + 16);
    }

    // Safety net regardless of the heuristic above: never let a single
    // obstruction push the launcher further than this from the bottom edge.
    return Math.min(offset, 200);
  }

  function updateBellPosition() {
    if (!state.launcher) {
      return;
    }

    state.bellOffset = getBellAvoidanceOffset();
    state.launcher.style.left = "20px";
    state.launcher.style.bottom = 20 + state.bellOffset + "px";

    if (state.tray) {
      state.tray.style.left = "20px";
      state.tray.style.bottom = 92 + state.bellOffset + "px";
    }
  }

  function createStyles() {
    if (document.getElementById("epe-optin-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "epe-optin-styles";
    style.textContent = `
      .epe-optin-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        padding: 16px;
        pointer-events: none;
        animation: epeOptinFade 180ms ease-out;
      }
      .epe-optin-backdrop--lightbox-1 {
        align-items: flex-start;
        justify-content: center;
        padding-top: 24px;
      }
      .epe-optin-backdrop--lightbox-2 {
        align-items: center;
        justify-content: center;
      }
      .epe-optin-backdrop--bell-icon {
        align-items: flex-end;
        justify-content: flex-start;
        padding-bottom: 24px;
        padding-left: 24px;
      }
      @media (max-width: 767px) {
        .epe-optin-backdrop--lightbox-1 {
          align-items: flex-end;
          padding-bottom: 24px;
          padding-top: 16px;
        }
        .epe-optin-backdrop--bell-icon {
          padding-left: 16px;
          padding-bottom: 16px;
        }
      }
      .epe-optin-panel {
        position: relative;
        width: min(920px, 100%);
        border-radius: 28px;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 30px 90px rgba(15, 23, 42, 0.25);
        animation: epeOptinRise 220ms ease-out;
        pointer-events: auto;
      }
      .epe-optin-panel[data-type="lightbox-2"] {
        width: min(760px, 100%);
      }
      .epe-optin-panel[data-type="bell-icon"] {
        width: min(360px, 100%);
      }
      .epe-optin-shell {
        display: grid;
        gap: 16px;
        padding: 24px;
      }
      .epe-optin-header {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }
      .epe-optin-icon {
        width: 72px;
        height: 72px;
        border-radius: 20px;
        overflow: hidden;
        background: rgba(15, 23, 42, 0.04);
        display: grid;
        place-items: center;
      }
      .epe-optin-icon img {
        width: 48px;
        height: 48px;
        object-fit: contain;
      }
      .epe-optin-headline {
        margin: 0;
        font-size: 1.125rem;
        line-height: 1.2;
        font-weight: 700;
      }
      .epe-optin-text {
        margin: 6px 0 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .epe-optin-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        flex-wrap: wrap;
      }
      .epe-optin-button {
        min-height: 46px;
        padding: 0 18px;
        border: 0;
        border-radius: 14px;
        cursor: pointer;
        font-weight: 700;
        letter-spacing: 0.01em;
        font-size: 0.95rem;
        line-height: 1;
      }
      .epe-optin-button:focus-visible,
      .epe-optin-close:focus-visible,
      .epe-optin-launcher:focus-visible,
      .epe-notification-tray__unsubscribe:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }
      .epe-optin-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.45);
        color: #ffffff;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }
      .epe-optin-close:hover {
        background: rgba(15, 23, 42, 0.6);
      }
      .epe-optin-launcher {
        position: fixed;
        z-index: 2147483000;
        width: 58px;
        height: 58px;
        border-radius: 999px;
        border: 0;
        cursor: pointer;
        box-shadow: 0 18px 36px rgba(15, 23, 42, 0.28);
        display: grid;
        place-items: center;
        font-size: 24px;
        line-height: 1;
      }
      .epe-notification-tray {
        position: fixed;
        z-index: 2147483000;
        width: min(360px, calc(100vw - 32px));
        max-height: min(460px, calc(100vh - 132px));
        border-radius: 24px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 24px 72px rgba(15, 23, 42, 0.22);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        backdrop-filter: blur(10px);
      }
      .epe-notification-tray__header,
      .epe-notification-tray__footer {
        padding: 16px 18px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      }
      .epe-notification-tray__footer {
        border-bottom: 0;
        border-top: 1px solid rgba(15, 23, 42, 0.08);
      }
      .epe-notification-tray__title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
      }
      .epe-notification-tray__list {
        overflow: auto;
        padding: 12px;
        display: grid;
        gap: 10px;
      }
      .epe-notification-card {
        display: grid;
        gap: 6px;
        padding: 14px;
        border-radius: 18px;
        background: rgba(15, 23, 42, 0.04);
        border: 1px solid rgba(15, 23, 42, 0.07);
      }
      .epe-notification-card__title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
      }
      .epe-notification-card__message {
        margin: 0;
        font-size: 0.88rem;
        line-height: 1.45;
        color: rgba(15, 23, 42, 0.82);
      }
      .epe-notification-card__meta {
        margin: 0;
        font-size: 0.78rem;
        color: rgba(15, 23, 42, 0.58);
      }
      .epe-notification-empty {
        padding: 20px;
        color: rgba(15, 23, 42, 0.68);
        font-size: 0.9rem;
      }
      .epe-notification-tray__unsubscribe {
        border: 0;
        background: transparent;
        color: #b91c1c;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 0;
      }
      @keyframes epeOptinFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes epeOptinRise { from { transform: translateY(14px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
    `;
    document.head.appendChild(style);
  }

  function registerSubscription(registration) {
    if (!config.apiUrl || !getSiteKey() || !config.vapidPublicKey) {
      return Promise.resolve(null);
    }

    return registration.pushManager
      .getSubscription()
      .then(function (existing) {
        if (existing) {
          return existing;
        }

        return registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(config.vapidPublicKey),
        });
      })
      .then(function (subscription) {
        if (!subscription) {
          return null;
        }

        var subJson = subscription.toJSON();
        var keys = subJson.keys || {};

        clearLocalUnsubscribe();

        return fetch(config.apiUrl + "/subscribers/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: getSiteKey(),
            browser: detectBrowser(),
            deviceType: detectDeviceType(),
            language: (navigator.language || "en").slice(0, 10),
            subscriptionEndpoint: subscription.endpoint,
            p256dhKey: keys.p256dh || null,
            authKey: keys.auth || null,
          }),
        }).then(function (response) {
          // fetch() only rejects on network failure, never on HTTP error status --
          // without this check, a 400/404/500 from the API was silently ignored
          // and the UI went on to show the subscriber launcher as if registration
          // had actually succeeded, even though nothing was ever persisted.
          if (!response.ok) {
            throw new Error("Subscriber registration failed with status " + response.status);
          }
          return subscription;
        });
      });
  }

  function fetchRecentNotifications(limit) {
    if (!config.apiUrl || !getSiteKey()) {
      return Promise.resolve([]);
    }

    return fetch(config.apiUrl + "/sites/public/" + encodeURIComponent(getSiteKey()) + "/notifications?limit=" + clampLimit(limit), {
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return { data: [] };
        });
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.data)) {
          return [];
        }

        return payload.data;
      })
      .catch(function () {
        return [];
      });
  }

  function trackPageVisit() {
    if (!config.apiUrl || !getSiteKey()) {
      return;
    }

    fetch(config.apiUrl + "/workflow/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: getSiteKey(),
        triggerEvent: "page_visit",
        payload: { url: window.location.href, referrer: document.referrer || null },
      }),
    }).catch(function () {
      return undefined;
    });
  }

  function closePrompt(backdrop) {
    markPromptDismissed();
    backdrop.remove();
    document.removeEventListener("keydown", backdrop._epeKeydownHandler);
  }

  function showPrompt(registration) {
    if (shouldSuppressPrompt()) {
      return;
    }

    createStyles();

    var backdrop = document.createElement("div");
    backdrop.className = "epe-optin-backdrop epe-optin-backdrop--" + (config.optInPromptType || "lightbox-1");

    var panel = document.createElement("div");
    panel.className = "epe-optin-panel";
    panel.dataset.type = config.optInPromptType || "lightbox-1";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", config.optInPromptHeadline || "Notification prompt");
    panel.style.background = config.optInPromptBackgroundColor || "#ffffff";

    var shell = document.createElement("div");
    shell.className = "epe-optin-shell";

    var close = document.createElement("button");
    close.className = "epe-optin-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.addEventListener("click", function () {
      closePrompt(backdrop);
    });

    var header = document.createElement("div");
    header.className = "epe-optin-header";

    var icon = document.createElement("div");
    icon.className = "epe-optin-icon";
    if (config.optInPromptIconUrl) {
      var img = document.createElement("img");
      img.alt = "";
      img.src = config.optInPromptIconUrl;
      icon.appendChild(img);
    }

    var copy = document.createElement("div");
    var headline = document.createElement("h2");
    headline.className = "epe-optin-headline";
    headline.textContent = config.optInPromptHeadline || "Stay in the loop";
    headline.style.color = config.optInPromptHeadlineTextColor || "#111111";

    var text = document.createElement("p");
    text.className = "epe-optin-text";
    text.textContent = config.optInPromptText || "Get important updates delivered to your browser.";
    text.style.color = config.optInPromptTextColor || "#444444";

    copy.appendChild(headline);
    copy.appendChild(text);
    header.appendChild(icon);
    header.appendChild(copy);

    var actions = document.createElement("div");
    actions.className = "epe-optin-actions";

    var cancel = document.createElement("button");
    cancel.className = "epe-optin-button";
    cancel.type = "button";
    cancel.textContent = config.optInPromptCancelButtonLabel || "Not now";
    cancel.style.color = config.optInPromptCancelButtonTextColor || "#ffffff";
    cancel.style.background = config.optInPromptCancelButtonBackgroundColor || "#111111";
    cancel.addEventListener("click", function () {
      closePrompt(backdrop);
    });

    var approve = document.createElement("button");
    approve.className = "epe-optin-button";
    approve.type = "button";
    approve.textContent = config.optInPromptApproveButtonLabel || "Enable";
    approve.style.color = config.optInPromptApproveButtonTextColor || "#ffffff";
    approve.style.background = config.optInPromptApproveButtonBackgroundColor || "#ea580c";
    approve.addEventListener("click", function () {
      clearPromptDismissed();
      Notification.requestPermission().then(function (permission) {
        backdrop.remove();
        if (permission !== "granted") {
          markPromptDismissed();
          return;
        }

        registerSubscription(registration)
          .then(function (subscription) {
            if (subscription) {
              renderSubscriberLauncher(registration);
            }
          })
          .catch(function () {
            return undefined;
          });
      });
    });

    actions.appendChild(cancel);
    actions.appendChild(approve);

    shell.appendChild(close);
    shell.appendChild(header);
    shell.appendChild(actions);
    panel.appendChild(shell);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    backdrop._epeKeydownHandler = function (event) {
      if (event.key === "Escape") {
        closePrompt(backdrop);
      }
    };
    document.addEventListener("keydown", backdrop._epeKeydownHandler);
    close.focus();
  }

  function removeLauncher() {
    if (state.launcher) {
      state.launcher.remove();
      state.launcher = null;
    }
  }

  function removeTray() {
    if (state.tray) {
      state.tray.remove();
      state.tray = null;
    }
  }

  function closeTrayAndLauncher() {
    removeTray();
    removeLauncher();
  }

  function unsubscribeCurrentSubscription(registration) {
    return registration.pushManager.getSubscription().then(function (subscription) {
      if (!subscription) {
        return false;
      }

      return subscription.unsubscribe().then(function () {
        var unsubscribeRequest = config.apiUrl && getSiteKey()
          ? fetch(config.apiUrl + "/subscribers/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                siteId: getSiteKey(),
                subscriptionEndpoint: subscription.endpoint,
              }),
            })
          : Promise.resolve();

        return Promise.resolve(unsubscribeRequest)
          .catch(function () {
            return undefined;
          })
          .then(function () {
            markLocallyUnsubscribed();
            closeTrayAndLauncher();
            return true;
          });
      });
    });
  }

  function renderNotificationTray(registration) {
    if (state.tray) {
      return;
    }

    createStyles();

    var tray = document.createElement("div");
    tray.className = "epe-notification-tray";
    tray.style.left = "20px";
    tray.style.bottom = 92 + state.bellOffset + "px";

    var header = document.createElement("div");
    header.className = "epe-notification-tray__header";
    header.innerHTML = "<p class=\"epe-notification-tray__title\">Recent notifications</p>";

    var list = document.createElement("div");
    list.className = "epe-notification-tray__list";

    var footer = document.createElement("div");
    footer.className = "epe-notification-tray__footer";

    var unsubscribe = document.createElement("button");
    unsubscribe.className = "epe-notification-tray__unsubscribe";
    unsubscribe.type = "button";
    unsubscribe.textContent = "Unsubscribe";
    unsubscribe.addEventListener("click", function () {
      unsubscribeCurrentSubscription(registration).catch(function () {
        return undefined;
      });
    });

    footer.appendChild(unsubscribe);
    tray.appendChild(header);
    tray.appendChild(list);
    tray.appendChild(footer);
    document.body.appendChild(tray);
    state.tray = tray;
    updateBellPosition();

    fetchRecentNotifications(config.optInPromptRecentNotificationsLimit).then(function (notifications) {
      state.trayItems = notifications;
      list.innerHTML = "";

      if (!notifications.length) {
        var empty = document.createElement("div");
        empty.className = "epe-notification-empty";
        empty.textContent = "No recent notifications yet.";
        list.appendChild(empty);
        return;
      }

      notifications.forEach(function (notification) {
        var card = document.createElement("article");
        card.className = "epe-notification-card";

        var title = document.createElement("h3");
        title.className = "epe-notification-card__title";
        title.textContent = notification.title || "Notification";

        var message = document.createElement("p");
        message.className = "epe-notification-card__message";
        message.textContent = notification.message || "";

        card.appendChild(title);
        card.appendChild(message);

        if (notification.url) {
          var meta = document.createElement("p");
          meta.className = "epe-notification-card__meta";
          meta.textContent = notification.url;
          card.appendChild(meta);
        }

        list.appendChild(card);
      });
    });
  }

  function renderSubscriberLauncher(registration) {
    createStyles();
    removeLauncher();

    var bell = document.createElement("button");
    bell.type = "button";
    bell.className = "epe-optin-launcher";
    bell.setAttribute("aria-label", "Open recent notifications");
    bell.style.background = config.optInPromptApproveButtonBackgroundColor || "#ea580c";
    bell.style.color = config.optInPromptApproveButtonTextColor || "#ffffff";
    bell.textContent = "🔔";
    bell.addEventListener("click", function () {
      if (state.tray) {
        removeTray();
        updateBellPosition();
        return;
      }

      renderNotificationTray(registration);
    });

    document.body.appendChild(bell);
    state.launcher = bell;
    updateBellPosition();
  }

  function renderOptInLauncher(registration) {
    createStyles();
    removeLauncher();

    var bell = document.createElement("button");
    bell.type = "button";
    bell.className = "epe-optin-launcher";
    bell.setAttribute("aria-label", "Open notification prompt");
    bell.style.background = config.optInPromptApproveButtonBackgroundColor || "#ea580c";
    bell.style.color = config.optInPromptApproveButtonTextColor || "#ffffff";
    bell.textContent = "🔔";
    bell.addEventListener("click", function () {
      showPrompt(registration);
      removeLauncher();
    });

    document.body.appendChild(bell);
    state.launcher = bell;
    updateBellPosition();
  }

  function init() {
    if (!config.apiUrl || !getSiteKey() || !config.vapidPublicKey) {
      return;
    }

    trackPageVisit();

    navigator.serviceWorker
      .register(config.serviceWorkerUrl || "/push-sw.js", { scope: "/" })
      .then(function (registration) {
        if (isUnsubscribedLocally()) {
          return;
        }

        if (Notification.permission === "granted") {
          return registerSubscription(registration).then(function (subscription) {
            if (subscription) {
              renderSubscriberLauncher(registration);
            }
          });
        }

        if (Notification.permission === "denied") {
          return;
        }

        if ((config.optInPromptType || "lightbox-1") === "bell-icon") {
          renderOptInLauncher(registration);
          return;
        }

        showPrompt(registration);
      })
      .catch(function () {
        return undefined;
      });

    window.addEventListener(
      "resize",
      function () {
        updateBellPosition();
      },
      { passive: true },
    );
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init, { once: true });
  }
})();
