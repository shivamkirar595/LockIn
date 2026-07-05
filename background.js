async function getStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["whitelist", "siteData", "lastReset", "analyticsData", "hardModeActive"], (result) => {
      resolve({
        whitelist: result.whitelist || ["pw.live"],
        siteData: result.siteData || {},
        lastReset: result.lastReset || 0,
        analyticsData: result.analyticsData || {},
        hardModeActive: result.hardModeActive || false
      });
    });
  });
}

function checkDailyReset(lastReset) {
  const now = new Date();
  const threeAMToday = new Date();
  threeAMToday.setHours(3, 0, 0, 0);

  if (now < threeAMToday) {
    threeAMToday.setDate(threeAMToday.getDate() - 1);
  }
  return lastReset < threeAMToday.getTime();
}

function getHostName(url) {
  try { return new URL(url).hostname; } catch (e) { return null; }
}

function cleanHostName(hostname) {
  if (hostname && hostname.startsWith('www.')) {
    return hostname.substring(4);
  }
  return hostname;
}

// Background monitoring loop (ticks every 1 second)
setInterval(async () => {
  let { siteData, lastReset, whitelist, analyticsData, hardModeActive } = await getStorageData();
  const now = Date.now();
  const todayKey = new Date().toISOString().split('T')[0];

  if (checkDailyReset(lastReset)) {
    siteData = {};
    lastReset = now;
    hardModeActive = false; // Reset Hard Mode automatically at 3 AM daily
    await chrome.storage.local.set({ siteData, lastReset, hardModeActive });
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs.length === 0) return;
    const tab = tabs[0];
    if (!tab.url || tab.url.startsWith("chrome-extension://")) return;

    let rawHost = getHostName(tab.url);
    if (!rawHost) return;
    let host = cleanHostName(rawHost);

    // Incremental usage metrics logging
    if (!analyticsData[todayKey]) analyticsData[todayKey] = {};
    if (!analyticsData[todayKey][host]) analyticsData[todayKey][host] = 0;
    analyticsData[todayKey][host] += 1;

    let updated = true;

    if (siteData[host]) {
      const config = siteData[host];

      // Bypass constraints if temporary pass window is live
      if (config.tempUntil && now < config.tempUntil) {
        return; 
      }

      if (config.limit === 0 && !config.isBlocked) {
        config.slotsLeft = 0;
        config.isBlocked = true;
        config.nextAvailableTime = now + (config.gap * 60 * 1000);
      }

      if (config.isBlocked) {
        const blockUrl = chrome.runtime.getURL("blocked.html") + "?site=" + host;
        if (tab.url !== blockUrl) {
          chrome.tabs.update(tab.id, { url: blockUrl });
        }
      } else if (config.timeLeftInCurrentSlot > 0) {
        config.timeLeftInCurrentSlot -= 1;

        // Trigger 30-Second Grace Period when regular slot hits exactly 0
        if (config.timeLeftInCurrentSlot <= 0) {
          if (!config.graceTimeActive) {
            config.graceTimeActive = true;
            config.graceTimeLeft = 30; // 30 seconds of grace time
            
            chrome.notifications.create({
              type: "basic",
              iconUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'><path fill='%23ffc107' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/></svg>",
              title: "Slot Expired!",
              message: `You have 30 seconds of grace time remaining before access to ${host} locks down.`
            });
          }
        }
      } else if (config.graceTimeActive && config.graceTimeLeft > 0) {
        config.graceTimeLeft -= 1;
        
        if (config.graceTimeLeft <= 0) {
          config.graceTimeActive = false;
          config.slotsLeft -= 1;
          config.isBlocked = true;
          config.nextAvailableTime = now + (config.gap * 60 * 1000);
          
          const blockUrl = chrome.runtime.getURL("blocked.html") + "?site=" + host;
          chrome.tabs.update(tab.id, { url: blockUrl });
        }
      }
    }

    // Cooldown verification passes across ambient elements
    for (const targetedHost in siteData) {
      const config = siteData[targetedHost];
      if (config.isBlocked && config.slotsLeft > 0 && now >= config.nextAvailableTime) {
        config.isBlocked = false;
        config.timeLeftInCurrentSlot = config.limit * 60;
        config.graceTimeActive = false;
        updated = true;
      }
    }

    if (updated) {
      await chrome.storage.local.set({ siteData, analyticsData });
    }
  });
}, 1000);

// Routing control checks
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    if (tab.url.startsWith("chrome-extension://") || tab.url.includes("options.html")) return;

    let rawHost = getHostName(tab.url);
    if (!rawHost || rawHost === "newtab" || rawHost === "extensions") return;
    let host = cleanHostName(rawHost);

    let { whitelist, siteData } = await getStorageData();
    if (whitelist.some(item => host.includes(item))) return;

    if (siteData[host] && siteData[host].tempUntil && Date.now() < siteData[host].tempUntil) {
      return; 
    }

    if (!siteData[host] || siteData[host].limit === -1) {
      if (!siteData[host]) {
        siteData[host] = { limit: -1, slotsLeft: -1, isBlocked: false, tempUntil: 0, sessionGoal: "" };
        await chrome.storage.local.set({ siteData });
      }
      const setupUrl = chrome.runtime.getURL("blocked.html") + "?site=" + host + "&mode=setup";
      chrome.tabs.update(tabId, { url: setupUrl });
      return;
    }

    if (siteData[host].isBlocked) {
      const blockUrl = chrome.runtime.getURL("blocked.html") + "?site=" + host;
      chrome.tabs.update(tabId, { url: blockUrl });
    }
  }
});