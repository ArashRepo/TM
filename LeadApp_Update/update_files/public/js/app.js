// TM Frontend Main Script

let currentTab = 'dashboard';
let reportsCache = [];
let tasksCache = [];
let interactionsCache = [];
let routinesCache = [];

const paginationState = {
  tasks: { page: 1, pageSize: 10 },
  routines: { page: 1, pageSize: 9 },
  reports: { page: 1, pageSize: 10 },
  interactions: { page: 1, pageSize: 10 }
};

let archivedCache = { tasks: [], interactions: [] };
let activeArchiveTab = 'tasks';

const PRIORITY_LABELS = {
  low: { text: 'کم', class: 'badge-priority-low' },
  medium: { text: 'متوسط', class: 'badge-priority-medium' },
  high: { text: 'بالا', class: 'badge-priority-high' },
  urgent: { text: 'فوری 🔥', class: 'badge-priority-urgent' }
};

const STATUS_LABELS = {
  pending: { text: 'انجام نشده', class: 'badge-pending' },
  in_progress: { text: 'در حال انجام', class: 'badge-in_progress' },
  completed: { text: 'تکمیل شده', class: 'badge-completed' },
  cancelled: { text: 'لغو شده', class: 'badge-cancelled' }
};

const INTERACTION_TYPES = {
  meeting: { text: 'جلسه', icon: 'fa-handshake', color: 'text-indigo-600 dark:text-indigo-400' },
  call: { text: 'تماس تلفنی', icon: 'fa-phone', color: 'text-blue-600 dark:text-blue-400' },
  message: { text: 'پیام/چت', icon: 'fa-comment', color: 'text-emerald-600 dark:text-emerald-400' },
  email: { text: 'ایمیل', icon: 'fa-envelope', color: 'text-purple-600 dark:text-purple-400' },
  in_person: { text: 'دیدار حضوری', icon: 'fa-user-group', color: 'text-amber-600 dark:text-amber-400' },
  other: { text: 'سایر', icon: 'fa-asterisk', color: 'text-slate-600 dark:text-slate-400' }
};

const OUTCOME_LABELS = {
  answered: { text: 'پاسخ داد ✅', class: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' },
  no_answer: { text: 'پاسخ نداد 🚫', class: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold' },
  awaiting: { text: 'منتظر پاسخ ⏳', class: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' },
  successful: { text: 'موفق / توافق 🤝', class: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-bold' },
  cancelled: { text: 'عدم تمایل / رد ❌', class: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' }
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initShortcuts();
  initNotifications();

  // Initialize Local-First DataEngine & Google Drive Sync
  if (window.DataEngine) await DataEngine.init();
  if (window.GDriveSync) GDriveSync.init();

  const todayFull = Shamsi.getTodayJalaliFull();
  document.getElementById('current-date-display').innerText = `امروز: ${todayFull}`;
  
  loadDashboardStats();
  await loadRoutines();
  switchTab('dashboard');

  // Interval for routine daily reminders (every 5 seconds for instant notification)
  setInterval(checkDailyRoutineNotifications, 5000);
});

function switchTab(tabName) {
  currentTab = tabName;
  
  // Desktop & Mobile top segmented pill tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    if (typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // Mobile bottom navigation bar items
  document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
  const activeBottomBtn = document.getElementById(`bottom-nav-${tabName}`);
  if (activeBottomBtn) {
    activeBottomBtn.classList.add('active');
  } else if (tabName === 'reports' || tabName === 'interactions') {
    const moreBtn = document.getElementById('bottom-nav-more');
    if (moreBtn) moreBtn.classList.add('active');
  }

  document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));

  const activeView = document.getElementById(`view-${tabName}`);
  if (activeView) {
    activeView.classList.remove('hidden');
  }

  if (tabName === 'dashboard') {
    loadDashboardStats();
  } else if (tabName === 'tasks') {
    loadTasks();
  } else if (tabName === 'routines') {
    loadRoutines();
  } else if (tabName === 'reports') {
    loadReports();
  } else if (tabName === 'interactions') {
    loadInteractions();
  }
}

function openMobileAddSheet() {
  const modal = document.getElementById('modal-mobile-add');
  if (modal) modal.classList.remove('hidden');
}

function closeMobileAddSheet() {
  const modal = document.getElementById('modal-mobile-add');
  if (modal) modal.classList.add('hidden');
}

function openMobileMoreSheet() {
  const modal = document.getElementById('modal-mobile-more');
  if (modal) modal.classList.remove('hidden');
}

function closeMobileMoreSheet() {
  const modal = document.getElementById('modal-mobile-more');
  if (modal) modal.classList.add('hidden');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-rose-600' : (type === 'purple' ? 'bg-purple-600' : 'bg-slate-800'));
  
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0 z-50`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'purple' ? 'fa-arrows-rotate' : 'fa-triangle-exclamation')}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// -------------------------------------------------------------
// UNIVERSAL PAGINATION ENGINE
// -------------------------------------------------------------
function renderPagination(containerId, sectionKey, totalItems) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = paginationState[sectionKey];
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  const startItem = (state.page - 1) * state.pageSize + 1;
  const endItem = Math.min(state.page * state.pageSize, totalItems);

  let pageButtonsHtml = '';
  
  // Previous button
  const prevDisabled = state.page === 1;
  pageButtonsHtml += `
    <button ${prevDisabled ? 'disabled' : ''} onclick="changePage('${sectionKey}', ${state.page - 1})" 
      class="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${prevDisabled ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'}">
      <i class="fa-solid fa-chevron-right text-[10px]"></i>
      <span>قبلی</span>
    </button>
  `;

  // Page Numbers
  const maxButtons = 5;
  let startPage = Math.max(1, state.page - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    pageButtonsHtml += `
      <button onclick="changePage('${sectionKey}', 1)" class="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition">
        ${Shamsi.toPersianDigits(1)}
      </button>
    `;
    if (startPage > 2) {
      pageButtonsHtml += `<span class="px-1 text-slate-400">...</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    const isActive = p === state.page;
    pageButtonsHtml += `
      <button onclick="changePage('${sectionKey}', ${p})" class="w-8 h-8 rounded-lg text-xs font-bold transition ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}">
        ${Shamsi.toPersianDigits(p)}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pageButtonsHtml += `<span class="px-1 text-slate-400">...</span>`;
    }
    pageButtonsHtml += `
      <button onclick="changePage('${sectionKey}', ${totalPages})" class="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition">
        ${Shamsi.toPersianDigits(totalPages)}
      </button>
    `;
  }

  // Next button
  const nextDisabled = state.page === totalPages;
  pageButtonsHtml += `
    <button ${nextDisabled ? 'disabled' : ''} onclick="changePage('${sectionKey}', ${state.page + 1})" 
      class="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${nextDisabled ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'}">
      <span>بعدی</span>
      <i class="fa-solid fa-chevron-left text-[10px]"></i>
    </button>
  `;

  container.innerHTML = `
    <div class="px-5 py-3.5 border-t border-slate-100 dark:border-slate-700/70 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-3 text-slate-600 dark:text-slate-300">
        <span>نمایش <strong>${Shamsi.toPersianDigits(startItem)}</strong> تا <strong>${Shamsi.toPersianDigits(endItem)}</strong> از <strong>${Shamsi.toPersianDigits(totalItems)}</strong> مورد</span>
        <div class="flex items-center gap-1.5 mr-2">
          <span class="text-slate-400">تعداد در صفحه:</span>
          <select onchange="changePageSize('${sectionKey}', this.value)" class="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-xs outline-none text-slate-700 dark:text-slate-200 font-bold">
            <option value="5" ${state.pageSize === 5 ? 'selected' : ''}>۵</option>
            <option value="9" ${state.pageSize === 9 ? 'selected' : ''}>۹</option>
            <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>۱۰</option>
            <option value="20" ${state.pageSize === 20 ? 'selected' : ''}>۲۰</option>
            <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>۵۰</option>
          </select>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        ${pageButtonsHtml}
      </div>
    </div>
  `;
}

function changePage(sectionKey, newPage) {
  paginationState[sectionKey].page = newPage;
  if (sectionKey === 'tasks') renderTasksTable(tasksCache);
  else if (sectionKey === 'routines') renderRoutinesGrid(routinesCache);
  else if (sectionKey === 'reports') renderReportsTable(reportsCache);
  else if (sectionKey === 'interactions') renderInteractionsTable(interactionsCache);
}

function changePageSize(sectionKey, newSize) {
  paginationState[sectionKey].pageSize = parseInt(newSize, 10);
  paginationState[sectionKey].page = 1;
  if (sectionKey === 'tasks') renderTasksTable(tasksCache);
  else if (sectionKey === 'routines') renderRoutinesGrid(routinesCache);
  else if (sectionKey === 'reports') renderReportsTable(reportsCache);
  else if (sectionKey === 'interactions') renderInteractionsTable(interactionsCache);
}

// -------------------------------------------------------------
// BACKUP & 2-STEP DATA CLEAR
// -------------------------------------------------------------
async function downloadBackup() {
  try {
    if (window.DataEngine) {
      const db = await DataEngine.getLocalDB();
      const filename = `TM-backup-${new Date().toISOString().split('T')[0]}.json`;
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('نسخه پشتیبان با موفقیت دانلود شد ✅');
      return;
    }
  } catch (e) {
    console.warn('Direct IDB backup error, falling back to server route:', e);
  }
  window.location.href = '/api/backup';
  showToast('دانلود نسخه پشتیبان شروع شد');
}

function openClearDataStep1() {
  document.getElementById('modal-clear-step1').classList.remove('hidden');
}

function openClearDataStep2() {
  document.getElementById('modal-clear-step1').classList.add('hidden');
  document.getElementById('input-clear-confirm').value = '';
  checkClearInput();
  document.getElementById('modal-clear-step2').classList.remove('hidden');
}

function closeClearDataModals() {
  document.getElementById('modal-clear-step1').classList.add('hidden');
  document.getElementById('modal-clear-step2').classList.add('hidden');
}

function checkClearInput() {
  const val = document.getElementById('input-clear-confirm').value.trim();
  const btn = document.getElementById('btn-final-clear');
  if (val === 'پاکسازی') {
    btn.disabled = false;
    btn.classList.remove('bg-rose-300', 'cursor-not-allowed');
    btn.classList.add('bg-rose-600', 'hover:bg-rose-700', 'shadow-sm');
  } else {
    btn.disabled = true;
    btn.classList.add('bg-rose-300', 'cursor-not-allowed');
    btn.classList.remove('bg-rose-600', 'hover:bg-rose-700', 'shadow-sm');
  }
}

async function executeClearData() {
  try {
    const res = await fetch('/api/clear-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true })
    });
    
    if (!res.ok) {
      showToast(`خطای سرور: ${res.status}`, 'error');
      return;
    }

    const json = await res.json();
    if (json.success) {
      closeClearDataModals();
      showToast(json.message, 'success');
      loadDashboardStats();
      if (currentTab === 'tasks') loadTasks();
      if (currentTab === 'routines') loadRoutines();
      if (currentTab === 'reports') loadReports();
      if (currentTab === 'interactions') loadInteractions();
    } else {
      showToast(json.message || 'خطا در پاکسازی', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('خطا در ارتباط با سرور پاکسازی', 'error');
  }
}

// -------------------------------------------------------------
// 1. DASHBOARD STATS
// -------------------------------------------------------------
async function loadDashboardStats() {
  try {
    const todayJalali = Shamsi.getTodayJalali();
    const [statsRes, tasksRes, interRes] = await Promise.all([
      fetch(`/api/stats?todayStr=${encodeURIComponent(todayJalali)}`),
      fetch('/api/tasks'),
      fetch('/api/interactions')
    ]);

    const json = await statsRes.json();
    const tasksJson = await tasksRes.json();
    const interJson = await interRes.json();

    if (!json.success) return;

    const data = json.data;
    const allTasks = tasksJson.data || [];
    const allInteractions = interJson.data || [];

    tasksCache = allTasks;
    interactionsCache = allInteractions;
    
    updateCategoryDatalist();

    document.getElementById('stat-pending-tasks').innerText = Shamsi.toPersianDigits(data.tasks.pending + data.tasks.inProgress);
    document.getElementById('stat-urgent-tasks').innerText = Shamsi.toPersianDigits(data.tasks.urgent);
    document.getElementById('stat-total-reports').innerText = Shamsi.toPersianDigits(data.reports.total);
    document.getElementById('stat-pending-followup').innerText = Shamsi.toPersianDigits(data.interactions.pendingFollowUp);

    const activeTasksCount = data.tasks.pending + data.tasks.inProgress;
    document.getElementById('badge-tasks-count').innerText = Shamsi.toPersianDigits(activeTasksCount);
    const bottomTasksBadge = document.getElementById('badge-bottom-tasks-count');
    if (bottomTasksBadge) {
      bottomTasksBadge.innerText = Shamsi.toPersianDigits(activeTasksCount);
      bottomTasksBadge.classList.toggle('hidden', activeTasksCount === 0);
    }

    const routineBadge = document.getElementById('badge-routines-count');
    const bottomRoutinesBadge = document.getElementById('badge-bottom-routines-count');
    if (data.routines) {
      const pendingRoutines = Math.max(0, data.routines.total - data.routines.completedToday);
      if (routineBadge) routineBadge.innerText = Shamsi.toPersianDigits(pendingRoutines);
      if (bottomRoutinesBadge) {
        bottomRoutinesBadge.innerText = Shamsi.toPersianDigits(pendingRoutines);
        bottomRoutinesBadge.classList.toggle('hidden', pendingRoutines === 0);
      }
    }

    const followupBadge = document.getElementById('badge-followup-count');
    if (data.interactions.pendingFollowUp > 0) {
      followupBadge.innerText = Shamsi.toPersianDigits(data.interactions.pendingFollowUp);
      followupBadge.classList.remove('hidden');
    } else {
      followupBadge.classList.add('hidden');
    }

    const headerArchiveBadge = document.getElementById('badge-header-archived-count');
    const mobileArchiveBadge = document.getElementById('badge-mobile-archived-count');
    const archivedTotal = (data.archived && data.archived.total) ? data.archived.total : 0;

    if (headerArchiveBadge) {
      if (archivedTotal > 0) {
        headerArchiveBadge.innerText = Shamsi.toPersianDigits(archivedTotal);
        headerArchiveBadge.classList.remove('hidden');
      } else {
        headerArchiveBadge.classList.add('hidden');
      }
    }

    if (mobileArchiveBadge) {
      if (archivedTotal > 0) {
        mobileArchiveBadge.innerText = Shamsi.toPersianDigits(archivedTotal);
        mobileArchiveBadge.classList.remove('hidden');
      } else {
        mobileArchiveBadge.classList.add('hidden');
      }
    }

    // Check Overdue Tasks
    checkOverdueTasks(allTasks);

    renderDashRecentTasks();
    renderDashRecentInteractions(data.interactions.recent);

  } catch (err) {
    console.error('خطا در دریافت آمار داشبورد:', err);
  }
}

async function renderDashRecentTasks() {
  try {
    const res = await fetch('/api/tasks?status=pending&sortBy=dueDate');
    const json = await res.json();
    const container = document.getElementById('dash-recent-tasks');
    
    if (!json.data || json.data.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <div class="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl mx-auto mb-2">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <p class="text-xs font-bold text-slate-700 dark:text-slate-200">همه کارهای باز تکمیل شده‌اند! 🎉</p>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">کار جدیدی ثبت نشده است.</p>
        </div>
      `;
      return;
    }

    const items = json.data.slice(0, 5);
    container.innerHTML = items.map(t => {
      const priorityInfo = PRIORITY_LABELS[t.priority] || PRIORITY_LABELS.medium;
      const dateDisplay = t.dueDate ? Shamsi.formatShortDate(t.dueDate) : 'بدون تاریخ';
      return `
        <div class="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-indigo-50/40 dark:bg-slate-800/60 dark:hover:bg-slate-700/60 border border-slate-100 hover:border-indigo-100 dark:border-slate-700 rounded-2xl transition-all cursor-pointer group" onclick="viewTaskDetails('${t.id}')">
          <div class="flex items-center gap-3">
            <button onclick="event.stopPropagation(); quickToggleTask('${t.id}', 'completed')" class="w-6 h-6 rounded-lg border-2 border-slate-300 dark:border-slate-600 group-hover:border-indigo-600 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-white hover:bg-indigo-600 transition shadow-sm" title="علامت‌گذاری به عنوان تکمیل شده">
              <i class="fa-solid fa-check text-xs"></i>
            </button>
            <div>
              <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">${t.title}</h4>
              <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                <span class="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium">${t.category || 'عمومی'}</span>
                <span>•</span>
                <span><i class="fa-regular fa-calendar text-indigo-500 ml-1"></i>${dateDisplay}</span>
              </div>
            </div>
          </div>
          <span class="badge ${priorityInfo.class} shrink-0 text-[10px]">${priorityInfo.text}</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

function renderDashRecentInteractions(items) {
  const container = document.getElementById('dash-recent-interactions');
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
        <div class="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl mx-auto mb-2">
          <i class="fa-solid fa-handshake"></i>
        </div>
        <p class="text-xs font-bold text-slate-700 dark:text-slate-200">هنوز تعاملی ثبت نشده است</p>
        <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">با کلیک روی «ثبت تعامل» تماس‌ها و جلسات خود را ثبت کنید.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(i => {
    const outcomeInfo = OUTCOME_LABELS[i.outcomeStatus] || OUTCOME_LABELS.answered;
    const nameParts = i.contactName.trim().split(' ');
    const initials = nameParts.length >= 2 ? (nameParts[0][0] + nameParts[1][0]) : i.contactName.substring(0, 2);

    return `
      <div class="p-3.5 bg-slate-50 hover:bg-amber-50/40 dark:bg-slate-800/60 dark:hover:bg-slate-700/60 border border-slate-100 hover:border-amber-200 dark:border-slate-700 rounded-2xl transition-all flex items-center justify-between cursor-pointer group" onclick="viewInteractionDetails('${i.id}')">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0 border border-slate-700 dark:border-slate-600">
            ${initials}
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition truncate">${i.contactName} ${i.company ? `<span class="text-[10px] text-slate-400 font-normal">(${i.company})</span>` : ''}</h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${i.subject || i.notes || 'بدون موضوع'}</p>
          </div>
        </div>
        <div class="text-left flex flex-col items-end gap-1 shrink-0 ml-2">
          <span class="badge ${outcomeInfo.class} text-[10px]">${outcomeInfo.text}</span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500">${Shamsi.formatShortDate(i.date)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// AUTOCOMPLETE SUGGESTIONS FOR PROJECTS / CATEGORIES
// -------------------------------------------------------------
function updateCategoryDatalist() {
  const datalist = document.getElementById('task-category-list');
  if (!datalist) return;

  const categories = new Set();
  tasksCache.forEach(t => { if (t.category && t.category.trim()) categories.add(t.category.trim()); });
  routinesCache.forEach(r => { if (r.category && r.category.trim()) categories.add(r.category.trim()); });

  datalist.innerHTML = Array.from(categories).map(cat => `<option value="${cat}">`).join('');
}

// -------------------------------------------------------------
// 2. TASKS MANAGEMENT (OPTIONAL DUE DATE & AUTOCOMPLETE)
// -------------------------------------------------------------
async function loadTasks(resetPage = false) {
  if (resetPage) paginationState.tasks.page = 1;
  const status = document.getElementById('filter-task-status').value;
  const priority = document.getElementById('filter-task-priority').value;
  const search = document.getElementById('search-task').value;
  const sortBy = document.getElementById('sort-task-by').value;

  const query = new URLSearchParams({ status, priority, search, sortBy }).toString();
  
  try {
    const res = await fetch(`/api/tasks?${query}`);
    const json = await res.json();
    tasksCache = json.data || [];
    updateCategoryDatalist();
    renderTasksTable(tasksCache);

    if (currentTasksView === 'kanban') {
      renderKanbanBoard(tasksCache);
    }
  } catch (err) {
    console.error('خطا در دریافت کارها:', err);
  }
}

function renderTasksTable(tasksList) {
  const tbody = document.getElementById('tasks-table-body');
  if (!tbody) return;

  if (!tasksList || tasksList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-400">
          <i class="fa-solid fa-list-check text-3xl mb-2 block"></i>
          هیچ کاری با این مشخصات یافت نشد
        </td>
      </tr>
    `;
    const pagContainer = document.getElementById('tasks-pagination-container');
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  const state = paginationState.tasks;
  const totalPages = Math.max(1, Math.ceil(tasksList.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedTasks = tasksList.slice(startIndex, startIndex + state.pageSize);

  tbody.innerHTML = paginatedTasks.map(t => {
    const statusInfo = STATUS_LABELS[t.status] || STATUS_LABELS.pending;
    const priorityInfo = PRIORITY_LABELS[t.priority] || PRIORITY_LABELS.medium;
    const isCompleted = t.status === 'completed';
    const dateText = t.dueDate ? Shamsi.formatShortDate(t.dueDate) : '<span class="text-slate-400 dark:text-slate-500 font-normal">تعیین نشده</span>';

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer" onclick="viewTaskDetails('${t.id}')">
        <td class="py-3.5 px-4 text-center" onclick="event.stopPropagation()">
          <button onclick="quickToggleTask('${t.id}', '${isCompleted ? 'pending' : 'completed'}')" class="w-5 h-5 rounded border ${isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-600 text-slate-300 dark:text-slate-600 hover:text-indigo-600'} flex items-center justify-center transition mx-auto" title="${isCompleted ? 'علامت‌گذاری به عنوان انجام نشده' : 'علامت‌گذاری به عنوان انجام شده'}">
            <i class="fa-solid fa-check text-xs"></i>
          </button>
        </td>

        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-800 dark:text-slate-100 ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : ''}">${t.title}</div>
          ${t.description ? `<div class="text-xs text-slate-400 dark:text-slate-500 truncate max-w-sm">${t.description}</div>` : ''}
        </td>

        <td class="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
          <span class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold">${t.category || 'عمومی'}</span>
        </td>

        <td class="py-3.5 px-4 text-center whitespace-nowrap">
          <span class="badge ${priorityInfo.class}">${priorityInfo.text}</span>
        </td>

        <td class="py-3.5 px-4 text-center text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">
          <i class="fa-regular fa-calendar-check text-indigo-500 ml-1"></i>
          ${dateText}
        </td>

        <td class="py-3.5 px-4 text-center whitespace-nowrap">
          <span class="badge ${statusInfo.class}">${statusInfo.text}</span>
        </td>

        <td class="py-3.5 px-4 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <div class="flex items-center justify-center gap-2">
            <button onclick="viewTaskDetails('${t.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition">
              <i class="fa-solid fa-eye"></i>
              <span>مشاهده</span>
            </button>
            <button onclick="editTask('${t.id}')" class="p-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-400"><i class="fa-solid fa-pen"></i></button>
            <button onclick="deleteTask('${t.id}')" class="p-1.5 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination('tasks-pagination-container', 'tasks', tasksList.length);
}

function viewTaskDetails(id) {
  const task = tasksCache.find(t => t.id === id);
  if (!task) return;

  const priorityInfo = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.medium;
  const statusInfo = STATUS_LABELS[task.status] || STATUS_LABELS.pending;

  document.getElementById('view-task-title').innerText = task.title;
  
  const pBadge = document.getElementById('view-task-priority');
  pBadge.className = `badge ${priorityInfo.class}`;
  pBadge.innerText = priorityInfo.text;

  const sBadge = document.getElementById('view-task-status');
  sBadge.className = `badge ${statusInfo.class}`;
  sBadge.innerText = statusInfo.text;

  document.getElementById('view-task-category').innerText = task.category || 'عمومی';
  document.getElementById('view-task-duedate').innerText = task.dueDate ? Shamsi.formatShortDate(task.dueDate) : 'ثبت نشده (اختیاری)';
  document.getElementById('view-task-description').innerText = task.description || 'بدون توضیحات تکمیلی';

  document.getElementById('btn-view-task-edit').onclick = () => {
    closeTaskViewModal();
    editTask(task.id);
  };

  document.getElementById('modal-task-view').classList.remove('hidden');
}

function closeTaskViewModal() {
  document.getElementById('modal-task-view').classList.add('hidden');
}

function openTaskModal(task = null) {
  document.getElementById('form-task').reset();
  document.getElementById('task-id').value = '';
  updateCategoryDatalist();
  
  if (task) {
    document.getElementById('modal-task-title').innerText = 'ویرایش کار';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-description').value = task.description || '';
    document.getElementById('task-priority').value = task.priority || 'medium';
    document.getElementById('task-status').value = task.status || 'pending';
    document.getElementById('task-category').value = task.category || '';
    document.getElementById('task-due-date').value = task.dueDate || '';
  } else {
    document.getElementById('modal-task-title').innerText = 'ایجاد کار جدید';
    document.getElementById('task-due-date').value = ''; // Optional Date!
  }

  document.getElementById('modal-task').classList.remove('hidden');
}

function closeTaskModal() {
  document.getElementById('modal-task').classList.add('hidden');
}

async function saveTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const payload = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    category: document.getElementById('task-category').value,
    dueDate: document.getElementById('task-due-date').value
  };

  const url = id ? `/api/tasks/${id}` : '/api/tasks';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      closeTaskModal();
      loadTasks();
      loadDashboardStats();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
}

async function editTask(id) {
  try {
    const res = await fetch(`/api/tasks/${id}`);
    const json = await res.json();
    if (json.success) {
      openTaskModal(json.data);
    }
  } catch (e) {
    console.error(e);
  }
}

async function quickToggleTask(id, newStatus) {
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`وضعیت کار تغییر کرد`);
      loadTasks();
      loadDashboardStats();
    }
  } catch (e) {
    console.error(e);
  }
}

async function deleteTask(id) {
  if (!confirm('آیا از حذف این کار اطمینان دارید؟')) return;
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      loadTasks();
      loadDashboardStats();
    }
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// 3. DAILY ROUTINES & NOTIFICATIONS
// -------------------------------------------------------------
async function loadRoutines(resetPage = false) {
  if (resetPage) paginationState.routines.page = 1;
  const todayJalali = Shamsi.getTodayJalali();
  try {
    const res = await fetch(`/api/routines?todayStr=${encodeURIComponent(todayJalali)}`);
    const json = await res.json();
    routinesCache = json.data || [];
    updateRoutineStats(routinesCache);
    renderRoutinesGrid(routinesCache);
  } catch (err) {
    console.error('خطا در دریافت روتین‌ها:', err);
  }
}

function renderRoutinesGrid(routinesList) {
  const container = document.getElementById('routines-grid');
  if (!container) return;

  if (!routinesList || routinesList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
        <div class="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
          <i class="fa-solid fa-arrows-rotate"></i>
        </div>
        <h4 class="font-bold text-slate-800 dark:text-white text-base">هنوز روتین روزانه‌ای تعریف نشده است</h4>
        <p class="text-xs text-slate-400 max-w-md mx-auto">کارهای تکرارشونده مانند ورزش روزانه، چک ایمیل، مطالعه یا ارسال گزارش کار را اضافه کنید تا هر روز به شما یادآوری شود.</p>
        <button onclick="openRoutineModal()" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition shadow-sm inline-flex items-center gap-2">
          <i class="fa-solid fa-plus"></i>
          <span>تعریف اولین روتین روزانه</span>
        </button>
      </div>
    `;
    const pagContainer = document.getElementById('routines-pagination-container');
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  const state = paginationState.routines;
  const totalPages = Math.max(1, Math.ceil(routinesList.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedRoutines = routinesList.slice(startIndex, startIndex + state.pageSize);

  container.innerHTML = paginatedRoutines.map(r => {
    const isDone = r.isCompletedToday;
    return `
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 border ${isDone ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20' : 'border-slate-200/80 dark:border-slate-700'} shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 group">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 min-w-0">
            <button onclick="toggleRoutineToday('${r.id}')" class="w-7 h-7 rounded-xl border-2 ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-purple-600 text-transparent'} flex items-center justify-center transition shrink-0 mt-0.5 shadow-sm" title="${isDone ? 'علامت‌گذاری به عنوان انجام‌نشده' : 'علامت‌گذاری به عنوان انجام‌شده امروز'}">
              <i class="fa-solid fa-check text-xs"></i>
            </button>
            <div class="min-w-0">
              <h4 class="font-bold text-sm text-slate-900 dark:text-white ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : ''} leading-snug truncate" title="${r.title}">${r.title}</h4>
              ${r.notes ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">${r.notes}</p>` : ''}
            </div>
          </div>
          
          <div class="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
            <button onclick="editRoutine('${r.id}')" class="p-1.5 hover:text-purple-600 text-slate-400" title="ویرایش"><i class="fa-solid fa-pen text-xs"></i></button>
            <button onclick="deleteRoutine('${r.id}')" class="p-1.5 hover:text-rose-600 text-slate-400" title="حذف"><i class="fa-solid fa-trash text-xs"></i></button>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-lg font-semibold text-[11px]">${r.category || 'عمومی'}</span>
            ${r.time ? `<span class="text-[11px] text-purple-700 dark:text-purple-300 font-mono font-bold"><i class="fa-regular fa-clock ml-1 text-purple-500"></i>${Shamsi.toPersianDigits(r.time)}</span>` : ''}
          </div>
          
          <span class="text-[11px] font-bold ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">
            ${isDone ? 'انجام شده امروز ✅' : 'در انتظار انجام ⏳'}
          </span>
        </div>
      </div>
    `;
  }).join('');

  renderPagination('routines-pagination-container', 'routines', routinesList.length);
}

function updateRoutineStats(routines) {
  const activeRoutines = routines.filter(r => r.active !== false);
  const total = activeRoutines.length;
  const completed = activeRoutines.filter(r => r.isCompletedToday).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('routine-stat-total').innerText = Shamsi.toPersianDigits(total);
  document.getElementById('routine-stat-completed').innerText = Shamsi.toPersianDigits(completed);
  document.getElementById('routine-progress-percent').innerText = `${Shamsi.toPersianDigits(percent)}٪`;
  document.getElementById('routine-progress-bar').style.width = `${percent}%`;

  const badge = document.getElementById('badge-routines-count');
  const bottomRoutinesBadge = document.getElementById('badge-bottom-routines-count');
  if (badge) {
    const pending = total - completed;
    badge.innerText = Shamsi.toPersianDigits(pending);
    if (bottomRoutinesBadge) {
      bottomRoutinesBadge.innerText = Shamsi.toPersianDigits(pending);
      bottomRoutinesBadge.classList.toggle('hidden', pending === 0);
    }
  }
}

async function toggleRoutineToday(id) {
  const todayJalali = Shamsi.getTodayJalali();
  try {
    const res = await fetch(`/api/routines/${id}/toggle-today`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todayStr: todayJalali })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, json.isCompletedToday ? 'purple' : 'success');
      loadRoutines();
      loadDashboardStats();
    }
  } catch (e) {
    console.error(e);
  }
}

function openRoutineModal(routine = null) {
  document.getElementById('form-routine').reset();
  document.getElementById('routine-id').value = '';
  updateCategoryDatalist();

  if (routine) {
    document.getElementById('modal-routine-title').innerText = 'ویرایش روتین روزانه';
    document.getElementById('routine-id').value = routine.id;
    document.getElementById('routine-title').value = routine.title;
    document.getElementById('routine-time').value = routine.time || '09:00';
    document.getElementById('routine-category').value = routine.category || 'عمومی';
    document.getElementById('routine-notes').value = routine.notes || '';
    document.getElementById('routine-active').checked = routine.active !== false;
  } else {
    document.getElementById('modal-routine-title').innerText = 'ایجاد روتین روزانه جدید';
    document.getElementById('routine-time').value = '09:00';
    document.getElementById('routine-active').checked = true;
  }

  document.getElementById('modal-routine').classList.remove('hidden');
}

function closeRoutineModal() {
  document.getElementById('modal-routine').classList.add('hidden');
}

async function saveRoutine(e) {
  e.preventDefault();
  const id = document.getElementById('routine-id').value;
  const payload = {
    title: document.getElementById('routine-title').value,
    time: document.getElementById('routine-time').value,
    category: document.getElementById('routine-category').value,
    notes: document.getElementById('routine-notes').value,
    active: document.getElementById('routine-active').checked
  };

  const url = id ? `/api/routines/${id}` : '/api/routines';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'purple');
      closeRoutineModal();
      await loadRoutines();
      loadDashboardStats();
      checkDailyRoutineNotifications();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
}

async function editRoutine(id) {
  try {
    const res = await fetch(`/api/routines/${id}`);
    const json = await res.json();
    if (json.success) openRoutineModal(json.data);
  } catch (e) {
    console.error(e);
  }
}

async function deleteRoutine(id) {
  if (!confirm('آیا از حذف این روتین اطمینان دارید؟')) return;
  try {
    const res = await fetch(`/api/routines/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      loadRoutines();
      loadDashboardStats();
    }
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// BROWSER NOTIFICATIONS & DAILY REMINDERS (ZERO-SERVER & MOBILE NATIVE)
// -------------------------------------------------------------

// Web Audio API Context unlocked on user gesture for mobile Safari / Chrome
let appAudioContext = null;

function getOrCreateAudioContext() {
  try {
    if (!appAudioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        appAudioContext = new AudioCtx();
      }
    }
    if (appAudioContext && appAudioContext.state === 'suspended') {
      appAudioContext.resume();
    }
  } catch (e) {
    console.warn('AudioContext init error:', e);
  }
  return appAudioContext;
}

// Unlock audio context on first interaction on mobile
['click', 'touchstart', 'pointerdown'].forEach(evt => {
  document.addEventListener(evt, () => {
    getOrCreateAudioContext();
  }, { once: false, passive: true });
});

function getNotificationSupportStatus() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isSecure = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const hasNotifApi = ('Notification' in window);

  return {
    isIOS,
    isStandalone,
    isSecure,
    hasNotifApi,
    canUseSystemNotif: hasNotifApi && isSecure && (!isIOS || isStandalone),
    permission: hasNotifApi ? Notification.permission : 'unsupported'
  };
}

function initNotifications() {
  const banner = document.getElementById('routine-notif-banner');
  const title = document.getElementById('routine-notif-title');
  const subtext = document.getElementById('routine-notif-subtext');
  const btn = document.getElementById('btn-request-notif');

  if (!banner) return;

  const status = getNotificationSupportStatus();

  // Case 1: Insecure origin on local network (e.g. http://192.168.1.7:3000)
  if (!status.isSecure) {
    if (title) title.textContent = 'یادآوری هوشمند فعال است (صدا + لرزش + اعلان) 🔔';
    if (subtext) subtext.textContent = 'در شبکه محلی، هشدار صوتی و لرزشی گوشی در زمان مقرر فعال است. نیازی به مجوز سرور نیست.';
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-bell"></i><span>تست زنگ و لرزش</span>`;
      btn.onclick = sendTestNotification;
      btn.className = 'bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md';
    }
    return;
  }

  // Case 2: iOS Safari outside standalone PWA mode
  if (status.isIOS && !status.isStandalone) {
    if (title) title.textContent = 'نصب نسخه نیتو در آیفون (iOS) 📱';
    if (subtext) subtext.textContent = 'در آیفون برای اجرای مستقل و تمام‌صفحه، گزینه Add to Home Screen را از منوی Share بزنید.';
    if (btn) {
      btn.innerHTML = `<i class="fa-brands fa-apple"></i><span>راهنمای نصب آیفون</span>`;
      btn.onclick = openNotificationGuideModal;
      btn.className = 'bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md';
    }
    return;
  }

  // Case 3: Notification API unsupported by browser
  if (!status.hasNotifApi) {
    if (title) title.textContent = 'یادآوری صوتی و تصویری فعال است 🔔';
    if (subtext) subtext.textContent = 'مرورگر از اعلان سیستمی پشتیبانی نمی‌کند، اما زنگ و لرزش درون‌برنامه فعال است.';
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-volume-high"></i><span>تست صدا</span>`;
      btn.onclick = sendTestNotification;
    }
    return;
  }

  // Case 4: Permission already granted
  if (status.permission === 'granted') {
    banner.classList.add('hidden'); // Hide banner completely when already granted
    return;
  }

  // Case 5: Permission denied by user in browser
  if (status.permission === 'denied') {
    banner.classList.remove('hidden');
    if (title) title.textContent = 'دسترسی نوتیفیکیشن مرورگر مسدود است 🔕';
    if (subtext) subtext.textContent = 'دسترسی اعلان‌ها در مرورگر رد شده است. جهت فعال‌سازی مجدد، روی آیکون کنار آدرس کلیک کنید.';
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>راهنمای فعال‌سازی</span>`;
      btn.onclick = openNotificationGuideModal;
      btn.className = 'bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md';
    }
    return;
  }

  // Case 6: Default state (prompt available)
  banner.classList.remove('hidden');
  if (title) title.textContent = 'یادآوری خودکار و نوتیفیکیشن‌های روزانه 🔔';
  if (subtext) subtext.textContent = 'با فعال‌سازی دسترسی مرورگر، روتین‌های روزانه به صورت اعلان به شما یادآوری می‌شوند.';
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-bell"></i><span>فعال‌سازی نوتیفیکیشن مرورگر</span>`;
    btn.onclick = requestNotificationPermission;
    btn.className = 'bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md';
  }
}

function openNotificationGuideModal() {
  const modal = document.getElementById('modal-notification-guide');
  if (modal) modal.classList.remove('hidden');
}

function closeNotificationGuideModal() {
  const modal = document.getElementById('modal-notification-guide');
  if (modal) modal.classList.add('hidden');
}

let activeRoutineAlertId = null;

function showRoutineAlertModal(routine) {
  const modal = document.getElementById('modal-routine-alert');
  if (!modal) return;

  activeRoutineAlertId = routine.id;
  const titleEl = document.getElementById('routine-alert-title');
  const notesEl = document.getElementById('routine-alert-notes');
  const doneBtn = document.getElementById('btn-routine-alert-done');

  if (titleEl) titleEl.textContent = routine.title || 'روتین روزانه';
  if (notesEl) notesEl.textContent = routine.notes || 'وقت انجام این کار روتین فرا رسیده است!';
  
  if (doneBtn) {
    doneBtn.onclick = () => {
      toggleRoutineToday(routine.id);
      closeRoutineAlertModal();
      showToast(`روتین «${routine.title}» انجام شد ✅`, 'purple');
    };
  }

  modal.classList.remove('hidden');
}

function closeRoutineAlertModal() {
  const modal = document.getElementById('modal-routine-alert');
  if (modal) modal.classList.add('hidden');
  activeRoutineAlertId = null;
}

function requestNotificationPermission() {
  // Always unlock audio context
  getOrCreateAudioContext();

  const status = getNotificationSupportStatus();

  if (status.isIOS && !status.isStandalone) {
    openNotificationGuideModal();
    return;
  }

  if (!status.isSecure) {
    showToast('در شبکه محلی (HTTP)، زنگ صوتی 🔔 و لرزش 📳 بدون نیاز به مجوز فعال است!', 'purple');
    sendTestNotification();
    return;
  }

  if (!status.hasNotifApi) {
    showToast('مرورگر از اعلان سیستمی پشتیبانی نمی‌کند؛ هشدار صوتی برنامه فعال است.', 'purple');
    sendTestNotification();
    return;
  }

  try {
    const p = Notification.requestPermission();
    if (p && typeof p.then === 'function') {
      p.then(permission => {
        initNotifications();
        if (permission === 'granted') {
          showToast('دسترسی نوتیفیکیشن تایید شد 🔔', 'purple');
          sendTestNotification();
        } else {
          openNotificationGuideModal();
        }
      });
    } else {
      Notification.requestPermission(permission => {
        initNotifications();
        if (permission === 'granted') {
          showToast('دسترسی نوتیفیکیشن تایید شد 🔔', 'purple');
          sendTestNotification();
        } else {
          openNotificationGuideModal();
        }
      });
    }
  } catch (err) {
    console.warn('requestPermission error:', err);
    openNotificationGuideModal();
  }
}

function playNotifSound() {
  try {
    // Haptic vibration feedback for mobile devices
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([180, 90, 180]);
      } catch (e) {}
    }

    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    // Dual-tone harmonic chime (587.33Hz D5 -> 880Hz A5)
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.05);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('playNotifSound error:', e);
  }
}

async function triggerSystemNotification(title, options = {}) {
  const defaultOptions = {
    icon: '/icon.svg',
    badge: '/icon.svg',
    requireInteraction: true,
    ...options
  };

  // Try Service Worker registration first (standard for mobile & PWA)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, defaultOptions);
        return true;
      }
    } catch (e) {
      console.warn('SW notification fallback to window:', e);
    }
  }

  // Fallback to Desktop Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, defaultOptions);
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return true;
    } catch (e) {
      console.warn('Desktop Notification error:', e);
    }
  }
  return false;
}

async function sendTestNotification() {
  // Always trigger sound & haptic vibration
  playNotifSound();

  const status = getNotificationSupportStatus();

  // If system notifications can be shown, trigger them
  if (status.canUseSystemNotif && status.permission === 'granted') {
    const success = await triggerSystemNotification('🔔 تست نوتیفیکیشن TM', {
      body: 'سیستم اعلان و یادآوری روتین‌های روزانه فعال است! 🎉',
      tag: 'test-notification'
    });
    if (success) {
      showToast('اعلان سیستمی صادر شد! 🔔', 'purple');
      return;
    }
  }

  // Visual in-app alert card test
  showRoutineAlertModal({
    id: 'test_routine',
    title: 'تست یادآوری روتین روزانه',
    notes: 'سیستم صوتی 🔔، لرزش گوشی 📳 و کادر هشدار هوشمند با موفقیت اجرا شد!'
  });

  showToast('هشدار صوتی و تصویری آزمایشی با موفقیت پخش شد! 🔔', 'purple');
}

const notifiedRoutinesSet = new Set();

function checkDailyRoutineNotifications() {
  if (!routinesCache || routinesCache.length === 0) return;

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  const todayStr = Shamsi.getTodayJalali();

  routinesCache.forEach(r => {
    if (r.active !== false && !r.isCompletedToday) {
      if (r.time === currentTimeStr) {
        const notifKey = `${r.id}_${todayStr}_${r.time}`;
        if (!notifiedRoutinesSet.has(notifKey)) {
          notifiedRoutinesSet.add(notifKey);

          // 1. Play audio chime & trigger phone vibration
          playNotifSound();

          // 2. Trigger OS notification if supported & granted
          triggerSystemNotification(`⏰ یادآوری روتین روزانه: ${r.title}`, {
            body: r.notes ? r.notes : 'وقت انجام این کار روتین رسیده است!',
            tag: notifKey
          });

          // 3. Show native in-app reminder card
          showRoutineAlertModal(r);

          // 4. In-app toast banner
          showToast(`⏰ یادآوری روتین روزانه: ${r.title}`, 'purple');
        }
      }
    }
  });
}

// -------------------------------------------------------------
// 4. DAILY REPORTS (TABLE LAYOUT & VIEW MODAL)
// -------------------------------------------------------------
async function loadReports(resetPage = false) {
  if (resetPage) paginationState.reports.page = 1;
  const search = document.getElementById('search-report').value;
  const query = new URLSearchParams({ search }).toString();

  try {
    const res = await fetch(`/api/reports?${query}`);
    const json = await res.json();
    reportsCache = json.data || [];
    renderReportsTable(reportsCache);
  } catch (err) {
    console.error('خطا در دریافت گزارش‌ها:', err);
  }
}

function renderReportsTable(reportsList) {
  const tbody = document.getElementById('reports-table-body');
  if (!tbody) return;

  if (!reportsList || reportsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-12 text-center text-slate-400">
          <i class="fa-solid fa-book-open text-3xl mb-2 block"></i>
          هیچ گزارش روزانه‌ای یافت نشد
        </td>
      </tr>
    `;
    const pagContainer = document.getElementById('reports-pagination-container');
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  const state = paginationState.reports;
  const totalPages = Math.max(1, Math.ceil(reportsList.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedReports = reportsList.slice(startIndex, startIndex + state.pageSize);

  tbody.innerHTML = paginatedReports.map(r => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer" onclick="viewReportDetails('${r.id}')">
      <td class="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
        <i class="fa-regular fa-calendar-days text-emerald-600 ml-2"></i>
        ${Shamsi.formatShortDate(r.date)}
      </td>
      <td class="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-md">
        <div class="truncate font-medium">${r.summary}</div>
      </td>
      <td class="py-3.5 px-4 text-center text-amber-400 text-xs whitespace-nowrap" title="امتیاز: ${r.rating}">
        ${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}
      </td>
      <td class="py-3.5 px-4 text-center whitespace-nowrap" onclick="event.stopPropagation()">
        <div class="flex items-center justify-center gap-2">
          <button onclick="viewReportDetails('${r.id}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition">
            <i class="fa-solid fa-eye"></i>
            <span>مشاهده</span>
          </button>
          <button onclick="editReport('${r.id}')" class="p-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-400"><i class="fa-solid fa-pen"></i></button>
          <button onclick="deleteReport('${r.id}')" class="p-1.5 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPagination('reports-pagination-container', 'reports', reportsList.length);
}

function viewReportDetails(id) {
  const report = reportsCache.find(r => r.id === id);
  if (!report) return;

  document.getElementById('view-report-date-title').innerText = `گزارش روزانه: ${Shamsi.formatDate(report.date)}`;
  document.getElementById('view-report-rating-stars').innerText = `${'★'.repeat(report.rating || 5)}${'☆'.repeat(5 - (report.rating || 5))} (${report.rating} از ۵)`;
  document.getElementById('view-report-summary').innerText = report.summary || '-';

  const achBox = document.getElementById('view-report-achievements-box');
  if (report.achievements && report.achievements.trim()) {
    document.getElementById('view-report-achievements').innerText = report.achievements;
    achBox.classList.remove('hidden');
  } else {
    achBox.classList.add('hidden');
  }

  const blkBox = document.getElementById('view-report-blockers-box');
  if (report.blockers && report.blockers.trim()) {
    document.getElementById('view-report-blockers').innerText = report.blockers;
    blkBox.classList.remove('hidden');
  } else {
    blkBox.classList.add('hidden');
  }

  const nxtBox = document.getElementById('view-report-nextplan-box');
  if (report.nextPlan && report.nextPlan.trim()) {
    document.getElementById('view-report-nextplan').innerText = report.nextPlan;
    nxtBox.classList.remove('hidden');
  } else {
    nxtBox.classList.add('hidden');
  }

  document.getElementById('btn-view-report-edit').onclick = () => {
    closeReportViewModal();
    editReport(report.id);
  };

  document.getElementById('modal-report-view').classList.remove('hidden');
}

function closeReportViewModal() {
  document.getElementById('modal-report-view').classList.add('hidden');
}

function openReportModal(report = null) {
  document.getElementById('form-report').reset();
  document.getElementById('report-id').value = '';

  if (report) {
    document.getElementById('modal-report-title').innerText = 'ویرایش گزارش روزانه';
    document.getElementById('report-id').value = report.id;
    document.getElementById('report-date').value = report.date;
    document.getElementById('report-summary').value = report.summary;
    document.getElementById('report-achievements').value = report.achievements || '';
    document.getElementById('report-blockers').value = report.blockers || '';
    document.getElementById('report-nextplan').value = report.nextPlan || '';
    document.getElementById('report-rating').value = report.rating || 5;
  } else {
    document.getElementById('modal-report-title').innerText = 'ثبت گزارش روزانه';
    document.getElementById('report-date').value = Shamsi.getTodayJalali();
  }

  document.getElementById('modal-report').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('modal-report').classList.add('hidden');
}

async function saveReport(e) {
  e.preventDefault();
  const id = document.getElementById('report-id').value;
  const payload = {
    date: document.getElementById('report-date').value,
    summary: document.getElementById('report-summary').value,
    achievements: document.getElementById('report-achievements').value,
    blockers: document.getElementById('report-blockers').value,
    nextPlan: document.getElementById('report-nextplan').value,
    rating: document.getElementById('report-rating').value
  };

  const url = id ? `/api/reports/${id}` : '/api/reports';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      closeReportModal();
      loadReports();
      loadDashboardStats();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('خطا در ذخیره گزارش', 'error');
  }
}

async function editReport(id) {
  try {
    const res = await fetch(`/api/reports/${id}`);
    const json = await res.json();
    if (json.success) openReportModal(json.data);
  } catch (e) {
    console.error(e);
  }
}

async function deleteReport(id) {
  if (!confirm('آیا از حذف این گزارش اطمینان دارید؟')) return;
  try {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      loadReports();
      loadDashboardStats();
    }
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// 5. INTERACTIONS MANAGEMENT (TABLE LAYOUT WITH OUTCOME)
// -------------------------------------------------------------
async function loadInteractions(resetPage = false) {
  if (resetPage) paginationState.interactions.page = 1;
  const type = document.getElementById('filter-interaction-type').value;
  const outcomeStatus = document.getElementById('filter-interaction-outcome').value;
  const followUp = document.getElementById('filter-interaction-followup').value;
  const search = document.getElementById('search-interaction').value;

  const query = new URLSearchParams({ type, outcomeStatus, followUp, search }).toString();

  try {
    const res = await fetch(`/api/interactions?${query}`);
    const json = await res.json();
    interactionsCache = json.data || [];
    renderInteractionsTable(interactionsCache);
  } catch (err) {
    console.error('خطا در دریافت تعاملات:', err);
  }
}

function renderInteractionsTable(interactionsList) {
  const tbody = document.getElementById('interactions-table-body');
  if (!tbody) return;

  if (!interactionsList || interactionsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-400">
          <i class="fa-solid fa-address-book text-3xl mb-2 block"></i>
          هیچ تعاملی یافت نشد
        </td>
      </tr>
    `;
    const pagContainer = document.getElementById('interactions-pagination-container');
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  const state = paginationState.interactions;
  const totalPages = Math.max(1, Math.ceil(interactionsList.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedInteractions = interactionsList.slice(startIndex, startIndex + state.pageSize);

  tbody.innerHTML = paginatedInteractions.map(i => {
    const typeInfo = INTERACTION_TYPES[i.type] || INTERACTION_TYPES.other;
    const outcomeInfo = OUTCOME_LABELS[i.outcomeStatus] || OUTCOME_LABELS.answered;
    const isDone = i.followUpStatus === 'done';

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer" onclick="viewInteractionDetails('${i.id}')">
        <td class="py-3.5 px-4 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            <i class="fa-solid ${typeInfo.icon} ${typeInfo.color}"></i>
            ${typeInfo.text}
          </span>
        </td>

        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-800 dark:text-slate-100">${i.contactName}</div>
          ${i.company ? `<div class="text-xs text-slate-400 dark:text-slate-500">${i.company}</div>` : ''}
        </td>

        <td class="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300 font-medium">
          ${i.subject || i.notes || 'بدون موضوع'}
        </td>

        <td class="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
          ${Shamsi.formatShortDate(i.date)}
        </td>

        <td class="py-3.5 px-4 text-center whitespace-nowrap">
          <span class="badge ${outcomeInfo.class}">${outcomeInfo.text}</span>
        </td>

        <td class="py-3.5 px-4 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          ${i.followUpRequired ? `
            <button onclick="toggleFollowUp('${i.id}')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto ${isDone ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'}" title="کلیک برای تغییر وضعیت">
              <i class="fa-solid ${isDone ? 'fa-circle-check' : 'fa-clock-rotate-left'}"></i>
              <span>${isDone ? 'پیگیری شد' : `پیگیری: ${Shamsi.formatShortDate(i.followUpDate)}`}</span>
            </button>
          ` : '<span class="text-slate-400 dark:text-slate-500 text-xs">-</span>'}
        </td>

        <td class="py-3.5 px-4 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <div class="flex items-center justify-center gap-2">
            <button onclick="viewInteractionDetails('${i.id}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition">
              <i class="fa-solid fa-eye"></i>
              <span>مشاهده</span>
            </button>
            <button onclick="editInteraction('${i.id}')" class="p-1.5 hover:text-amber-600 dark:hover:text-amber-400 text-slate-400"><i class="fa-solid fa-pen"></i></button>
            <button onclick="deleteInteraction('${i.id}')" class="p-1.5 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination('interactions-pagination-container', 'interactions', interactionsList.length);
}

function viewInteractionDetails(id) {
  const item = interactionsCache.find(i => i.id === id);
  if (!item) return;

  const typeInfo = INTERACTION_TYPES[item.type] || INTERACTION_TYPES.other;
  const outcomeInfo = OUTCOME_LABELS[item.outcomeStatus] || OUTCOME_LABELS.answered;

  document.getElementById('view-int-contact').innerText = item.contactName;
  document.getElementById('view-int-company').innerText = item.company ? `(${item.company})` : '';

  const iconContainer = document.getElementById('view-int-icon');
  iconContainer.innerHTML = `<i class="fa-solid ${typeInfo.icon}"></i>`;

  document.getElementById('view-int-type').innerText = typeInfo.text;
  document.getElementById('view-int-date').innerText = Shamsi.formatShortDate(item.date);
  
  const oBadge = document.getElementById('view-int-outcome');
  oBadge.className = `badge ${outcomeInfo.class}`;
  oBadge.innerText = outcomeInfo.text;

  document.getElementById('view-int-subject').innerText = item.subject || 'بدون موضوع مشخص';
  document.getElementById('view-int-notes').innerText = item.notes || 'بدون توضیحات تکمیلی';

  const fBox = document.getElementById('view-int-followup-box');
  const fBtn = document.getElementById('btn-view-int-toggle-followup');
  if (item.followUpRequired) {
    fBox.classList.remove('hidden');
    const isDone = item.followUpStatus === 'done';
    document.getElementById('view-int-followup-text').innerText = isDone ? '✅ این تعامل پیگیری گردید' : `⏳ نیازمند پیگیری در تاریخ: ${Shamsi.formatShortDate(item.followUpDate)}`;
    fBtn.onclick = async () => {
      await toggleFollowUp(item.id);
      closeInteractionViewModal();
    };
  } else {
    fBox.classList.add('hidden');
  }

  document.getElementById('btn-view-int-edit').onclick = () => {
    closeInteractionViewModal();
    editInteraction(item.id);
  };

  document.getElementById('modal-interaction-view').classList.remove('hidden');
}

function closeInteractionViewModal() {
  document.getElementById('modal-interaction-view').classList.add('hidden');
}

function openInteractionModal(item = null) {
  document.getElementById('form-interaction').reset();
  document.getElementById('interaction-id').value = '';
  document.getElementById('followup-fields').classList.add('hidden');

  if (item) {
    document.getElementById('modal-interaction-title').innerText = 'ویرایش تعامل';
    document.getElementById('interaction-id').value = item.id;
    document.getElementById('interaction-contact').value = item.contactName;
    document.getElementById('interaction-company').value = item.company || '';
    document.getElementById('interaction-type').value = item.type || 'call';
    document.getElementById('interaction-outcome').value = item.outcomeStatus || 'answered';
    document.getElementById('interaction-date').value = item.date;
    document.getElementById('interaction-subject').value = item.subject || '';
    document.getElementById('interaction-notes').value = item.notes || '';
    document.getElementById('interaction-followup-check').checked = Boolean(item.followUpRequired);
    document.getElementById('interaction-followup-date').value = item.followUpDate || '';
    document.getElementById('interaction-followup-status').value = item.followUpStatus || 'pending';

    toggleFollowUpFields();
  } else {
    document.getElementById('modal-interaction-title').innerText = 'ثبت تعامل جدید';
    document.getElementById('interaction-date').value = Shamsi.getTodayJalali();
    document.getElementById('interaction-followup-date').value = Shamsi.getTodayJalali();
    document.getElementById('interaction-outcome').value = 'answered';
  }

  document.getElementById('modal-interaction').classList.remove('hidden');
}

function closeInteractionModal() {
  document.getElementById('modal-interaction').classList.add('hidden');
}

function toggleFollowUpFields() {
  const isChecked = document.getElementById('interaction-followup-check').checked;
  const fields = document.getElementById('followup-fields');
  if (isChecked) {
    fields.classList.remove('hidden');
  } else {
    fields.classList.add('hidden');
  }
}

async function saveInteraction(e) {
  e.preventDefault();
  const id = document.getElementById('interaction-id').value;
  const isFollowUp = document.getElementById('interaction-followup-check').checked;

  const payload = {
    contactName: document.getElementById('interaction-contact').value,
    company: document.getElementById('interaction-company').value,
    type: document.getElementById('interaction-type').value,
    outcomeStatus: document.getElementById('interaction-outcome').value,
    date: document.getElementById('interaction-date').value,
    subject: document.getElementById('interaction-subject').value,
    notes: document.getElementById('interaction-notes').value,
    followUpRequired: isFollowUp,
    followUpDate: isFollowUp ? document.getElementById('interaction-followup-date').value : '',
    followUpStatus: isFollowUp ? document.getElementById('interaction-followup-status').value : 'done'
  };

  const url = id ? `/api/interactions/${id}` : '/api/interactions';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      closeInteractionModal();
      loadInteractions();
      loadDashboardStats();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('خطا در ثبت تعامل', 'error');
  }
}

async function toggleFollowUp(id) {
  try {
    const res = await fetch(`/api/interactions/${id}/toggle-followup`, { method: 'PATCH' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      loadInteractions();
      loadDashboardStats();
    }
  } catch (e) {
    console.error(e);
  }
}

async function editInteraction(id) {
  try {
    const res = await fetch(`/api/interactions/${id}`);
    const json = await res.json();
    if (json.success) openInteractionModal(json.data);
  } catch (e) {
    console.error(e);
  }
}

async function deleteInteraction(id) {
  if (!confirm('آیا از حذف این تعامل اطمینان دارید؟')) return;
  try {
    const res = await fetch(`/api/interactions/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      loadInteractions();
      loadDashboardStats();
    }
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// 6. DARK MODE & THEME MANAGEMENT
// -------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.getElementById('theme-toggle-icon');
  const btn = document.getElementById('btn-theme-toggle');
  if (!icon) return;

  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    icon.className = 'fa-solid fa-sun text-amber-400 text-sm';
    if (btn) btn.title = 'تغییر تم به حالت روز ☀️';
  } else {
    icon.className = 'fa-solid fa-moon text-indigo-600 text-sm';
    if (btn) btn.title = 'تغییر تم به حالت شب 🌙';
  }
}

function toggleDarkMode() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    showToast('حالت روز فعال شد ☀️');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    showToast('حالت شب فعال شد 🌙');
  }
  updateThemeIcon();
}

// DROPDOWN CONTROLLER
function toggleDropdown(id, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const targetMenu = document.getElementById(id);
  if (!targetMenu) return;

  const isHidden = targetMenu.classList.contains('hidden');
  closeAllDropdowns();

  if (isHidden) {
    targetMenu.classList.remove('hidden');
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(el => {
    el.classList.add('hidden');
  });
}

// Global click outside to close dropdowns
window.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-container')) {
    closeAllDropdowns();
  }
});

// -------------------------------------------------------------
// 7. KEYBOARD SHORTCUTS & COMMAND PALETTE (CTRL+K)
// -------------------------------------------------------------
function initShortcuts() {
  window.addEventListener('keydown', (e) => {
    const key = (e.key || '').toLowerCase();
    const code = e.code || '';
    const keyCode = e.keyCode || e.which;

    if ((e.ctrlKey || e.metaKey) && (key === 'k' || key === 'ن' || code === 'KeyK' || keyCode === 75)) {
      e.preventDefault();
      e.stopPropagation();
      openCommandPalette();
      return;
    }

    if (key === 'escape' || code === 'Escape' || keyCode === 27) {
      closeAllDropdowns();
      closeCommandPalette();
      closeDatePicker();
      closeTaskModal();
      closeRoutineModal();
      closeReportModal();
      closeInteractionModal();
      closeTaskViewModal();
      closeInteractionViewModal();
      return;
    }

    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.altKey && (key === 't' || key === 'ف' || code === 'KeyT' || keyCode === 84)) {
      e.preventDefault();
      e.stopPropagation();
      openTaskModal();
    } else if (e.altKey && (key === 'r' || key === 'ق' || code === 'KeyR' || keyCode === 82)) {
      e.preventDefault();
      e.stopPropagation();
      openReportModal();
    } else if (e.altKey && (key === 'i' || key === 'ه' || code === 'KeyI' || keyCode === 73)) {
      e.preventDefault();
      e.stopPropagation();
      openInteractionModal();
    } else if (e.altKey && (key === '1' || code === 'Digit1')) {
      e.preventDefault();
      switchTab('dashboard');
    } else if (e.altKey && (key === '2' || code === 'Digit2')) {
      e.preventDefault();
      switchTab('tasks');
    } else if (e.altKey && (key === '3' || code === 'Digit3')) {
      e.preventDefault();
      switchTab('routines');
    } else if (e.altKey && (key === '4' || code === 'Digit4')) {
      e.preventDefault();
      switchTab('reports');
    } else if (e.altKey && (key === '5' || code === 'Digit5')) {
      e.preventDefault();
      switchTab('interactions');
    } else if (e.altKey && (key === 'arrowleft' || code === 'ArrowLeft')) {
      e.preventDefault();
      cycleNextTab();
    } else if (e.altKey && (key === 'arrowright' || code === 'ArrowRight')) {
      e.preventDefault();
      cyclePrevTab();
    } else if (key === '[' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      cyclePrevTab();
    } else if (key === ']' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      cycleNextTab();
    }
  }, true);
}

function cycleNextTab() {
  const tabs = ['dashboard', 'tasks', 'routines', 'reports', 'interactions'];
  const currentIndex = tabs.indexOf(currentTab);
  const nextIndex = (currentIndex + 1) % tabs.length;
  switchTab(tabs[nextIndex]);
}

function cyclePrevTab() {
  const tabs = ['dashboard', 'tasks', 'routines', 'reports', 'interactions'];
  const currentIndex = tabs.indexOf(currentTab);
  const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  switchTab(tabs[prevIndex]);
}

function openCommandPalette() {
  const modal = document.getElementById('modal-command-palette');
  const input = document.getElementById('cmd-palette-input');
  if (modal) {
    modal.classList.remove('hidden');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
  }
}

function closeCommandPalette() {
  const modal = document.getElementById('modal-command-palette');
  if (modal) modal.classList.add('hidden');
}

function filterCommandPalette() {
  const q = (document.getElementById('cmd-palette-input')?.value || '').toLowerCase().trim();
  const items = document.querySelectorAll('#cmd-palette-results > div:not(.uppercase)');
  items.forEach(item => {
    const text = item.innerText.toLowerCase();
    if (!q || text.includes(q)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// -------------------------------------------------------------
// 8. EXCEL / CSV EXPORT (PERSIAN UTF-8 BOM)
// -------------------------------------------------------------
async function exportToCSV(type) {
  try {
    const res = await fetch(`/api/${type}`);
    const json = await res.json();
    if (!json.data || json.data.length === 0) {
      showToast('اطلاعاتی برای خروجی گرفتن وجود ندارد', 'error');
      return;
    }

    let csvContent = '\uFEFF';
    const data = json.data;

    if (type === 'tasks') {
      csvContent += 'شناسه,عنوان کار,دسته‌بندی,اولویت,وضعیت,تاریخ سررسید,توضیحات\n';
      data.forEach(t => {
        const title = `"${(t.title || '').replace(/"/g, '""')}"`;
        const cat = `"${(t.category || 'عمومی').replace(/"/g, '""')}"`;
        const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
        const priority = PRIORITY_LABELS[t.priority]?.text || t.priority;
        const status = STATUS_LABELS[t.status]?.text || t.status;
        csvContent += `${t.id},${title},${cat},${priority},${status},${t.dueDate || ''},${desc}\n`;
      });
    } else if (type === 'reports') {
      csvContent += 'شناسه,تاریخ,امتیاز,خلاصه اقدامات,دستاوردها,موانع,برنامه بعد\n';
      data.forEach(r => {
        const summary = `"${(r.summary || '').replace(/"/g, '""')}"`;
        const ach = `"${(r.achievements || '').replace(/"/g, '""')}"`;
        const blk = `"${(r.blockers || '').replace(/"/g, '""')}"`;
        const nextP = `"${(r.nextPlan || '').replace(/"/g, '""')}"`;
        csvContent += `${r.id},${r.date || ''},${r.rating || ''},${summary},${ach},${blk},${nextP}\n`;
      });
    } else if (type === 'interactions') {
      csvContent += 'شناسه,نام مخاطب,شرکت/سازمان,نوع تعامل,وضعیت پاسخ,موضوع,تاریخ,نیازمند پیگیری,تاریخ پیگیری\n';
      data.forEach(i => {
        const name = `"${(i.contactName || '').replace(/"/g, '""')}"`;
        const company = `"${(i.company || '').replace(/"/g, '""')}"`;
        const subject = `"${(i.subject || '').replace(/"/g, '""')}"`;
        const typeText = INTERACTION_TYPES[i.type]?.text || i.type;
        const outcomeText = OUTCOME_LABELS[i.outcomeStatus]?.text || i.outcomeStatus;
        csvContent += `${i.id},${name},${company},${typeText},${outcomeText},${subject},${i.date || ''},${i.followUpRequired ? 'بله' : 'خیر'},${i.followUpDate || ''}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TM-Export-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('فایل خروجی CSV با موفقیت ایجاد و دانلود شد');
  } catch (err) {
    console.error(err);
    showToast('خطا در دانلود فایل خروجی', 'error');
  }
}

// -------------------------------------------------------------
// 9. KANBAN BOARD VIEW & DRAG AND DROP
// -------------------------------------------------------------
let currentTasksView = 'table';
let draggedTaskId = null;

function setTasksView(view) {
  currentTasksView = view;
  const tableView = document.getElementById('tasks-table-view');
  const kanbanView = document.getElementById('tasks-kanban-view');
  const btnTable = document.getElementById('btn-view-table');
  const btnKanban = document.getElementById('btn-view-kanban');

  if (!tableView || !kanbanView) return;

  if (view === 'kanban') {
    tableView.classList.add('hidden');
    kanbanView.classList.remove('hidden');
    btnKanban.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm';
    btnTable.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white';
    renderKanbanBoard(tasksCache);
  } else {
    kanbanView.classList.add('hidden');
    tableView.classList.remove('hidden');
    btnTable.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm';
    btnKanban.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white';
  }
}

function renderKanbanBoard(tasks) {
  const pendingCol = document.getElementById('kanban-col-pending');
  const inProgressCol = document.getElementById('kanban-col-in_progress');
  const completedCol = document.getElementById('kanban-col-completed');

  if (!pendingCol || !inProgressCol || !completedCol) return;

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  document.getElementById('kanban-count-pending').innerText = Shamsi.toPersianDigits(pendingTasks.length);
  document.getElementById('kanban-count-in_progress').innerText = Shamsi.toPersianDigits(inProgressTasks.length);
  document.getElementById('kanban-count-completed').innerText = Shamsi.toPersianDigits(completedTasks.length);

  pendingCol.innerHTML = renderKanbanCards(pendingTasks);
  inProgressCol.innerHTML = renderKanbanCards(inProgressTasks);
  completedCol.innerHTML = renderKanbanCards(completedTasks);
}

function renderKanbanCards(tasksList) {
  if (tasksList.length === 0) {
    return `<div class="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">کاری در این ستون وجود ندارد</div>`;
  }

  return tasksList.map(t => {
    const priorityInfo = PRIORITY_LABELS[t.priority] || PRIORITY_LABELS.medium;
    const dateText = t.dueDate ? Shamsi.formatShortDate(t.dueDate) : 'بدون تاریخ';
    return `
      <div draggable="true" ondragstart="handleKanbanDragStart(event, '${t.id}')" onclick="viewTaskDetails('${t.id}')"
           class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2.5 group relative">
        <div class="flex items-center justify-between">
          <span class="badge ${priorityInfo.class} text-[10px]">${priorityInfo.text}</span>
          <span class="text-[10px] text-slate-400 font-mono"><i class="fa-regular fa-calendar ml-1 text-indigo-500"></i>${dateText}</span>
        </div>
        <h4 class="text-xs font-bold text-slate-900 dark:text-white leading-relaxed group-hover:text-indigo-600 transition">${t.title}</h4>
        ${t.description ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">${t.description}</p>` : ''}
        <div class="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
          <span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-semibold text-[10px]">${t.category || 'عمومی'}</span>
          <div class="flex items-center gap-1" onclick="event.stopPropagation()">
            ${t.status !== 'completed' ? `<button onclick="quickToggleTask('${t.id}', 'completed')" class="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold">تکمیل ✅</button>` : ''}
            ${t.status === 'pending' ? `<button onclick="quickToggleTask('${t.id}', 'in_progress')" class="px-2 py-0.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded text-[10px] font-bold">شروع ⏳</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function allowKanbanDrop(e) {
  e.preventDefault();
}

function handleKanbanDragStart(e, taskId) {
  draggedTaskId = taskId;
  e.dataTransfer.setData('text/plain', taskId);
}

async function handleKanbanDrop(e, newStatus) {
  e.preventDefault();
  const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
  if (!taskId) return;
  draggedTaskId = null;

  await quickToggleTask(taskId, newStatus);
}

// -------------------------------------------------------------
// 10. OVERDUE TASKS ALERT SYSTEM
// -------------------------------------------------------------
function checkOverdueTasks(allTasks) {
  const container = document.getElementById('dash-overdue-alert-container');
  const titleEl = document.getElementById('dash-overdue-alert-title');
  const actionsEl = document.getElementById('dash-overdue-actions');
  if (!container || !titleEl || !actionsEl) return;

  const todayStr = Shamsi.getTodayJalali();
  const overdue = allTasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < todayStr);

  if (overdue.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  titleEl.innerText = `تعداد ${Shamsi.toPersianDigits(overdue.length)} کار سررسید گذشته (معوق) دارید!`;
  
  actionsEl.innerHTML = overdue.slice(0, 3).map(t => `
    <div class="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-xl border border-white/20 text-xs">
      <span class="font-bold truncate max-w-[130px] text-white" title="${t.title}">${t.title}</span>
      <button onclick="postponeTask('${t.id}', 1)" class="px-2 py-0.5 bg-white text-rose-900 rounded font-bold text-[10px] hover:bg-rose-50 transition">+۱ روز</button>
      <button onclick="quickToggleTask('${t.id}', 'completed')" class="px-2 py-0.5 bg-emerald-500 text-white rounded font-bold text-[10px] hover:bg-emerald-600 transition">تکمیل ✅</button>
    </div>
  `).join('');
}

async function postponeTask(taskId, days) {
  try {
    const todayJalali = Shamsi.getTodayJalali();
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate: todayJalali })
    });
    showToast(`تاریخ سررسید به امروز تغییر یافت`);
    loadDashboardStats();
    if (currentTab === 'tasks') loadTasks();
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// 11. WORK PERIOD FINISH & ARCHIVE MANAGER (RESTORE)
// -------------------------------------------------------------
function openFinishPeriodModal() {
  document.getElementById('input-period-title').value = '';
  document.getElementById('modal-finish-period').classList.remove('hidden');
}

function closeFinishPeriodModal() {
  document.getElementById('modal-finish-period').classList.add('hidden');
}

async function executeFinishPeriod() {
  const periodTitle = document.getElementById('input-period-title').value.trim();
  try {
    const res = await fetch('/api/work-period/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodTitle })
    });
    const json = await res.json();
    if (json.success) {
      closeFinishPeriodModal();
      showToast(json.message, 'success');
      paginationState.tasks.page = 1;
      paginationState.interactions.page = 1;
      await loadDashboardStats();
      if (currentTab === 'tasks') loadTasks();
      if (currentTab === 'interactions') loadInteractions();
      if (currentTab === 'routines') loadRoutines();
    } else {
      showToast(json.message || 'خطا در اتمام دوره کاری', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('خطا در ارتباط با سرور', 'error');
  }
}

async function openArchiveManagerModal() {
  document.getElementById('modal-archive-manager').classList.remove('hidden');
  await loadArchivedData();
}

function closeArchiveManagerModal() {
  document.getElementById('modal-archive-manager').classList.add('hidden');
}

async function loadArchivedData() {
  try {
    const res = await fetch('/api/work-period/archived');
    const json = await res.json();
    if (json.success) {
      archivedCache = json.data || { tasks: [], interactions: [] };
      updateArchiveBadges();
      renderArchivedList();
    }
  } catch (err) {
    console.error('خطا در دریافت اطلاعات آرشیو:', err);
  }
}

function updateArchiveBadges() {
  const tCount = archivedCache.tasks ? archivedCache.tasks.length : 0;
  const iCount = archivedCache.interactions ? archivedCache.interactions.length : 0;
  const total = tCount + iCount;

  const tBadge = document.getElementById('badge-archive-tasks-count');
  const iBadge = document.getElementById('badge-archive-inter-count');
  const statusEl = document.getElementById('archive-status-text');
  const headerBadge = document.getElementById('badge-header-archived-count');

  if (tBadge) tBadge.innerText = Shamsi.toPersianDigits(tCount);
  if (iBadge) iBadge.innerText = Shamsi.toPersianDigits(iCount);
  if (statusEl) statusEl.innerText = `مجموع موارد آرشیو شده: ${Shamsi.toPersianDigits(total)} مورد (${Shamsi.toPersianDigits(tCount)} کار، ${Shamsi.toPersianDigits(iCount)} تعامل)`;
  
  if (headerBadge) {
    if (total > 0) {
      headerBadge.innerText = Shamsi.toPersianDigits(total);
      headerBadge.classList.remove('hidden');
    } else {
      headerBadge.classList.add('hidden');
    }
  }

  const mobileArchiveBadge = document.getElementById('badge-mobile-archived-count');
  if (mobileArchiveBadge) {
    if (total > 0) {
      mobileArchiveBadge.innerText = Shamsi.toPersianDigits(total);
      mobileArchiveBadge.classList.remove('hidden');
    } else {
      mobileArchiveBadge.classList.add('hidden');
    }
  }
}

function switchArchiveTab(tab) {
  activeArchiveTab = tab;
  const btnTasks = document.getElementById('tab-archive-tasks-btn');
  const btnInter = document.getElementById('tab-archive-interactions-btn');

  if (tab === 'tasks') {
    btnTasks.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm flex-1 sm:flex-none justify-center';
    btnInter.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex-1 sm:flex-none justify-center';
  } else {
    btnInter.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm flex-1 sm:flex-none justify-center';
    btnTasks.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex-1 sm:flex-none justify-center';
  }

  renderArchivedList();
}

function filterArchivedItems() {
  renderArchivedList();
}

function renderArchivedList() {
  const container = document.getElementById('archive-list-container');
  if (!container) return;

  const q = (document.getElementById('search-archive-input')?.value || '').toLowerCase().trim();
  const items = activeArchiveTab === 'tasks' ? (archivedCache.tasks || []) : (archivedCache.interactions || []);

  const filtered = items.filter(item => {
    if (!q) return true;
    if (activeArchiveTab === 'tasks') {
      return (item.title && item.title.toLowerCase().includes(q)) || (item.description && item.description.toLowerCase().includes(q)) || (item.category && item.category.toLowerCase().includes(q));
    } else {
      return (item.contactName && item.contactName.toLowerCase().includes(q)) || (item.company && item.company.toLowerCase().includes(q)) || (item.subject && item.subject.toLowerCase().includes(q));
    }
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
        <i class="fa-solid fa-box-open text-3xl mb-2 block"></i>
        <span>هیچ موردی در این بخش آرشیو نشده است</span>
      </div>
    `;
    return;
  }

  if (activeArchiveTab === 'tasks') {
    container.innerHTML = filtered.map(t => {
      const priorityInfo = PRIORITY_LABELS[t.priority] || PRIORITY_LABELS.medium;
      const statusInfo = STATUS_LABELS[t.status] || STATUS_LABELS.pending;
      const periodLabel = t.periodTitle ? `<span class="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">دوره: ${t.periodTitle}</span>` : '';

      return `
        <div class="p-3.5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="font-bold text-slate-800 dark:text-slate-100 text-xs">${t.title}</span>
              ${periodLabel}
              <span class="badge ${priorityInfo.class} text-[10px]">${priorityInfo.text}</span>
              <span class="badge ${statusInfo.class} text-[10px]">${statusInfo.text}</span>
            </div>
            ${t.description ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">${t.description}</p>` : ''}
            <div class="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
              <span>دسته‌بندی: ${t.category || 'عمومی'}</span>
              ${t.dueDate ? `<span>• سررسید: ${Shamsi.formatShortDate(t.dueDate)}</span>` : ''}
            </div>
          </div>

          <button onclick="restoreSingleItem('task', '${t.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer" title="بازگردانی به کارتابل فعال">
            <i class="fa-solid fa-rotate-left text-[11px]"></i>
            <span>برگردان</span>
          </button>
        </div>
      `;
    }).join('');
  } else {
    container.innerHTML = filtered.map(i => {
      const typeInfo = INTERACTION_TYPES[i.type] || INTERACTION_TYPES.other;
      const outcomeInfo = OUTCOME_LABELS[i.outcomeStatus] || OUTCOME_LABELS.answered;
      const periodLabel = i.periodTitle ? `<span class="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">دوره: ${i.periodTitle}</span>` : '';

      return `
        <div class="p-3.5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="font-bold text-slate-800 dark:text-slate-100 text-xs">${i.contactName} ${i.company ? `(${i.company})` : ''}</span>
              ${periodLabel}
              <span class="badge ${outcomeInfo.class} text-[10px]">${outcomeInfo.text}</span>
              <span class="text-[10px] text-slate-400"><i class="fa-solid ${typeInfo.icon} ml-1"></i>${typeInfo.text}</span>
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">${i.subject || i.notes || 'بدون موضوع'}</p>
            <div class="text-[10px] text-slate-400 mt-1">
              <span>تاریخ تعامل: ${Shamsi.formatShortDate(i.date)}</span>
            </div>
          </div>

          <button onclick="restoreSingleItem('interaction', '${i.id}')" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer" title="بازگردانی به کارتابل فعال">
            <i class="fa-solid fa-rotate-left text-[11px]"></i>
            <span>برگردان</span>
          </button>
        </div>
      `;
    }).join('');
  }
}

async function restoreSingleItem(type, id) {
  try {
    const res = await fetch('/api/work-period/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      await loadArchivedData();
      await loadDashboardStats();
      if (currentTab === 'tasks') loadTasks();
      if (currentTab === 'interactions') loadInteractions();
    } else {
      showToast(json.message || 'خطا در بازگردانی', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('خطا در ارتباط با سرور', 'error');
  }
}

async function restoreAllArchived() {
  if (!confirm('آیا مطمئن هستید که می‌خواهید تمام موارد آرشیو شده را به محیط کاری فعال بازگردانید؟')) return;

  try {
    const res = await fetch('/api/work-period/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'all' })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      closeArchiveManagerModal();
      await loadDashboardStats();
      if (currentTab === 'tasks') loadTasks();
      if (currentTab === 'interactions') loadInteractions();
    } else {
      showToast(json.message || 'خطا در بازگردانی', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('خطا در برقراری ارتباط با سرور', 'error');
  }
}

// -------------------------------------------------------------
// 12. DAILY REPORTS: ALL CHALLENGES & BLOCKERS MONITOR
// -------------------------------------------------------------
async function openBlockersModal() {
  if (!reportsCache || reportsCache.length === 0) {
    try {
      const res = await fetch('/api/reports');
      const json = await res.json();
      reportsCache = json.data || [];
    } catch (e) {}
  }

  const today = Shamsi.getTodayJalali();
  const fromEl = document.getElementById('blockers-from-date');
  const toEl = document.getElementById('blockers-to-date');
  const searchEl = document.getElementById('blockers-search-input');

  if (fromEl && !fromEl.value) fromEl.value = '1400/01/01';
  if (toEl && !toEl.value) toEl.value = today;
  if (searchEl) searchEl.value = '';

  filterBlockersList();
  document.getElementById('modal-blockers').classList.remove('hidden');
}

function closeBlockersModal() {
  document.getElementById('modal-blockers').classList.add('hidden');
}

function setBlockersQuickRange(type) {
  const today = Shamsi.getTodayJalali();
  const fromEl = document.getElementById('blockers-from-date');
  const toEl = document.getElementById('blockers-to-date');
  if (!fromEl || !toEl) return;

  toEl.value = today;

  if (type === 'all') {
    fromEl.value = '1400/01/01';
  } else if (type === 'month') {
    const parts = today.split('/');
    fromEl.value = `${parts[0]}/${parts[1]}/01`;
  } else if (type === '30days') {
    const parts = today.split('/').map(Number);
    let y = parts[0], m = parts[1] - 1, d = parts[2];
    if (m < 1) { m = 12; y--; }
    fromEl.value = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  } else if (type === '7days') {
    const parts = today.split('/').map(Number);
    let y = parts[0], m = parts[1], d = parts[2] - 7;
    if (d < 1) {
      m--;
      if (m < 1) { m = 12; y--; }
      d = 28;
    }
    fromEl.value = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  }

  filterBlockersList();
}

function filterBlockersList() {
  const fromDate = (document.getElementById('blockers-from-date')?.value || '').trim();
  const toDate = (document.getElementById('blockers-to-date')?.value || '').trim();
  const q = (document.getElementById('blockers-search-input')?.value || '').toLowerCase().trim();
  const container = document.getElementById('blockers-cards-container');
  const statsEl = document.getElementById('blockers-stats-count');
  const badgeEl = document.getElementById('blockers-date-badge');

  if (!container) return;

  if (badgeEl) {
    badgeEl.innerText = `بازه انتخابی: از ${Shamsi.toPersianDigits(fromDate || '-')} تا ${Shamsi.toPersianDigits(toDate || '-')}`;
  }

  let blockersList = (reportsCache || []).filter(r => r.blockers && r.blockers.trim().length > 0);

  if (fromDate) {
    blockersList = blockersList.filter(r => r.date >= fromDate);
  }
  if (toDate) {
    blockersList = blockersList.filter(r => r.date <= toDate);
  }

  if (q) {
    blockersList = blockersList.filter(r => 
      r.blockers.toLowerCase().includes(q) || 
      (r.summary && r.summary.toLowerCase().includes(q))
    );
  }

  blockersList.sort((a, b) => b.date.localeCompare(a.date));

  if (statsEl) {
    statsEl.innerText = `تعداد کل چالش‌های ثبت‌شده در این بازه: ${Shamsi.toPersianDigits(blockersList.length)} مورد`;
  }

  if (blockersList.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center bg-slate-50 dark:bg-slate-700/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
        <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-inner">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h4 class="font-bold text-slate-800 dark:text-white text-base">در این بازه تاریخی، مانع یا چالشی ثبت نشده است 🎉</h4>
        <p class="text-xs text-slate-400 max-w-sm mx-auto">یا کارها با موفقیت و بدون مانع پیش رفته‌اند یا بازه تاریخی دیگری را انتخاب فرمایید.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = blockersList.map(r => `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-700 shadow-sm hover:shadow-md transition space-y-3.5">
      <div class="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center text-sm font-bold shadow-sm">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h4 class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">گزارش تاریخ: ${Shamsi.formatDate(r.date)}</h4>
            <div class="text-[10px] text-amber-400 mt-0.5">
              ${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))} <span class="text-slate-400">(${r.rating} از ۵)</span>
            </div>
          </div>
        </div>

        <button onclick="viewReportDetails('${r.id}'); closeBlockersModal();" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
          <i class="fa-solid fa-file-lines text-emerald-600"></i>
          <span>مشاهده گزارش کامل روز</span>
        </button>
      </div>

      <!-- Blocker Text Box -->
      <div class="bg-rose-50/70 dark:bg-rose-950/40 p-4 rounded-xl border border-rose-100 dark:border-rose-900/60 text-xs sm:text-sm leading-relaxed text-rose-950 dark:text-rose-200 font-medium whitespace-pre-line">
        ${r.blockers}
      </div>

      <!-- Summary Context -->
      <div class="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
        <span class="font-bold text-slate-700 dark:text-slate-200 block mb-1">اقدامات انجام‌شده در آن روز:</span>
        <p class="leading-relaxed line-clamp-2">${r.summary || '-'}</p>
      </div>
    </div>
  `).join('');
}

function copyBlockersText() {
  const fromDate = (document.getElementById('blockers-from-date')?.value || '').trim();
  const toDate = (document.getElementById('blockers-to-date')?.value || '').trim();
  const q = (document.getElementById('blockers-search-input')?.value || '').toLowerCase().trim();

  let list = (reportsCache || []).filter(r => r.blockers && r.blockers.trim().length > 0);
  if (fromDate) list = list.filter(r => r.date >= fromDate);
  if (toDate) list = list.filter(r => r.date <= toDate);
  if (q) list = list.filter(r => r.blockers.toLowerCase().includes(q) || (r.summary && r.summary.toLowerCase().includes(q)));
  list.sort((a, b) => b.date.localeCompare(a.date));

  if (list.length === 0) {
    showToast('موردی برای کپی وجود ندارد', 'error');
    return;
  }

  let text = `📋 فهرست چالش‌ها و موانع کاری (بازه: ${fromDate} تا ${toDate}):\n\n`;
  list.forEach((r, idx) => {
    text += `${idx + 1}. تاریخ: ${r.date}\n   چالش: ${r.blockers}\n   خلاصه روز: ${r.summary}\n\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    showToast('متن تمام چالش‌ها در کلیپ‌بورد کپی شد 📋');
  }).catch(() => {
    showToast('خطا در کپی متن', 'error');
  });
}
