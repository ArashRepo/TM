/**
 * TM Data Engine - Local-First & Offline Engine with IndexedDB
 * Handles data transparently whether the desktop server is online or offline.
 */

const DataEngine = (() => {
  const DB_NAME = 'TM_LeadApp_IndexedDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'keyval';

  let idbInstance = null;
  let isServerConnected = false;
  let hasCheckedServer = false;

  const initialData = {
    tasks: [],
    reports: [],
    interactions: [],
    routines: [],
    settings: {
      appName: "TM",
      version: "1.0.0",
      theme: "light",
      lastUpdated: new Date().toISOString()
    }
  };

  // -------------------------------------------------------------
  // 1. IndexedDB Core
  // -------------------------------------------------------------
  function openIDB() {
    return new Promise((resolve, reject) => {
      if (idbInstance) return resolve(idbInstance);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (e) => {
        idbInstance = e.target.result;
        resolve(idbInstance);
      };
      req.onerror = (e) => reject(e);
    });
  }

  async function getFromIDB(key) {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => resolve(null);
    });
  }

  async function setInIDB(key, val) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(val, key);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e);
    });
  }

  // -------------------------------------------------------------
  // 2. Database Read / Write in Local Storage
  // -------------------------------------------------------------
  async function getLocalDB() {
    let db = await getFromIDB('main_database');
    if (!db) {
      db = JSON.parse(JSON.stringify(initialData));
      await setInIDB('main_database', db);
    }
    return db;
  }

  async function saveLocalDB(db) {
    db.settings = db.settings || {};
    db.settings.lastUpdated = new Date().toISOString();
    await setInIDB('main_database', db);
    return db;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  // -------------------------------------------------------------
  // 3. Server Connectivity Check
  // -------------------------------------------------------------
  async function checkServer() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await window._originalFetch('/api/health', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        isServerConnected = json.status === 'ok';
        hasCheckedServer = true;
        updateConnectionBadge(true);
        return true;
      }
    } catch (e) {
      // Server is offline / unreachable
    }
    isServerConnected = false;
    hasCheckedServer = true;
    updateConnectionBadge(false);
    return false;
  }

  function updateConnectionBadge(online) {
    const badge = document.getElementById('connection-status-badge');
    if (!badge) return;
    if (online) {
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> <span class="text-xs text-emerald-700 dark:text-emerald-400 font-medium">سرور دسکتاپ وصل است</span>`;
      badge.title = 'دسترسی مستقیم به دیتابیس محلی کامپیوتر';
    } else {
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> <span class="text-xs text-amber-700 dark:text-amber-400 font-medium">حالت آفلاین (موبایل)</span>`;
      badge.title = 'اطلاعات در حافظه داخلی گوشی ذخیره می‌شود و هنگام اتصال سینک خواهد شد';
    }
  }

  // -------------------------------------------------------------
  // 4. Local In-Memory / IndexedDB API Handlers (Offline Simulation)
  // -------------------------------------------------------------
  const PRIORITY_WEIGHTS = { urgent: 4, high: 3, medium: 2, low: 1 };

  async function handleLocalAPI(urlStr, options = {}) {
    const parsed = new URL(urlStr, window.location.origin);
    const pathname = parsed.pathname;
    const method = (options.method || 'GET').toUpperCase();
    const query = Object.fromEntries(parsed.searchParams.entries());

    let body = {};
    if (options.body) {
      try {
        body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch (e) {
        body = {};
      }
    }

    const db = await getLocalDB();

    // 1. HEALTH
    if (pathname === '/api/health') {
      return makeResponse(200, { status: 'ok', mode: 'offline-indexeddb', timestamp: new Date().toISOString() });
    }

    // 2. STATS
    if (pathname === '/api/stats') {
      const activeTasks = (db.tasks || []).filter(t => !t.archived);
      const activeInteractions = (db.interactions || []).filter(i => !i.archived);
      const archivedTasks = (db.tasks || []).filter(t => t.archived);
      const archivedInteractions = (db.interactions || []).filter(i => i.archived);
      const routines = db.routines || [];
      const todayJalaliStr = query.todayStr || '';

      const stats = {
        tasks: {
          total: activeTasks.length,
          pending: activeTasks.filter(t => t.status === 'pending').length,
          inProgress: activeTasks.filter(t => t.status === 'in_progress').length,
          completed: activeTasks.filter(t => t.status === 'completed').length,
          urgent: activeTasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length
        },
        reports: {
          total: (db.reports || []).length,
          recent: (db.reports || []).slice(0, 3)
        },
        interactions: {
          total: activeInteractions.length,
          pendingFollowUp: activeInteractions.filter(i => i.followUpRequired && i.followUpStatus === 'pending').length,
          noAnswer: activeInteractions.filter(i => i.outcomeStatus === 'no_answer').length,
          recent: activeInteractions.slice(0, 3)
        },
        routines: {
          total: routines.filter(r => r.active !== false).length,
          completedToday: todayJalaliStr ? routines.filter(r => r.active !== false && (r.completedDates || []).includes(todayJalaliStr)).length : 0
        },
        archived: {
          tasks: archivedTasks.length,
          interactions: archivedInteractions.length,
          total: archivedTasks.length + archivedInteractions.length
        }
      };
      return makeResponse(200, { success: true, data: stats });
    }

    // 3. TASKS
    if (pathname.startsWith('/api/tasks')) {
      const id = pathname.replace('/api/tasks', '').replace('/', '');

      if (method === 'GET' && !id) {
        let list = db.tasks || [];
        const { status, priority, category, search, sortBy, includeArchived, archivedOnly } = query;

        if (archivedOnly === 'true') {
          list = list.filter(t => t.archived === true);
        } else if (includeArchived !== 'true') {
          list = list.filter(t => !t.archived);
        }

        if (status && status !== 'all') list = list.filter(t => t.status === status);
        if (priority && priority !== 'all') list = list.filter(t => t.priority === priority);
        if (category && category !== 'all') list = list.filter(t => t.category === category);
        if (search) {
          const q = search.toLowerCase();
          list = list.filter(t => (t.title && t.title.toLowerCase().includes(q)) || (t.description && t.description.toLowerCase().includes(q)));
        }

        list.sort((a, b) => {
          const isDoneA = a.status === 'completed' ? 1 : 0;
          const isDoneB = b.status === 'completed' ? 1 : 0;
          if (isDoneA !== isDoneB) return isDoneA - isDoneB;

          if (sortBy === 'priority') {
            const wA = PRIORITY_WEIGHTS[a.priority] || 0;
            const wB = PRIORITY_WEIGHTS[b.priority] || 0;
            if (wB !== wA) return wB - wA;
            return (a.dueDate || '').localeCompare(b.dueDate || '');
          } else if (sortBy === 'dueDate') {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            const wA = PRIORITY_WEIGHTS[a.priority] || 0;
            const wB = PRIORITY_WEIGHTS[b.priority] || 0;
            return wB - wA;
          } else {
            if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
              return a.dueDate.localeCompare(b.dueDate);
            }
            const wA = PRIORITY_WEIGHTS[a.priority] || 0;
            const wB = PRIORITY_WEIGHTS[b.priority] || 0;
            if (wB !== wA) return wB - wA;
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
        });

        return makeResponse(200, { success: true, count: list.length, data: list });
      }

      if (method === 'GET' && id) {
        const item = (db.tasks || []).find(t => t.id === id);
        if (!item) return makeResponse(404, { success: false, message: 'تسک یافت نشد' });
        return makeResponse(200, { success: true, data: item });
      }

      if (method === 'POST' && !id) {
        if (!body.title || !body.title.trim()) {
          return makeResponse(400, { success: false, message: 'عنوان تسک الزامی است' });
        }
        const newTask = {
          id: generateId(),
          title: body.title.trim(),
          description: body.description ? body.description.trim() : '',
          status: body.status || 'pending',
          priority: body.priority || 'medium',
          category: body.category ? body.category.trim() : 'عمومی',
          dueDate: body.dueDate ? body.dueDate.trim() : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.tasks = db.tasks || [];
        db.tasks.push(newTask);
        await saveLocalDB(db);
        return makeResponse(201, { success: true, message: 'تسک با موفقیت ایجاد شد', data: newTask });
      }

      if (method === 'PUT' && id) {
        const index = (db.tasks || []).findIndex(t => t.id === id);
        if (index === -1) return makeResponse(404, { success: false, message: 'تسک یافت نشد' });
        const existing = db.tasks[index];
        const updated = {
          ...existing,
          title: body.title !== undefined ? body.title.trim() : existing.title,
          description: body.description !== undefined ? body.description.trim() : existing.description,
          priority: body.priority || existing.priority,
          category: body.category !== undefined ? body.category.trim() : existing.category,
          dueDate: body.dueDate !== undefined ? body.dueDate.trim() : existing.dueDate,
          status: body.status || existing.status,
          updatedAt: new Date().toISOString()
        };
        db.tasks[index] = updated;
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'تسک بروزرسانی شد', data: updated });
      }

      if (method === 'DELETE' && id) {
        const initialLen = (db.tasks || []).length;
        db.tasks = (db.tasks || []).filter(t => t.id !== id);
        if (db.tasks.length === initialLen) return makeResponse(404, { success: false, message: 'تسک یافت نشد' });
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'تسک با موفقیت حذف شد' });
      }
    }

    // 4. ROUTINES
    if (pathname.startsWith('/api/routines')) {
      const parts = pathname.replace('/api/routines', '').split('/').filter(Boolean);
      const id = parts[0];
      const isToggleToday = parts[1] === 'toggle-today';

      if (method === 'GET' && !id) {
        let routines = db.routines || [];
        const { search, todayStr } = query;
        if (search) {
          const q = search.toLowerCase();
          routines = routines.filter(r => 
            (r.title && r.title.toLowerCase().includes(q)) || 
            (r.category && r.category.toLowerCase().includes(q))
          );
        }
        const data = routines.map(r => ({
          ...r,
          isCompletedToday: Boolean(todayStr && (r.completedDates || []).includes(todayStr))
        }));
        return makeResponse(200, { success: true, count: data.length, data });
      }

      if (method === 'GET' && id && !isToggleToday) {
        const routine = (db.routines || []).find(r => r.id === id);
        if (!routine) return makeResponse(404, { success: false, message: 'روتین یافت نشد' });
        return makeResponse(200, { success: true, data: routine });
      }

      if (method === 'POST' && !id) {
        if (!body.title || !body.title.trim()) {
          return makeResponse(400, { success: false, message: 'عنوان روتین الزامی است' });
        }
        const newRoutine = {
          id: generateId(),
          title: body.title.trim(),
          time: body.time ? body.time.trim() : '09:00',
          category: body.category ? body.category.trim() : 'عمومی',
          notes: body.notes ? body.notes.trim() : '',
          active: body.active !== undefined ? Boolean(body.active) : true,
          completedDates: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.routines = db.routines || [];
        db.routines.push(newRoutine);
        await saveLocalDB(db);
        return makeResponse(201, { success: true, message: 'روتین روزانه با موفقیت ایجاد شد', data: newRoutine });
      }

      if (method === 'PATCH' && id && isToggleToday) {
        const todayStr = body.todayStr || query.todayStr;
        if (!todayStr) return makeResponse(400, { success: false, message: 'تاریخ امروز مشخص نشده است' });

        const index = (db.routines || []).findIndex(r => r.id === id);
        if (index === -1) return makeResponse(404, { success: false, message: 'روتین یافت نشد' });

        const item = db.routines[index];
        item.completedDates = item.completedDates || [];
        const hasCompleted = item.completedDates.includes(todayStr);

        if (hasCompleted) {
          item.completedDates = item.completedDates.filter(d => d !== todayStr);
        } else {
          item.completedDates.push(todayStr);
        }
        item.updatedAt = new Date().toISOString();
        await saveLocalDB(db);

        const isCompletedToday = item.completedDates.includes(todayStr);
        return makeResponse(200, {
          success: true,
          message: isCompletedToday ? 'روتین برای امروز انجام شد ✅' : 'وضعیت انجام روتین بازنشانی شد',
          isCompletedToday,
          data: item
        });
      }

      if (method === 'PUT' && id && !isToggleToday) {
        const index = (db.routines || []).findIndex(r => r.id === id);
        if (index === -1) return makeResponse(404, { success: false, message: 'روتین یافت نشد' });
        const existing = db.routines[index];
        const updated = {
          ...existing,
          title: body.title !== undefined ? body.title.trim() : existing.title,
          time: body.time !== undefined ? body.time.trim() : existing.time,
          category: body.category !== undefined ? body.category.trim() : existing.category,
          notes: body.notes !== undefined ? body.notes.trim() : existing.notes,
          active: body.active !== undefined ? Boolean(body.active) : existing.active,
          updatedAt: new Date().toISOString()
        };
        db.routines[index] = updated;
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'روتین بروزرسانی شد', data: updated });
      }

      if (method === 'DELETE' && id) {
        const initialLen = (db.routines || []).length;
        db.routines = (db.routines || []).filter(r => r.id !== id);
        if (db.routines.length === initialLen) return makeResponse(404, { success: false, message: 'روتین یافت نشد' });
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'روتین حذف شد' });
      }
    }

    // 5. REPORTS
    if (pathname.startsWith('/api/reports')) {
      const id = pathname.replace('/api/reports', '').replace('/', '');

      if (method === 'GET' && !id) {
        let reports = db.reports || [];
        const { search } = query;
        if (search) {
          const q = search.toLowerCase();
          reports = reports.filter(r => 
            (r.summary && r.summary.toLowerCase().includes(q)) || 
            (r.achievements && r.achievements.toLowerCase().includes(q)) ||
            (r.blockers && r.blockers.toLowerCase().includes(q))
          );
        }
        reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return makeResponse(200, { success: true, count: reports.length, data: reports });
      }

      if (method === 'GET' && id) {
        const report = (db.reports || []).find(r => r.id === id);
        if (!report) return makeResponse(404, { success: false, message: 'گزارش یافت نشد' });
        return makeResponse(200, { success: true, data: report });
      }

      if (method === 'POST' && !id) {
        if (!body.summary || !body.summary.trim()) {
          return makeResponse(400, { success: false, message: 'خلاصه گزارش الزامی است' });
        }
        const newReport = {
          id: generateId(),
          date: body.date || new Date().toISOString().split('T')[0],
          summary: body.summary.trim(),
          achievements: body.achievements ? body.achievements.trim() : '',
          blockers: body.blockers ? body.blockers.trim() : '',
          nextPlan: body.nextPlan ? body.nextPlan.trim() : '',
          rating: Number(body.rating) || 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.reports = db.reports || [];
        db.reports.push(newReport);
        await saveLocalDB(db);
        return makeResponse(201, { success: true, message: 'گزارش روزانه با موفقیت ثبت شد', data: newReport });
      }

      if (method === 'PUT' && id) {
        const index = (db.reports || []).findIndex(r => r.id === id);
        if (index === -1) return makeResponse(404, { success: false, message: 'گزارش یافت نشد' });
        const existing = db.reports[index];
        const updated = {
          ...existing,
          date: body.date || existing.date,
          summary: body.summary !== undefined ? body.summary.trim() : existing.summary,
          achievements: body.achievements !== undefined ? body.achievements.trim() : existing.achievements,
          blockers: body.blockers !== undefined ? body.blockers.trim() : existing.blockers,
          nextPlan: body.nextPlan !== undefined ? body.nextPlan.trim() : existing.nextPlan,
          rating: body.rating !== undefined ? Number(body.rating) : existing.rating,
          updatedAt: new Date().toISOString()
        };
        db.reports[index] = updated;
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'گزارش بروزرسانی شد', data: updated });
      }

      if (method === 'DELETE' && id) {
        const initialLen = (db.reports || []).length;
        db.reports = (db.reports || []).filter(r => r.id !== id);
        if (db.reports.length === initialLen) return makeResponse(404, { success: false, message: 'گزارش یافت نشد' });
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'گزارش حذف شد' });
      }
    }

    // 6. INTERACTIONS
    if (pathname.startsWith('/api/interactions')) {
      const parts = pathname.replace('/api/interactions', '').split('/').filter(Boolean);
      const id = parts[0];
      const isToggleFollowUp = parts[1] === 'toggle-followup';

      if (method === 'GET' && !id) {
        let interactions = db.interactions || [];
        const { type, outcomeStatus, followUp, search, includeArchived, archivedOnly } = query;

        if (archivedOnly === 'true') {
          interactions = interactions.filter(i => i.archived === true);
        } else if (includeArchived !== 'true') {
          interactions = interactions.filter(i => !i.archived);
        }

        if (type && type !== 'all') interactions = interactions.filter(i => i.type === type);
        if (outcomeStatus && outcomeStatus !== 'all') interactions = interactions.filter(i => i.outcomeStatus === outcomeStatus);
        if (followUp === 'pending') interactions = interactions.filter(i => i.followUpRequired && i.followUpStatus === 'pending');
        if (search) {
          const q = search.toLowerCase();
          interactions = interactions.filter(i => 
            (i.contactName && i.contactName.toLowerCase().includes(q)) || 
            (i.company && i.company.toLowerCase().includes(q)) ||
            (i.subject && i.subject.toLowerCase().includes(q))
          );
        }
        interactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return makeResponse(200, { success: true, count: interactions.length, data: interactions });
      }

      if (method === 'GET' && id && !isToggleFollowUp) {
        const item = (db.interactions || []).find(i => i.id === id);
        if (!item) return makeResponse(404, { success: false, message: 'تعامل یافت نشد' });
        return makeResponse(200, { success: true, data: item });
      }

      if (method === 'POST' && !id) {
        if (!body.contactName || !body.contactName.trim()) {
          return makeResponse(400, { success: false, message: 'نام مخاطب الزامی است' });
        }
        const newInteraction = {
          id: generateId(),
          contactName: body.contactName.trim(),
          company: body.company ? body.company.trim() : '',
          type: body.type || 'call',
          outcomeStatus: body.outcomeStatus || 'answered',
          subject: body.subject ? body.subject.trim() : '',
          notes: body.notes ? body.notes.trim() : '',
          date: body.date || new Date().toISOString().split('T')[0],
          followUpRequired: Boolean(body.followUpRequired),
          followUpDate: body.followUpDate || '',
          followUpStatus: body.followUpStatus || 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.interactions = db.interactions || [];
        db.interactions.push(newInteraction);
        await saveLocalDB(db);
        return makeResponse(201, { success: true, message: 'تعامل با موفقیت ثبت شد', data: newInteraction });
      }

      if (method === 'PATCH' && id && isToggleFollowUp) {
        const index = (db.interactions || []).findIndex(i => i.id === id);
        if (index === -1) return makeResponse(404, { success: false, message: 'تعامل یافت نشد' });
        const item = db.interactions[index];
        item.followUpStatus = item.followUpStatus === 'done' ? 'pending' : 'done';
        item.updatedAt = new Date().toISOString();
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'وضعیت پیگیری تغییر کرد', data: item });
      }

      if (method === 'PUT' && id && !isToggleFollowUp) {
        const index = (db.interactions || []).findIndex(i => i.id === id);
        if (index === -1) return makeResponse(404, { success: false, message: 'تعامل یافت نشد' });
        const existing = db.interactions[index];
        const updated = {
          ...existing,
          contactName: body.contactName !== undefined ? body.contactName.trim() : existing.contactName,
          company: body.company !== undefined ? body.company.trim() : existing.company,
          type: body.type || existing.type,
          outcomeStatus: body.outcomeStatus || existing.outcomeStatus,
          subject: body.subject !== undefined ? body.subject.trim() : existing.subject,
          notes: body.notes !== undefined ? body.notes.trim() : existing.notes,
          date: body.date || existing.date,
          followUpRequired: body.followUpRequired !== undefined ? Boolean(body.followUpRequired) : existing.followUpRequired,
          followUpDate: body.followUpDate !== undefined ? body.followUpDate : existing.followUpDate,
          followUpStatus: body.followUpStatus || existing.followUpStatus,
          updatedAt: new Date().toISOString()
        };
        db.interactions[index] = updated;
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'تعامل بروزرسانی شد', data: updated });
      }

      if (method === 'DELETE' && id) {
        const initialLen = (db.interactions || []).length;
        db.interactions = (db.interactions || []).filter(i => i.id !== id);
        if (db.interactions.length === initialLen) return makeResponse(404, { success: false, message: 'تعامل یافت نشد' });
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'تعامل حذف شد' });
      }
    }

    // 7. WORK PERIOD
    if (pathname === '/api/work-period/finish' && method === 'POST') {
      const periodId = generateId();
      const now = new Date().toISOString();
      const periodTitle = body.periodTitle ? body.periodTitle.trim() : '';

      let archivedTasksCount = 0;
      (db.tasks || []).forEach(t => {
        if (!t.archived) {
          t.archived = true;
          t.archivedAt = now;
          t.periodId = periodId;
          if (periodTitle) t.periodTitle = periodTitle;
          archivedTasksCount++;
        }
      });

      let archivedInteractionsCount = 0;
      (db.interactions || []).forEach(i => {
        if (!i.archived) {
          i.archived = true;
          i.archivedAt = now;
          i.periodId = periodId;
          if (periodTitle) i.periodTitle = periodTitle;
          archivedInteractionsCount++;
        }
      });

      await saveLocalDB(db);
      return makeResponse(200, {
        success: true,
        message: `دوره کاری با موفقیت پایان یافت. ${archivedTasksCount} کار و ${archivedInteractionsCount} تعامل به آرشیو منتقل شدند.`,
        archivedTasksCount,
        archivedInteractionsCount,
        periodId
      });
    }

    if (pathname === '/api/work-period/restore' && method === 'POST') {
      const { mode, type, id } = body;
      if (mode === 'all') {
        let restoredCount = 0;
        (db.tasks || []).forEach(t => {
          if (t.archived) { t.archived = false; restoredCount++; }
        });
        (db.interactions || []).forEach(i => {
          if (i.archived) { i.archived = false; restoredCount++; }
        });
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: `تمام ${restoredCount} مورد آرشیو شده با موفقیت به محیط فعال بازگردانده شدند.` });
      }

      if (type === 'task' && id) {
        const task = (db.tasks || []).find(t => t.id === id);
        if (!task) return makeResponse(404, { success: false, message: 'کار یافت نشد' });
        task.archived = false;
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'کار مورد نظر با موفقیت بازگردانده شد' });
      }

      if (type === 'interaction' && id) {
        const item = (db.interactions || []).find(i => i.id === id);
        if (!item) return makeResponse(404, { success: false, message: 'تعامل یافت نشد' });
        item.archived = false;
        await saveLocalDB(db);
        return makeResponse(200, { success: true, message: 'تعامل مورد نظر با موفقیت بازگردانده شد' });
      }
      return makeResponse(400, { success: false, message: 'درخواست بازگردانی نامعتبر است' });
    }

    if (pathname === '/api/work-period/archived' && method === 'GET') {
      const tasks = (db.tasks || []).filter(t => t.archived);
      const interactions = (db.interactions || []).filter(i => i.archived);
      return makeResponse(200, {
        success: true,
        data: { tasks, interactions, total: tasks.length + interactions.length }
      });
    }

    // 8. BACKUP, RESTORE & CLEAR
    if (pathname === '/api/backup') {
      return makeResponse(200, db, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="TM-backup-${new Date().toISOString().split('T')[0]}.json"`
      });
    }

    if (pathname === '/api/clear-data') {
      const fresh = JSON.parse(JSON.stringify(initialData));
      fresh.settings.lastCleared = new Date().toISOString();
      await saveLocalDB(fresh);
      return makeResponse(200, { success: true, message: 'تمام اطلاعات با موفقیت پاکسازی شدند' });
    }

    if (pathname === '/api/restore') {
      if (!body || (!body.tasks && !body.reports && !body.interactions)) {
        return makeResponse(400, { success: false, message: 'فرمت فایل پشتیبان معتبر نیست' });
      }
      await saveLocalDB(body);
      return makeResponse(200, { success: true, message: 'اطلاعات با موفقیت بازیابی شد' });
    }

    return makeResponse(404, { success: false, message: 'مسیر یافت نشد' });
  }

  function makeResponse(status, data, extraHeaders = {}) {
    const isBlobOrStr = typeof data === 'string';
    const text = isBlobOrStr ? data : JSON.stringify(data);
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    });
    return new Response(text, { status, headers });
  }

  // -------------------------------------------------------------
  // 5. Fetch Interceptor (Seamless Fallback)
  // -------------------------------------------------------------
  window._originalFetch = window.fetch.bind(window);

  window.fetch = async function(resource, init = {}) {
    const urlStr = typeof resource === 'string' ? resource : (resource.url || '');

    // Only intercept /api/ requests
    if (urlStr.startsWith('/api/')) {
      // If server is known to be connected, attempt server first
      if (isServerConnected) {
        try {
          const res = await window._originalFetch(resource, init);
          // If server responds with valid response, also mirror mutations to local IDB
          const method = (init.method || 'GET').toUpperCase();
          if (res.ok && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            mirrorServerDataToLocal();
          }
          return res;
        } catch (networkErr) {
          console.warn('[DataEngine] Server unreachable during request. Falling back to local offline mode.', networkErr);
          isServerConnected = false;
          updateConnectionBadge(false);
          return handleLocalAPI(urlStr, init);
        }
      } else {
        // Run in Offline Local Mode
        return handleLocalAPI(urlStr, init);
      }
    }

    // Default fetch for other resources
    return window._originalFetch(resource, init);
  };

  // Sync server data to local IDB when online
  async function mirrorServerDataToLocal() {
    try {
      const [tasksRes, repRes, intRes, routRes] = await Promise.all([
        window._originalFetch('/api/tasks?includeArchived=true'),
        window._originalFetch('/api/reports'),
        window._originalFetch('/api/interactions?includeArchived=true'),
        window._originalFetch('/api/routines')
      ]);
      if (tasksRes.ok && repRes.ok && intRes.ok && routRes.ok) {
        const [tasksJ, repJ, intJ, routJ] = await Promise.all([
          tasksRes.json(), repRes.json(), intRes.json(), routRes.json()
        ]);
        const db = await getLocalDB();
        db.tasks = tasksJ.data || [];
        db.reports = repJ.data || [];
        db.interactions = intJ.data || [];
        db.routines = routJ.data || [];
        await saveLocalDB(db);
      }
    } catch (e) {
      // Non-blocking background sync
    }
  }

  // -------------------------------------------------------------
  // 6. Public Methods
  // -------------------------------------------------------------
  async function init() {
    await openIDB();
    await checkServer();
    if (isServerConnected) {
      mirrorServerDataToLocal();
    }
    // Periodic check every 15s
    setInterval(checkServer, 15000);
  }

  return {
    init,
    checkServer,
    getLocalDB,
    saveLocalDB,
    isOnline: () => isServerConnected,
    mirrorServerDataToLocal
  };
})();
