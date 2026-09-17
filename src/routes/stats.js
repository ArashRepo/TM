const express = require('express');
const router = express.Router();
const { readDB } = require('../db');

// دریافت خلاصه‌ی آمارها برای داشبورد
router.get('/', (req, res) => {
  const db = readDB();
  const tasks = db.tasks || [];
  const reports = db.reports || [];
  const interactions = db.interactions || [];

  const stats = {
    tasks: {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      urgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length
    },
    reports: {
      total: reports.length,
      recent: reports.slice(0, 3)
    },
    interactions: {
      total: interactions.length,
      pendingFollowUp: interactions.filter(i => i.followUpRequired && i.followUpStatus === 'pending').length,
      recent: interactions.slice(0, 3)
    }
  };

  res.json({ success: true, data: stats });
});

module.exports = router;
