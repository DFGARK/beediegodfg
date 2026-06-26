const router = require('express').Router();
const c = require('../controllers/attendanceController');
const auth = require('../middleware/auth');
const apiKey = require('../middleware/apiKey');

router.post('/register', apiKey, c.registerAttendance);
router.get('/today', auth, c.getToday);
router.get('/stats', auth, c.getStats);
router.get('/stats-by-grade', auth, c.statsByGrade);
router.get('/date/:date', auth, c.getByDate);
router.get('/student/:id/history', auth, c.getStudentHistory);
router.post('/manual', auth, c.manualAttendance);

module.exports = router;
