const fs = require('fs');
const path = require('path');

// مسیر پوشه دیتابیس محلی در کنار پروژه
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// مطمئن شو پوشه data وجود دارد
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// دیتای اولیه در صورت نبود فایل
const initialData = {
  tasks: [],
  reports: [],
  interactions: [],
  routines: [],
  settings: {
    appName: "TM",
    version: "1.0.0",
    theme: "light"
  }
};

/**
 * خواندن دیتابیس از فایل
 */
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDB(initialData);
      return initialData;
    }
    const dataStr = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(dataStr);
  } catch (err) {
    console.error("خطا در خواندن فایل دیتابیس:", err);
    return initialData;
  }
}

/**
 * نوشتن دیتابیس با قابلیت حفظ ایمنی اطلاعات (Atomic Save)
 */
function writeDB(data) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error("خطا در ذخیره‌سازی دیتابیس:", err);
  }
}

// ساخت شناسه یکتا
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

module.exports = {
  DATA_DIR,
  DB_FILE,
  readDB,
  writeDB,
  generateId
};
