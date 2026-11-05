"use client"

import * as React from "react"
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileText,
  ShieldCheck,
  ArrowRight,
} from "lucide-react"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { leaveApi } from "@/lib/api/leave.api"
import { apiErrorMessage, leaveTypeLabel, requestDurationLabel } from "@/lib/utils"

export interface LeaveDetailItem {
  id: string
  type: string
  startDate: string
  endDate: string
  totalDays: number
  overtimeHours?: number | null
  reason: string
  status: string
  rejectionReason?: string | null
  approvedBy?: { id: string; fullName: string } | null
  createdAt?: string
  employee: {
    id?: string
    fullName: string
    employeeCode: string
    department?: { name: string } | null
    position?: { title: string } | null
  }
}

interface LeaveDetailModalProps {
  leave: LeaveDetailItem | null
  isOpen: boolean
  onClose: () => void
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, reason: string) => Promise<void>
}

function formatDateVN(dateStr: string | null | undefined): string {
  if (!dateStr) return "--/--/----"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr.slice(0, 10)
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return dateStr.slice(0, 10)
  }
}

export function LeaveDetailModal({
  leave,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: LeaveDetailModalProps) {
  const [balance, setBalance] = React.useState<{ remainingDays: number; totalDays: number } | null>(null)
  const [loadingBalance, setLoadingBalance] = React.useState(false)

  // Reject mode
  const [showRejectInput, setShowRejectInput] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState("")
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!leave || !isOpen) {
      setBalance(null)
      setShowRejectInput(false)
      setRejectReason("")
      return
    }
    setActionError(null)

    // Chỉ đơn phép năm mới trừ vào quỹ phép năm → các loại khác không cần tải
    if (leave.employee.id && leave.type === "ANNUAL") {
      setLoadingBalance(true)
      const currentYear = new Date().getFullYear()
      leaveApi
        .getBalance(leave.employee.id, currentYear)
        .then((res) => setBalance({ remainingDays: res.remainingDays, totalDays: res.totalDays }))
        .catch(() => setBalance(null))
        .finally(() => setLoadingBalance(false))
    }
  }, [leave, isOpen])

  if (!leave) return null

  const isPending = leave.status === "PENDING"

  const handleApprove = async () => {
    setIsProcessing(true)
    setActionError(null)
    try {
      await onApprove(leave.id)
      onClose()
    } catch (e) {
      setActionError(apiErrorMessage(e, "Phê duyệt thất bại. Vui lòng thử lại."))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối đơn.")
      return
    }
    setIsProcessing(true)
    setActionError(null)
    try {
      await onReject(leave.id, rejectReason.trim())
      onClose()
    } catch (e) {
      setActionError(apiErrorMessage(e, "Từ chối thất bại. Vui lòng thử lại."))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} className="max-w-[560px]">
      {/* Header */}
      <DialogHeader className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" /> Chi tiết đơn
          </DialogTitle>
          <Badge
            variant={
              leave.status === "APPROVED"
                ? "success"
                : leave.status === "REJECTED"
                ? "destructive"
                : "warning"
            }
          >
            {leave.status === "APPROVED" && <CheckCircle2 />}
            {leave.status === "REJECTED" && <XCircle />}
            {leave.status === "PENDING" && <Clock />}
            {leave.status === "APPROVED"
              ? "Đã duyệt"
              : leave.status === "REJECTED"
              ? "Từ chối"
              : "Chờ duyệt"}
          </Badge>
        </div>
        <DialogDescription className="tabular">
          Đơn nộp ngày {formatDateVN(leave.createdAt || leave.startDate)}
        </DialogDescription>
      </DialogHeader>

      {/* Body Content */}
      <div className="mt-5 flex flex-col gap-4 text-body-sm">
        {/* Khối 1: Thông tin nhân sự */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-sunken p-4">
          <Avatar
            initials={leave.employee.fullName
              .split(" ")
              .slice(-2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
            className="size-10 bg-primary-tint text-body-sm text-accent-foreground"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold text-foreground">{leave.employee.fullName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              <span>Mã NV: <span className="font-mono font-medium text-foreground">{leave.employee.employeeCode}</span></span>
              <span aria-hidden>•</span>
              <span>Phòng: <span className="font-medium text-foreground">{leave.employee.department?.name || "—"}</span></span>
            </div>
          </div>
        </div>

        {/* Khối 2: Chi tiết kỳ nghỉ */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <span className="block text-caption text-muted-foreground">Loại đơn</span>
            <Badge variant="default" className="mt-1.5">
              {leaveTypeLabel(leave.type)}
            </Badge>
          </div>

          <div className="rounded-lg border border-border p-3">
            <span className="block text-caption text-muted-foreground">Thời lượng</span>
            <p className="tabular mt-1 text-h3 font-semibold text-foreground">{requestDurationLabel(leave)}</p>
          </div>
        </div>

        {/* Thời gian nghỉ */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <span className="text-caption text-muted-foreground">Từ ngày</span>
            <p className="tabular mt-0.5 font-semibold text-foreground">{formatDateVN(leave.startDate)}</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          <div className="text-right">
            <span className="text-caption text-muted-foreground">Đến ngày</span>
            <p className="tabular mt-0.5 font-semibold text-foreground">{formatDateVN(leave.endDate)}</p>
          </div>
        </div>

        {/* Phép năm còn lại — chỉ liên quan đơn phép năm */}
        {leave.type === "ANNUAL" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-info/20 bg-info-tint p-3">
          <div className="flex items-center gap-2 text-info">
            <ShieldCheck className="size-4 shrink-0" />
            <span className="font-medium">Quỹ phép năm của nhân viên</span>
          </div>
          <div>
            {loadingBalance ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : balance ? (
              <span className="tabular font-semibold text-foreground">
                {balance.remainingDays} / {balance.totalDays} ngày còn lại
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        )}

        {/* Lý do nghỉ */}
        <div>
          <span className="mb-1.5 block text-caption font-medium text-muted-foreground">Lý do</span>
          <p className="rounded-lg border border-border bg-sunken p-3 leading-relaxed text-foreground">
            {leave.reason}
          </p>
        </div>

        {/* Người duyệt / Lý do từ chối nếu có */}
        {leave.approvedBy && (
          <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-tint p-3 text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Phê duyệt bởi: <strong className="font-semibold">{leave.approvedBy.fullName}</strong></span>
          </div>
        )}

        {leave.rejectionReason && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint p-3 text-danger">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <span>Lý do từ chối: <strong className="font-semibold">{leave.rejectionReason}</strong></span>
          </div>
        )}

        {/* Vùng nhập lý do khi bấm từ chối */}
        {showRejectInput && (
          <div className="flex flex-col gap-2 animate-in fade-in">
            <label htmlFor="leave-reject-reason" className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
              <AlertTriangle className="size-4 text-danger" /> Nhập lý do từ chối đơn
            </label>
            <textarea
              id="leave-reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ghi rõ lý do từ chối để gửi thông báo đến nhân viên..."
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-body text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-subtle-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
            />
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {actionError && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3 py-2 text-body-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {actionError}
        </p>
      )}
      <DialogFooter className="border-t border-border pt-4">
        {!showRejectInput ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Đóng
            </Button>

            {isPending && (
              <>
                <Button variant="destructive" onClick={() => setShowRejectInput(true)} disabled={isProcessing}>
                  Từ chối
                </Button>

                <Button onClick={handleApprove} disabled={isProcessing}>
                  {isProcessing && <Loader2 className="size-4 animate-spin" />}
                  Duyệt
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setShowRejectInput(false)} disabled={isProcessing}>
              Hủy từ chối
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing || !rejectReason.trim()}>
              {isProcessing && <Loader2 className="size-4 animate-spin" />}
              Xác nhận từ chối
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  )
}
