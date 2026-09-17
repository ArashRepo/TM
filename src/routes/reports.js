const express = require('express');
const router = express.Router();
const { readDB, writeDB, generateId } = require('../db');

// دریافت تمام گزارش‌های روزانه
router.get('/', (req, res) => {
  const db = readDB();
  let reports = db.reports || [];
  
  const { date, search } = req.query;
  
  if (date) {
    reports = reports.filter(r => r.date === date);
  }
  
  if (search) {
    const q = search.toLowerCase();
    reports = reports.filter(r => 
      (r.summary && r.summary.toLowerCase().includes(q)) || 
      (r.achievements && r.achievements.toLowerCase().includes(q)) ||
      (r.blockers && r.blockers.toLowerCase().includes(q)) ||
      (r.nextPlan && r.nextPlan.toLowerCase().includes(q))
    );
  }
  
  // مرتب‌سازی بر اساس تاریخ ثبت (جدیدترین‌ها اول)
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, count: reports.length, data: reports });
});

// دریافت یک گزارش
router.get('/:id', (req, res) => {
  const db = readDB();
  const report = (db.reports || []).find(r => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ success: false, message: 'گزارش یافت نشد' });
  }
  res.json({ success: true, data: report });
});

// ثبت گزارش روزانه جدید
router.post('/', (req, res) => {
  const { date, summary, achievements, blockers, nextPlan, rating } = req.body;
  
  if (!summary || !summary.trim()) {
    return res.status(400).json({ success: false, message: 'خلاصه گزارش الزامی است' });
  }
  
  const db = readDB();
  const newReport = {
    id: generateId(),
    date: date || new Date().toISOString().split('T')[0], // تاریخ شمسی یا میلادی
    summary: summary.trim(),
    achievements: achievements ? achievements.trim() : '',
    blockers: blockers ? blockers.trim() : '',
    nextPlan: nextPlan ? nextPlan.trim() : '',
    rating: Number(rating) || 5, // امتیاز از ۱ تا ۵
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.reports = db.reports || [];
  db.reports.push(newReport);
  writeDB(db);
  
  res.status(201).json({ success: true, message: 'گزارش روزانه با موفقیت ثبت شد', data: newReport });
});

// ویرایش گزارش
router.put('/:id', (req, res) => {
  const db = readDB();
  const index = (db.reports || []).findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'گزارش یافت نشد' });
  }
  
  const existing = db.reports[index];
  const { date, summary, achievements, blockers, nextPlan, rating } = req.body;
  
  const updatedReport = {
    ...existing,
    date: date || existing.date,
    summary: summary !== undefined ? summary.trim() : existing.summary,
    achievements: achievements !== undefined ? achievements.trim() : existing.achievements,
    blockers: blockers !== undefined ? blockers.trim() : existing.blockers,
    nextPlan: nextPlan !== undefined ? nextPlan.trim() : existing.nextPlan,
    rating: rating !== undefined ? Number(rating) : existing.rating,
    updatedAt: new Date().toISOString()
  };
  
  db.reports[index] = updatedReport;
  writeDB(db);
  
  res.json({ success: true, message: 'گزارش بروزرسانی شد', data: updatedReport });
});

// حذف گزارش
router.delete('/:id', (req, res) => {
  const db = readDB();
  const initialLen = (db.reports || []).length;
  db.reports = (db.reports || []).filter(r => r.id !== req.params.id);
  
  if (db.reports.length === initialLen) {
    return res.status(404).json({ success: false, message: 'گزارش یافت نشد' });
  }
  
  writeDB(db);
  res.json({ success: true, message: 'گزارش حذف شد' });
});

module.exports = router;
