/**
 * Sửa các tin nhắn demo bị hỏng encoding tiếng Việt (ký tự U+FFFD "�").
 *
 * Chạy:
 *   node scripts/fix-corrupted-chat-encoding.cjs          # dry-run
 *   node scripts/fix-corrupted-chat-encoding.cjs --apply  # ghi DB
 *
 * Đây là dữ liệu test bị nhập sai charset, không phải lỗi font:
 * Inter/JetBrains Mono đều có subset vietnamese; chuỗi gốc đã mất byte
 * trước khi lưu DB nên không thể khôi phục tự động.
 */
const { PrismaClient } = require('@prisma/client')

const p = new PrismaClient()
const apply = process.argv.includes('--apply')

const MESSAGE_FIXES = [
  { id: 'cmw0jg4f50011tljkbjyle0su', content: 'lương tháng này của tôi bao nhiêu' },
  { id: 'cmw0jclr0000xtljkzouwpi9c', content: 'tôi muốn khiếu nại về dịch vụ' },
  { id: 'cmw0j74jt000ntljkjiok4899', content: 'lương của tôi tháng này' },
  { id: 'cmw0j2ayq000jtljkheunuft0', content: 'lương của tôi tháng này' },
  { id: 'cmw0j1kyx000btljkibxil6rt', content: 'lương của tôi tháng này' },
  { id: 'cmw0ikvuv000ftlf43nhhavpm', content: 'lương của tôi tháng này' },
]

// id -> nội dung đúng; giữ nguyên prefix "[Thong tin nguoi dung...]" nếu có
const HISTORY_FIXES = [
  { id: 241, content: 'tôi muốn khiếu nại về dịch vụ' },
  { id: 237, content: 'lương của tôi tháng này', keepPrefix: true },
  { id: 235, content: 'lương của tôi tháng này' },
]

async function main() {
  let changed = 0

  for (const fix of MESSAGE_FIXES) {
    const row = await p.aiChatMessage.findUnique({ where: { id: fix.id } })
    if (!row) {
      console.log(`[skip] message ${fix.id} not found`)
      continue
    }
    const metadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? { ...row.metadata }
        : row.metadata
    if (metadata && typeof metadata === 'object' && 'maskedMessage' in metadata) {
      metadata.maskedMessage = fix.content
    }
    console.log(`[message] ${fix.id}: ${JSON.stringify(row.content)} -> ${JSON.stringify(fix.content)}`)
    if (apply) {
      await p.aiChatMessage.update({
        where: { id: fix.id },
        data: { content: fix.content, metadata },
      })
    }
    changed++
  }

  for (const fix of HISTORY_FIXES) {
    const rows = await p.$queryRawUnsafe(
      `SELECT id, message FROM n8n_chat_histories WHERE id = $1`,
      fix.id,
    )
    const row = rows[0]
    if (!row) {
      console.log(`[skip] history ${fix.id} not found`)
      continue
    }
    const message = { ...row.message }
    const old = String(message.content ?? '')
    const prefix = fix.keepPrefix ? old.slice(0, old.indexOf('\n\n') + 2) : ''
    message.content = `${prefix}${fix.content}`
    console.log(`[history] ${fix.id}: ${JSON.stringify(old.slice(-60))} -> ${JSON.stringify(message.content)}`)
    if (apply) {
      await p.$executeRawUnsafe(
        `UPDATE n8n_chat_histories SET message = $1::jsonb WHERE id = $2`,
        JSON.stringify(message),
        fix.id,
      )
    }
    changed++
  }

  console.log(`\n${apply ? 'APPLIED' : 'DRY-RUN'}: ${changed} bản ghi`)
  await p.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await p.$disconnect()
  process.exit(1)
})
