const router = require('express').Router();
const c = require('../controllers/readersController');
const auth = require('../middleware/auth');
const apiKey = require('../middleware/apiKey');

router.get('/unknown-uids', auth, c.getUnknownUids);
router.delete('/unknown-uids/:uid', auth, c.deleteUnknownUid);
router.get('/', auth, c.getReaders);
router.post('/', auth, c.createReader);
router.put('/:id', auth, c.updateReader);
router.delete('/:id', auth, c.deleteReader);
router.post('/:id/heartbeat', apiKey, c.heartbeat);

module.exports = router;
