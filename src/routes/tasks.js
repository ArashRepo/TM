const express = require('express');
const router = express.Router();
const { readDB, writeDB, generateId } = require('../db');

// دریافت تمام تسک‌ها (با امکان فیلتر)
router.get('/', (req, res) => {
  const db = readDB();
  let tasks = db.tasks || [];
  
  const { status, priority, category, search } = req.query;
  
  if (status && status !== 'all') {
    tasks = tasks.filter(t => t.status === status);
  }
  if (priority && priority !== 'all') {
    tasks = tasks.filter(t => t.priority === priority);
  }
  if (category && category !== 'all') {
    tasks = tasks.filter(t => t.category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    tasks = tasks.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) || 
      (t.description && t.description.toLowerCase().includes(q))
    );
  }
  
  // مرتب‌سازی بر اساس تاریخ ایجاد (جدیدترین‌ها اول)
  tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, count: tasks.length, data: tasks });
});

// دریافت یک تسک بر اساس شناسه
router.get('/:id', (req, res) => {
  const db = readDB();
  const task = (db.tasks || []).find(t => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'تسک مورد نظر یافت نشد' });
  }
  res.json({ success: true, data: task });
});

// ساخت تسک جدید
router.post('/', (req, res) => {
  const { title, description, priority, category, dueDate, status } = req.body;
  
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'عنوان تسک الزامی است' });
  }
  
  const db = readDB();
  const newTask = {
    id: generateId(),
    title: title.trim(),
    description: description ? description.trim() : '',
    status: status || 'pending', // pending, in_progress, completed, cancelled
    priority: priority || 'medium', // low, medium, high, urgent
    category: category ? category.trim() : 'عمومی',
    dueDate: dueDate || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.tasks = db.tasks || [];
  db.tasks.push(newTask);
  writeDB(db);
  
  res.status(201).json({ success: true, message: 'تسک با موفقیت ایجاد شد', data: newTask });
});

// بروزرسانی تسک
router.put('/:id', (req, res) => {
  const db = readDB();
  const index = (db.tasks || []).findIndex(t => t.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'تسک پیدا نشد' });
  }
  
  const existing = db.tasks[index];
  const { title, description, priority, category, dueDate, status } = req.body;
  
  const updatedTask = {
    ...existing,
    title: title !== undefined ? title.trim() : existing.title,
    description: description !== undefined ? description.trim() : existing.description,
    priority: priority || existing.priority,
    category: category !== undefined ? category.trim() : existing.category,
    dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
    status: status || existing.status,
    updatedAt: new Date().toISOString()
  };
  
  db.tasks[index] = updatedTask;
  writeDB(db);
  
  res.json({ success: true, message: 'تسک بروزرسانی شد', data: updatedTask });
});

// حذف تسک
router.delete('/:id', (req, res) => {
  const db = readDB();
  const initialLen = (db.tasks || []).length;
  db.tasks = (db.tasks || []).filter(t => t.id !== req.params.id);
  
  if (db.tasks.length === initialLen) {
    return res.status(404).json({ success: false, message: 'تسک یافت نشد' });
  }
  
  writeDB(db);
  res.json({ success: true, message: 'تسک با موفقیت حذف شد' });
});

module.exports = router;
