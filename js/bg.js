const reloadHistory = new Map(); // Loop protection
const notificationToTabMap = new Map(); // Maps notification ID to tab ID

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Catch when the tab process crashes (unloaded)
  if (changeInfo.status === 'unloaded' && tab.url) {
    try {
      const tabDomain = new URL(tab.url).hostname.replace('www.', '').toLowerCase();

      // Fetch mode settings and allowed sites whitelist
      chrome.storage.local.get(['workMode', 'allowedSites'], (result) => {
        const workMode = result.workMode || 'all'; // Default to all mode
        const allowedSites = result.allowedSites || [];

        let isAllowed = false;

        if (workMode === 'all') {
          isAllowed = true;
        } else {
          isAllowed = allowedSites.some(site => tabDomain === site || tabDomain.endsWith('.' + site));
        }

        if (isAllowed) {
          const timeString = new Date().toLocaleTimeString('en-US');

          if (checkRateLimit(tabId)) {
            console.log(`[Smart Reloader] Reloading: ${tab.url}`);

            showNotification(
              tabId,
              "Tab Crashed (Aw, Snap!)",
              `${tabDomain} crashed at ${timeString}. The page was automatically reloaded. Click to focus.`
            );

            chrome.tabs.reload(tabId);
          } else {
            console.warn(`[Smart Reloader] Rate limit exceeded for tab ${tabId}.`);

            showNotification(
              tabId,
              "Critical Page Failure!",
              `${tabDomain} is crashing too frequently. Auto-reload suspended to prevent system strain. Click to inspect.`
            );
          }
        }
      });
    } catch (e) {
      // Ignore invalid or internal chrome:// URLs
    }
  }
});

// Create push notification bound to tab ID
function showNotification(tabId, title, message) {
  const notificationId = `crash-${tabId}-${Date.now()}`;
  notificationToTabMap.set(notificationId, tabId);

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: '/img/2.png',
    title: title,
    message: message,
    priority: 2
  });
}

// Handle push notification click event
chrome.notifications.onClicked.addListener((notificationId) => {
  const targetTabId = notificationToTabMap.get(notificationId);

  if (targetTabId) {
    chrome.tabs.get(targetTabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        console.log("[Smart Reloader] Target tab no longer exists.");
        return;
      }

      // Focus on the tab and bring its parent window forward
      chrome.tabs.update(targetTabId, { active: true }, () => {
        chrome.windows.update(tab.windowId, { focused: true });
      });
    });

    notificationToTabMap.delete(notificationId);
  }
});

// Rate limiting logic (max 3 reloads within 30 seconds)
function checkRateLimit(tabId) {
  const now = Date.now();
  if (!reloadHistory.has(tabId)) {
    reloadHistory.set(tabId, []);
  }

  const timestamps = reloadHistory.get(tabId).filter(time => now - time < 30000);
  if (timestamps.length >= 3) {
    return false;
  }

  timestamps.push(now);
  reloadHistory.set(tabId, timestamps);
  return true;
}

// Clean up maps when a tab is closed by the user
chrome.tabs.onRemoved.addListener((tabId) => {
  reloadHistory.delete(tabId);

  for (let [notifId, tId] of notificationToTabMap.entries()) {
    if (tId === tabId) {
      notificationToTabMap.delete(notifId);
    }
  }
});
