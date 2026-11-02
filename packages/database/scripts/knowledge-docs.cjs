/**
 * knowledge-docs.cjs — Nguồn tri thức chính sách nhân sự cho RAG (WF02).
 * Mỗi document sẽ được chunk và embedding vào bảng policy_chunks.
 */
const DOCUMENTS = [
  {
    title: "Quy chế lương, thưởng và làm thêm giờ",
    source: "QUY CHE LD 2024 - MUC 3",
    body: `Công ty áp dụng lương khoán theo vị trí, chi trả vào ngày 05 của tháng kế tiếp. Ngày công chuẩn mỗi tháng là 22 ngay cong (176 gio).
Làm thêm giờ được tính như sau: ngày thường x1.5 lần (tối đa 4 gio/ngay, 40 gio/thang), ngày nghỉ hằng tuần x2.0 lần, ngày lễ tết x3.0 lần theo Luat Lao dong 2019 (Điều 98).
Nhân viên phải có phê duyệt của quản lý trực tiếp trước khi làm OT; OT không phê duyệt sẽ không được tính lương thêm giờ.
Thưởng tháng lương thứ 13 (tháng 13) áp dụng cho nhân viên làm việc đủ 12 tháng, mức tối thiểu 1 tháng lương cơ bản, tối đa 3 tháng tùy kết quả kinh doanh.
Thưởng nóng (spot award) từ 500.000đ đến 5.000.000đ dành cho đóng góp đột xuất, được quản lý phòng đề xuất và HR Admin phê duyệt.`,
  },
  {
    title: "Bảo hiểm xã hội, y tế, thất nghiệp",
    source: "QUY CHE LD 2024 - MUC 5",
    body: `Mức đóng bảo hiểm bắt buộc tính trên lương đóng bảo hiểm: BHXH 8% (người lao động), BHYT 1.5%, BHTN 1%. Công ty đóng tương ứng 17.5%, 3%, 1%.
Người lao động đóng tổng cộng 10.5% lương đóng bảo hiểm vào các khoản trên.
Phép ốm kéo dài được hưởng trợ cấp BHXH theo thông tư 56/2022: 30 ngày đầu hưởng 75% mức đóng, từ ngày 31 trở đi hưởng 65%.
Thai sản: nữ nghỉ 6 tháng, được hưởng 100% mức lương đóng BHXH từ quỹ BHXH, cộng thêm 1 tháng lương trợ cấp từ công ty.
Nhân viên được khám sức khỏe định kỳ 1 lần/năm do công ty tài trợ tại bệnh viện đối tác.`,
  },
  {
    title: "Thuế thu nhập cá nhân",
    source: "THUE TNCN - HUONG DAN NHAN SU",
    body: `Thuế thu nhập cá nhân tính theo biểu lũy tiến 7 bac: 5% (đến 5 triệu), 10% (5-10tr), 15% (10-18tr), 20% (18-32tr), 25% (32-52tr), 30% (52-80tr), 35% (trên 80 triệu) tính trên thu nhập tính thuế mỗi tháng.
Giảm trừ gia cảnh: 11.000.000đ/tháng cho bản thân và 4.400.000đ/tháng cho mỗi người phụ thuộc (mức áp dụng từ năm tính thuế 2024 theo Nghị định 94/2025).
Các khoản giảm trừ khác: BHXH bắt buộc 100%, bảo hiểm tự nguyện, quỹ hưu trí, khoản đóng góp từ thiện.
Công ty kê khai và nộp thuế TNCN thay nhân viên hàng tháng; cuối năm quyết toán thuế trước 31/03. Nhân viên cung cấp đầy đủ chứng từ người phụ thuộc trước 30/11 để được giảm trừ.`,
  },
  {
    title: "Chế độ nghỉ phép và ngày nghỉ",
    source: "QUY CHE LD 2024 - MUC 4",
    body: `Phép năm cơ bản là 12 ngày làm việc mỗi năm dương lịch (01/01 - 31/12) cho nhân viên làm đủ 12 tháng.
Nhân viên mới vào làm trong năm được tính phép theo tỷ lệ số tháng làm việc thực tế (pro-rate: 12 x số tháng làm việc / 12, tháng vào làm tính trọn 1 tháng). Công ty áp dụng mức chuẩn 12 ngày/năm cố định, không áp dụng bất kỳ cơ chế cộng thêm ngày phép nào khác (không cộng thêm ngày phép theo mốc 5 năm thâm niên cống hiến, không chuyển phép dư năm trước sang năm sau).
Nghỉ lễ tết: 11 ngày lễ trong năm theo Luật Lao động; nếu ngày lễ trùng cuối tuần được nghỉ bù ngày kế tiếp.
Phép ốm ngắn ngày (1-2 ngày) cần giấy khám bệnh hoặc xác nhận của phòng khám; ngày ốm không trừ vào phép năm.
Phép năm chưa sử dụng hết trong năm sẽ hết hiệu lực vào cuối ngày 31/12 (không chuyển sang năm sau). Xin nghỉ phép gửi trên hệ thống ít nhất 3 ngày làm việc trước, trừ trường hợp khẩn cấp.`,
  },
  {
    title: "Quy trình chăm sóc khách hàng và leo thang khiếu nại",
    source: "QUY TRINH CSKH 2024",
    body: `Bot AI CSKH tiếp nhận tin nhắn khách hàng 24/7 qua kênh tin nhắn chính thức. Bot chỉ trả lời các vấn đề trong phạm vi: tra cứu bảo hành, hướng dẫn sử dụng, thông tin sản phẩm, chính sách đổi trả thông thường.
Các trường hợp bot PHAI chuyển cho nhân viên xử lý (escalation): khiếu nại nghiêm trọng, yêu cầu bồi thường, đòi gặp quản lý, mời chào cạnh tranh, vấn đề pháp lý, khách tức giận cấp độ cao.
Khi bot chuyển phiên, tin nhắn của khách xuất hiện ngay trên bảng Cảnh Báo CSKH; chuyên viên tiếp quản và trả lời trong giờ hành chính, thời gian phản hồi mục tiêu 2 giờ làm việc.
Sau khi xử lý xong, chuyên viên bấm Bật lại bot để AI tiếp tục phục vụ phiên; toàn bộ lịch sử được lưu để phục vụ kiểm tra chất lượng.
Chất lượng CSKH đo bằng: thời gian phản hồi đầu tiên, tỷ lệ escalation, mức độ hài lòng cuối phiên.`,
  },
  {
    title: "Nội quy chấm công và làm việc tại văn phòng",
    source: "NOI QUY LD - MUC 2",
    body: `Giờ làm việc: thứ Hai đến thứ Sáu, 8:00 - 17:30, nghỉ trưa 12:00 - 13:30. Làm việc linh hoạt đầu giờ sáng (đến sớm về sớm) tối đa 45 phút.
Nhân viên check-in/check-out qua ứng dụng nhân viên (Employee Portal) với định vị GPS: phải ở trong bán kính văn phòng để check-in hợp lệ. Bán kính mặc định 200 mét, quản trị cấu hình được trong trang Cai Dat.
Quên check-in khai bổ sung trong vòng 3 ngày, được quản lý phê duyệt. Check-in giúp (giúp người khác check-in) là vi phạm nghiêm trọng nội quy.
Đi muộn: muộn dưới 30 phút tính 0.5 ngày công trừ lương nếu quá 3 lần/tháng. Vắng mặt không phép 3 ngày liên tiếp bị xem là bỏ việc theo Điều 125 Luat Lao dong.`,
  },
  {
    title: "Onboarding nhân viên mới và thử việc",
    source: "QUY TRINH NS - ONBOARDING",
    body: `Thử việc tối đa 60 ngày (2 tháng), mức lương thử việc 85% lương chính thức. Kết thúc thử việc quản lý đánh giá: đạt → ký hợp đồng chính thức, không đạt → gia hạn tối đa 1 lần hoặc kết thúc.
Trong 7 ngày đầu: nhân viên nhận tài khoản hệ thống (email công ty, portal), được chỉ định buddy hướng dẫn, hoàn thành checklist onboarding trên hệ thống.
Nhiệm vụ onboarding bắt buộc: ký hợp đồng lao động, cung cấp chứng từ bảo hiểm, hoàn thành đào tạo an toàn thông tin, tham gia buổi giới thiệu công ty vào thứ Hai tuần đầu.
Đào tạo hội nhập: văn hóa công ty, quy định nhân sự (RAG tra cứu chính sách trên AI Assistant), an toàn PII - nhân viên không chia sẻ dữ liệu cá nhân của đồng nghiệp ra ngoài hệ thống.`,
  },
  {
    title: "Loại hợp đồng lao động và ký kết",
    source: "HDLD - QUY DINH CHUNG",
    body: `Ba loại hợp đồng: hợp đồng xác định thời hạn 12-36 tháng, không xác định thời hạn (cho nhân viên ký 2 kỳ cố định trở lên), hợp đồng theo nhiệm vụ/từng việc.
Hợp đồng thử việc riêng biệt tối đa 30 ngày với vị trí dưới quản lý, 60 ngày với vị trí đòi hỏi trình độ đại học trở lên.
Đơn xin nghỉ việc: nhân viên ký hợp đồng xác định thời hạn báo trước 30 ngày, hợp đồng không xác định thời hạn báo trước 45 ngày.
Hợp đồng được ký điện tử trên hệ thống, có giá trị pháp lý như bản cứng. Mọi phụ lục thay đổi lương, chức danh phải có phụ lục hợp đồng đính kèm.`,
  },
  {
    title: "Bảo mật dữ liệu nhân sự và che giấu thông tin cá nhân",
    source: "AN TOAN THONG TIN - PII",
    body: `Dữ liệu cá nhân (PII) bao gồm: số CCCD/căn cước, số điện thoại, email cá nhân, địa chỉ nhà, số tài khoản ngân hàng, lương chi tiết của người khác.
Hệ thống AI tự động che giấu (mask) PII trong tin nhắn trước khi gửi tới mô hình AI: số CCCD thành ***-****, số điện thoại thành ******99, email thành d***@domain. Toàn bộ bản gốc vẫn lưu an toàn trong database để tra cứu khi cần.
Nhân viên chỉ được xem lương, hồ sơ của bản thân. Admin/HR được xem dữ liệu phòng ban phục vụ công tác quản lý; mọi truy xuất bất thường đều ghi audit log.
Tuyệt đối không xuất dữ liệu khách hàng/nhân viên ra ngoài hệ thống, không chụp màn hình dữ liệu lương chia sẻ mạng xã hội. Vi phạm xử lý kỷ luật đến mức chấm dứt hợp đồng.`,
  },
  {
    title: "Đăng ký làm thêm giờ và phê duyệt",
    source: "QUY TRINH OT",
    body: `Quy trình OT 4 bước: (1) nhân viên tạo đề nghị OT trên portal nêu lý do và thời gian; (2) quản lý trực tiếp phê duyệt trong 24 giờ; (3) sau khi làm OT, chấm công đối chiếu tự động; (4) kỳ lương kế tiếp hiển thị tiền OT trong phiếu lương.
Hạn mức OT: không quá 40 giờ/tháng và 200 giờ/năm theo Luat Lao dong 2019 (có thể tăng tối đa 60 giờ/tháng theo nghị quyết đại diện người lao động).
OT phải đăng ký TRƯỚC; trường hợp khẩn cấp đăng ký sau tối đa 2 ngày làm việc kèm xác nhận quản lý.
Các phòng ban hạn chế OT sau 22:00; nhân viên nữ mang thai không được làm OT và đêm theo quy định.`,
  },
];

module.exports = { DOCUMENTS };
