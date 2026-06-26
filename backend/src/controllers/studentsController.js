const prisma = require('../lib/prisma');

const getStudents = async (req, res) => {
  try {
    const { search, gradeId, section, isActive } = req.query;
    const students = await prisma.student.findMany({
      where: {
        schoolId: req.user.schoolId,
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
        ...(gradeId && { gradeId }),
        ...(section && { grade: { section } }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { studentCode: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: { grade: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    res.json(students);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getStudent = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { grade: true },
    });
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getStudentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);
    const attendances = await prisma.attendance.findMany({
      where: { studentId: id, date: { gte: startOfYear, lt: endOfYear } },
      include: { reader: true },
      orderBy: { date: 'desc' },
    });
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const late = attendances.filter(a => a.status === 'LATE').length;
    const absent = attendances.filter(a => a.status === 'ABSENT').length;
    const excused = attendances.filter(a => a.status === 'EXCUSED').length;
    const total = attendances.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    res.json({ total, present, late, absent, excused, rate, attendances });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const createStudent = async (req, res) => {
  try {
    const data = { ...req.body, schoolId: req.user.schoolId };
    if (data.birthDate) data.birthDate = new Date(data.birthDate);
    if (!data.rfidUid) delete data.rfidUid;
    const student = await prisma.student.create({ data, include: { grade: true } });
    res.status(201).json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateStudent = async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.schoolId;
    if (data.birthDate) data.birthDate = new Date(data.birthDate);
    if (data.rfidUid === '') data.rfidUid = null;
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data,
      include: { grade: true },
    });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const assignRfid = async (req, res) => {
  try {
    const { rfidUid } = req.body;
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { rfidUid: rfidUid || null },
    });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteStudent = async (req, res) => {
  try {
    await prisma.student.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Estudiante desactivado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getStudents, getStudent, getStudentStats, createStudent, updateStudent, assignRfid, deleteStudent };
