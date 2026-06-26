const router = require('express').Router();
const c = require('../controllers/studentsController');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/', c.getStudents);
router.post('/', c.createStudent);
router.get('/:id/stats', c.getStudentStats);
router.get('/:id', c.getStudent);
router.put('/:id', c.updateStudent);
router.patch('/:id/rfid', c.assignRfid);
router.delete('/:id', c.deleteStudent);

module.exports = router;
