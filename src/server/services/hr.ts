import fs from 'fs';
import path from 'path';
import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';

// Interface Definitions
export interface Department {
  id: string;
  name: string;
  code: string;
  managerId?: string; // staffId
  managerName?: string;
  description: string;
  budget: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Staff {
  id: string;
  userId?: number; // Linked database User.id
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  departmentName: string;
  designation: string; // e.g. Clinical Director, Senior Surgeon, Receptionist, Head Nurse
  role: 'superadmin' | 'admin' | 'doctor' | 'receptionist' | 'nurse' | 'technician' | 'billing' | 'support';
  joinedDate: string; // YYYY-MM-DD
  status: 'active' | 'suspended' | 'resigned' | 'on_leave';
  basicSalary: number;
  bankName: string;
  bankAccountNumber: string;
  shiftId: string;
  shiftName: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  clockIn?: string; // HH:MM
  clockOut?: string; // HH:MM
  status: 'present' | 'late' | 'half_day' | 'absent' | 'on_leave';
  notes?: string;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  type: 'sick' | 'casual' | 'annual' | 'unpaid' | 'maternity' | 'paternity';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  color: string; // Tailwind bg color class
  workingDays: number[]; // 0=Sunday, 1=Monday, etc.
  createdAt: string;
}

export interface Payroll {
  id: string;
  staffId: string;
  staffName: string;
  month: string; // YYYY-MM (e.g. "2026-07")
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: 'draft' | 'approved' | 'paid' | 'on_hold';
  paymentDate?: string;
  paymentMethod?: 'bank_transfer' | 'cash' | 'check';
  notes?: string;
  createdAt: string;
}

export interface Holiday {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'national' | 'festival' | 'restricted' | 'clinic_closure';
  description: string;
  createdAt: string;
}

export interface StaffDocument {
  id: string;
  staffId: string;
  name: string;
  type: 'contract' | 'id_proof' | 'qualification' | 'other';
  size: string;
  url: string;
  uploadedAt: string;
}

interface HRData {
  departments: Department[];
  staff: Staff[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  shifts: Shift[];
  payroll: Payroll[];
  holidays: Holiday[];
  documents: StaffDocument[];
}

const DATA_FILE = path.join(process.cwd(), 'src', 'server', 'data', 'hr.json');

export class HRService {
  private static initFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const defaultData: HRData = {
        departments: [
          {
            id: 'dept-1',
            name: 'Administration & HR',
            code: 'ADMIN',
            description: 'Handles facility coordination, management, medical billing operations, and human resources.',
            budget: 25000,
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'dept-2',
            name: 'General Medicine & OPD',
            code: 'MED-OPD',
            description: 'Primary clinical diagnostic consultations, outpatient clinic care, and family medicine guidance.',
            budget: 60000,
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'dept-3',
            name: 'Nursing & Care Staff',
            code: 'NURSE',
            description: 'Inpatient triage, vital checks, laboratory sampling support, and patient monitoring.',
            budget: 45000,
            status: 'active',
            createdAt: new Date().toISOString()
          }
        ],
        staff: [], // Will be auto-synced with Prisma Users when read or initialized
        attendance: [
          {
            id: 'att-1',
            staffId: 'staff-1',
            staffName: 'Dr. Sarah Connor',
            date: new Date().toISOString().split('T')[0],
            clockIn: '08:52',
            status: 'present',
            notes: 'On time. Morning rounds.',
            createdAt: new Date().toISOString()
          },
          {
            id: 'att-2',
            staffId: 'staff-2',
            staffName: 'Admin Marcus',
            date: new Date().toISOString().split('T')[0],
            clockIn: '09:15',
            status: 'late',
            notes: 'Heavy traffic.',
            createdAt: new Date().toISOString()
          }
        ],
        leaves: [
          {
            id: 'lv-1',
            staffId: 'staff-1',
            staffName: 'Dr. Sarah Connor',
            type: 'annual',
            startDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
            endDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0],
            reason: 'Annual family holiday trip.',
            status: 'pending',
            createdAt: new Date().toISOString()
          },
          {
            id: 'lv-2',
            staffId: 'staff-2',
            staffName: 'Admin Marcus',
            type: 'sick',
            startDate: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
            endDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
            reason: 'Severe migraine headache.',
            status: 'approved',
            approvedBy: 'Clinic Lead Admin',
            createdAt: new Date().toISOString()
          }
        ],
        shifts: [
          {
            id: 'sh-1',
            name: 'Day Morning Shift',
            startTime: '08:00',
            endTime: '16:00',
            color: 'bg-amber-100 text-amber-800 border-amber-200',
            workingDays: [1, 2, 3, 4, 5],
            createdAt: new Date().toISOString()
          },
          {
            id: 'sh-2',
            name: 'Afternoon Evening Shift',
            startTime: '16:00',
            endTime: '00:00',
            color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            workingDays: [1, 2, 3, 4, 5],
            createdAt: new Date().toISOString()
          },
          {
            id: 'sh-3',
            name: 'Emergency Night Guard',
            startTime: '00:00',
            endTime: '08:00',
            color: 'bg-rose-100 text-rose-800 border-rose-200',
            workingDays: [0, 5, 6],
            createdAt: new Date().toISOString()
          }
        ],
        payroll: [],
        holidays: [
          {
            id: 'hol-1',
            title: 'National Independence Day',
            date: '2026-07-04',
            type: 'national',
            description: 'Clinic open for Emergency Trauma ER only. Core OPD consult services closed.',
            createdAt: new Date().toISOString()
          },
          {
            id: 'hol-2',
            title: 'Annual Clinic Team Outing',
            date: '2026-08-15',
            type: 'clinic_closure',
            description: 'Annual facility holiday closure for nursing and physician appreciation day.',
            createdAt: new Date().toISOString()
          }
        ],
        documents: [
          {
            id: 'doc-1',
            staffId: 'staff-1',
            name: 'Physician_Credentials_Board_Certificate.pdf',
            type: 'qualification',
            size: '2.4 MB',
            url: '/files/physician_board_cert.pdf',
            uploadedAt: new Date().toLocaleDateString()
          }
        ]
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    }
  }

  private static readData(): HRData {
    this.initFile();
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading HR JSON:', error);
      return { departments: [], staff: [], attendance: [], leaves: [], shifts: [], payroll: [], holidays: [], documents: [] };
    }
  }

  private static writeData(data: HRData) {
    this.initFile();
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing HR JSON:', error);
    }
  }

  // Auto-sync database Users with Staff profiles
  public static async syncPrismaUsersToStaff(): Promise<void> {
    const data = this.readData();
    try {
      const dbUsers = await prisma.user.findMany({
        where: {
          role: { in: ['admin', 'superadmin', 'doctor', 'receptionist'] }
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true
        }
      });

      let updated = false;

      for (const u of dbUsers) {
        const hasStaff = data.staff.some(s => s.userId === u.id || s.email === u.email);
        if (!hasStaff) {
          // Auto create a staff record for this user
          const isDoctor = u.role === 'doctor';
          const isAdmin = u.role === 'admin' || u.role === 'superadmin';
          
          const defaultDeptId = isDoctor ? 'dept-2' : 'dept-1';
          const defaultDept = data.departments.find(d => d.id === defaultDeptId) || data.departments[0];
          
          const newStaff: Staff = {
            id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            userId: u.id,
            name: u.name,
            email: u.email,
            phone: '1-800-555-0199',
            departmentId: defaultDeptId,
            departmentName: defaultDept?.name || 'General Clinic',
            designation: isDoctor ? 'Chief Resident Physician' : isAdmin ? 'Medical Facility Director' : 'Clinical Desk Coordinator',
            role: u.role as any,
            joinedDate: new Date(u.createdAt).toISOString().split('T')[0],
            status: 'active',
            basicSalary: isDoctor ? 12000 : isAdmin ? 8000 : 4500,
            bankName: 'MedAlliance Federal Credit Union',
            bankAccountNumber: `XXXX-XXXX-${Math.floor(1000 + Math.random() * 9000)}`,
            shiftId: 'sh-1',
            shiftName: 'Day Morning Shift',
            createdAt: new Date().toISOString()
          };
          
          data.staff.push(newStaff);
          updated = true;
        }
      }

      // If data.staff is empty even after sync (e.g. no prisma users in dev), insert some mock templates
      if (data.staff.length === 0) {
        const defaultStaff: Staff[] = [
          {
            id: 'staff-1',
            name: 'Dr. Sarah Connor',
            email: 'connor@clinical.com',
            phone: '1-555-010-2342',
            departmentId: 'dept-2',
            departmentName: 'General Medicine & OPD',
            designation: 'Managing Director of Medicine',
            role: 'doctor',
            joinedDate: '2024-01-15',
            status: 'active',
            basicSalary: 14500,
            bankName: 'Global Medical Trust Union',
            bankAccountNumber: 'XXXX-XXXX-4562',
            shiftId: 'sh-1',
            shiftName: 'Day Morning Shift',
            createdAt: new Date().toISOString()
          },
          {
            id: 'staff-2',
            name: 'Admin Marcus',
            email: 'marcus@clinical.com',
            phone: '1-555-010-9911',
            departmentId: 'dept-1',
            departmentName: 'Administration & HR',
            designation: 'Senior Desk Admin & Billing Lead',
            role: 'receptionist',
            joinedDate: '2025-06-10',
            status: 'active',
            basicSalary: 5200,
            bankName: 'Apex Health Bank',
            bankAccountNumber: 'XXXX-XXXX-1102',
            shiftId: 'sh-1',
            shiftName: 'Day Morning Shift',
            createdAt: new Date().toISOString()
          }
        ];
        data.staff = defaultStaff;
        updated = true;
      }

      if (updated) {
        this.writeData(data);
      }
    } catch (error) {
      console.error('Error syncing prisma users to staff:', error);
    }
  }

  // ================= DEPARTMENTS CRUD =================
  public static getDepartments(): Department[] {
    return this.readData().departments;
  }

  public static createDepartment(dept: Omit<Department, 'id' | 'createdAt'>): Department {
    const data = this.readData();
    const newDept: Department = {
      ...dept,
      id: `dept-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      createdAt: new Date().toISOString()
    };
    
    // Resolve Manager Name
    if (dept.managerId) {
      const manager = data.staff.find(s => s.id === dept.managerId);
      if (manager) {
        newDept.managerName = manager.name;
      }
    }

    data.departments.push(newDept);
    this.writeData(data);
    return newDept;
  }

  public static updateDepartment(id: string, updates: Partial<Department>): Department {
    const data = this.readData();
    const index = data.departments.findIndex(d => d.id === id);
    if (index === -1) throw new AppError('Department not found', 404);

    const merged = { ...data.departments[index], ...updates };
    
    if (updates.managerId) {
      const manager = data.staff.find(s => s.id === updates.managerId);
      if (manager) merged.managerName = manager.name;
    }

    data.departments[index] = merged;
    
    // Update department name in staff profiles if changed
    if (updates.name) {
      data.staff = data.staff.map(s => {
        if (s.departmentId === id) {
          return { ...s, departmentName: updates.name! };
        }
        return s;
      });
    }

    this.writeData(data);
    return merged;
  }

  public static deleteDepartment(id: string) {
    const data = this.readData();
    // Check if staff are linked to department
    const hasStaff = data.staff.some(s => s.departmentId === id);
    if (hasStaff) {
      throw new AppError('Cannot delete department with active staff. Reassign staff first.', 400);
    }
    data.departments = data.departments.filter(d => d.id !== id);
    this.writeData(data);
  }

  // ================= STAFF CRUD =================
  public static async getStaff(): Promise<Staff[]> {
    await this.syncPrismaUsersToStaff();
    return this.readData().staff;
  }

  public static createStaff(staff: Omit<Staff, 'id' | 'departmentName' | 'shiftName' | 'createdAt'>): Staff {
    const data = this.readData();
    
    // Resolve Department Name
    const dept = data.departments.find(d => d.id === staff.departmentId);
    if (!dept) throw new AppError('Assigned Department not found', 404);

    // Resolve Shift Name
    const shift = data.shifts.find(s => s.id === staff.shiftId) || data.shifts[0];

    const newStaff: Staff = {
      ...staff,
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      departmentName: dept.name,
      shiftName: shift ? shift.name : 'Unassigned',
      createdAt: new Date().toISOString()
    };

    data.staff.push(newStaff);
    this.writeData(data);
    return newStaff;
  }

  public static updateStaff(id: string, updates: Partial<Staff>): Staff {
    const data = this.readData();
    const index = data.staff.findIndex(s => s.id === id);
    if (index === -1) throw new AppError('Staff profile not found', 404);

    const current = data.staff[index];
    const merged = { ...current, ...updates };

    if (updates.departmentId && updates.departmentId !== current.departmentId) {
      const dept = data.departments.find(d => d.id === updates.departmentId);
      if (!dept) throw new AppError('Department not found', 404);
      merged.departmentName = dept.name;
    }

    if (updates.shiftId && updates.shiftId !== current.shiftId) {
      const shift = data.shifts.find(s => s.id === updates.shiftId);
      if (shift) {
        merged.shiftName = shift.name;
      }
    }

    data.staff[index] = merged;

    // Propagate manager name changes in departments if applicable
    data.departments = data.departments.map(d => {
      if (d.managerId === id && updates.name) {
        return { ...d, managerName: updates.name };
      }
      return d;
    });

    this.writeData(data);
    return merged;
  }

  public static deleteStaff(id: string) {
    const data = this.readData();
    // Cannot delete active clinical user unless suspended or resigned first
    const staff = data.staff.find(s => s.id === id);
    if (staff && staff.status === 'active') {
      throw new AppError('Cannot delete active staff. Change status to suspended/resigned first.', 400);
    }
    data.staff = data.staff.filter(s => s.id !== id);
    this.writeData(data);
  }

  // ================= ATTENDANCE CRUD =================
  public static getAttendance(date?: string): Attendance[] {
    const data = this.readData();
    const queryDate = date || new Date().toISOString().split('T')[0];
    return data.attendance.filter(a => a.date === queryDate);
  }

  public static getAllAttendanceLogs(): Attendance[] {
    return this.readData().attendance;
  }

  public static clockIn(staffId: string, clockInTime?: string, notes?: string): Attendance {
    const data = this.readData();
    const staff = data.staff.find(s => s.id === staffId);
    if (!staff) throw new AppError('Staff member not found', 404);

    const todayStr = new Date().toISOString().split('T')[0];
    const existingIndex = data.attendance.findIndex(a => a.staffId === staffId && a.date === todayStr);

    const clockInValue = clockInTime || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    // Determine Status (Late if after 09:00 AM)
    let status: Attendance['status'] = 'present';
    const [hr, min] = clockInValue.split(':').map(Number);
    if (hr > 9 || (hr === 9 && min > 5)) {
      status = 'late';
    }

    let record: Attendance;

    if (existingIndex !== -1) {
      record = {
        ...data.attendance[existingIndex],
        clockIn: clockInValue,
        status,
        notes: notes || data.attendance[existingIndex].notes
      };
      data.attendance[existingIndex] = record;
    } else {
      record = {
        id: `att-${Date.now()}`,
        staffId,
        staffName: staff.name,
        date: todayStr,
        clockIn: clockInValue,
        status,
        notes,
        createdAt: new Date().toISOString()
      };
      data.attendance.push(record);
    }

    this.writeData(data);
    return record;
  }

  public static clockOut(staffId: string, clockOutTime?: string): Attendance {
    const data = this.readData();
    const todayStr = new Date().toISOString().split('T')[0];
    const existingIndex = data.attendance.findIndex(a => a.staffId === staffId && a.date === todayStr);

    if (existingIndex === -1) {
      throw new AppError('No Clock-In record found for today. Please clock-in first.', 400);
    }

    const clockOutValue = clockOutTime || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const record = {
      ...data.attendance[existingIndex],
      clockOut: clockOutValue
    };

    data.attendance[existingIndex] = record;
    this.writeData(data);
    return record;
  }

  public static updateAttendanceBulk(records: Omit<Attendance, 'id' | 'createdAt' | 'staffName'>[]): void {
    const data = this.readData();
    for (const r of records) {
      const idx = data.attendance.findIndex(a => a.staffId === r.staffId && a.date === r.date);
      const staffObj = data.staff.find(s => s.id === r.staffId);
      if (!staffObj) continue;

      if (idx !== -1) {
        data.attendance[idx] = {
          ...data.attendance[idx],
          ...r
        };
      } else {
        data.attendance.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          staffId: r.staffId,
          staffName: staffObj.name,
          date: r.date,
          clockIn: r.clockIn,
          clockOut: r.clockOut,
          status: r.status,
          notes: r.notes,
          createdAt: new Date().toISOString()
        });
      }
    }
    this.writeData(data);
  }

  // ================= LEAVE CRUD =================
  public static getLeaves(): LeaveRequest[] {
    return this.readData().leaves;
  }

  public static applyLeave(leave: Omit<LeaveRequest, 'id' | 'staffName' | 'status' | 'createdAt'>): LeaveRequest {
    const data = this.readData();
    const staff = data.staff.find(s => s.id === leave.staffId);
    if (!staff) throw new AppError('Staff member not found', 404);

    const newLeave: LeaveRequest = {
      ...leave,
      id: `lv-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      staffName: staff.name,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    data.leaves.push(newLeave);
    this.writeData(data);
    return newLeave;
  }

  public static reviewLeave(id: string, status: 'approved' | 'rejected', reviewerName: string, notes?: string): LeaveRequest {
    const data = this.readData();
    const index = data.leaves.findIndex(l => l.id === id);
    if (index === -1) throw new AppError('Leave request not found', 404);

    const leave = data.leaves[index];
    leave.status = status;
    leave.approvedBy = reviewerName;
    
    if (status === 'rejected' && notes) {
      leave.rejectionReason = notes;
    }

    // If leave approved, update staff profile status temporarily
    if (status === 'approved') {
      const staffIdx = data.staff.findIndex(s => s.id === leave.staffId);
      if (staffIdx !== -1) {
        data.staff[staffIdx].status = 'on_leave';
      }
    }

    data.leaves[index] = leave;
    this.writeData(data);
    return leave;
  }

  // ================= SHIFTS CRUD =================
  public static getShifts(): Shift[] {
    return this.readData().shifts;
  }

  public static createShift(shift: Omit<Shift, 'id' | 'createdAt'>): Shift {
    const data = this.readData();
    const newShift: Shift = {
      ...shift,
      id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      createdAt: new Date().toISOString()
    };
    data.shifts.push(newShift);
    this.writeData(data);
    return newShift;
  }

  public static updateShift(id: string, updates: Partial<Shift>): Shift {
    const data = this.readData();
    const index = data.shifts.findIndex(s => s.id === id);
    if (index === -1) throw new AppError('Shift schedule not found', 404);

    const merged = { ...data.shifts[index], ...updates };
    data.shifts[index] = merged;

    // Propagate shift name changes in staff profiles if changed
    if (updates.name) {
      data.staff = data.staff.map(s => {
        if (s.shiftId === id) {
          return { ...s, shiftName: updates.name! };
        }
        return s;
      });
    }

    this.writeData(data);
    return merged;
  }

  public static deleteShift(id: string) {
    const data = this.readData();
    // Reassign staff before deleting
    const hasStaff = data.staff.some(s => s.shiftId === id);
    if (hasStaff) {
      throw new AppError('Cannot delete shift currently assigned to staff members. Reassign first.', 400);
    }
    data.shifts = data.shifts.filter(s => s.id !== id);
    this.writeData(data);
  }

  // ================= PAYROLL SERVICES =================
  public static getPayrolls(month?: string): Payroll[] {
    const data = this.readData();
    let pays = data.payroll;
    if (month) {
      pays = pays.filter(p => p.month === month);
    }
    return pays;
  }

  public static generateMonthlyPayroll(month: string): Payroll[] {
    const data = this.readData();
    
    // Check if payroll already exists for this month to prevent duplication
    const existing = data.payroll.filter(p => p.month === month);
    if (existing.length > 0) {
      return existing;
    }

    const generated: Payroll[] = [];

    for (const s of data.staff) {
      if (s.status === 'resigned' || s.status === 'suspended') continue;

      // Simple allowance calculation (e.g. 10% of basic salary for allowances)
      const allowances = Math.round(s.basicSalary * 0.08);
      // Tax deduction deduction (e.g. 15% income tax deduction)
      const deductions = Math.round(s.basicSalary * 0.12);
      const netSalary = s.basicSalary + allowances - deductions;

      const payrollRecord: Payroll = {
        id: `pr-${Date.now()}-${s.id}`,
        staffId: s.id,
        staffName: s.name,
        month,
        basicSalary: s.basicSalary,
        allowances,
        deductions,
        netSalary,
        status: 'draft',
        createdAt: new Date().toISOString()
      };

      generated.push(payrollRecord);
      data.payroll.push(payrollRecord);
    }

    this.writeData(data);
    return generated;
  }

  public static updatePayrollStatus(id: string, status: Payroll['status'], paymentMethod?: Payroll['paymentMethod'], notes?: string): Payroll {
    const data = this.readData();
    const idx = data.payroll.findIndex(p => p.id === id);
    if (idx === -1) throw new AppError('Payroll record not found', 404);

    const record = data.payroll[idx];
    record.status = status;
    if (status === 'paid') {
      record.paymentDate = new Date().toISOString().split('T')[0];
      if (paymentMethod) {
        record.paymentMethod = paymentMethod;
      }
    }
    if (notes !== undefined) {
      record.notes = notes;
    }

    data.payroll[idx] = record;
    this.writeData(data);
    return record;
  }

  // ================= HOLIDAY SERVICES =================
  public static getHolidays(): Holiday[] {
    return this.readData().holidays;
  }

  public static createHoliday(holiday: Omit<Holiday, 'id' | 'createdAt'>): Holiday {
    const data = this.readData();
    const newHol: Holiday = {
      ...holiday,
      id: `hol-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    data.holidays.push(newHol);
    this.writeData(data);
    return newHol;
  }

  public static deleteHoliday(id: string) {
    const data = this.readData();
    data.holidays = data.holidays.filter(h => h.id !== id);
    this.writeData(data);
  }

  // ================= STAFF DOCUMENTS SERVICES =================
  public static getStaffDocuments(staffId?: string): StaffDocument[] {
    const data = this.readData();
    if (staffId) {
      return data.documents.filter(d => d.staffId === staffId);
    }
    return data.documents;
  }

  public static addStaffDocument(doc: Omit<StaffDocument, 'id' | 'uploadedAt'>): StaffDocument {
    const data = this.readData();
    const newDoc: StaffDocument = {
      ...doc,
      id: `stdoc-${Date.now()}`,
      uploadedAt: new Date().toLocaleDateString()
    };
    data.documents.push(newDoc);
    this.writeData(data);
    return newDoc;
  }

  public static deleteStaffDocument(id: string) {
    const data = this.readData();
    data.documents = data.documents.filter(d => d.id !== id);
    this.writeData(data);
  }
}
