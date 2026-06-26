const prisma = require('../lib/prisma');

const getReaders = async (req, res) => {
  try {
    const readers = await prisma.reader.findMany({
      where: { schoolId: req.user.schoolId },
      include: { _count: { select: { attendances: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(readers);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const createReader = async (req, res) => {
  try {
    const { id, name, location, ipAddress } = req.body;
    const reader = await prisma.reader.create({
      data: { id, name, location, ipAddress, schoolId: req.user.schoolId },
    });
    res.status(201).json(reader);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateReader = async (req, res) => {
  try {
    const { name, location, ipAddress, isActive } = req.body;
    const reader = await prisma.reader.update({
      where: { id: req.params.id },
      data: { name, location, ipAddress, ...(isActive !== undefined && { isActive }) },
    });
    res.json(reader);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteReader = async (req, res) => {
  try {
    await prisma.reader.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Lector desactivado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const heartbeat = async (req, res) => {
  try {
    const { ipAddress } = req.body;
    const reader = await prisma.reader.update({
      where: { id: req.params.id },
      data: { isOnline: true, lastSeen: new Date(), ...(ipAddress && { ipAddress }) },
    });
    res.json(reader);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getUnknownUids = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [logs, registeredStudents] = await Promise.all([
      prisma.readerLog.findMany({
        where: {
          event: 'UNKNOWN_UID',
          createdAt: { gte: sevenDaysAgo },
          rfidUid: { not: null },
          reader: { schoolId: req.user.schoolId },
        },
        include: { reader: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.student.findMany({
        where: { schoolId: req.user.schoolId, rfidUid: { not: null } },
        select: { rfidUid: true },
      }),
    ]);

    const registeredUids = new Set(registeredStudents.map(s => s.rfidUid));

    const grouped = {};
    for (const log of logs) {
      if (!log.rfidUid || registeredUids.has(log.rfidUid)) continue;
      if (!grouped[log.rfidUid]) {
        grouped[log.rfidUid] = { uid: log.rfidUid, count: 0, lastSeen: log.createdAt, readerId: log.readerId, readerName: log.reader.name };
      }
      grouped[log.rfidUid].count++;
    }

    res.json(Object.values(grouped).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen)));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteUnknownUid = async (req, res) => {
  try {
    const { uid } = req.params;
    await prisma.readerLog.deleteMany({
      where: {
        rfidUid: uid,
        event: 'UNKNOWN_UID',
        reader: { schoolId: req.user.schoolId },
      },
    });
    res.json({ message: 'Registros eliminados' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getReaders, createReader, updateReader, deleteReader, heartbeat, getUnknownUids, deleteUnknownUid };
