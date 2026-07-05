let trackingInterval = null;

function cleanHostName(hostname) {
  if (hostname && hostname.startsWith('www.')) return hostname.substring(4);
  return hostname;
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    document.getElementById('currentHost').textContent = "Invalid Context"; return;
  }
  try {
    let rawHost = new URL(tab.url).hostname;
    let host = cleanHostName(rawHost);
    document.getElementById('currentHost').textContent = host;
    startPopupTrackingLoop(host);
  } catch(e) { document.getElementById('currentHost').textContent = "Invalid Context"; }
});

function startPopupTrackingLoop(host) {
  function renderUpdates() {
    chrome.storage.local.get(["siteData", "whitelist"], (result) => {
      const siteData = result.siteData || {};
      const whitelist = result.whitelist || ["pw.live"];
      const config = siteData[host];
      const now = Date.now();

      if (whitelist.some(item => host.includes(item))) {
        document.getElementById('popupSlots').textContent = "∞";
        document.getElementById('popupTimer').textContent = "✅ Whitelisted (Productive)";
        return;
      }

      if (config && config.tempUntil && now < config.tempUntil) {
        const tempDiff = config.tempUntil - now;
        const tempMins = Math.floor(tempDiff / (1000 * 60));
        const tempSecs = Math.floor((tempDiff % (1000 * 60)) / 1000);
        document.getElementById('popupSlots').textContent = "Temp";
        document.getElementById('popupTimer').textContent = `⚡ Pass: ${tempMins}m ${tempSecs}s`;
        return;
      }

      if (config && config.limit !== -1) {
        document.getElementById('popupSlots').textContent = config.slotsLeft;
        if (config.isBlocked) {
          if (config.slotsLeft <= 0) {
            document.getElementById('popupTimer').textContent = "Depleted";
          } else if (config.nextAvailableTime > now) {
            const waitDiff = config.nextAvailableTime - now;
            const waitMins = Math.floor(waitDiff / (1000 * 60));
            const waitSecs = Math.floor((waitDiff % (1000 * 60)) / 1000);
            document.getElementById('popupTimer').textContent = `* Break: ${waitMins}m ${waitSecs}s`;
          }
        } else if (config.graceTimeActive) {
          document.getElementById('popupTimer').textContent = `⏳ Grace: ${config.graceTimeLeft}s`;
        } else {
          const activeMins = Math.floor(config.timeLeftInCurrentSlot / 60);
          const activeSecs = config.timeLeftInCurrentSlot % 60;
          document.getElementById('popupTimer').textContent = `# Active: ${activeMins}m ${activeSecs}s`;
        }
      } else {
        document.getElementById('popupSlots').textContent = "--";
        document.getElementById('popupTimer').textContent = "Unconfigured Site";
      }
    });
  }
  renderUpdates();
  trackingInterval = setInterval(renderUpdates, 1000);
}

document.getElementById('openDashboardBtn').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open(chrome.runtime.getURL('options.html'));
});

window.addEventListener('unload', () => { if (trackingInterval) clearInterval(trackingInterval); });