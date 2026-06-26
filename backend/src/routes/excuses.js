const router = require('express').Router();
const { getExcuses, createExcuse, deleteExcuse } = require('../controllers/excusesController');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/', getExcuses);
router.post('/', createExcuse);
router.delete('/:id', deleteExcuse);

module.exports = router;
