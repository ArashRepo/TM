const express = require('express');
const router = express.Router();
const { readDB, writeDB, generateId } = require('../db');

// دریافت لیست تعاملات
router.get('/', (req, res) => {
  const db = readDB();
  let interactions = db.interactions || [];
  
  const { type, followUp, search } = req.query;
  
  if (type && type !== 'all') {
    interactions = interactions.filter(i => i.type === type);
  }
  
  if (followUp === 'pending') {
    interactions = interactions.filter(i => i.followUpRequired && i.followUpStatus === 'pending');
  }
  
  if (search) {
    const q = search.toLowerCase();
    interactions = interactions.filter(i => 
      (i.contactName && i.contactName.toLowerCase().includes(q)) || 
      (i.company && i.company.toLowerCase().includes(q)) ||
      (i.subject && i.subject.toLowerCase().includes(q)) ||
      (i.notes && i.notes.toLowerCase().includes(q))
    );
  }
  
  interactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, count: interactions.length, data: interactions });
});

// دریافت یک تعامل
router.get('/:id', (req, res) => {
  const db = readDB();
  const item = (db.interactions || []).find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'تعامل یافت نشد' });
  }
  res.json({ success: true, data: item });
});

// ثبت تعامل جدید
router.post('/', (req, res) => {
  const { contactName, company, type, subject, notes, date, followUpRequired, followUpDate, followUpStatus } = req.body;
  
  if (!contactName || !contactName.trim()) {
    return res.status(400).json({ success: false, message: 'نام مخاطب/طرف تعامل الزامی است' });
  }
  
  const db = readDB();
  const newInteraction = {
    id: generateId(),
    contactName: contactName.trim(),
    company: company ? company.trim() : '',
    type: type || 'call', // meeting, call, message, email, in_person, other
    subject: subject ? subject.trim() : '',
    notes: notes ? notes.trim() : '',
    date: date || new Date().toISOString().split('T')[0],
    followUpRequired: Boolean(followUpRequired),
    followUpDate: followUpDate || '',
    followUpStatus: followUpStatus || 'pending', // pending, done
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.interactions = db.interactions || [];
  db.interactions.push(newInteraction);
  writeDB(db);
  
  res.status(201).json({ success: true, message: 'تعامل با موفقیت ثبت شد', data: newInteraction });
});

// ویرایش تعامل
router.put('/:id', (req, res) => {
  const db = readDB();
  const index = (db.interactions || []).findIndex(i => i.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'تعامل یافت نشد' });
  }
  
  const existing = db.interactions[index];
  const { contactName, company, type, subject, notes, date, followUpRequired, followUpDate, followUpStatus } = req.body;
  
  const updated = {
    ...existing,
    contactName: contactName !== undefined ? contactName.trim() : existing.contactName,
    company: company !== undefined ? company.trim() : existing.company,
    type: type || existing.type,
    subject: subject !== undefined ? subject.trim() : existing.subject,
    notes: notes !== undefined ? notes.trim() : existing.notes,
    date: date || existing.date,
    followUpRequired: followUpRequired !== undefined ? Boolean(followUpRequired) : existing.followUpRequired,
    followUpDate: followUpDate !== undefined ? followUpDate : existing.followUpDate,
    followUpStatus: followUpStatus || existing.followUpStatus,
    updatedAt: new Date().toISOString()
  };
  
  db.interactions[index] = updated;
  writeDB(db);
  
  res.json({ success: true, message: 'تعامل بروزرسانی شد', data: updated });
});

// تغییر سریع وضعیت پیگیری
router.patch('/:id/toggle-followup', (req, res) => {
  const db = readDB();
  const index = (db.interactions || []).findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'تعامل یافت نشد' });
  }
  
  const item = db.interactions[index];
  item.followUpStatus = item.followUpStatus === 'done' ? 'pending' : 'done';
  item.updatedAt = new Date().toISOString();
  
  writeDB(db);
  res.json({ success: true, message: 'وضعیت پیگیری تغییر کرد', data: item });
});

// حذف تعامل
router.delete('/:id', (req, res) => {
  const db = readDB();
  const initialLen = (db.interactions || []).length;
  db.interactions = (db.interactions || []).filter(i => i.id !== req.params.id);
  
  if (db.interactions.length === initialLen) {
    return res.status(404).json({ success: false, message: 'تعامل یافت نشد' });
  }
  
  writeDB(db);
  res.json({ success: true, message: 'تعامل حذف شد' });
});

module.exports = router;
