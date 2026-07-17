import json
import os
import re
import socket
import time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "backend" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
CONSTANTS_PATH = DATA_DIR / "constants.json"
REPORTS_DIR = ROOT / "backend" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_INDEX_PATH = DATA_DIR / "reports.json"
LOGO_PATH = ROOT / "assets" / "logo-header.jpg"

DEFAULT_CONSTANTS = {
    "networth_threshold": 1000000,
    "networth_adjustment": 0,
}

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


class ExclusiveThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        # Windows otherwise permits an older Python server to share the port.
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def read_constants():
    if not CONSTANTS_PATH.exists():
        write_constants(DEFAULT_CONSTANTS)
        return dict(DEFAULT_CONSTANTS)

    try:
        with CONSTANTS_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
            merged = {**DEFAULT_CONSTANTS, **data}
            return merged
    except Exception:
        return dict(DEFAULT_CONSTANTS)


def write_constants(constants):
    with CONSTANTS_PATH.open("w", encoding="utf-8") as f:
        json.dump(constants, f, indent=2)


def read_reports_index():
    if not REPORTS_INDEX_PATH.exists():
        write_reports_index([])
        return []

    try:
        with REPORTS_INDEX_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                cleaned = []
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    file_name = sanitize_filename(item.get("file_name", ""))
                    if not file_name:
                        continue
                    if not (REPORTS_DIR / file_name).exists():
                        continue
                    try:
                        net_worth = float(item.get("net_worth", 0) or 0)
                    except Exception:
                        net_worth = 0.0
                    cleaned.append({
                        "file_name": file_name,
                        "created_at": str(item.get("created_at", "")),
                        "client_name": str(item.get("client_name", "")),
                        "client_email": str(item.get("client_email", "")),
                        "net_worth": net_worth,
                    })
                if cleaned != data:
                    write_reports_index(cleaned)
                return cleaned
    except Exception:
        pass

    return []


def write_reports_index(items):
    with REPORTS_INDEX_PATH.open("w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)


def sanitize_filename(name):
    safe = re.sub(r"[^a-zA-Z0-9._\- ]+", "_", str(name or "report.pdf"))
    safe = re.sub(r"\s+", " ", safe).strip()
    safe = safe.rstrip(". ")
    if not safe:
        safe = "report.pdf"
    if not safe.lower().endswith(".pdf"):
        safe = f"{safe}.pdf"
    return safe


def require_admin(handler):
    password = handler.headers.get("X-Admin-Password", "")
    return password == ADMIN_PASSWORD


def pdf_escape_text(text):
    s = str(text or "")
    s = s.replace("\\", "\\\\")
    s = s.replace("(", "\\(")
    s = s.replace(")", "\\)")
    return s


def read_jpeg_info(path):
    if not path.exists():
        return None

    data = path.read_bytes()
    if len(data) < 4 or data[0] != 0xFF or data[1] != 0xD8:
        return None

    i = 2
    while i + 1 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        while i < len(data) and data[i] == 0xFF:
            i += 1
        if i >= len(data):
            break
        marker = data[i]
        i += 1
        if marker in (0xD8, 0xD9):
            continue
        if i + 1 >= len(data):
            break
        seg_len = (data[i] << 8) + data[i + 1]
        i += 2
        if seg_len < 2 or i + seg_len - 2 > len(data):
            break

        # SOF markers hold dimensions/components
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            if seg_len >= 8:
                precision = data[i]
                height = (data[i + 1] << 8) + data[i + 2]
                width = (data[i + 3] << 8) + data[i + 4]
                components = data[i + 5]
                if precision == 8 and width > 0 and height > 0:
                    return {
                        "bytes": data,
                        "width": width,
                        "height": height,
                        "components": components,
                    }
            break

        i += seg_len - 2

    return None


def build_table_pdf(payload):
    details = payload.get("details", {})
    assets_rows = payload.get("assets_rows", [])
    liabilities_rows = payload.get("liabilities_rows", [])
    loan_options_rows = payload.get("loan_options_rows", [])
    calc_rows = payload.get("calc_rows", [])
    comparison_table = payload.get("comparison_table", {})
    report_sections = payload.get("report_sections", [])
    chart_series = payload.get("chart_series", [])

    if not isinstance(report_sections, list) or not report_sections:
        report_sections = [
            {"title": "EXECUTIVE SUMMARY METRICS", "rows": assets_rows},
            {"title": "SALE & LIABILITY ANALYSIS", "rows": liabilities_rows},
            {"title": "LOAN OPTIONS / RETURNS", "rows": loan_options_rows},
            {"title": "CALCULATIONS", "rows": calc_rows},
        ]
    if not isinstance(chart_series, list):
        chart_series = []

    def money(v):
        try:
            n = float(v or 0)
        except Exception:
            n = 0
        return f"${n:,.0f}"

    def tw(text, size):
        return len(str(text or "")) * size * 0.48

    def short(text, max_chars):
        t = str(text or "")
        return t if len(t) <= max_chars else t[:max_chars - 3] + "..."

    page_w, page_h = 595, 842
    margin_x = 28
    margin_bottom = 34
    content_w = page_w - (margin_x * 2)
    table_label_w = content_w - 120
    title_h = 22
    col_h = 14
    row_h = 13

    logo_info = read_jpeg_info(LOGO_PATH)
    logo_draw_h = 62.0
    logo_draw_w = 60.0
    if logo_info:
        iw = float(logo_info.get("width", 1) or 1)
        ih = float(logo_info.get("height", 1) or 1)
        logo_draw_w = max(48.0, min(105.0, logo_draw_h * (iw / ih)))
    logo_x = page_w - margin_x - logo_draw_w
    logo_y = page_h - margin_x - logo_draw_h

    pages_ops = []
    current_ops = []
    y_cursor = 0

    def text_to(target_ops, x, y, value, size=9, bold=False):
        font = "F2" if bold else "F1"
        target_ops.append(f"BT /{font} {size} Tf {x:.2f} {y:.2f} Td ({pdf_escape_text(value)}) Tj ET")

    def line_to(target_ops, x1, y1, x2, y2):
        target_ops.append(f"{x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S")

    def rect_to(target_ops, x, y, w, h):
        target_ops.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re S")

    def draw_logo(target_ops):
        if not logo_info:
            return
        target_ops.append(
            f"q {logo_draw_w:.2f} 0 0 {logo_draw_h:.2f} {logo_x:.2f} {logo_y:.2f} cm /LGO Do Q"
        )

    def draw_header(target_ops):
        header_top = 812
        text_to(target_ops, margin_x, header_top, "DSCR Calculator - Investment Report", 14, True)
        text_to(target_ops, margin_x, header_top - 20, f"Date: {str(details.get('date', ''))}", 10, False)
        text_to(target_ops, margin_x, header_top - 36, f"Property: {str(details.get('property_name', ''))}", 10, False)
        text_to(target_ops, margin_x, header_top - 52, f"Prepared for: {str(details.get('client_name', details.get('name', '')))}", 10, False)
        text_to(target_ops, margin_x, header_top - 68, f"Email: {str(details.get('email', ''))}", 10, False)
        draw_logo(target_ops)

    def start_page():
        nonlocal current_ops, y_cursor
        if current_ops:
            pages_ops.append(current_ops)
        current_ops = []
        draw_header(current_ops)
        y_cursor = 712

    def ensure_space(required_height):
        nonlocal y_cursor
        if y_cursor - required_height < margin_bottom:
            start_page()

    def draw_table_paginated(table_title, rows):
        nonlocal y_cursor
        if not rows:
            return

        idx = 0
        continued = False
        while idx < len(rows):
            ensure_space(title_h + col_h + row_h + 10)

            # Draw section header and table column header.
            top_y = y_cursor
            current_ops.append("0.88 0.93 0.95 rg")
            current_ops.append(f"{margin_x:.2f} {top_y - title_h:.2f} {content_w:.2f} {title_h:.2f} re f")
            current_ops.append("0 0 0 rg")
            rect_to(current_ops, margin_x, top_y - title_h, content_w, title_h)
            text_to(current_ops, margin_x + 6, top_y - 14, table_title if not continued else f"{table_title} (continued)", 10, True)

            head_y = top_y - title_h
            current_ops.append("0.95 0.97 0.98 rg")
            current_ops.append(f"{margin_x:.2f} {head_y - col_h:.2f} {content_w:.2f} {col_h:.2f} re f")
            current_ops.append("0 0 0 rg")
            rect_to(current_ops, margin_x, head_y - col_h, content_w, col_h)
            line_to(current_ops, margin_x + table_label_w, head_y - col_h, margin_x + table_label_w, head_y)
            text_to(current_ops, margin_x + 6, head_y - 10, "Description", 9, True)
            text_to(current_ops, margin_x + table_label_w + 6, head_y - 10, "Value", 9, True)

            y = head_y - col_h
            rows_drawn = 0
            while idx < len(rows):
                if y - row_h < margin_bottom:
                    break
                row = rows[idx]
                label = short(str(row.get("label", "")), 78)
                display_value = row.get("display")
                value = str(display_value) if display_value is not None else money(row.get("value", 0))
                is_bold = bool(row.get("bold", False))

                rect_to(current_ops, margin_x, y - row_h, content_w, row_h)
                line_to(current_ops, margin_x + table_label_w, y - row_h, margin_x + table_label_w, y)
                text_to(current_ops, margin_x + 6, y - 9.6, label, 8.8, is_bold)
                val_x = margin_x + content_w - 6 - tw(value, 8.8)
                text_to(current_ops, val_x, y - 9.6, value, 8.8, is_bold)

                y -= row_h
                idx += 1
                rows_drawn += 1

            y_cursor = y - 12
            continued = idx < len(rows)

            # If no row could be drawn due to height, force new page to avoid loop.
            if rows_drawn == 0:
                start_page()

    def draw_comparison_table(table):
        nonlocal y_cursor
        if not isinstance(table, dict):
            return
        headers = table.get("headers", [])
        rows = table.get("rows", [])
        if not isinstance(headers, list) or not headers or not isinstance(rows, list) or not rows:
            return

        headers = headers[:11]
        rows = rows[:18]
        column_count = len(headers)
        if column_count <= 6:
            label_w = 108.0
            compare_header_h = 30
            compare_row_h = 18
            header_font = 6.8
            label_font = 7.2
            cell_font = 6.6
            row_baseline = 12
        elif column_count <= 8:
            label_w = 96.0
            compare_header_h = 28
            compare_row_h = 16
            header_font = 5.8
            label_font = 6.6
            cell_font = 5.5
            row_baseline = 10.8
        else:
            label_w = 88.0
            compare_header_h = 27
            compare_row_h = 15
            header_font = 4.9
            label_font = 5.9
            cell_font = 4.7
            row_baseline = 10

        compare_title_h = 22
        total_h = compare_title_h + compare_header_h + (len(rows) * compare_row_h)
        ensure_space(total_h + 12)

        top_y = y_cursor
        bottom_y = top_y - total_h
        value_w = (content_w - label_w) / column_count
        max_cell_chars = max(7, int(value_w / (cell_font * 0.48)))
        max_label_chars = 27 if column_count <= 6 else (23 if column_count <= 8 else 21)

        current_ops.append("0.88 0.93 0.95 rg")
        current_ops.append(f"{margin_x:.2f} {top_y - compare_title_h:.2f} {content_w:.2f} {compare_title_h:.2f} re f")
        current_ops.append("0 0 0 rg")
        rect_to(current_ops, margin_x, bottom_y, content_w, total_h)
        line_to(current_ops, margin_x, top_y - compare_title_h, margin_x + content_w, top_y - compare_title_h)
        title = short(str(table.get("title", "DSCR ANALYSIS")), 72)
        title_x = margin_x + (content_w - tw(title, 10)) / 2
        text_to(current_ops, title_x, top_y - 14, title, 10, True)

        header_top = top_y - compare_title_h
        current_ops.append("0.95 0.97 0.98 rg")
        current_ops.append(f"{margin_x:.2f} {header_top - compare_header_h:.2f} {content_w:.2f} {compare_header_h:.2f} re f")
        current_ops.append("0 0 0 rg")
        line_to(current_ops, margin_x, header_top - compare_header_h, margin_x + content_w, header_top - compare_header_h)

        x = margin_x + label_w
        line_to(current_ops, x, bottom_y, x, header_top)
        for index, header in enumerate(headers):
            if index > 0:
                line_to(current_ops, x, bottom_y, x, header_top)
            header_text = str(header)
            if header_text.startswith("Projected "):
                first_line = "Projected"
                second_line = header_text.replace("Projected ", "")
            elif header_text == "Historical T12":
                first_line = "Historical"
                second_line = "T12"
            else:
                first_line = short(header_text, max_cell_chars)
                second_line = ""
            first_x = x + (value_w - tw(first_line, header_font)) / 2
            text_to(current_ops, first_x, header_top - 10, first_line, header_font, True)
            if second_line:
                second_line = short(second_line, max_cell_chars)
                second_x = x + (value_w - tw(second_line, header_font)) / 2
                text_to(current_ops, second_x, header_top - 20, second_line, header_font, True)
            x += value_w

        row_top = header_top - compare_header_h
        for row_index, row in enumerate(rows):
            row_bottom = row_top - compare_row_h
            if row_index > 0:
                line_to(current_ops, margin_x, row_top, margin_x + content_w, row_top)
            is_bold = bool(row.get("bold", False))
            label = short(str(row.get("label", "")), max_label_chars)
            text_to(current_ops, margin_x + 4, row_top - row_baseline, label, label_font, is_bold)
            values = row.get("values", []) if isinstance(row.get("values", []), list) else []
            x = margin_x + label_w
            for value_index in range(len(headers)):
                cell = str(values[value_index]) if value_index < len(values) else ""
                cell = short(cell, max_cell_chars)
                cell_x = x + (value_w - tw(cell, cell_font)) / 2
                text_to(current_ops, cell_x, row_top - row_baseline, cell, cell_font, is_bold)
                x += value_w
            row_top = row_bottom

        y_cursor = bottom_y - 12

    def draw_chart_paginated(chart):
        nonlocal y_cursor
        values = chart.get("values", []) if isinstance(chart, dict) else []
        if not isinstance(values, list) or not values:
            return

        values = values[:10]
        chart_h = 36 + (len(values) * 18)
        ensure_space(chart_h + 12)
        top_y = y_cursor
        bottom_y = top_y - chart_h
        rect_to(current_ops, margin_x, bottom_y, content_w, chart_h)
        text_to(current_ops, margin_x + 7, top_y - 16, str(chart.get("title", "Trend")), 11, True)

        max_value = max([abs(float(item.get("value", 0) or 0)) for item in values] + [1.0])
        bar_x = margin_x + 55
        value_w = 105
        bar_w = content_w - 55 - value_w - 12

        for index, item in enumerate(values):
            row_y = top_y - 34 - (index * 18)
            numeric_value = float(item.get("value", 0) or 0)
            display_value = str(item.get("display", numeric_value))
            label = short(str(item.get("label", "")), 12)
            text_to(current_ops, margin_x + 7, row_y, label, 8.5, False)
            rect_to(current_ops, bar_x, row_y - 2, bar_w, 7)
            fill_w = max(1.0, (abs(numeric_value) / max_value) * bar_w)
            current_ops.append("0.18 0.42 0.50 rg")
            current_ops.append(f"{bar_x:.2f} {row_y - 2:.2f} {fill_w:.2f} 7.00 re f")
            current_ops.append("0 0 0 rg")
            text_to(current_ops, bar_x + bar_w + 7, row_y, display_value, 8.5, False)

        y_cursor = bottom_y - 12

    start_page()
    draw_comparison_table(comparison_table)
    first_section = report_sections[0] if report_sections else None
    if isinstance(first_section, dict):
        draw_table_paginated(str(first_section.get("title", "SUMMARY")), first_section.get("rows", []))

    if chart_series:
        start_page()
        for chart in chart_series:
            draw_chart_paginated(chart)
        start_page()

    for section in report_sections[1:]:
        if not isinstance(section, dict):
            continue
        draw_table_paginated(str(section.get("title", "CALCULATIONS")), section.get("rows", []))

    if current_ops:
        pages_ops.append(current_ops)

    page_count = len(pages_ops)
    for page_index, page_ops in enumerate(pages_ops, start=1):
        footer = f"Page {page_index} of {page_count}"
        footer_x = (page_w - tw(footer, 8)) / 2
        text_to(page_ops, footer_x, 18, footer, 8, False)

    page_streams = [("\n".join(page_ops)).encode("latin-1", errors="replace") for page_ops in pages_ops]
    objects = []

    def add_obj(content):
        objects.append(content)
        return len(objects)

    font1 = add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font2 = add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    logo_obj_id = None
    if logo_info:
        components = int(logo_info.get("components", 3))
        color_space = "/DeviceRGB"
        extra = ""
        if components == 1:
            color_space = "/DeviceGray"
        elif components == 4:
            color_space = "/DeviceCMYK"
            extra = " /Decode [1 0 1 0 1 0 1 0]"
        logo_stream = logo_info["bytes"].decode("latin-1", errors="replace")
        logo_obj_id = add_obj(
            f"<< /Type /XObject /Subtype /Image /Width {int(logo_info['width'])} /Height {int(logo_info['height'])} "
            f"/ColorSpace {color_space} /BitsPerComponent 8 /Filter /DCTDecode{extra} /Length {len(logo_info['bytes'])} >>\n"
            f"stream\n{logo_stream}\nendstream"
        )
    content_ids = []
    for s in page_streams:
        content_ids.append(add_obj(f"<< /Length {len(s)} >>\nstream\n{s.decode('latin-1', errors='replace')}\nendstream"))

    pages_id = add_obj("PENDING_PAGES")
    page_ids = []
    for content_id in content_ids:
        xobj_part = ""
        if logo_obj_id:
            xobj_part = f" /XObject << /LGO {logo_obj_id} 0 R >>"
        page_id = add_obj(
            f"<< /Type /Page /Parent {pages_id} 0 R "
            f"/Resources << /Font << /F1 {font1} 0 R /F2 {font2} 0 R >>{xobj_part} >> "
            f"/MediaBox [0 0 {page_w} {page_h}] /Contents {content_id} 0 R >>"
        )
        page_ids.append(page_id)

    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>"
    catalog = add_obj(f"<< /Type /Catalog /Pages {pages_id} 0 R >>")

    out = bytearray()
    out.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{i} 0 obj\n{obj}\nendobj\n".encode("latin-1", errors="replace"))
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("latin-1"))
    out.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog} 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF"
        ).encode("latin-1")
    )
    return bytes(out)


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Allow embedding in iframe environments (for example, GHL) and cross-origin API calls.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
        self.send_header("Content-Security-Policy", "frame-ancestors *")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _send_pdf_bytes(self, file_path):
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Disposition", f'attachment; filename="{file_path.name}"')
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"ok": True})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/constants":
            self._send_json(200, {"constants": read_constants()})
            return

        if path == "/api/reports":
            if not require_admin(self):
                self._send_json(401, {"error": "Unauthorized"})
                return
            self._send_json(200, {"reports": read_reports_index()})
            return

        if path.startswith("/api/reports/"):
            if not require_admin(self):
                self._send_json(401, {"error": "Unauthorized"})
                return
            file_name = unquote(path.replace("/api/reports/", "", 1))
            safe_name = sanitize_filename(file_name)
            target = REPORTS_DIR / safe_name
            if not target.exists():
                self._send_json(404, {"error": "Report not found"})
                return
            self._send_pdf_bytes(target)
            return

        return super().do_GET()

    def do_PUT(self):
        if self.path != "/api/constants":
            self._send_json(404, {"error": "Not found"})
            return

        if not require_admin(self):
            self._send_json(401, {"error": "Unauthorized"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)

        try:
            body = json.loads(raw_body.decode("utf-8"))
            constants = body.get("constants", {})
            sanitized = {}

            for key, default_value in DEFAULT_CONSTANTS.items():
                value = constants.get(key, default_value)
                sanitized[key] = float(value)

            write_constants(sanitized)
            self._send_json(200, {"constants": sanitized})
        except Exception:
            self._send_json(400, {"error": "Invalid request body"})

    def do_DELETE(self):
        if self.path != "/api/reports":
            self._send_json(404, {"error": "Not found"})
            return

        if not require_admin(self):
            self._send_json(401, {"error": "Unauthorized"})
            return

        deleted_count = 0
        for item in REPORTS_DIR.iterdir():
            if item.is_file() and item.suffix.lower() == ".pdf":
                try:
                    item.unlink()
                    deleted_count += 1
                except Exception:
                    continue

        write_reports_index([])
        self._send_json(200, {"ok": True, "deleted": deleted_count})

    def do_POST(self):
        if self.path not in ["/api/reports", "/api/reports/generate"]:
            self._send_json(404, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)

        try:
            body = json.loads(raw_body.decode("utf-8"))
            meta = body.get("meta", {})
            if self.path == "/api/reports/generate":
                file_name = sanitize_filename(body.get("file_name", "report.pdf"))
                pdf_bytes = build_table_pdf(body.get("payload", {}))
            else:
                file_name = sanitize_filename(body.get("file_name", "report.pdf"))
                pdf_base64 = body.get("pdf_base64", "")
                if not pdf_base64:
                    self._send_json(400, {"error": "Missing pdf_base64"})
                    return
                import base64
                pdf_bytes = base64.b64decode(pdf_base64)

            timestamp = int(time.time())
            final_name = sanitize_filename(f"{timestamp}_{file_name}")
            target = REPORTS_DIR / final_name
            target.write_bytes(pdf_bytes)

            reports = read_reports_index()
            reports.insert(0, {
                "file_name": final_name,
                "created_at": datetime.utcnow().isoformat() + "Z",
                "client_name": meta.get("client_name", ""),
                "client_email": meta.get("client_email", ""),
                "net_worth": float(meta.get("net_worth", 0) or 0),
            })
            write_reports_index(reports[:500])

            if self.path == "/api/reports/generate":
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Length", str(len(pdf_bytes)))
                self.send_header("Content-Disposition", f'attachment; filename="{file_name}"')
                self.send_header("X-Report-File", file_name)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password")
                self.end_headers()
                self.wfile.write(pdf_bytes)
            else:
                self._send_json(200, {"ok": True, "file_name": final_name})
        except Exception:
            self._send_json(400, {"error": "Invalid request body"})


if __name__ == "__main__":
    host = "0.0.0.0"
    port = int(os.getenv("PORT", "8000"))
    print(f"Serving on http://{host}:{port}")
    ExclusiveThreadingHTTPServer((host, port), AppHandler).serve_forever()
