const ExcelJS = require('exceljs');
const prisma = require('../lib/prisma');

const YELLOW_ARGB = 'FFF5C400';
const BLACK_ARGB = 'FF000000';
const WHITE_ARGB = 'FFFFFFFF';
const GREEN_ARGB = 'FFE6F4EA';
const RED_ARGB = 'FFFCE4E4';
const ORANGE_ARGB = 'FFFFF9E6';
const BLUE_ARGB = 'FFE8F0FE';

const STATUS_LABELS = { PRESENT: 'Presente', LATE: 'Tarde', ABSENT: 'Ausente', EXCUSED: 'Excusado' };
const STATUS_COLORS = { PRESENT: GREEN_ARGB, LATE: ORANGE_ARGB, ABSENT: RED_ARGB, EXCUSED: BLUE_ARGB };

function headerStyle(cell, bgArgb = BLACK_ARGB) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
  cell.font = { bold: true, color: { argb: bgArgb === BLACK_ARGB ? WHITE_ARGB : BLACK_ARGB }, size: 10 };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' },
  };
}

const dailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const school = await prisma.school.findUnique({ where: { id: req.user.schoolId } });
    const students = await prisma.student.findMany({
      where: { schoolId: req.user.schoolId, isActive: true },
      include: { grade: true },
      orderBy: [{ grade: { name: 'asc' } }, { lastName: 'asc' }],
    });
    const attendances = await prisma.attendance.findMany({
      where: { date: targetDate, student: { schoolId: req.user.schoolId } },
      include: { reader: true },
    });
    const attMap = new Map(attendances.map(a => [a.studentId, a]));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Beehive RFID';
    const sheet = workbook.addWorksheet('Asistencia Diaria');
    sheet.columns = [
      { key: 'num', width: 6 }, { key: 'code', width: 14 }, { key: 'name', width: 32 },
      { key: 'grade', width: 18 }, { key: 'status', width: 14 }, { key: 'time', width: 14 },
    ];

    sheet.mergeCells('A1:F1');
    const title = sheet.getCell('A1');
    title.value = `${school.name} — Reporte Diario — ${targetDate.toLocaleDateString('es-GT')}`;
    title.font = { bold: true, size: 14, color: { argb: BLACK_ARGB } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_ARGB } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    const hRow = sheet.addRow(['#', 'Codigo', 'Nombre Completo', 'Grado', 'Estado', 'Hora Entrada']);
    hRow.eachCell(c => headerStyle(c));
    sheet.getRow(2).height = 20;

    students.forEach((s, i) => {
      const att = attMap.get(s.id);
      const status = att?.status || 'ABSENT';
      const row = sheet.addRow([
        i + 1, s.studentCode, `${s.lastName}, ${s.firstName}`,
        `${s.grade.name} ${s.grade.section}`, STATUS_LABELS[status],
        att?.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '—',
      ]);
      const colorArgb = STATUS_COLORS[status];
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } };
      row.getCell(5).alignment = { horizontal: 'center' };
    });

    const dateStr = targetDate.toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=asistencia_${dateStr}.xlsx`);
    await workbook.xlsx.write(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const monthlyReport = async (req, res) => {
  try {
    const m = parseInt(req.query.month || new Date().getMonth() + 1);
    const y = parseInt(req.query.year || new Date().getFullYear());
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);

    const school = await prisma.school.findUnique({ where: { id: req.user.schoolId } });
    const students = await prisma.student.findMany({
      where: { schoolId: req.user.schoolId, isActive: true },
      include: { grade: true },
      orderBy: [{ grade: { name: 'asc' } }, { lastName: 'asc' }],
    });
    const attendances = await prisma.attendance.findMany({
      where: { date: { gte: startDate, lte: endDate }, student: { schoolId: req.user.schoolId } },
    });

    const schoolDays = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      if (cur.getDay() >= 1 && cur.getDay() <= 5) schoolDays.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    const attMap = new Map();
    attendances.forEach(a => {
      attMap.set(`${a.studentId}_${new Date(a.date).toISOString().split('T')[0]}`, a.status);
    });

    const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Beehive RFID';
    const sheet = workbook.addWorksheet('Reporte Mensual');

    const totalCols = 4 + schoolDays.length + 4;
    sheet.mergeCells(1, 1, 1, totalCols);
    const title = sheet.getCell('A1');
    title.value = `${school.name} — Reporte Mensual — ${MONTHS[m-1]} ${y}`;
    title.font = { bold: true, size: 14, color: { argb: BLACK_ARGB } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_ARGB } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    const hData = ['#', 'Codigo', 'Nombre', 'Grado', ...schoolDays.map(d => d.getDate()), 'P', 'T', 'A', '%'];
    const hRow = sheet.addRow(hData);
    hRow.eachCell(c => headerStyle(c));

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 28;
    sheet.getColumn(4).width = 14;
    for (let i = 5; i <= 4 + schoolDays.length; i++) sheet.getColumn(i).width = 4;

    students.forEach((s, i) => {
      let P = 0, T = 0, A = 0;
      const cells = [i + 1, s.studentCode, `${s.lastName}, ${s.firstName}`, `${s.grade.name} ${s.grade.section}`];
      schoolDays.forEach(day => {
        const key = `${s.id}_${day.toISOString().split('T')[0]}`;
        const status = attMap.get(key);
        if (status === 'PRESENT') { cells.push('P'); P++; }
        else if (status === 'LATE') { cells.push('T'); T++; }
        else if (status === 'EXCUSED') { cells.push('E'); }
        else { cells.push('A'); A++; }
      });
      const rate = schoolDays.length > 0 ? Math.round(((P + T) / schoolDays.length) * 100) : 0;
      cells.push(P, T, A, `${rate}%`);
      sheet.addRow(cells);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_${y}-${String(m).padStart(2,'0')}.xlsx`);
    await workbook.xlsx.write(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const studentReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const student = await prisma.student.findUnique({
      where: { id },
      include: { grade: true, school: true },
    });

    if (!student || student.schoolId !== req.user.schoolId) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const attendances = await prisma.attendance.findMany({
      where: { studentId: id, date: { gte: fromDate, lte: toDate } },
      include: { reader: true },
      orderBy: { date: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Beehive RFID';
    const sheet = workbook.addWorksheet('Historial');
    sheet.columns = [
      { key: 'num', width: 6 }, { key: 'date', width: 18 }, { key: 'status', width: 14 },
      { key: 'time', width: 14 }, { key: 'reader', width: 24 },
    ];

    sheet.mergeCells('A1:E1');
    const title = sheet.getCell('A1');
    title.value = `${student.school.name} — Historial de Asistencia`;
    title.font = { bold: true, size: 14, color: { argb: BLACK_ARGB } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_ARGB } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:E2');
    const subtitle = sheet.getCell('A2');
    subtitle.value = `${student.lastName}, ${student.firstName}  —  ${student.grade.name} ${student.grade.section}  —  Cod: ${student.studentCode}`;
    subtitle.font = { bold: true, size: 11 };
    subtitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 18;

    const hRow = sheet.addRow(['#', 'Fecha', 'Estado', 'Hora Entrada', 'Lector / Origen']);
    hRow.eachCell(c => headerStyle(c, YELLOW_ARGB));
    sheet.getRow(3).height = 20;

    attendances.forEach((att, i) => {
      const status = att.status;
      const row = sheet.addRow([
        i + 1,
        new Date(att.date).toLocaleDateString('es-GT'),
        STATUS_LABELS[status] || status,
        att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '—',
        att.reader?.name || (att.isManual ? 'Manual' : '—'),
      ]);
      if (STATUS_COLORS[status]) {
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLORS[status] } };
      }
      row.getCell(3).alignment = { horizontal: 'center' };
    });

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];
    const fname = `historial_${student.studentCode}_${fromStr}_${toStr}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fname}`);
    await workbook.xlsx.write(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { dailyReport, monthlyReport, studentReport };
