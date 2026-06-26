const router = require('express').Router();
const c = require('../controllers/settingsController');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/school', c.getSchool);
router.put('/school', c.updateSchool);
router.get('/users', c.getUsers);
router.post('/users', c.createUser);
router.delete('/users/:id', c.deleteUser);

module.exports = router;
