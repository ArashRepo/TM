const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const { DATA_DIR, readDB, writeDB, generateId } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const VENDOR_DIR = path.join(PUBLIC_DIR, 'vendor');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webmanifest': 'application/manifest+json'
};

const PRIORITY_WEIGHTS = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Download missing vendor files automatically on server start if online
function downloadFile(urlStr, dest) {
  return new Promise((resolve) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Clean up empty 0-byte file if exists
    if (fs.existsSync(dest)) {
      try {
        const stats = fs.statSync(dest);
        if (stats.size > 0) return resolve(true);
        fs.unlinkSync(dest);
      } catch (e) {}
    }

    const downloadWithRedirects = (currentUrl, maxRedirects = 5) => {
      if (maxRedirects <= 0) return resolve(false);

      try {
        const parsed = new URL(currentUrl);
        const reqOptions = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*'
          }
        };

        const client = parsed.protocol === 'https:' ? https : http;
        const req = client.get(reqOptions, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            let redirectUrl = res.headers.location;
            if (redirectUrl) {
              if (redirectUrl.startsWith('/')) {
                redirectUrl = `${parsed.protocol}//${parsed.hostname}${redirectUrl}`;
              }
              res.resume();
              return downloadWithRedirects(redirectUrl, maxRedirects - 1);
            }
          }

          if (res.statusCode !== 200) {
            res.resume();
            return resolve(false);
          }

          const fileStream = fs.createWriteStream(dest);
          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => {
              try {
                const stats = fs.statSync(dest);
                if (stats.size > 0) {
                  console.log(`✅ Downloaded ${path.basename(dest)} (${(stats.size / 1024).toFixed(1)} KB)`);
                  resolve(true);
                } else {
                  fs.unlinkSync(dest);
                  resolve(false);
                }
              } catch (e) {
                resolve(false);
              }
            });
          });

          fileStream.on('error', () => {
            fileStream.close();
            try { fs.unlinkSync(dest); } catch (e) {}
            resolve(false);
          });
        });

        req.on('error', () => {
          try { fs.unlinkSync(dest); } catch (e) {}
          resolve(false);
        });
      } catch (err) {
        resolve(false);
      }
    };

    downloadWithRedirects(urlStr);
  });
}

async function ensureVendorFiles() {
  const downloads = [
    { url: 'https://cdn.tailwindcss.com', dest: path.join(VENDOR_DIR, 'tailwind.min.js') },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', dest: path.join(VENDOR_DIR, 'fontawesome', 'css', 'all.min.css') },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2', dest: path.join(VENDOR_DIR, 'fontawesome', 'webfonts', 'fa-solid-900.woff2') },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2', dest: path.join(VENDOR_DIR, 'fontawesome', 'webfonts', 'fa-regular-400.woff2') },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2', dest: path.join(VENDOR_DIR, 'fontawesome', 'webfonts', 'fa-brands-400.woff2') },
    { url: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css', dest: path.join(VENDOR_DIR, 'vazirmatn', 'vazirmatn.css') },
    { url: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2', dest: path.join(VENDOR_DIR, 'vazirmatn', 'Vazirmatn-Regular.woff2') }
  ];

  for (const item of downloads) {
    let exists = false;
    if (fs.existsSync(item.dest)) {
      try {
        const stats = fs.statSync(item.dest);
        if (stats.size > 500) {
          exists = true;
        } else {
          fs.unlinkSync(item.dest);
        }
      } catch (e) {}
    }

    if (!exists) {
      console.log(`📥 Downloading missing offline asset: ${path.basename(item.dest)}...`);
      await downloadFile(item.url, item.dest);
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  // HEALTH CHECK
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, { status: 'ok', dataDir: DATA_DIR, timestamp: new Date().toISOString() });
  }

  // BACKUP
  if (pathname === '/api/backup' && method === 'GET') {
    const data = readDB();
    const filename = `TM-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    return res.end(JSON.stringify(data, null, 2));
  }

  // CLEAR DATA
  if (pathname === '/api/clear-data' && (method === 'POST' || method === 'DELETE')) {
    await getRequestBody(req);
    const freshData = {
      tasks: [],
      reports: [],
      interactions: [],
      routines: [],
      settings: {
        appName: "TM",
        version: "1.0.0",
        lastCleared: new Date().toISOString()
      }
    };
    writeDB(freshData);
    return sendJSON(res, 200, { success: true, message: 'تمام اطلاعات با موفقیت پاکسازی شدند' });
  }

  // RESTORE
  if (pathname === '/api/restore' && method === 'POST') {
    const body = await getRequestBody(req);
    if (!body || (!body.tasks && !body.reports && !body.interactions)) {
      return sendJSON(res, 400, { success: false, message: 'فرمت فایل پشتیبان معتبر نیست' });
    }
    writeDB(body);
    return sendJSON(res, 200, { success: true, message: 'اطلاعات با موفقیت بازیابی شد' });
  }

  // WORK PERIOD API (FINISH & RESTORE ARCHIVE)
  if (pathname === '/api/work-period/finish' && method === 'POST') {
    const body = await getRequestBody(req);
    const db = readDB();
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

    writeDB(db);
    return sendJSON(res, 200, {
      success: true,
      message: `دوره کاری با موفقیت پایان یافت. ${archivedTasksCount} کار و ${archivedInteractionsCount} تعامل به آرشیو منتقل شدند.`,
      archivedTasksCount,
      archivedInteractionsCount,
      periodId
    });
  }

  if (pathname === '/api/work-period/restore' && method === 'POST') {
    const body = await getRequestBody(req);
    const db = readDB();
    const { mode, type, id } = body;

    if (mode === 'all') {
      let restoredCount = 0;
      (db.tasks || []).forEach(t => {
        if (t.archived) {
          t.archived = false;
          restoredCount++;
        }
      });
      (db.interactions || []).forEach(i => {
        if (i.archived) {
          i.archived = false;
          restoredCount++;
        }
      });
      writeDB(db);
      return sendJSON(res, 200, {
        success: true,
        message: `تمام ${restoredCount} مورد آرشیو شده با موفقیت به محیط فعال بازگردانده شدند.`
      });
    }

    if (type === 'task' && id) {
      const task = (db.tasks || []).find(t => t.id === id);
      if (!task) return sendJSON(res, 404, { success: false, message: 'کار یافت نشد' });
      task.archived = false;
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'کار مورد نظر با موفقیت بازگردانده شد' });
    }

    if (type === 'interaction' && id) {
      const item = (db.interactions || []).find(i => i.id === id);
      if (!item) return sendJSON(res, 404, { success: false, message: 'تعامل یافت نشد' });
      item.archived = false;
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'تعامل مورد نظر با موفقیت بازگردانده شد' });
    }

    return sendJSON(res, 400, { success: false, message: 'درخواست بازگردانی نامعتبر است' });
  }

  if (pathname === '/api/work-period/archived' && method === 'GET') {
    const db = readDB();
    const tasks = (db.tasks || []).filter(t => t.archived);
    const interactions = (db.interactions || []).filter(i => i.archived);
    return sendJSON(res, 200, {
      success: true,
      data: {
        tasks,
        interactions,
        total: tasks.length + interactions.length
      }
    });
  }

  // DASHBOARD STATS
  if (pathname === '/api/stats' && method === 'GET') {
    const db = readDB();
    const allTasks = db.tasks || [];
    const activeTasks = allTasks.filter(t => !t.archived);
    const archivedTasks = allTasks.filter(t => t.archived);

    const reports = db.reports || [];

    const allInteractions = db.interactions || [];
    const activeInteractions = allInteractions.filter(i => !i.archived);
    const archivedInteractions = allInteractions.filter(i => i.archived);

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
        total: reports.length,
        recent: reports.slice(0, 3)
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
    return sendJSON(res, 200, { success: true, data: stats });
  }

  // ROUTINES API
  if (pathname.startsWith('/api/routines')) {
    const parts = pathname.replace('/api/routines', '').split('/').filter(Boolean);
    const id = parts[0];
    const isToggleToday = parts[1] === 'toggle-today';

    if (method === 'GET' && !id) {
      const db = readDB();
      let routines = db.routines || [];
      const { search, todayStr } = query;

      if (search) {
        const q = search.toLowerCase();
        routines = routines.filter(r => 
          (r.title && r.title.toLowerCase().includes(q)) || 
          (r.category && r.category.toLowerCase().includes(q))
        );
      }

      // Add isCompletedToday status flag
      const data = routines.map(r => ({
        ...r,
        isCompletedToday: Boolean(todayStr && (r.completedDates || []).includes(todayStr))
      }));

      return sendJSON(res, 200, { success: true, count: data.length, data });
    }

    if (method === 'GET' && id && !isToggleToday) {
      const db = readDB();
      const routine = (db.routines || []).find(r => r.id === id);
      if (!routine) return sendJSON(res, 404, { success: false, message: 'روتین یافت نشد' });
      return sendJSON(res, 200, { success: true, data: routine });
    }

    if (method === 'POST' && !id) {
      const body = await getRequestBody(req);
      if (!body.title || !body.title.trim()) {
        return sendJSON(res, 400, { success: false, message: 'عنوان روتین الزامی است' });
      }
      const db = readDB();
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
      writeDB(db);
      return sendJSON(res, 201, { success: true, message: 'روتین روزانه با موفقیت ایجاد شد', data: newRoutine });
    }

    if (method === 'PATCH' && id && isToggleToday) {
      const body = await getRequestBody(req);
      const todayStr = body.todayStr || query.todayStr;
      if (!todayStr) {
        return sendJSON(res, 400, { success: false, message: 'تاریخ امروز مشخص نشده است' });
      }

      const db = readDB();
      const index = (db.routines || []).findIndex(r => r.id === id);
      if (index === -1) return sendJSON(res, 404, { success: false, message: 'روتین یافت نشد' });

      const item = db.routines[index];
      item.completedDates = item.completedDates || [];
      const hasCompleted = item.completedDates.includes(todayStr);

      if (hasCompleted) {
        item.completedDates = item.completedDates.filter(d => d !== todayStr);
      } else {
        item.completedDates.push(todayStr);
      }

      item.updatedAt = new Date().toISOString();
      writeDB(db);

      const isCompletedToday = item.completedDates.includes(todayStr);
      return sendJSON(res, 200, { 
        success: true, 
        message: isCompletedToday ? 'روتین برای امروز انجام شد ✅' : 'وضعیت انجام روتین بازنشانی شد', 
        isCompletedToday,
        data: item 
      });
    }

    if (method === 'PUT' && id && !isToggleToday) {
      const body = await getRequestBody(req);
      const db = readDB();
      const index = (db.routines || []).findIndex(r => r.id === id);
      if (index === -1) return sendJSON(res, 404, { success: false, message: 'روتین یافت نشد' });

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
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'روتین بروزرسانی شد', data: updated });
    }

    if (method === 'DELETE' && id) {
      const db = readDB();
      const initialLen = (db.routines || []).length;
      db.routines = (db.routines || []).filter(r => r.id !== id);
      if (db.routines.length === initialLen) return sendJSON(res, 404, { success: false, message: 'روتین یافت نشد' });
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'روتین حذف شد' });
    }
  }

  // TASKS API
  if (pathname.startsWith('/api/tasks')) {
    const id = pathname.replace('/api/tasks', '').replace('/', '');

    if (method === 'GET' && !id) {
      const db = readDB();
      let tasks = db.tasks || [];
      const { status, priority, category, search, sortBy, includeArchived, archivedOnly } = query;

      if (archivedOnly === 'true') {
        tasks = tasks.filter(t => t.archived === true);
      } else if (includeArchived !== 'true') {
        tasks = tasks.filter(t => !t.archived);
      }

      if (status && status !== 'all') tasks = tasks.filter(t => t.status === status);
      if (priority && priority !== 'all') tasks = tasks.filter(t => t.priority === priority);
      if (category && category !== 'all') tasks = tasks.filter(t => t.category === category);
      if (search) {
        const q = search.toLowerCase();
        tasks = tasks.filter(t => (t.title && t.title.toLowerCase().includes(q)) || (t.description && t.description.toLowerCase().includes(q)));
      }

      tasks.sort((a, b) => {
        // Completed tasks automatically go to the very bottom
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

      return sendJSON(res, 200, { success: true, count: tasks.length, data: tasks });
    }

    if (method === 'GET' && id) {
      const db = readDB();
      const task = (db.tasks || []).find(t => t.id === id);
      if (!task) return sendJSON(res, 404, { success: false, message: 'تسک یافت نشد' });
      return sendJSON(res, 200, { success: true, data: task });
    }

    if (method === 'POST' && !id) {
      const body = await getRequestBody(req);
      if (!body.title || !body.title.trim()) {
        return sendJSON(res, 400, { success: false, message: 'عنوان تسک الزامی است' });
      }
      const db = readDB();
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
      writeDB(db);
      return sendJSON(res, 201, { success: true, message: 'تسک با موفقیت ایجاد شد', data: newTask });
    }

    if (method === 'PUT' && id) {
      const body = await getRequestBody(req);
      const db = readDB();
      const index = (db.tasks || []).findIndex(t => t.id === id);
      if (index === -1) return sendJSON(res, 404, { success: false, message: 'تسک یافت نشد' });

      const existing = db.tasks[index];
      const updatedTask = {
        ...existing,
        title: body.title !== undefined ? body.title.trim() : existing.title,
        description: body.description !== undefined ? body.description.trim() : existing.description,
        priority: body.priority || existing.priority,
        category: body.category !== undefined ? body.category.trim() : existing.category,
        dueDate: body.dueDate !== undefined ? body.dueDate.trim() : existing.dueDate,
        status: body.status || existing.status,
        updatedAt: new Date().toISOString()
      };
      db.tasks[index] = updatedTask;
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'تسک بروزرسانی شد', data: updatedTask });
    }

    if (method === 'DELETE' && id) {
      const db = readDB();
      const initialLen = (db.tasks || []).length;
      db.tasks = (db.tasks || []).filter(t => t.id !== id);
      if (db.tasks.length === initialLen) return sendJSON(res, 404, { success: false, message: 'تسک یافت نشد' });
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'تسک با موفقیت حذف شد' });
    }
  }

  // REPORTS API
  if (pathname.startsWith('/api/reports')) {
    const id = pathname.replace('/api/reports', '').replace('/', '');

    if (method === 'GET' && !id) {
      const db = readDB();
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
      return sendJSON(res, 200, { success: true, count: reports.length, data: reports });
    }

    if (method === 'GET' && id) {
      const db = readDB();
      const report = (db.reports || []).find(r => r.id === id);
      if (!report) return sendJSON(res, 404, { success: false, message: 'گزارش یافت نشد' });
      return sendJSON(res, 200, { success: true, data: report });
    }

    if (method === 'POST' && !id) {
      const body = await getRequestBody(req);
      if (!body.summary || !body.summary.trim()) {
        return sendJSON(res, 400, { success: false, message: 'خلاصه گزارش الزامی است' });
      }
      const db = readDB();
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
      writeDB(db);
      return sendJSON(res, 201, { success: true, message: 'گزارش روزانه با موفقیت ثبت شد', data: newReport });
    }

    if (method === 'PUT' && id) {
      const body = await getRequestBody(req);
      const db = readDB();
      const index = (db.reports || []).findIndex(r => r.id === id);
      if (index === -1) return sendJSON(res, 404, { success: false, message: 'گزارش یافت نشد' });

      const existing = db.reports[index];
      const updatedReport = {
        ...existing,
        date: body.date || existing.date,
        summary: body.summary !== undefined ? body.summary.trim() : existing.summary,
        achievements: body.achievements !== undefined ? body.achievements.trim() : existing.achievements,
        blockers: body.blockers !== undefined ? body.blockers.trim() : existing.blockers,
        nextPlan: body.nextPlan !== undefined ? body.nextPlan.trim() : existing.nextPlan,
        rating: body.rating !== undefined ? Number(body.rating) : existing.rating,
        updatedAt: new Date().toISOString()
      };
      db.reports[index] = updatedReport;
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'گزارش بروزرسانی شد', data: updatedReport });
    }

    if (method === 'DELETE' && id) {
      const db = readDB();
      const initialLen = (db.reports || []).length;
      db.reports = (db.reports || []).filter(r => r.id !== id);
      if (db.reports.length === initialLen) return sendJSON(res, 404, { success: false, message: 'گزارش یافت نشد' });
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'گزارش حذف شد' });
    }
  }

  // INTERACTIONS API
  if (pathname.startsWith('/api/interactions')) {
    const parts = pathname.replace('/api/interactions', '').split('/').filter(Boolean);
    const id = parts[0];
    const isToggleFollowUp = parts[1] === 'toggle-followup';

    if (method === 'GET' && !id) {
      const db = readDB();
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
      return sendJSON(res, 200, { success: true, count: interactions.length, data: interactions });
    }

    if (method === 'GET' && id && !isToggleFollowUp) {
      const db = readDB();
      const item = (db.interactions || []).find(i => i.id === id);
      if (!item) return sendJSON(res, 404, { success: false, message: 'تعامل یافت نشد' });
      return sendJSON(res, 200, { success: true, data: item });
    }

    if (method === 'POST' && !id) {
      const body = await getRequestBody(req);
      if (!body.contactName || !body.contactName.trim()) {
        return sendJSON(res, 400, { success: false, message: 'نام مخاطب الزامی است' });
      }
      const db = readDB();
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
      writeDB(db);
      return sendJSON(res, 201, { success: true, message: 'تعامل با موفقیت ثبت شد', data: newInteraction });
    }

    if (method === 'PATCH' && id && isToggleFollowUp) {
      const db = readDB();
      const index = (db.interactions || []).findIndex(i => i.id === id);
      if (index === -1) return sendJSON(res, 404, { success: false, message: 'تعامل یافت نشد' });

      const item = db.interactions[index];
      item.followUpStatus = item.followUpStatus === 'done' ? 'pending' : 'done';
      item.updatedAt = new Date().toISOString();
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'وضعیت پیگیری تغییر کرد', data: item });
    }

    if (method === 'PUT' && id && !isToggleFollowUp) {
      const body = await getRequestBody(req);
      const db = readDB();
      const index = (db.interactions || []).findIndex(i => i.id === id);
      if (index === -1) return sendJSON(res, 404, { success: false, message: 'تعامل یافت نشد' });

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
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'تعامل بروزرسانی شد', data: updated });
    }

    if (method === 'DELETE' && id) {
      const db = readDB();
      const initialLen = (db.interactions || []).length;
      db.interactions = (db.interactions || []).filter(i => i.id !== id);
      if (db.interactions.length === initialLen) return sendJSON(res, 404, { success: false, message: 'تعامل یافت نشد' });
      writeDB(db);
      return sendJSON(res, 200, { success: true, message: 'تعامل حذف شد' });
    }
  }

  // STATIC FILES SERVING
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const ext = path.extname(pathname).toLowerCase();
      if (!ext || ext === '.html') {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

function syncUpdateFiles() {
  try {
    const updateDir = path.join(__dirname, '..', 'LeadApp_Update', 'update_files');
    const updateSrc = path.join(updateDir, 'src');
    const updateJs = path.join(updateDir, 'public', 'js');
    if (!fs.existsSync(updateSrc)) fs.mkdirSync(updateSrc, { recursive: true });
    if (!fs.existsSync(updateJs)) fs.mkdirSync(updateJs, { recursive: true });
    
    fs.copyFileSync(path.join(__dirname, 'server.js'), path.join(updateSrc, 'server.js'));
    fs.copyFileSync(path.join(PUBLIC_DIR, 'index.html'), path.join(updateDir, 'public', 'index.html'));
    fs.copyFileSync(path.join(PUBLIC_DIR, 'manifest.json'), path.join(updateDir, 'public', 'manifest.json'));
    fs.copyFileSync(path.join(PUBLIC_DIR, 'icon.svg'), path.join(updateDir, 'public', 'icon.svg'));
    fs.copyFileSync(path.join(PUBLIC_DIR, 'sw.js'), path.join(updateDir, 'public', 'sw.js'));
    fs.copyFileSync(path.join(PUBLIC_DIR, 'js', 'app.js'), path.join(updateJs, 'app.js'));
    fs.copyFileSync(path.join(PUBLIC_DIR, 'js', 'data-engine.js'), path.join(updateJs, 'data-engine.js'));
    fs.copyFileSync(path.join(PUBLIC_DIR, 'js', 'gdrive-sync.js'), path.join(updateJs, 'gdrive-sync.js'));

    const srcVendor = path.join(__dirname, 'vendor');
    const updateSrcVendor = path.join(updateSrc, 'vendor');
    if (fs.existsSync(srcVendor)) {
      fs.cpSync(srcVendor, updateSrcVendor, { recursive: true });
    }

    console.log('📦 Update package files synchronized successfully.');
  } catch (err) {
    console.error('Error syncing update files:', err.message);
  }
}

readDB();
ensureVendorFiles();
syncUpdateFiles();

function getLocalIP() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(nets)) {
    const lower = name.toLowerCase();
    const isVirtual = lower.includes('tun') || 
                      lower.includes('tap') || 
                      lower.includes('vmnet') || 
                      lower.includes('vethernet') || 
                      lower.includes('docker') || 
                      lower.includes('loopback');

    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && net.address !== '127.0.0.1') {
        candidates.push({
          name,
          address: net.address,
          isPreferred: lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('ethernet') || lower.includes('wlan') || lower.includes('lan'),
          isVirtual
        });
      }
    }
  }

  const preferred = candidates.find(c => c.isPreferred && !c.isVirtual);
  if (preferred) return preferred.address;

  const nonVirtual = candidates.find(c => !c.isVirtual);
  if (nonVirtual) return nonVirtual.address;

  return candidates[0] ? candidates[0].address : 'localhost';
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ خطا: پورت ${PORT} توسط اجرای قبلی همین برنامه یا نرم‌افزار دیگری اشغال شده است!`);
    console.error(`💡 راهکار: یک‌بار پنجره سیاه را ببندید و مجدداً فایل start.bat را باز کنید (پورت به صورت خودکار آزاد می‌شود).\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  const mobileUrl = `http://${localIP}:${PORT}`;

  console.log(`=======================================================`);
  console.log(`🚀 TM (Local-First & Offline PWA) is running on port ${PORT}`);
  console.log(`💻 Desktop Access: http://localhost:${PORT}`);
  console.log(`📱 Mobile Access:  ${mobileUrl}`);
  console.log(`☁️ Cloud Sync:     Personal Google Drive (Zero-Server)`);
  console.log(`📁 Local DB path:  ${DATA_DIR}`);
  console.log(`=======================================================`);

  // Generate terminal QR code for mobile
  try {
    let qrcode;
    try {
      qrcode = require('./vendor/qrcode-terminal');
    } catch (e) {
      try {
        qrcode = require('qrcode-terminal');
      } catch (err) {}
    }

    if (qrcode && localIP !== 'localhost') {
      console.log(`\n📲 اسکن سریع با دوربین گوشی (اتصال مستقیم به سامانه):`);
      qrcode.generate(mobileUrl, { small: true });
      console.log(`💡 نکته: گوشی و کامپیوتر باید به یک وای‌فای متصل باشند.\n`);
    }
  } catch (qrErr) {
    // Non-blocking fallback
  }
});

