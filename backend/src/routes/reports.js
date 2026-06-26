const router = require('express').Router();
const { dailyReport, monthlyReport, studentReport } = require('../controllers/reportsController');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/daily', dailyReport);
router.get('/monthly', monthlyReport);
router.get('/student/:id', studentReport);

module.exports = router;
