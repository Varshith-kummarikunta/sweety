const express = require('express');
const {
  createReading,
  listReadings,
  getReadingById,
  updateReading,
  deleteReading,
} = require('../controllers/readingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All reading routes require valid JWT authentication
router.use(authMiddleware);

router.post('/', createReading);
router.get('/', listReadings);
router.get('/:id', getReadingById);
router.put('/:id', updateReading);
router.delete('/:id', deleteReading);

module.exports = router;
