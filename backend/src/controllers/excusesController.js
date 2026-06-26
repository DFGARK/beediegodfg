const prisma = require('../lib/prisma');

const getExcuses = async (req, res) => {
  try {
    const { studentId } = req.query;
    const excuses = await prisma.excuse.findMany({
      where: {
        student: { schoolId: req.user.schoolId },
        ...(studentId && { studentId }),
      },
      include: { student: { include: { grade: true } }, attendance: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(excuses);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const createExcuse = async (req, res) => {
  try {
    const { studentId, attendanceId, reason, description, type } = req.body;
    const excuse = await prisma.excuse.create({
      data: {
        studentId,
        attendanceId: attendanceId || null,
        reason,
        description,
        type: type || 'OTHER',
        approvedBy: req.user.firstName || req.user.email,
      },
      include: { student: { include: { grade: true } }, attendance: true },
    });

    if (attendanceId) {
      await prisma.attendance.update({
        where: { id: attendanceId },
        data: { status: 'EXCUSED' },
      }).catch(() => {});
    }

    res.status(201).json(excuse);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteExcuse = async (req, res) => {
  try {
    await prisma.excuse.delete({ where: { id: req.params.id } });
    res.json({ message: 'Excusa eliminada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getExcuses, createExcuse, deleteExcuse };
