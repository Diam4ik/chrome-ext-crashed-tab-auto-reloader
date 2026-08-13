document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('sitesList');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  const modeAll = document.getElementById('modeAll');
  const modeList = document.getElementById('modeList');

  // Toggle textarea availability using explicit attribute methods
  function toggleTextarea() {
    textarea.disabled = modeAll.checked;
  }

  modeAll.addEventListener('change', toggleTextarea);
  modeList.addEventListener('change', toggleTextarea);

  // Load saved configuration from storage
  chrome.storage.local.get(['workMode', 'allowedSites'], (result) => {
    if (result.workMode === 'list') {
      modeList.checked = true;
    } else {
      modeAll.checked = true; // Default fall-through fallback
    }

    if (result.allowedSites) {
      textarea.value = result.allowedSites.join(', ');
    }
    toggleTextarea(); // Set correct visual state immediately on load
  });

  // Save configuration
  saveBtn.addEventListener('click', () => {
    const selectedMode = modeAll.checked ? 'all' : 'list';

    // Sanitize links: remove protocols, paths, and trailing slashes
    const cleanSites = textarea.value
    .split(',')
    .map(site => site.trim().toLowerCase())
    .map(site => {
      let clean = site;
      if (!/^https?:\/\//i.test(clean)) {
        clean = 'http://' + clean;
      }
      try {
        const urlObj = new URL(clean);
        return urlObj.hostname.replace('www.', '');
      } catch (e) {
        return site.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '');
      }
    })
    .filter(site => site.length > 0);

    // Save mode and clean array to storage
    chrome.storage.local.set({
      workMode: selectedMode,
      allowedSites: cleanSites
    }, () => {
      // Show the sanitized format back to the user
      textarea.value = cleanSites.join(', ');

      status.textContent = 'Settings saved successfully!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    });
  });
});
