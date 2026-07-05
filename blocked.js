const urlParams = new URLSearchParams(window.location.search);
const site = urlParams.get('site') || 'this website';
let mode = urlParams.get('mode');

document.querySelectorAll('.btn-preset').forEach(button => {
  button.addEventListener('click', (e) => {
    document.getElementById('limitInput').value = e.target.dataset.limit;
    document.getElementById('slotsInput').value = e.target.dataset.slots;
    document.getElementById('gapInput').value = e.target.dataset.gap;
  });
});

document.getElementById('quickPassBtn')?.addEventListener('click', () => {
  chrome.storage.local.get(["siteData"], (result) => {
    const siteData = result.siteData || {};
    siteData[site] = {
      limit: -1, slotsLeft: -1, gap: -1, timeLeftInCurrentSlot: 0, isBlocked: false,
      tempUntil: Date.now() + (5 * 60 * 1000), sessionGoal: "Quick Pass Lookup Mode"
    };
    chrome.storage.local.set({ siteData }, () => {
      window.location.href = "http://" + site;
    });
  });
});

document.getElementById('activateBtn')?.addEventListener('click', async () => {
  const limit = parseInt(document.getElementById('limitInput').value);
  const slots = parseInt(document.getElementById('slotsInput').value);
  const gap = parseInt(document.getElementById('gapInput').value);
  const goal = document.getElementById('goalInput').value.trim() || "No target goal specified";

  if (isNaN(limit) || isNaN(slots) || isNaN(gap)) {
    alert("Please check numerical input fields."); return;
  }

  chrome.storage.local.get(["siteData"], (result) => {
    const siteData = result.siteData || {};
    siteData[site] = {
      limit: limit, slotsLeft: slots, gap: gap, timeLeftInCurrentSlot: limit * 60,
      isBlocked: false, nextAvailableTime: 0, tempUntil: 0, sessionGoal: goal,
      graceTimeActive: false, graceTimeLeft: 0
    };
    chrome.storage.local.set({ siteData }, () => {
      window.location.href = "http://" + site;
    });
  });
});

function updateSystemTimers() {
  const now = Date.now();
  const nextThreeAM = new Date();
  nextThreeAM.setHours(3, 0, 0, 0);
  if (new Date() >= nextThreeAM) nextThreeAM.setDate(nextThreeAM.getDate() + 1);
  const diffMs = nextThreeAM.getTime() - now;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  document.getElementById('globalResetCountdown').textContent = 
    `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  chrome.storage.local.get(["siteData", "whitelist"], (result) => {
    const siteData = result.siteData || {};
    const whitelist = result.whitelist || ["pw.live"];
    const config = siteData[site];

    if (config && config.limit !== -1 && mode === 'setup') {
      if (config.tempUntil && now < config.tempUntil) {
        window.location.href = "http://" + site; return;
      }
      mode = 'active';
      document.getElementById('setupMessage').style.display = 'none';
      document.getElementById('blockedMessage').style.display = 'block';
      document.getElementById('siteNameBlocked').textContent = site;
    }

    if (config && config.limit !== -1) {
      document.getElementById('rightHud').style.display = 'block';
      document.getElementById('hudHost').textContent = site;
      document.getElementById('hudSlots').textContent = config.slotsLeft;
      document.getElementById('hudGoal').textContent = `🎯 Goal: ${config.sessionGoal || 'Not specified'}`;

      if (config.isBlocked) {
        if (config.slotsLeft <= 0) {
          if (mode !== 'setup') document.getElementById('timerStatus').innerHTML = `No slots left! Resetting at 3 AM.`;
          document.getElementById('hudTimer').textContent = "Depleted";
        } else if (config.nextAvailableTime > now) {
          const waitDiff = config.nextAvailableTime - now;
          const waitMins = Math.floor(waitDiff / (1000 * 60));
          const waitSecs = Math.floor((waitDiff % (1000 * 60)) / 1000);
          const remainingStr = `${waitMins}m ${waitSecs}s`;
          if (mode !== 'setup') {
            document.getElementById('timerStatus').innerHTML = `Intermission break active.<br>Next slot opens in: ${remainingStr}`;
          }
          document.getElementById('hudTimer').textContent = `* Break: ${remainingStr}`;
        }
      } else if (config.graceTimeActive) {
        document.getElementById('hudTimer').textContent = `⏳ GRACE: ${config.graceTimeLeft}s`;
        document.getElementById('hudTimer').style.color = "#dc3545";
        if (mode !== 'setup') {
          document.getElementById('timerStatus').innerHTML = `⚠️ Grace active! Locking in ${config.graceTimeLeft}s.`;
        }
      } else {
        const activeMins = Math.floor(config.timeLeftInCurrentSlot / 60);
        const activeSecs = config.timeLeftInCurrentSlot % 60;
        document.getElementById('hudTimer').style.color = "#ffc107";
        document.getElementById('hudTimer').textContent = `# Active: ${activeMins}m ${activeSecs}s`;
        if (mode !== 'setup') window.location.href = "http://" + site;
      }
    }

    // Populate dynamic whitelisted links
    const whitelistView = document.getElementById('dynamicWhitelistedLinks');
    if (whitelistView && whitelistView.children.length === 0) {
      whitelist.forEach(item => {
        const a = document.createElement('a');
        a.className = "whitelist-link";
        a.href = item.startsWith('http') ? item : "https://" + item;
        a.target = "_blank";
        a.textContent = `🚀 Go to ${item}`;
        whitelistView.appendChild(a);
      });
      if (whitelist.length === 0) {
        whitelistView.innerHTML = `<span style="color: #6c757d; font-size:13px;">No Whitelisted Portals Configured</span>`;
      }
    }
  });
}

if (mode === 'setup') {
  document.getElementById('setupMessage').style.display = 'block';
  document.getElementById('siteNameSetup').textContent = site;
} else {
  document.getElementById('blockedMessage').style.display = 'block';
  document.getElementById('siteNameBlocked').textContent = site;
}

setInterval(updateSystemTimers, 1000);
updateSystemTimers();