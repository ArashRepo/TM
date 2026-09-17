/**
 * TM Google Drive Sync Engine (Zero-Server Architecture)
 * Enables private 2-way smart synchronization to each user's personal Google Drive.
 */

const GDriveSync = (() => {
  const SYNC_CONFIG_KEY = 'tm_gdrive_sync_config';

  // Default configuration
  let config = {
    method: 'webhook', // 'webhook' (Google Apps Script) or 'oauth' (Google Client ID)
    webhookUrl: '',
    clientId: '',
    autoSync: true,
    lastSyncTime: null,
    syncIntervalMinutes: 10
  };

  let isSyncing = false;
  let syncIntervalId = null;

  // -------------------------------------------------------------
  // 1. Config Management
  // -------------------------------------------------------------
  function loadConfig() {
    try {
      const stored = localStorage.getItem(SYNC_CONFIG_KEY);
      if (stored) {
        config = { ...config, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[GDriveSync] Could not load config:', e);
    }
    return config;
  }

  function saveConfig(newConfig) {
    config = { ...config, ...newConfig };
    try {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {}
    setupAutoSync();
    updateSyncUI();
    return config;
  }

  function getConfig() {
    return { ...config };
  }

  // -------------------------------------------------------------
  // 2. Google Drive Webhook Operations (Google Apps Script)
  // -------------------------------------------------------------
  async function fetchFromWebhook(url) {
    try {
      const fetchFn = window._originalFetch || window.fetch;
      const res = await fetchFn(url, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('دسترسی مسدود است (کد ۴۰۳). در اسکریپت گوگل، گزینه Who has access را روی «Anyone» قرار دهید.');
        }
        throw new Error(`کد خطای ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (e) {
      if (e.message && e.message.includes('Failed to fetch')) {
        throw new Error('خطای دسترسی CORS / 403. در تنظیمات Deploy اسکریپت گوگل، گزینه Who has access را روی «Anyone» تنظیم کنید.');
      }
      throw e;
    }
  }

  async function uploadToWebhook(url, data) {
    try {
      const fetchFn = window._originalFetch || window.fetch;
      const res = await fetchFn(url, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids preflight CORS on GAS
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('دسترسی مسدود است (کد ۴۰۳). در اسکریپت گوگل، گزینه Who has access را روی «Anyone» قرار دهید.');
        }
        throw new Error(`کد خطای ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      if (e.message && e.message.includes('Failed to fetch')) {
        throw new Error('خطای دسترسی CORS / 403. در تنظیمات Deploy اسکریپت گوگل، گزینه Who has access را روی «Anyone» تنظیم کنید.');
      }
      throw e;
    }
  }

  // -------------------------------------------------------------
  // 3. Smart 2-Way Merge Engine
  // -------------------------------------------------------------
  function mergeDatabases(localDB, cloudDB) {
    // If one is empty, return the other
    if (!cloudDB || (!cloudDB.tasks && !cloudDB.reports && !cloudDB.interactions)) {
      return localDB;
    }
    if (!localDB || (!localDB.tasks && !localDB.reports && !localDB.interactions)) {
      return cloudDB;
    }

    const merged = {
      tasks: mergeListById(localDB.tasks || [], cloudDB.tasks || []),
      reports: mergeListById(localDB.reports || [], cloudDB.reports || []),
      interactions: mergeListById(localDB.interactions || [], cloudDB.interactions || []),
      routines: mergeRoutines(localDB.routines || [], cloudDB.routines || []),
      settings: {
        ...(localDB.settings || {}),
        ...(cloudDB.settings || {}),
        lastSyncedAt: new Date().toISOString()
      }
    };

    return merged;
  }

  function mergeListById(localList, cloudList) {
    const map = new Map();

    // 1. Add all cloud items
    for (const item of cloudList) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }

    // 2. Merge local items
    for (const localItem of localList) {
      if (!localItem || !localItem.id) continue;
      
      const cloudItem = map.get(localItem.id);
      if (!cloudItem) {
        // Item exists only locally -> keep it
        map.set(localItem.id, localItem);
      } else {
        // Item exists in both -> pick the one with later updatedAt or createdAt
        const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
        const cloudTime = new Date(cloudItem.updatedAt || cloudItem.createdAt || 0).getTime();
        if (localTime >= cloudTime) {
          map.set(localItem.id, localItem);
        }
      }
    }

    return Array.from(map.values());
  }

  function mergeRoutines(localRoutines, cloudRoutines) {
    const map = new Map();

    for (const r of cloudRoutines) {
      if (r && r.id) map.set(r.id, { ...r, completedDates: [...(r.completedDates || [])] });
    }

    for (const lr of localRoutines) {
      if (!lr || !lr.id) continue;
      const cr = map.get(lr.id);
      if (!cr) {
        map.set(lr.id, lr);
      } else {
        const localTime = new Date(lr.updatedAt || lr.createdAt || 0).getTime();
        const cloudTime = new Date(cr.updatedAt || cr.createdAt || 0).getTime();
        const base = localTime >= cloudTime ? lr : cr;

        // Union of completed dates so completion marks from both devices are preserved!
        const datesSet = new Set([...(cr.completedDates || []), ...(lr.completedDates || [])]);
        map.set(lr.id, {
          ...base,
          completedDates: Array.from(datesSet)
        });
      }
    }

    return Array.from(map.values());
  }

  // -------------------------------------------------------------
  // 4. Main Sync Function
  // -------------------------------------------------------------
  async function sync(silent = false) {
    if (isSyncing) return;
    loadConfig();

    if (config.method === 'webhook' && !config.webhookUrl) {
      if (!silent) {
        openSyncModal();
        if (typeof showToast === 'function') {
          showToast('لطفاً ابتدا آدرس گوگل درایو خود را وارد کنید', 'warning');
        }
      }
      return;
    }

    try {
      isSyncing = true;
      setSyncingVisual(true);

      const localDB = await DataEngine.getLocalDB();
      let cloudDB = null;

      // 1. Fetch from Google Drive
      if (config.method === 'webhook') {
        cloudDB = await fetchFromWebhook(config.webhookUrl);
      }

      // 2. Perform 2-Way Smart Merge
      const mergedDB = mergeDatabases(localDB, cloudDB);

      // 3. Save to Local IDB
      await DataEngine.saveLocalDB(mergedDB);

      // 4. If Desktop Server is reachable, also save directly to PC hard drive (database.json)
      if (DataEngine.isOnline()) {
        try {
          await window._originalFetch('/api/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mergedDB)
          });
        } catch (e) {
          console.warn('[GDriveSync] Could not push to local desktop server:', e);
        }
      }

      // 5. Upload Merged Database back to Google Drive
      if (config.method === 'webhook') {
        await uploadToWebhook(config.webhookUrl, mergedDB);
      }

      config.lastSyncTime = new Date().toISOString();
      saveConfig(config);

      // 6. Refresh UI if available
      if (typeof loadDashboardStats === 'function') loadDashboardStats();
      if (typeof loadTasks === 'function' && currentTab === 'tasks') loadTasks();
      if (typeof loadRoutines === 'function' && currentTab === 'routines') loadRoutines();
      if (typeof loadReports === 'function' && currentTab === 'reports') loadReports();
      if (typeof loadInteractions === 'function' && currentTab === 'interactions') loadInteractions();

      if (!silent && typeof showToast === 'function') {
        showToast('همگام‌سازی با گوگل درایو با موفقیت انجام شد ✅', 'success');
      }
    } catch (err) {
      console.error('[GDriveSync] Sync error:', err);
      if (!silent && typeof showToast === 'function') {
        showToast(`خطا در همگام‌سازی با گوگل درایو: ${err.message}`, 'error');
      }
    } finally {
      isSyncing = false;
      setSyncingVisual(false);
      updateSyncUI();
    }
  }

  // -------------------------------------------------------------
  // 5. UI Helpers & Auto-Sync
  // -------------------------------------------------------------
  function setSyncingVisual(active) {
    const icon = document.getElementById('gdrive-sync-icon');
    if (icon) {
      if (active) {
        icon.classList.add('animate-spin', 'text-indigo-600', 'dark:text-indigo-400');
      } else {
        icon.classList.remove('animate-spin', 'text-indigo-600', 'dark:text-indigo-400');
      }
    }
  }

  function updateSyncUI() {
    const statusText = document.getElementById('gdrive-status-text');
    const badge = document.getElementById('gdrive-sync-badge');
    if (!statusText && !badge) return;

    loadConfig();
    const isConfigured = Boolean(config.webhookUrl);

    if (badge) {
      if (isConfigured) {
        badge.classList.remove('hidden');
      }
    }

    if (statusText) {
      if (!isConfigured) {
        statusText.innerText = 'گوگل درایو متصل نیست';
      } else if (config.lastSyncTime) {
        const timeStr = new Date(config.lastSyncTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        statusText.innerText = `سینک شده (${timeStr})`;
      } else {
        statusText.innerText = 'در انتظار اولین سینک';
      }
    }
  }

  function setupAutoSync() {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
    }

    if (config.autoSync && config.webhookUrl) {
      const ms = Math.max(2, config.syncIntervalMinutes || 10) * 60 * 1000;
      syncIntervalId = setInterval(() => {
        sync(true); // silent background sync
      }, ms);
    }
  }

  function openSyncModal() {
    loadConfig();
    const modal = document.getElementById('modal-gdrive-sync');
    if (!modal) return;

    const inputUrl = document.getElementById('gdrive-webhook-url');
    const checkAuto = document.getElementById('gdrive-auto-sync');
    const inputInterval = document.getElementById('gdrive-sync-interval');
    const lastSyncSpan = document.getElementById('gdrive-last-sync-modal');

    if (inputUrl) inputUrl.value = config.webhookUrl || '';
    if (checkAuto) checkAuto.checked = config.autoSync !== false;
    if (inputInterval) inputInterval.value = config.syncIntervalMinutes || 10;
    if (lastSyncSpan) {
      lastSyncSpan.innerText = config.lastSyncTime 
        ? new Date(config.lastSyncTime).toLocaleString('fa-IR') 
        : 'تاکنون همگام‌سازی انجام نشده است';
    }

    modal.classList.remove('hidden');
  }

  function closeSyncModal() {
    const modal = document.getElementById('modal-gdrive-sync');
    if (modal) modal.classList.add('hidden');
  }

  function saveModalSettings() {
    const inputUrl = document.getElementById('gdrive-webhook-url');
    const checkAuto = document.getElementById('gdrive-auto-sync');
    const inputInterval = document.getElementById('gdrive-sync-interval');

    const webhookUrl = inputUrl ? inputUrl.value.trim() : '';
    const autoSync = checkAuto ? checkAuto.checked : true;
    const syncIntervalMinutes = inputInterval ? parseInt(inputInterval.value) || 10 : 10;

    saveConfig({ webhookUrl, autoSync, syncIntervalMinutes });
    closeSyncModal();

    if (typeof showToast === 'function') {
      showToast('تنظیمات گوگل درایو با موفقیت ذخیره شد', 'success');
    }

    if (webhookUrl) {
      sync(false); // run immediate sync
    }
  }

  // Copy Google Apps Script template for user
  function copyAppsScriptCode() {
    const code = `// ========================================================
// TM LeadApp Google Drive Sync Script
// این کد را در script.google.com قرار داده و Deploy کنید.
// ========================================================
function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : "";
    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "No data" })).setMimeType(ContentService.MimeType.JSON);
    }
    var data = JSON.parse(contents);
    var files = DriveApp.getFilesByName("leadapp_database.json");
    var file = files.hasNext() ? files.next() : DriveApp.createFile("leadapp_database.json", "{}");
    file.setContent(JSON.stringify(data, null, 2));
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Saved to Google Drive" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var files = DriveApp.getFilesByName("leadapp_database.json");
    if (files.hasNext()) {
      var content = files.next().getBlob().getDataAsString();
      return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

    navigator.clipboard.writeText(code).then(() => {
      if (typeof showToast === 'function') {
        showToast('کد گوگل اپس‌اسکریپت در کلیپ‌بورد کپی شد 📋', 'success');
      }
    }).catch(() => {
      alert('لطفاً کد را به صورت دستی کپی کنید');
    });
  }

  function init() {
    loadConfig();
    setupAutoSync();
    updateSyncUI();

    // Trigger initial silent sync after 3 seconds if configured
    if (config.webhookUrl && config.autoSync) {
      setTimeout(() => sync(true), 3000);
    }
  }

  return {
    init,
    sync,
    getConfig,
    saveConfig,
    openSyncModal,
    closeSyncModal,
    saveModalSettings,
    copyAppsScriptCode
  };
})();
