document.getElementById('menuRules').addEventListener('click', () => switchTab('rules'));
document.getElementById('menuStats').addEventListener('click', () => switchTab('stats'));

function switchTab(target) {
  document.getElementById('menuRules').classList.toggle('active', target === 'rules');
  document.getElementById('menuStats').classList.toggle('active', target === 'stats');
  document.getElementById('panelRules').style.display = target === 'rules' ? 'block' : 'none';
  document.getElementById('panelStats').style.display = target === 'stats' ? 'block' : 'none';
  
  if (target === 'stats' && typeof loadStatsEngine === 'function') {
    loadStatsEngine();
  }
}

function renderRulesUI() {
  chrome.storage.local.get(["whitelist", "siteData", "hardModeActive"], (result) => {
    const whitelist = result.whitelist || ["pw.live"];
    const siteData = result.siteData || {};
    const isHardMode = result.hardModeActive || false;

    const hardModeBtn = document.getElementById('toggleHardModeBtn');
    if (isHardMode) {
      hardModeBtn.textContent = "🔒 Locked Until 3 AM";
      hardModeBtn.disabled = true;
      hardModeBtn.style.background = "#555";
      document.getElementById('addWhitelistBtn').disabled = true;
      document.getElementById('whitelistInput').disabled = true;
      document.getElementById('whitelistInput').placeholder = "Hard mode active: alterations locked.";
    } else {
      hardModeBtn.textContent = "Activate Hard Lock";
      hardModeBtn.disabled = false;
      hardModeBtn.style.background = "#dc3545";
      document.getElementById('addWhitelistBtn').disabled = false;
      document.getElementById('whitelistInput').disabled = false;
      document.getElementById('whitelistInput').placeholder = "example.com";
    }

    const whitelistView = document.getElementById('whitelistView');
    whitelistView.innerHTML = '';
    whitelist.forEach((site) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${site}</span><button class="danger-btn">Remove</button>`;
      
      const removeBtn = li.querySelector('button');
      if (isHardMode) removeBtn.style.display = "none";
      
      removeBtn.addEventListener('click', () => {
        const updated = whitelist.filter(i => i !== site);
        chrome.storage.local.set({ whitelist: updated }, renderRulesUI);
      });
      whitelistView.appendChild(li);
    });

    const trackedView = document.getElementById('trackedSitesView');
    trackedView.innerHTML = '';
    const hosts = Object.keys(siteData);
    if (hosts.length === 0) {
      trackedView.innerHTML = `<li>No limits configured yet today.</li>`;
    } else {
      hosts.forEach((host) => {
        const data = siteData[host];
        const li = document.createElement('li');
        let activeText = '';
        if (data.tempUntil && Date.now() < data.tempUntil) {
          activeText = `Temporary Pass Active`;
        } else {
          activeText = data.limit === -1 ? 'Pending Setup' : `Limit: ${data.limit}m (Slots Remaining: ${data.slotsLeft}) [🎯 Goal: ${data.sessionGoal || 'None'}]`;
        }
        li.innerHTML = `<div><strong>${host}</strong> - <small style="color:#aaa;">${activeText}</small></div>
                        <button class="danger-btn">Reset Rules</button>`;
        
        const resetBtn = li.querySelector('button');
        if (isHardMode) resetBtn.style.display = "none";
        
        resetBtn.addEventListener('click', () => {
          delete siteData[host];
          chrome.storage.local.set({ siteData }, renderRulesUI);
        });
        trackedView.appendChild(li);
      });
    }
  });
}

document.getElementById('toggleHardModeBtn').addEventListener('click', () => {
  if (confirm("Are you absolutely certain? This will lock down all rule parameters and configurations until the 3 AM local engine daily reset cycle completes.")) {
    chrome.storage.local.set({ hardModeActive: true }, renderRulesUI);
  }
});

document.getElementById('addWhitelistBtn').addEventListener('click', () => {
  const input = document.getElementById('whitelistInput');
  let domain = input.value.trim().toLowerCase();
  if (!domain) return;

  try { if (domain.startsWith('http')) domain = new URL(domain).hostname; } catch(e){}
  if (domain.startsWith('www.')) domain = domain.substring(4);

  chrome.storage.local.get(["whitelist"], (result) => {
    const whitelist = result.whitelist || ["pw.live"];
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      chrome.storage.local.set({ whitelist }, () => {
        input.value = '';
        renderRulesUI();
      });
    }
  });
});

renderRulesUI();