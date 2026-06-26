const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { school: true } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Credenciales invalidas' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciales invalidas' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId, firstName: user.firstName },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    const { passwordHash, ...safe } = user;
    res.json({ token, user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { school: true } });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { login, me };
