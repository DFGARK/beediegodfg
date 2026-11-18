const router = require('express').Router();
const c = require('../controllers/settingsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const adminOnly = requireRole('ADMIN');

router.use(auth);
// Lectura de datos del colegio: la usa el Sidebar para mostrar nombre y logo a todos los usuarios.
router.get('/school', c.getSchool);
// Modificaciones: solo administradores.
router.put('/school', adminOnly, c.updateSchool);
router.get('/users', adminOnly, c.getUsers);
router.post('/users', adminOnly, c.createUser);
router.delete('/users/:id', adminOnly, c.deleteUser);

module.exports = router;
