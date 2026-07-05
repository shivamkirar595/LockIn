function formatStatsDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${mins}m ${remainingSecs}s`;
}

window.loadStatsEngine = function() {
  chrome.storage.local.get(["analyticsData", "whitelist"], (result) => {
    const analytics = result.analyticsData || {};
    const whitelist = result.whitelist || ["pw.live"];
    const todayKey = new Date().toISOString().split('T')[0];
    
    const todayRecords = analytics[todayKey] || {};
    let productiveSecs = 0;
    let distractingSecs = 0;
    
    const timeListView = document.getElementById('analyticsTimeView');
    if (!timeListView) return;
    timeListView.innerHTML = '';

    for (const host in todayRecords) {
      const secondsSpent = todayRecords[host];
      const isProductive = whitelist.some(item => host.includes(item));
      
      if (isProductive) productiveSecs += secondsSpent;
      else distractingSecs += secondsSpent;

      const li = document.createElement('li');
      li.innerHTML = `<span>${host} ${isProductive ? '✅ (Productive)' : '🛑 (Distracting)'}</span>
                      <strong>${formatStatsDuration(secondsSpent)}</strong>`;
      timeListView.appendChild(li);
    }

    document.getElementById('statProductive').textContent = formatStatsDuration(productiveSecs);
    document.getElementById('statDistracting').textContent = formatStatsDuration(distractingSecs);

    let pastProductiveTotal = 0;
    let pastDistractingTotal = 0;
    let loggedDaysCount = 0;

    for (const dateKey in analytics) {
      if (dateKey === todayKey) continue;
      loggedDaysCount++;
      for (const host in analytics[dateKey]) {
        const secs = analytics[dateKey][host];
        if (whitelist.some(item => host.includes(item))) pastProductiveTotal += secs;
        else pastDistractingTotal += secs;
      }
    }

    const deltaDisplay = document.getElementById('statWeeklyReport');
    if (!deltaDisplay) return;

    if (loggedDaysCount === 0) {
      deltaDisplay.textContent = "Baseline building...";
      deltaDisplay.style.color = "#ffc107";
      return;
    }

    const avgPastDistracting = pastDistractingTotal / loggedDaysCount;
    const deltaSecs = distractingSecs - avgPastDistracting;
    
    if (deltaSecs > 60) {
      deltaDisplay.textContent = `+${Math.round(deltaSecs/60)}m More Distracted than baseline`;
      deltaDisplay.style.color = "#dc3545";
    } else if (deltaSecs < -60) {
      deltaDisplay.textContent = `${Math.round(Math.abs(deltaSecs)/60)}m Less Distracted (Progress!)`;
      deltaDisplay.style.color = "#28a745";
    } else {
      deltaDisplay.textContent = "On par with historical baseline profile";
      deltaDisplay.style.color = "#ffc107";
    }
  });
};

// CSV Analytics Export Logic
document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
  chrome.storage.local.get(["analyticsData", "whitelist"], (result) => {
    const analytics = result.analyticsData || {};
    const whitelist = result.whitelist || ["pw.live"];
    
    let csvRows = [];
    csvRows.push(["Date", "Website Host Domain", "Seconds Spent", "Classification Category"]);

    for (const dateKey in analytics) {
      for (const host in analytics[dateKey]) {
        const secondsSpent = analytics[dateKey][host];
        const classification = whitelist.some(item => host.includes(item)) ? "Productive" : "Distracting";
        
        csvRows.push([`"${dateKey}"`, `"${host}"`, secondsSpent, `"${classification}"`]);
      }
    }

    if (csvRows.length <= 1) {
      alert("No usage data collected yet to backup!"); return;
    }

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement("a");
    
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `Smart_Study_Usage_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  });
});