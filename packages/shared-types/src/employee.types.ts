import { Gender, EmploymentStatus } from './auth.types';

// ===== Department Types =====
export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  managerId?: string;
  manager?: EmployeeSummary;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
  managerId?: string;
  parentId?: string;
}

// ===== Position Types =====
export interface Position {
  id: string;
  title: string;
  code: string;
  level: number;
  departmentId: string;
  minSalary?: number;
  maxSalary?: number;
  createdAt: string;
  updatedAt: string;
}

// ===== Employee Types =====
export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  departmentId: string;
  positionId: string;
}

export interface Employee extends EmployeeSummary {
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;
  address?: string;
  nationalId?: string;
  joinDate: string;
  status: EmploymentStatus;
  department?: Department;
  position?: Position;
  managerId?: string;
  manager?: EmployeeSummary;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDto {
  fullName: string;
  email: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;
  address?: string;
  nationalId?: string;
  joinDate: string;
  departmentId: string;
  positionId: string;
  managerId?: string;
  salary: number;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {
  status?: EmploymentStatus;
}
