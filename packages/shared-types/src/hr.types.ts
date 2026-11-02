import { AttendanceStatus, LeaveType, LeaveStatus, ContractType, PayrollStatus } from './auth.types.js';
import { EmployeeSummary } from './employee.types.js';

// ===== Attendance Types =====
export interface Attendance {
  id: string;
  employeeId: string;
  employee?: EmployeeSummary;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  workHours?: number;
  overtime?: number;
  note?: string;
  createdAt: string;
}

export interface CheckInRequest {
  location?: string;
  note?: string;
}

export interface CheckOutRequest {
  note?: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employee?: EmployeeSummary;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  workHours?: number;
  workDays?: number;
  overtime?: number;
  note?: string;
  createdAt: string;
}

// ===== Leave / Request Types =====
export interface Request {
  id: string;
  employeeId: string;
  employee?: EmployeeSummary;
  type: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  overtimeHours?: number;
  overtimeDate?: string;
  reason: string;
  status: LeaveStatus;
  approvedById?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestDto {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  overtimeHours?: number;
  overtimeDate?: string;
}

export interface ApproveRequestDto {
  status: LeaveStatus.APPROVED | LeaveStatus.REJECTED;
  rejectionReason?: string;
}

// ===== Contract Types =====
export interface Contract {
  id: string;
  employeeId: string;
  employee?: EmployeeSummary;
  contractNumber: string;
  type: ContractType;
  startDate: string;
  endDate?: string;
  baseSalary: number;
  allowances?: number;
  signedDate: string;
  isActive: boolean;
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractDto {
  employeeId: string;
  contractNumber: string;
  type: ContractType;
  startDate: string;
  endDate?: string;
  baseSalary: number;
  allowances?: number;
  signedDate: string;
}

// ===== Payroll Types =====
export interface Payroll {
  id: string;
  employeeId: string;
  employee?: EmployeeSummary;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  tax: number;
  netSalary: number;
  workingDays: number;
  actualWorkingDays: number;
  overtimeHours: number;
  overtimePay: number;
  status: PayrollStatus;
  paidAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== API Response Types =====
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
