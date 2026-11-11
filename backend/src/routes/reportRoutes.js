const express = require('express');
const {
  getDailyReport,
  getMonthToDateReport,
  getPreviousMonthReport,
} = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All reporting routes require valid JWT authentication
router.use(authMiddleware);

router.get('/daily', getDailyReport);
router.get('/month-to-date', getMonthToDateReport);
router.get('/monthly', getPreviousMonthReport);

module.exports = router;
