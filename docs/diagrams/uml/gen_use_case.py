# Sinh sơ đồ ca sử dụng (Hình 3.1) theo ký hiệu UML kiểu Visual Paradigm.
# Chạy: python docs/diagrams/uml/gen_use_case.py  -> ghi H3-01-use-case.svg
# ADMIN kế thừa EMPLOYEE (generalization): mọi chức năng của nhân viên ADMIN đều dùng được
# (portal, trợ lý AI, bài test — các route này không giới hạn role).
import pathlib

W, H = 1200, 720
RX, RY = 118, 32
FONT = "Arial, Helvetica, sans-serif"
BOX = (200, 20, 1000, 640)  # x1, y1, x2, y2

actors = {
    "A": (95, 345, ["Admin"]),
    "E": (1105, 370, ["Employee"]),
    "K": (1105, 80, ["Khách hàng", "(Slack / Zalo OA)"]),
}
L, R = 400, 800
ucs = {
    "UC2": (L, 95, ["Quản lý hồ sơ nhân sự,", "hợp đồng, onboarding"]),
    "UC3": (L, 195, ["Duyệt đơn nghỉ phép,", "làm thêm giờ"]),
    "UC4": (L, 295, ["Tính, duyệt, chi trả", "bảng lương"]),
    "UC5": (L, 395, ["Cài đặt hệ thống,", "nhật ký thay đổi"]),
    "UC6": (L, 495, ["Giám sát AI Agents,", "tiếp quản CSKH"]),
    "UC7": (L, 595, ["Phân tích kết quả", "đào tạo"]),
    "UC12": (R, 80, ["Nhắn tin chăm sóc", "khách hàng"]),
    "UC1": (R, 215, ["Đăng nhập email,", "Google, Facebook"]),
    "UC8": (R, 300, ["Chấm công GPS"]),
    "UC9": (R, 385, ["Gửi đơn nghỉ phép,", "xem phiếu lương"]),
    "UC10": (R, 470, ["Hỏi đáp nhân sự", "với trợ lý AI"]),
    "UC11": (R, 555, ["Làm bài test,", "luyện role-play"]),
}
links = [("A", u) for u in ["UC2", "UC3", "UC4", "UC5", "UC6", "UC7"]]
links += [("E", u) for u in ["UC1", "UC8", "UC9", "UC10", "UC11"]]
links += [("K", "UC12")]


def actor_svg(x, y, label):
    s = [
        f'<circle cx="{x}" cy="{y-38}" r="11"/>',
        f'<line x1="{x}" y1="{y-27}" x2="{x}" y2="{y+8}"/>',
        f'<line x1="{x-20}" y1="{y-15}" x2="{x+20}" y2="{y-15}"/>',
        f'<line x1="{x}" y1="{y+8}" x2="{x-16}" y2="{y+34}"/>',
        f'<line x1="{x}" y1="{y+8}" x2="{x+16}" y2="{y+34}"/>',
    ]
    for i, t in enumerate(label):
        s.append(f'<text x="{x}" y="{y+54+i*17}" text-anchor="middle" stroke="none" fill="#000">{t}</text>')
    return "\n".join(s)


x1, y1, x2, y2 = BOX
out = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
    f'font-family="{FONT}" font-size="14">',
    f'<rect width="{W}" height="{H}" fill="#fff"/>',
    f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" fill="#fff" stroke="#000" stroke-width="1.4"/>',
    f'<text x="{(x1+x2)//2}" y="{y1+27}" text-anchor="middle" font-weight="bold" font-size="16">Hệ thống TechHRM</text>',
    '<g stroke="#000" stroke-width="1.2" fill="none">',
]
for a, u in links:
    ax, ay, _ = actors[a]
    cx, cy, _ = ucs[u]
    sx = ax + (24 if cx > ax else -24)
    ex = cx - RX if cx > ax else cx + RX
    out.append(f'<line x1="{sx}" y1="{ay}" x2="{ex}" y2="{cy}"/>')

# Generalization ADMIN -> EMPLOYEE: đường gấp khúc dưới khung, mũi tam giác rỗng ở EMPLOYEE
ax, ay, _ = actors["A"]
exx, ey, _ = actors["E"]
gy = y2 + 40
tip = ey + 64  # ngay dưới nhãn "Employee"
out.append(f'<polyline points="{ax},{ay+70} {ax},{gy} {exx},{gy} {exx},{tip+16}"/>')
out.append(f'<polygon points="{exx},{tip} {exx-10},{tip+16} {exx+10},{tip+16}" fill="#fff"/>')
out.append("</g>")

out.append('<g fill="#FFFFE6" stroke="#8C7B3E" stroke-width="1.3">')
for cx, cy, _ in ucs.values():
    out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{RX}" ry="{RY}"/>')
out.append('</g><g text-anchor="middle" fill="#000">')
for cx, cy, lines in ucs.values():
    y0 = cy + 5 - (len(lines) - 1) * 8.5
    for i, t in enumerate(lines):
        out.append(f'<text x="{cx}" y="{y0 + i*17:.1f}">{t}</text>')
out.append("</g>")

out.append('<g stroke="#000" stroke-width="1.6" fill="#fff">')
for x, y, label in actors.values():
    out.append(actor_svg(x, y, label))
out.append("</g></svg>")

dst = pathlib.Path(__file__).resolve().parent.parent / "H3-01-use-case.svg"
dst.write_text("\n".join(out), encoding="utf-8")
print(dst)
