const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const getSchool = async (req, res) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.user.schoolId } });
    res.json(school);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateSchool = async (req, res) => {
  try {
    const { name, address, phone, email, logoUrl, primaryColor } = req.body;
    const school = await prisma.school.update({
      where: { id: req.user.schoolId },
      data: { name, address, phone, email, logoUrl, primaryColor },
    });
    res.json(school);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { schoolId: req.user.schoolId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
      orderBy: { firstName: 'asc' },
    });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName, role: role || 'TEACHER', schoolId: req.user.schoolId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    res.status(201).json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteUser = async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Usuario desactivado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getSchool, updateSchool, getUsers, createUser, deleteUser };
