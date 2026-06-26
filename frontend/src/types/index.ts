export interface School {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  primaryColor: string;
  entryTime: string;
  lateTime: string;
}

export interface Grade {
  id: string;
  name: string;
  section: string;
  year: number;
  schoolId: string;
  _count?: { students: number };
}

export interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  rfidUid?: string;
  birthDate?: string;
  address?: string;
  isActive: boolean;
  gradeId: string;
  grade: Grade;
  schoolId: string;
  createdAt: string;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type ExcuseType = 'MEDICAL' | 'FAMILY' | 'OFFICIAL' | 'OTHER';
export type UserRole = 'ADMIN' | 'DIRECTOR' | 'TEACHER' | 'SECRETARY';

export interface Reader {
  id: string;
  name: string;
  location?: string;
  ipAddress?: string;
  isOnline: boolean;
  lastSeen?: string;
  isActive: boolean;
  _count?: { attendances: number };
}

export interface Attendance {
  id: string;
  date: string;
  checkInTime?: string;
  status: AttendanceStatus;
  isManual: boolean;
  studentId: string;
  student: Student;
  readerId?: string;
  reader?: Reader;
}

export interface Excuse {
  id: string;
  reason: string;
  description?: string;
  type: ExcuseType;
  studentId: string;
  student: Student;
  attendanceId?: string;
  attendance?: Attendance;
  approvedBy?: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  school: School;
}

export interface AttendanceStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
}
