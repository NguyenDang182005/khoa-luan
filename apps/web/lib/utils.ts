import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Ngày hôm nay theo giờ Việt Nam, định dạng yyyy-mm-dd (an toàn timezone, không dùng toISOString/UTC) */
export function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Tháng/năm hiện tại theo giờ Việt Nam */
export function currentMonthYearVN(): { month: number; year: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    month: "2-digit",
    year: "numeric",
  })
  const [year, month] = fmt.format(new Date()).split("-")
  return { month: Number(month), year: Number(year) }
}

/** Nhãn trạng thái payroll sang tiếng Việt */
export function payrollStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT": return "Chờ duyệt"
    case "APPROVED": return "Đã duyệt"
    case "PAID": return "Đã chi trả"
    case "CANCELLED": return "Đã hủy"
    default: return status
  }
}

/** Nhãn trạng thái nhân viên sang tiếng Việt */
export function employeeStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE": return "Đang làm việc"
    case "ON_LEAVE": return "Nghỉ phép"
    case "PROBATION": return "Thử việc"
    case "TERMINATED": return "Đã nghỉ việc"
    default: return status
  }
}

/** Nhãn loại đơn nghỉ phép / đơn làm thêm sang tiếng Việt */
export function leaveTypeLabel(type: string): string {
  switch (type) {
    case "ANNUAL": return "Phép năm"
    case "SICK": return "Nghỉ ốm"
    case "MATERNITY": return "Thai sản"
    case "PATERNITY": return "Chồng sinh"
    case "UNPAID": return "Không lương"
    case "EMERGENCY": return "Việc khẩn"
    case "OT": return "Làm thêm (OT)"
    case "LATE_PERMISSION": return "Đến muộn / Về sớm"
    case "BUSINESS_TRIP": return "Công tác"
    case "OTHER": return "Khác"
    default: return type
  }
}

/** Nhãn kịch bản đào tạo sang tiếng Việt */
export function scenarioLabel(scenario: string): string {
  switch (scenario) {
    case "CUSTOMER_COMPLAINT": return "Khiếu nại khách hàng"
    case "COLLEAGUE_CONFLICT": return "Xung đột đồng nghiệp"
    case "MANAGER_FEEDBACK": return "Tiếp nhận phản hồi quản lý"
    case "NEW_EMPLOYEE_ONBOARDING": return "Hội nhập nhân viên mới"
    case "PERFORMANCE_REVIEW": return "Đánh giá hiệu suất"
    case "GENERAL_COMMUNICATION": return "Giao tiếp chung"
    default: return scenario
  }
}

/** Định dạng tiền VNĐ */
export function vnd(amount: number): string {
  return `₫${Math.round(amount).toLocaleString("vi-VN")}`
}

/** Ngày kiểu ISO ("2026-09-11T00:00:00.000Z") → dd/MM/yyyy theo giờ VN */
export function fmtVNDate(iso: string | null | undefined): string {
  if (!iso) return "--"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "--"
  return d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
}
