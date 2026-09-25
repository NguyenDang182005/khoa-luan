import { apiClient } from './client'
import {
  PayrollListSchema,
  PayrollRecordSchema,
  PayrollHistorySchema,
  SalaryConfigSchema,
} from '../schemas/payroll.schema'
import type { PayrollRecord, PayrollHistoryItem } from '../schemas/payroll.schema'

export type { PayrollHistoryItem }

export interface BulkPayrollResult {
  approved?: number
  paid?: number
  month: number | null
  year: number | null
}

export const payrollApi = {
  list: async (month: number, year: number) => {
    const { data } = await apiClient.get('/payroll', { params: { month, year } })
    return PayrollListSchema.parse(data)
  },
  generateBulk: async (month: number, year: number): Promise<{ succeeded: number; failed: number; total: number }> => {
    const { data } = await apiClient.post('/payroll/generate-bulk', { month, year })
    return data
  },
  approve: async (id: string) => {
    const { data } = await apiClient.patch(`/payroll/${id}/approve`)
    return data
  },
  /** Duyệt toàn bộ DRAFT của kỳ, hoặc duyệt các dòng đã chọn (ids) */
  approveBulk: async (input: { month?: number; year?: number; ids?: string[] }): Promise<BulkPayrollResult> => {
    const { data } = await apiClient.post('/payroll/approve-bulk', input)
    return data
  },
  /** Chi trả toàn bộ APPROVED của kỳ, hoặc các dòng đã chọn (ids) */
  markPaidBulk: async (input: { month?: number; year?: number; ids?: string[] }): Promise<BulkPayrollResult> => {
    const { data } = await apiClient.post('/payroll/paid-bulk', input)
    return data
  },
  markPaid: async (id: string) => {
    const { data } = await apiClient.patch(`/payroll/${id}/paid`)
    return data
  },
  getSalaryConfig: async () => {
    const { data } = await apiClient.get('/salary-config/current')
    return SalaryConfigSchema.parse(data)
  },
  /** Lịch sử lương mọi kỳ của một nhân viên (mới nhất trước) */
  getEmployeeHistory: async (employeeId: string) => {
    const { data } = await apiClient.get(`/payroll/employee/${employeeId}`)
    return PayrollHistorySchema.parse(data)
  },
  /** Phiếu lương của chính người dùng đang đăng nhập (backend scope theo JWT) */
  getMyPayslip: async (month: number, year: number): Promise<PayrollRecord | null> => {
    const { data } = await apiClient.get('/payroll/me', { params: { month, year } })
    return data?.payroll ? PayrollRecordSchema.parse(data.payroll) : null
  },
}

/** Xuất danh sách bảng lương ra file CSV (mở được bằng Excel) */
export function exportPayrollCsv(records: PayrollRecord[], month: number, year: number) {
  const header = [
    'Ma NV', 'Ho ten', 'Phong ban', 'Chuc vu',
    'Luong co ban', 'Ngay cong', 'Ngay cong chuan',
    'Gio OT', 'Tien OT', 'Phu cap', 'Thuong',
    'Tong gross', 'Giam tru (BH + Thue)', 'Thue TNCN', 'Thuc nhan (Net)', 'Trang thai',
  ]
  const grossOf = (p: PayrollRecord) => p.baseSalary + p.allowances + p.overtimePay + p.bonus
  const rows = records.map((p) => [
    p.employee?.employeeCode ?? '', p.employee?.fullName ?? '', p.employee?.department?.name ?? '', p.employee?.position?.title ?? '',
    p.baseSalary, p.actualWorkingDays, p.workingDays,
    p.overtimeHours, p.overtimePay, p.allowances, p.bonus,
    grossOf(p), p.deductions, p.tax, p.netSalary, p.status,
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bang-luong-${String(month).padStart(2, '0')}-${year}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
