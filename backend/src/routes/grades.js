const router = require('express').Router();
const { getGrades, createGrade, deleteGrade } = require('../controllers/gradesController');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/', getGrades);
router.post('/', createGrade);
router.delete('/:id', deleteGrade);

module.exports = router;
