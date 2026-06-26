const prisma = require('../lib/prisma');

const getGrades = async (req, res) => {
  try {
    const grades = await prisma.grade.findMany({
      where: { schoolId: req.user.schoolId },
      include: { _count: { select: { students: { where: { isActive: true } } } } },
      orderBy: [{ name: 'asc' }, { section: 'asc' }],
    });
    res.json(grades);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const createGrade = async (req, res) => {
  try {
    const { name, section, year } = req.body;
    const grade = await prisma.grade.create({
      data: { name, section, year: year || 2026, schoolId: req.user.schoolId },
    });
    res.status(201).json(grade);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteGrade = async (req, res) => {
  try {
    await prisma.grade.delete({ where: { id: req.params.id } });
    res.json({ message: 'Grado eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getGrades, createGrade, deleteGrade };
