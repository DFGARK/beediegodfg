const prisma = require('../lib/prisma');

const registerAttendance = async (req, res) => {
  try {
    const { rfidUid, readerId } = req.body;
    const io = req.app.get('io');

    const student = await prisma.student.findUnique({
      where: { rfidUid },
      include: { grade: true, school: true },
    });

    if (!student) {
      if (readerId) {
        await prisma.readerLog.create({
          data: { event: 'UNKNOWN_UID', message: `UID desconocido: ${rfidUid}`, rfidUid, readerId },
        }).catch(() => {});
        io?.emit('rfid:unknown', { rfidUid, readerId });
      }
      return res.status(404).json({ error: 'Estudiante no encontrado', rfidUid });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [entryHour, entryMin] = (student.school.entryTime || '07:30').split(':').map(Number);
    const [lateHour, lateMin] = (student.school.lateTime || '08:00').split(':').map(Number);
    const entryThreshold = new Date(today);
    entryThreshold.setHours(entryHour, entryMin, 0, 0);
    const lateThreshold = new Date(today);
    lateThreshold.setHours(lateHour, lateMin, 0, 0);

    let status;
    if (now <= entryThreshold) status = 'PRESENT';
    else if (now <= lateThreshold) status = 'LATE';
    else status = 'ABSENT';

    const attendance = await prisma.attendance.upsert({
      where: { studentId_date: { studentId: student.id, date: today } },
      update: {},
      create: { date: today, checkInTime: now, status, studentId: student.id, readerId: readerId || null },
      include: { student: { include: { grade: true } }, reader: true },
    });

    if (readerId) {
      await prisma.reader.update({
        where: { id: readerId },
        data: { isOnline: true, lastSeen: now },
      }).catch(() => {});
    }

    io?.emit('attendance:new', attendance);
    res.json(attendance);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getToday = async (req, res) => {
  try {
    const { section } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendances = await prisma.attendance.findMany({
      where: {
        date: today,
        student: { schoolId: req.user.schoolId, ...(section && { grade: { section } }) },
      },
      include: { student: { include: { grade: true } }, reader: true },
      orderBy: { checkInTime: 'asc' },
    });
    res.json(attendances);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getStats = async (req, res) => {
  try {
    const { date, section } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const totalStudents = await prisma.student.count({
      where: { schoolId: req.user.schoolId, isActive: true, ...(section && { grade: { section } }) },
    });

    const attendances = await prisma.attendance.findMany({
      where: { date: targetDate, student: { schoolId: req.user.schoolId, ...(section && { grade: { section } }) } },
    });

    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const late = attendances.filter(a => a.status === 'LATE').length;
    const excused = attendances.filter(a => a.status === 'EXCUSED').length;
    const recorded = attendances.length;
    const absent = Math.max(0, totalStudents - recorded);
    const rate = totalStudents > 0 ? Math.round(((present + late + excused) / totalStudents) * 100) : 0;

    res.json({ total: totalStudents, present, late, absent, excused, rate });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const { section } = req.query;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const attendances = await prisma.attendance.findMany({
      where: {
        date: targetDate,
        student: { schoolId: req.user.schoolId, ...(section && { grade: { section } }) },
      },
      include: { student: { include: { grade: true } }, reader: true },
      orderBy: { checkInTime: 'asc' },
    });
    res.json(attendances);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getStudentHistory = async (req, res) => {
  try {
    const history = await prisma.attendance.findMany({
      where: { studentId: req.params.id },
      include: { reader: true, excuses: true },
      orderBy: { date: 'desc' },
      take: 120,
    });
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const manualAttendance = async (req, res) => {
  try {
    const { studentId, status, date } = req.body;
    const io = req.app.get('io');
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.upsert({
      where: { studentId_date: { studentId, date: targetDate } },
      update: { status, isManual: true },
      create: { date: targetDate, checkInTime: new Date(), status, isManual: true, studentId },
      include: { student: { include: { grade: true } }, reader: true },
    });

    io?.emit('attendance:updated', attendance);
    res.json(attendance);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const statsByGrade = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const [grades, students, attendances] = await Promise.all([
      prisma.grade.findMany({
        where: { schoolId: req.user.schoolId },
        orderBy: { name: 'asc' },
      }),
      prisma.student.findMany({
        where: { schoolId: req.user.schoolId, isActive: true },
        select: { id: true, gradeId: true },
      }),
      prisma.attendance.findMany({
        where: { date: targetDate, student: { schoolId: req.user.schoolId } },
        select: { studentId: true, status: true },
      }),
    ]);

    const attMap = new Map(attendances.map(a => [a.studentId, a.status]));
    const studentsByGrade = new Map();
    students.forEach(s => {
      if (!studentsByGrade.has(s.gradeId)) studentsByGrade.set(s.gradeId, []);
      studentsByGrade.get(s.gradeId).push(s.id);
    });

    const result = grades.map(g => {
      const ids = studentsByGrade.get(g.id) || [];
      let present = 0, late = 0, excused = 0;
      ids.forEach(id => {
        const st = attMap.get(id);
        if (st === 'PRESENT') present++;
        else if (st === 'LATE') late++;
        else if (st === 'EXCUSED') excused++;
      });
      const total = ids.length;
      const absent = Math.max(0, total - present - late - excused);
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      return { id: g.id, name: `${g.name} ${g.section}`, total, present, late, absent, excused, rate };
    }).filter(g => g.total > 0);

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { registerAttendance, getToday, getStats, getByDate, getStudentHistory, manualAttendance, statsByGrade };
