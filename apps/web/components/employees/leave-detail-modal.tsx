"use client"

import * as React from "react"
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Building2,
  Briefcase,
  AlertTriangle,
  Loader2,
  FileText,
  ShieldCheck,
} from "lucide-react"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { leaveApi } from "@/lib/api/leave.api"
import { leaveTypeLabel } from "@/lib/utils"

export interface LeaveDetailItem {
  id: string
  type: string
  startDate: string
  endDate: string
  totalDays: number
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

  React.useEffect(() => {
    if (!leave || !isOpen) {
      setBalance(null)
      setShowRejectInput(false)
      setRejectReason("")
      return
    }

    if (leave.employee.id) {
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
    try {
      await onApprove(leave.id)
      onClose()
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
    try {
      await onReject(leave.id, rejectReason.trim())
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-50 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <DialogHeader className="border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Chi Tiết Đơn Xin Nghỉ Phép
              </DialogTitle>
              <Badge
                variant={
                  leave.status === "APPROVED"
                    ? "success"
                    : leave.status === "REJECTED"
                    ? "destructive"
                    : "warning"
                }
                className="text-xs gap-1"
              >
                {leave.status === "APPROVED" && <CheckCircle2 className="size-3" />}
                {leave.status === "REJECTED" && <XCircle className="size-3" />}
                {leave.status === "PENDING" && <Clock className="size-3" />}
                {leave.status === "APPROVED"
                  ? "Đã Duyệt"
                  : leave.status === "REJECTED"
                  ? "Từ Chối"
                  : "Chờ Duyệt"}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Đơn nộp ngày {formatDateVN(leave.createdAt || leave.startDate)}
            </DialogDescription>
          </DialogHeader>

          {/* Body Content */}
          <div className="mt-4 flex flex-col gap-4 text-xs">
            {/* Khối 1: Thông tin nhân sự */}
            <div className="rounded-xl border border-border bg-muted/20 p-3.5 flex items-center gap-3">
              <Avatar
                initials={leave.employee.fullName
                  .split(" ")
                  .slice(-2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
                className="size-11 bg-primary/20 text-primary font-bold text-sm border border-primary/30"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{leave.employee.fullName}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-muted-foreground text-[11px]">
                  <span>Mã NV: <strong className="text-foreground font-mono">{leave.employee.employeeCode}</strong></span>
                  <span>•</span>
                  <span>Phòng: <strong className="text-foreground">{leave.employee.department?.name || "—"}</strong></span>
                </div>
              </div>
            </div>

            {/* Khối 2: Chi tiết kỳ nghỉ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <span className="text-muted-foreground text-[11px] block">Loại nghỉ phép</span>
                <Badge variant="outline" className="mt-1 text-xs font-semibold border-primary/40 text-primary">
                  {leaveTypeLabel(leave.type)}
                </Badge>
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <span className="text-muted-foreground text-[11px] block">Tổng số ngày nghỉ</span>
                <p className="mt-1 text-base font-bold text-foreground">
                  {leave.totalDays} <span className="text-xs font-normal text-muted-foreground">ngày</span>
                </p>
              </div>
            </div>

            {/* Thời gian nghỉ */}
            <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
              <div>
                <span className="text-muted-foreground text-[11px]">Từ ngày</span>
                <p className="font-bold text-foreground mt-0.5">{formatDateVN(leave.startDate)}</p>
              </div>
              <span className="text-muted-foreground text-sm font-bold">→</span>
              <div className="text-right">
                <span className="text-muted-foreground text-[11px]">Đến ngày</span>
                <p className="font-bold text-foreground mt-0.5">{formatDateVN(leave.endDate)}</p>
              </div>
            </div>

            {/* Phép năm còn lại */}
            <div className="rounded-xl border border-agent-teal/30 bg-agent-teal/5 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-agent-teal">
                <ShieldCheck className="size-4" />
                <span className="font-semibold">Quỹ phép năm của nhân viên</span>
              </div>
              <div>
                {loadingBalance ? (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : balance ? (
                  <span className="font-bold text-foreground">
                    {balance.remainingDays} / {balance.totalDays} ngày còn lại
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* Lý do nghỉ */}
            <div className="rounded-xl border border-border bg-muted/10 p-3">
              <span className="text-muted-foreground text-[11px] font-semibold block mb-1">
                Lý do xin nghỉ phép
              </span>
              <p className="text-foreground leading-relaxed italic bg-background/50 p-2.5 rounded-lg border border-border/50">
                &ldquo;{leave.reason}&rdquo;
              </p>
            </div>

            {/* Người duyệt / Lý do từ chối nếu có */}
            {leave.approvedBy && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-400">
                ✓ Phê duyệt bởi: <strong>{leave.approvedBy.fullName}</strong>
              </div>
            )}

            {leave.rejectionReason && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-[11px] text-rose-400">
                ✕ Lý do từ chối: <strong>{leave.rejectionReason}</strong>
              </div>
            )}

            {/* Vùng nhập lý do khi bấm từ chối */}
            {showRejectInput && (
              <div className="flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 animate-in fade-in">
                <label className="font-semibold text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" /> Nhập lý do từ chối đơn
                </label>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ghi rõ lý do từ chối để gửi thông báo đến nhân viên..."
                  className="w-full rounded-lg border border-border bg-background p-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-border pt-3">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={onClose}
              disabled={isProcessing}
            >
              Đóng
            </Button>

            {isPending && (
              <>
                {!showRejectInput ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => setShowRejectInput(true)}
                    disabled={isProcessing}
                  >
                    <XCircle className="size-3.5" /> Từ Chối
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs gap-1"
                    onClick={handleReject}
                    disabled={isProcessing || !rejectReason.trim()}
                  >
                    {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                    Xác Nhận Từ Chối
                  </Button>
                )}

                <Button
                  size="sm"
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  Phê Duyệt Đơn
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </div>
    </Dialog>
  )
}
