import {
  uid,
  minutes,
  duration,
  clock,
  flightKey,
  validateFlight,
  mergeRoster,
  statistics,
  dutySummary,
  restoreBackup,
  archiveRecord,
  restoreRecord,
  csvCell,
  reminders,
  validDate,
} from "./lib/domain.js";
import {
  parseRoster,
  parseAircraft,
  families,
  icaoFor,
} from "./lib/parsers.js";
import { sampleState, sampleRoster, sampleAOC } from "./lib/sample.js";
import { readState, writeState } from "./lib/storage.js";
import { evaluateRules } from "./lib/rules.js";
import { extractPDF, extractImage, asDataURL } from "./lib/importers.js";
const paths = {
  plane: "m22 2-7 20-4-9-9-4Z M22 2 11 13",
  calendar:
    "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  book: "M4 3h7a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H3V3Z M14 6a3 3 0 0 1 3-3h4v16h-4a4 4 0 0 0-3 2",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  stats: "M3 3v18h18 M7 14v3 M12 9v8 M17 5v12",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2",
  plus: "M12 5v14 M5 12h14",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 14v6h16v-6",
  camera: "M4 6h4l2-3h4l2 3h4v15H4Z M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  chevron: "m9 5 7 7-7 7",
  left: "m15 5-7 7 7 7",
  search: "M21 21l-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12 M6 18 18 6",
  shield: "m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z M8 12l3 3 5-6",
  cloud: "M5 17a5 5 0 0 1 0-10 7 7 0 0 1 13-1 5 5 0 0 1 1 11H5",
  moon: "M20 14A9 9 0 0 1 10 4a9 9 0 1 0 10 10",
  download: "M12 3v13 M7 11l5 5 5-5 M4 17v4h16v-4",
  info: "M12 11v6 M12 7v.1 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  pin: "M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13Z M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  edit: "m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5",
  file: "M14 2H4v20h16V8Z M14 2v6h6 M8 13h8 M8 17h5",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.plane}"/></svg>`;
const e = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal");
let state,
  tab = "schedule",
  month = "2026-10",
  day = "2026-10-09",
  view = "calendar",
  query = "",
  logFilter = "all",
  saving = false,
  importPreview = null,
  imageAttachment = null,
  imageIsSample = false,
  notificationShown = new Set();
const titles = {
  schedule: "Lịch bay",
  logbook: "Logbook",
  crew: "Crew / People",
  statistics: "Statistics",
  settings: "Account / Settings",
};
const tabs = [
  ["schedule", "calendar", "Lịch bay"],
  ["logbook", "book", "Logbook"],
  ["crew", "people", "Crew Book"],
  ["statistics", "stats", "Statistics"],
  ["settings", "settings", "Settings"],
];
const find = (id) => state.flights.find((f) => f.id === id);
const shortDate = (d) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
const fullDate = (d) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
const getFlights = () => state.flights.filter((f) => f.date.startsWith(month));
const statusPill = (f) =>
  `<span class="pill ${f.confirmed ? "green" : Object.keys(f.actual || {}).length ? "amber" : "gray"}"><i class="dot"></i>${f.confirmed ? "Actual đã xác nhận" : Object.keys(f.actual || {}).length ? "Actual nháp" : "Scheduled"}</span>`;
const btn = (action, text, ico, cls = "", extra = "") =>
  `<button class="btn ${cls}" data-action="${action}" ${extra}>${ico ? icon(ico) : ""}${text}</button>`;
function toast(text) {
  const t = document.querySelector("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => t.classList.remove("show"), 3800);
}
function error(text) {
  const target = modal.open ? modal.querySelector("[data-error]") : null;
  if (target) {
    target.textContent = text;
    target.hidden = false;
  } else toast(text);
}
async function commit(next, message) {
  if (saving) throw Error("Đang lưu, vui lòng chờ");
  saving = true;
  try {
    await writeState(next);
    state = next;
    if (message) toast(message);
  } finally {
    saving = false;
  }
}
function openModal(title, body, footer = "") {
  modal.innerHTML = `<div class="modal-head"><h2>${title}</h2><button class="iconbtn" data-action="close" aria-label="Đóng">${icon("close")}</button></div>${body}<div class="modal-footer">${footer || btn("close", "Đóng", null, "ghost")}</div>`;
  if (!modal.open) modal.showModal();
}
const input = (name, label, value = "", type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
const select = (name, label, value, options) =>
  `<label>${label}<select name="${name}">${options.map(([v, t]) => `<option value="${e(v)}" ${value === v ? "selected" : ""}>${e(t)}</option>`).join("")}</select></label>`;
const toUTC = (value) =>
  value ? new Date(value + "Z").toISOString() : undefined;
const timeInput = (name, label, t) =>
  input(name, label, t?.slice(0, 16) || "", "datetime-local");
function render() {
  const fs = getFlights(),
    s = statistics(fs);
  const nav = tabs
    .map(
      ([id, ico, title]) =>
        `<button data-action="tab" data-tab="${id}" class="${tab === id ? "active" : ""}" ${tab === id ? 'aria-current="page"' : ""}>${icon(ico)}<span>${title}</span>${id === "schedule" ? `<span class="num">${String(fs.length).padStart(2, "0")}</span>` : ""}</button>`,
    )
    .join("");
  app.innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brandmark">${icon("plane")}</span>AviLog<span style="color:#d6f58b">.</span></div><div class="nav-caption">YOUR FLIGHT COMPANION</div><nav class="nav" aria-label="Điều hướng">${nav}</nav><div class="sidebar-bottom"><div class="plan-card"><strong>${icon("shield")} Your logbook, your story.</strong><p>Lịch bay, giờ bay và những người đồng hành. Gọn trong một nơi.</p>${btn("plan", "Free preview ↗", null, "small")}</div><button class="profile iconbtn" style="width:100%;height:auto;text-align:left;display:flex" data-action="tab" data-tab="settings"><span class="avatar">${e((state.settings.name || "P").slice(0, 2).toUpperCase())}</span><span><strong>${e(state.settings.name || "Pilot")}</strong><small>Personal workspace</small></span>${icon("settings")}</button></div></aside><section class="workspace"><header class="topbar"><div class="breadcrumbs">Workspace <span>/</span> <strong>${titles[tab]}</strong></div><div class="mobile-brand"><span class="brandmark">${icon("plane")}</span>AviLog.</div><div class="top-actions"><span class="utc-clock mono" id="utc-clock">${new Date().toISOString().slice(11, 16)} <b>UTC</b></span><button class="iconbtn notification-btn" data-action="reminders" aria-label="Thông báo">${icon("bell")}</button><span class="avatar">${e((state.settings.name || "P").slice(0, 2).toUpperCase())}</span></div></header><main class="main"><div class="page-heading"><div><div style="display:flex;gap:10px;align-items:center"><h1>${titles[tab]}</h1><span class="badge-preview">PREVIEW</span></div><p>${{ schedule: "Mỗi hành trình, một câu chuyện. Sẵn sàng cho chuyến bay tiếp theo.", logbook: "Ghi lại hành trình. Giữ trọn từng phút bay.", crew: "Những người đồng hành trên mỗi chuyến bay.", statistics: "Một góc nhìn rõ hơn về hành trình của bạn.", settings: "Thiết lập không gian bay của riêng bạn." }[tab]}</p></div><div class="actions">${["schedule", "logbook"].includes(tab) ? `${btn("import", "Import roster", "upload")}${btn("add", "Thêm chuyến bay", "plus", "primary")}` : tab === "crew" ? btn("add-person", "Thêm người", "plus", "primary") : tab === "statistics" ? btn("csv", "Xuất CSV", "download") : ""}</div></div>${tab === "schedule" ? schedule(fs, s) : tab === "logbook" ? logbook(fs, s) : tab === "crew" ? crew() : tab === "statistics" ? statsPage(fs, s) : settingsPage()}<footer class="footer"><span>${icon("shield")} Lưu riêng trên thiết bị · All times in UTC · AviLog preview v0.1</span><span>Made for the journey, logged for you.</span></footer></main></section><nav class="bottom-nav" aria-label="Điều hướng mobile">${nav}</nav></div>`;
}
function metrics(s) {
  return `<div class="metrics"><div class="metric featured"><div class="metric-top">Block time ${icon("clock")}</div><div class="metric-value mono">${duration(s.block)}<small>hrs</small></div><div class="metric-foot">${icon("check")} Actual đã xác nhận</div></div><div class="metric"><div class="metric-top">Airborne time ${icon("plane")}</div><div class="metric-value mono">${duration(s.airborne)}<small>hrs</small></div><div class="metric-foot">OFF → ON · UTC</div></div><div class="metric"><div class="metric-top">Sectors ${icon("pin")}</div><div class="metric-value">${String(s.sectors).padStart(2, "0")}<small>flights</small></div><div class="metric-foot">${s.pf} PF <span>·</span> ${s.pm} PM</div></div><div class="metric"><div class="metric-top">Night time ${icon("moon")}</div><div class="metric-value mono">${duration(s.night)}<small>hrs</small></div><div class="metric-foot">Night time nhập thủ công</div></div></div>`;
}
function monthControls() {
  return `<div class="month-controls"><h2>${new Date(month + "-01T12:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</h2><button class="iconbtn" data-action="month-prev" aria-label="Tháng trước">${icon("left")}</button><button class="iconbtn" data-action="month-next" aria-label="Tháng sau">${icon("chevron")}</button><button class="btn small ghost" data-action="today">Hôm nay</button></div>`;
}
function schedule(fs, s) {
  return `${metrics(s)}<div class="schedule-grid"><section class="panel"><div class="calendar-toolbar">${monthControls()}<div class="view-switch"><button class="${view === "calendar" ? "active" : ""}" data-action="view" data-view="calendar">Tháng</button><button class="${view === "list" ? "active" : ""}" data-action="view" data-view="list">Danh sách</button></div></div>${view === "calendar" ? calendar(fs) : flightTable(fs)}<div class="calendar-footer"><div class="legend"><span><b></b> Scheduled</span><span><b class="actual"></b> Confirmed actual</span></div><span>Giờ hiển thị: UTC</span></div></section><section class="panel day-panel">${dayPanel()}</section></div><div class="below-grid"><div class="import-card"><div class="import-icon">${icon("camera")}</div><div><h3>Hạ cánh. Chụp lại. Hoàn tất.</h3><p>Nhập giờ thực tế từ ảnh MCDU / AOC FLT LOG.<br>Luôn kiểm tra và xác nhận trước khi lưu.</p></div>${btn("image", "Nhập từ ảnh ↗", null)}</div><div class="storage-note"><strong>${icon("cloud")} Personal, by design.</strong>Dữ liệu lưu trên trình duyệt này. Xuất backup thường xuyên để giữ lại hành trình.</div></div>${state.demo ? `<div class="welcome"><span>${icon("info")} Đang xem dữ liệu mẫu · tháng 10/2026. Crew là nhân vật giả.</span>${btn("fresh", "Bắt đầu logbook riêng", null, "small ghost")}</div>` : ""}`;
}
function calendar(fs) {
  const date = new Date(month + "-01T00:00Z"),
    start = new Date(+date - ((date.getUTCDay() + 6) % 7) * 86400000),
    today = new Date().toISOString().slice(0, 10),
    count =
      Math.ceil(
        (((date.getUTCDay() + 6) % 7) +
          new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
          ).getUTCDate()) /
          7,
      ) * 7;
  let html = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    .map((d) => `<div class="weekday">${d}</div>`)
    .join("");
  for (let n = 0; n < count; n++) {
    const d = new Date(+start + n * 86400000).toISOString().slice(0, 10),
      flights = state.flights.filter((f) => f.date === d),
      duties = state.duties.filter((a) => a.date === d && a.type !== "FLIGHT");
    html += `<button class="day ${!d.startsWith(month) ? "outside" : ""} ${d === day ? "selected" : ""} ${d === today ? "today" : ""}" data-action="day" data-day="${d}" aria-label="${d}, ${flights.length} chuyến bay" ${d === day ? 'aria-pressed="true"' : ""}><span class="day-number">${Number(d.slice(-2))}</span>${flights
      .slice(0, 2)
      .map(
        (f) =>
          `<span class="cal-flight ${f.confirmed ? "confirmed" : ""}"><span class="flight-code">${e(f.flightNo)}<br></span>${e(f.dep)}–${e(f.dest)}</span>`,
      )
      .join(
        "",
      )}${flights.length > 2 ? `<span class="cal-more">+${flights.length - 2} chuyến</span>` : ""}${duties.map((d) => `<span class="cal-more">${e(d.type)}</span>`).join("")}</button>`;
  }
  return `<div class="calendar">${html}</div>`;
}
function dayPanel() {
  const fs = state.flights
      .filter((f) => f.date === day)
      .sort((a, b) =>
        (a.scheduled?.out || "").localeCompare(b.scheduled?.out || ""),
      ),
    duties = state.duties.filter((d) => d.date === day);
  return `<div class="panel-head"><div><h3>${fullDate(day)}</h3><div class="day-label">${fs.length} sectors <span>·</span> ${shortDate(day)} <span>·</span> UTC</div></div><button class="iconbtn" data-action="duty" data-id="${e(duties[0]?.id || "")}" aria-label="Thêm hoặc sửa duty">${icon("clock")}</button></div>${
    fs.length
      ? fs
          .map((f) => {
            const times = f.confirmed ? f.actual : f.scheduled;
            return `<article class="day-route"><div class="flight-top"><strong>${e(f.flightNo)} <span class="muted tiny">· ${e(f.aircraft || "—")}</span></strong>${statusPill(f)}</div><div class="route-line"><span class="airport">${e(f.dep)}</span><span class="route-connector">${icon("plane")}</span><span class="airport">${e(f.dest)}</span></div><div class="flight-times"><b class="mono">${clock(times?.out)}</b><span class="muted mono">${duration(minutes(times?.out, times?.in))}${times?.in?.slice(0, 10) > f.date ? " · +1d" : ""}</span><b class="mono">${clock(times?.in)}</b></div><div class="flight-bottom"><button class="text-button" data-action="edit" data-id="${e(f.id)}">${f.confirmed ? "Xem logbook" : "Ghi Actual"} ${icon("arrow")}</button><button class="text-button" data-action="weather" data-id="${e(f.id)}">${icon("cloud")} METAR / TAF</button></div></article>`;
          })
          .join("")
      : `<div class="empty">${icon("calendar")}<p>Chưa có chuyến bay ngày này.</p>${btn("add", "Thêm chuyến bay", "plus", "small ghost")}</div>`
  }${duties
    .map((d) => {
      const all = state.duties
          .filter((x) => x.report)
          .sort((a, b) => a.report.localeCompare(b.report)),
        idx = all.findIndex((x) => x.id === d.id),
        summary = dutySummary(
          d,
          state.flights,
          idx > 0
            ? [...all.slice(0, idx)].sort((a, b) =>
                (b.release || "").localeCompare(a.release || ""),
              )[0]
            : null,
        );
      return `<div class="duty-strip">${icon("clock")}<span>${e(d.type)} · ${d.report ? clock(d.report) + " → " + clock(d.release) : "Chưa nhập report/release"}<br>${d.report && d.release ? "Duty " + duration(summary.minutes) : "Chưa tính Duty"}${summary.rest !== null ? (summary.rest < 0 ? " · CHỒNG DUTY " : " · Rest ") + duration(Math.abs(summary.rest)) : ""}</span><button class="text-button" style="margin-left:auto" data-action="duty" data-id="${e(d.id)}">Sửa</button></div>`;
    })
    .join(
      "",
    )}<div class="ftl-note">${icon("info")}<div>FTL: chưa có bộ quy định.<br><button data-action="rules">Xem căn cứ</button></div></div>`;
}
function flightTable(fs) {
  const filtered = fs
    .filter(
      (f) =>
        (f.flightNo + " " + f.dep + " " + f.dest)
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (logFilter === "all" ||
          (logFilter === "confirmed" ? f.confirmed : !f.confirmed)),
    )
    .sort((a, b) =>
      (a.scheduled?.out || a.date).localeCompare(b.scheduled?.out || b.date),
    );
  return filtered.length
    ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Ngày / Flight</th><th>Hành trình</th><th>Scheduled · UTC</th><th>Actual · UTC</th><th>Block / Air</th><th>Trạng thái</th><th></th></tr></thead><tbody>${filtered.map((f) => `<tr><td><span class="tiny muted">${shortDate(f.date)}</span><br><strong>${e(f.flightNo)}</strong></td><td class="route-col">${e(f.dep)} <span class="muted">→</span> ${e(f.dest)}<br><span class="tiny muted">${e(f.aircraft)} · ${e(f.reg || "Reg chưa ghi")}</span></td><td class="mono">${clock(f.scheduled?.out)}–${clock(f.scheduled?.in)}${(f.scheduled?.dep && f.scheduled.dep !== f.dep) || (f.scheduled?.dest && f.scheduled.dest !== f.dest) ? '<br><span class="tiny">' + e(f.scheduled.dep) + " → " + e(f.scheduled.dest) + "</span>" : ""}${f.scheduled?.in?.slice(0, 10) > f.date ? " +1d" : ""}</td><td class="mono">${clock(f.actual?.out)}–${clock(f.actual?.in)}${f.actual?.in?.slice(0, 10) > f.date ? " +1d" : ""}</td><td class="mono">${f.confirmed ? duration(minutes(f.actual.out, f.actual.in)) + " / " + duration(minutes(f.actual.off, f.actual.on)) : "—"}</td><td>${statusPill(f)}</td><td><button class="iconbtn" data-action="edit" data-id="${e(f.id)}" aria-label="Sửa ${e(f.flightNo)}">${icon("edit")}</button></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">${icon("book")}<p>Không có chuyến bay phù hợp.</p></div>`;
}
function logbook(fs, s) {
  return `${metrics(s)}<section class="panel"><div class="panel-head">${monthControls()}<div class="actions wrap"><div class="searchbar">${icon("search")}<input data-filter="search" value="${e(query)}" placeholder="Tìm flight, sân bay…" aria-label="Tìm chuyến bay"></div><select data-filter="status" aria-label="Lọc trạng thái"><option value="all" ${logFilter === "all" ? "selected" : ""}>Tất cả</option><option value="confirmed" ${logFilter === "confirmed" ? "selected" : ""}>Đã xác nhận</option><option value="pending" ${logFilter === "pending" ? "selected" : ""}>Chờ Actual</option></select></div></div>${flightTable(fs)}</section><div class="below-grid"><div class="import-card"><div class="import-icon">${icon("camera")}</div><div><h3>Giờ bay từ ảnh FLT LOG</h3><p>A320 / A321 parser · kiểm tra trước khi xác nhận.</p></div>${btn("image", "Nhập từ ảnh", "camera")}</div></div>`;
}
function crew() {
  return `<div class="wide-note">Crew Book chỉ tổng hợp những chuyến có Actual đã xác nhận. Chọn Captain, FO và crew trong từng chuyến để kết nối lịch sử.</div><div class="crew-grid">${
    state.people
      .map((p) => {
        const fs = state.flights.filter((f) =>
            [f.captainId, f.foId, ...(f.crewIds || [])].includes(p.id),
          ),
          s = statistics(fs),
          last = fs
            .filter((f) => f.confirmed)
            .sort((a, b) => b.date.localeCompare(a.date))[0];
        return `<article class="crew-card"><div style="display:flex;justify-content:space-between"><div class="avatar">${e(
          p.name
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join(""),
        )}</div><button class="iconbtn" data-action="edit-person" data-id="${e(p.id)}" aria-label="Sửa ${e(p.name)}">${icon("edit")}</button></div><h3>${e(p.name)}</h3><span class="pill gray">${e(p.rank)}</span><div class="crew-stats"><span><b>${s.sectors}</b>sectors</span><span><b class="mono">${duration(s.block)}</b>block hrs</span></div><p>${last ? "Lần gần nhất: " + shortDate(last.date) + " · " + e(last.dep) + " → " + e(last.dest) : "Chưa có chuyến đã xác nhận cùng nhau."}<br>${e(p.note || "")}</p>${btn("crew-history", "Xem lịch sử ↗", null, "small ghost", `data-id="${e(p.id)}"`)}</article>`;
      })
      .join("") || '<div class="empty">Chưa có người trong Crew Book.</div>'
  }</div>`;
}
function bars(entries, format = duration) {
  const max = Math.max(1, ...entries.map((x) => x[1]));
  return `<div class="bars">${entries.map(([name, n]) => `<div class="bar-row"><span>${e(name)}</span><div class="bar-track"><div style="width:${Math.round((n / max) * 100)}%"></div></div><b class="mono">${format(n)}</b></div>`).join("") || '<div class="empty">Chưa có Actual đã xác nhận.</div>'}</div>`;
}
function statsPage(fs, s) {
  return `${metrics(s)}<div class="panel" style="margin-bottom:20px"><div class="panel-head">${monthControls()}<span class="pill gray">Confirmed actual only</span></div></div><div class="two-columns"><section class="panel"><div class="panel-head"><h3>Aircraft type</h3>${icon("plane")}</div>${bars(Object.entries(s.aircraft))}</section><section class="panel"><div class="panel-head"><h3>PF / PM & thao tác</h3>${icon("stats")}</div>${bars(
    [
      ["PF", s.pf],
      ["PM", s.pm],
      ["Takeoff", s.takeoffs],
      ["Landing", s.landings],
    ],
    String,
  )}</section><section class="panel"><div class="panel-head"><h3>Airports · số lượt</h3>${icon("pin")}</div>${bars(Object.entries(s.airports), String)}</section><section class="panel"><div class="panel-head"><h3>Crew · block time</h3>${icon("people")}</div>${bars(state.people.map((p) => [p.name, statistics(fs.filter((f) => [f.captainId, f.foId, ...(f.crewIds || [])].includes(p.id))).block]))}</section></div><div class="wide-note" style="margin-top:20px">PIC ${duration(s.pic)} · SIC ${duration(s.sic)} · Night ${duration(s.night)}. PIC và Night do bạn nhập và xác nhận; simulator/training không cộng vào line flying.</div>`;
}
function settingsPage() {
  const s = state.settings;
  return `<div class="settings-grid"><section class="panel settings-card"><h3>Personal workspace</h3><p class="muted">Không cần tài khoản công ty. Dữ liệu thuộc trình duyệt này và chưa đồng bộ giữa các thiết bị.</p><form id="settings-form"><div class="form-grid">${input("name", "Tên hiển thị", s.name, "text", 'maxlength="60" required')}${input("base", "Home base (IATA)", s.base, "text", 'maxlength="4"')}<label>Múi giờ dữ liệu<input value="UTC · không đổi" disabled></label><label>Gói sử dụng<input value="Free Preview" disabled></label></div><hr class="divider"><h3>Nhắc lịch</h3>${[
    [
      "tomorrow",
      "Lịch ngày mai",
      "Hiện thông báo lịch ngày mai theo ngày UTC.",
    ],
    [
      "beforeDuty",
      "Trước report / duty",
      "Cần nhập giờ report trong từng duty.",
    ],
    [
      "missingActual",
      "Chưa ghi giờ thực tế",
      "Chuyến kết thúc dự kiến hơn 30 phút, chưa có Actual xác nhận.",
    ],
  ]
    .map(
      ([key, title, desc]) =>
        `<div class="toggle-row"><div><strong>${title}</strong><p>${desc}</p></div><input type="checkbox" name="${key}" ${s[key] ? "checked" : ""} aria-label="${title}"></div>`,
    )
    .join(
      "",
    )}<div class="form-grid">${input("leadMinutes", "Nhắc trước report (phút)", s.leadMinutes, "number", 'min="5" max="1440" required')}${input("eveningHour", "Giờ nhắc tối hôm trước (UTC)", s.eveningHour, "number", 'min="0" max="23" required')}</div><div class="actions"><button class="btn primary" type="submit">${icon("check")}Lưu cài đặt</button>${btn("notifications", s.notifications ? "Tắt thông báo" : "Bật thông báo trình duyệt", "bell")}</div></form><div class="source-card">Preview kiểm tra reminder khi app đang mở. Chưa có push nền khi app đã đóng. Trên iOS, cài PWA bằng Share → Add to Home Screen; quyền thông báo tùy phiên bản và trình duyệt.</div></section><div><section class="panel settings-card"><h3>Backup & export</h3><p class="muted">Backup JSON gồm chuyến bay, crew, cài đặt và ảnh. Giữ file này ở nơi riêng tư. Restore gộp dữ liệu và giữ Actual đã xác nhận hiện có.</p><div class="actions">${btn("backup", "Backup JSON", "download")}${btn("csv", "Export CSV", "file")}${btn("restore", "Restore backup", "upload")}${btn("trash", "Thùng rác (" + (state.trash || []).length + ")", null, "ghost")}</div></section><section class="panel settings-card" style="margin-top:20px"><h3>Duty / Rest & FTL</h3><p class="muted">Theo dõi thời lượng thực tế. Chưa có giới hạn FTL Vietnam Airlines được cài đặt.</p><div class="actions">${btn("rules", "Xem căn cứ", "shield")}${btn("duty-list", "Danh sách duty", "clock")}</div></section><section class="panel settings-card" style="margin-top:20px"><h3>Free / Pro</h3><p class="muted">Chỗ dành cho gói Pro và quảng cáo sau này. Preview chưa có thanh toán hoặc quảng cáo thật.</p><div class="actions">${btn("plan", "Thông tin preview ↗", null, "ghost")}${state.demo ? btn("fresh", "Bắt đầu logbook riêng", null, "ghost") : ""}</div></section></div></div>`;
}
function editFlight(original, imported) {
  const f = structuredClone(
      imported ||
        original || {
          id: uid(),
          date: day,
          flightNo: "",
          dep: state.settings.base || "SGN",
          dest: "",
          aircraft: "A321",
          scheduled: {},
          actual: {},
          role: "PM",
          picMinutes: 0,
          nightMinutes: 0,
          source: "manual",
          confidence: 100,
        },
    ),
    old = original || find(f.id);
  const people = [
    ["", "Chưa chọn"],
    ["self", "Tôi"],
    ...state.people.map((p) => [p.id, p.name]),
  ];
  const by = [
    ["", "Chưa ghi"],
    ["self", "Tôi"],
    ["captain", "Captain"],
    ["fo", "First Officer"],
    ["other", "Crew khác"],
  ];
  const body = `<form id="flight-form" data-id="${e(f.id)}"><div class="modal-body"><p>${imported ? "Đã đọc từ ảnh. Hãy kiểm tra từng ô và ngày UTC trước khi xác nhận." : "Scheduled và Actual được lưu riêng. Chuyến qua ngày cần ngày UTC đúng cho từng mốc."}</p>${old?.confirmed ? '<div class="wide-note" style="margin-top:12px">Actual hiện đã xác nhận. Cần tích đồng ý thay Actual nếu bạn sửa giờ thực tế.</div>' : ""}<div class="form-grid">${input("date", "Ngày chuyến bay · UTC", f.date, "date", "required")}${input("flightNo", "Flight number", f.flightNo, "text", 'required maxlength="12"')}${input("dep", "Departure · IATA / ICAO", f.dep, "text", 'required maxlength="4"')}${input("dest", "Destination · IATA / ICAO", f.dest, "text", 'required maxlength="4"')}${select(
    "aircraft",
    "Aircraft type",
    f.aircraft || "",
    [
      ["", "Chưa ghi"],
      ["A320", "A320"],
      ["A321", "A321"],
      ["B787", "B787"],
      ["A350", "A350"],
      ["OTHER", "Khác"],
    ],
  )}${input("reg", "Aircraft registration", f.reg || "", "text", 'maxlength="20"')}</div><div class="form-section"><span>Scheduled · UTC</span><span class="pill gray">Kế hoạch</span></div><div class="form-grid">${input("s_dep", "Scheduled DEP", f.scheduled?.dep || f.dep, "text", 'maxlength="4"')}${input("s_dest", "Scheduled DEST", f.scheduled?.dest || f.dest, "text", 'maxlength="4"')}${timeInput("s_out", "Departure (OUT)", f.scheduled?.out)}${timeInput("s_in", "Arrival (IN)", f.scheduled?.in)}</div><div class="form-section"><span>Actual · UTC</span><span class="pill green">OUT / OFF / ON / IN</span></div><div class="form-grid">${timeInput("a_out", "OUT · off blocks", f.actual?.out)}${timeInput("a_off", "OFF · takeoff", f.actual?.off)}${timeInput("a_on", "ON · landing", f.actual?.on)}${timeInput("a_in", "IN · on blocks", f.actual?.in)}</div><div id="actual-summary" class="event-summary"></div><div class="form-section"><span>Crew & pilot role</span></div><div class="form-grid">${select("captainId", "Captain", f.captainId || "", people)}${select("foId", "First Officer", f.foId || "", people)}${select(
    "role",
    "Vai trò",
    f.role,
    [
      ["PF", "PF · Pilot Flying"],
      ["PM", "PM · Pilot Monitoring"],
    ],
  )}${select("landingMode", "Landing mode", f.landingMode || "manual", [
    ["manual", "Manual"],
    ["autoland", "Autoland"],
  ])}${select("takeoffBy", "Takeoff by", f.takeoffBy || "", by)}${select("landingBy", "Landing by", f.landingBy || "", by)}${input("picMinutes", "PIC time (phút)", f.picMinutes || 0, "number", 'min="0" max="1440"')}${input("nightMinutes", "Night time (phút) · nhập thủ công", f.nightMinutes || 0, "number", 'min="0" max="1440"')}<label class="full">Crew khác<select name="crewIds" multiple size="3">${state.people.map((p) => `<option value="${e(p.id)}" ${(f.crewIds || []).includes(p.id) ? "selected" : ""}>${e(p.name)}</option>`).join("")}</select></label></div><div class="form-section"><span>Source & evidence</span><span class="pill gray">${e(f.confidence ?? 100)}% confidence</span></div><div class="form-grid">${input("source", "Nguồn", f.source || "manual", "text", 'maxlength="120"')}${input("confidence", "Độ tin cậy (%)", f.confidence ?? 100, "number", 'min="0" max="100"')}<label class="full">Note<textarea name="note" rows="2" maxlength="3000">${e(f.note || "")}</textarea></label><label class="full">Ảnh minh chứng · JPG/PNG/WebP ≤ 6 MB<input type="file" name="evidence" accept="image/jpeg,image/png,image/webp"></label></div>${imported?.attachment || old?.attachment ? `<img class="image-preview" src="${safeImage(imported?.attachment || old.attachment)}" alt="Ảnh minh chứng"><label class="check"><input type="checkbox" name="removeAttachment">Bỏ ảnh khỏi chuyến này</label>` : ""}<div style="margin-top:20px;display:grid;gap:12px"><label class="check"><input type="checkbox" name="confirmed" ${f.confirmed ? "checked" : ""}>Tôi đã kiểm tra và xác nhận Actual (đủ 4 mốc)</label>${old?.confirmed ? '<label class="check"><input type="checkbox" name="replaceConfirmed">Cho phép thay đổi Actual đã xác nhận của chuyến này</label>' : ""}</div><div class="error" data-error hidden></div></div></form>`;
  openModal(
    imported
      ? "Kiểm tra Actual từ ảnh"
      : old
        ? "Chi tiết chuyến bay"
        : "Thêm chuyến bay",
    body,
    `${old ? btn("archive-flight", "Bỏ chuyến", null, "ghost danger", `data-id="${e(old.id)}"`) : ""}${btn("close", "Hủy", null, "ghost")}<button class="btn primary" type="submit" form="flight-form">${icon("check")}Lưu chuyến bay</button>`,
  );
  const form = modal.querySelector("form");
  form._original = old;
  form._imported = imported;
  form.addEventListener("input", actualSummary);
  actualSummary();
  form.addEventListener("submit", saveFlight);
}
function safeImage(value) {
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
    value || "",
  )
    ? value
    : "";
}
function actualSummary() {
  const form = modal.querySelector("#flight-form");
  if (!form) return;
  const f = new FormData(form);
  try {
    const a = Object.fromEntries(
      ["out", "off", "on", "in"].map((k) => [k, toUTC(f.get("a_" + k))]),
    );
    document.querySelector("#actual-summary").innerHTML =
      `<div>Block · OUT → IN<strong class="mono">${a.out && a.in ? duration(minutes(a.out, a.in)) : "—"}</strong></div><div>Airborne · OFF → ON<strong class="mono">${a.off && a.on ? duration(minutes(a.off, a.on)) : "—"}</strong></div>`;
  } catch {}
}
async function saveFlight(ev) {
  ev.preventDefault();
  const form = ev.currentTarget,
    fd = new FormData(form);
  try {
    const old = form._original,
      imported = form._imported,
      actual = {};
    for (const k of ["out", "off", "on", "in"])
      if (fd.get("a_" + k)) actual[k] = toUTC(fd.get("a_" + k));
    const f = {
      ...(old || {}),
      id: form.dataset.id,
      date: fd.get("date"),
      flightNo: fd.get("flightNo").toUpperCase().replace(/\s/g, ""),
      dep: fd.get("dep").toUpperCase(),
      dest: fd.get("dest").toUpperCase(),
      aircraft: fd.get("aircraft"),
      reg: fd.get("reg"),
      scheduled: {
        ...(old?.scheduled || {}),
        dep: fd.get("s_dep").toUpperCase(),
        dest: fd.get("s_dest").toUpperCase(),
        out: toUTC(fd.get("s_out")),
        in: toUTC(fd.get("s_in")),
      },
      actual,
      confirmed: fd.has("confirmed"),
      captainId: fd.get("captainId"),
      foId: fd.get("foId"),
      crewIds: fd.getAll("crewIds"),
      role: fd.get("role"),
      landingMode: fd.get("landingMode"),
      takeoffBy: fd.get("takeoffBy"),
      landingBy: fd.get("landingBy"),
      picMinutes: Number(fd.get("picMinutes")),
      nightMinutes: Number(fd.get("nightMinutes")),
      note: fd.get("note"),
      source: fd.get("source"),
      confidence: Number(fd.get("confidence")),
      updatedAt: new Date().toISOString(),
      attachment: imported?.attachment || old?.attachment,
    };
    if (
      old?.confirmed &&
      (JSON.stringify(old.actual) !== JSON.stringify(actual) ||
        !f.confirmed ||
        [
          "dep",
          "dest",
          "aircraft",
          "reg",
          "source",
          "role",
          "takeoffBy",
          "landingBy",
          "landingMode",
          "picMinutes",
          "nightMinutes",
          "captainId",
          "foId",
        ].some((k) => (old[k] ?? "") !== (f[k] ?? "")) ||
        JSON.stringify(old.crewIds || []) !==
          JSON.stringify(f.crewIds || [])) &&
      !fd.has("replaceConfirmed")
    )
      throw Error(
        "Actual đã xác nhận được bảo vệ. Tích cho phép thay đổi để tiếp tục.",
      );
    if (
      state.flights.some((x) => x.id !== f.id && flightKey(x) === flightKey(f))
    )
      throw Error("Chuyến này đã có trong ngày. Mở chuyến cũ để ghi Actual.");
    validateFlight(f);
    if (f.captainId && f.captainId === f.foId)
      throw Error("Captain và First Officer cần khác nhau.");
    const file = fd.get("evidence");
    if (file?.size) {
      if (
        file.size > 6 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw Error("Ảnh JPG/PNG/WebP tối đa 6 MB");
      f.attachment = await asDataURL(file);
    }
    if (fd.has("removeAttachment")) delete f.attachment;
    const next = structuredClone(state),
      i = next.flights.findIndex((x) => x.id === f.id);
    if (i < 0) next.flights.push(f);
    else next.flights[i] = f;
    await commit(next, "Đã lưu chuyến bay");
    month = f.date.slice(0, 7);
    day = f.date;
    modal.close();
    render();
  } catch (err) {
    error(err.message);
  }
}
function importRoster() {
  importPreview = null;
  openModal(
    "Import month plan",
    `<div class="modal-body"><div class="steps"><b>01 · Đọc file</b><span>→</span><b>02 · Kiểm tra</b><span>→</span><span>03 · Lưu Scheduled</span></div><p>PDF được đọc trên thiết bị. Lịch mới chỉ cập nhật Scheduled; Actual đã ghi được giữ nguyên. Chuyến không xuất hiện trong file mới sẽ không tự bị xóa.</p><div class="file-zone">${icon("upload")}<strong>Chọn month-plan PDF</strong><input id="roster-file" type="file" accept="application/pdf"><span class="tiny muted">PDF có lớp chữ · tối đa 20 MB / 60 trang</span></div><div class="progress" id="import-progress"></div><div class="form-grid">${input("roster-month", "Tháng / năm của roster", month, "month", 'id="roster-month" required')}</div><div class="form-section"><span>Văn bản nhận được · có thể chỉnh sửa</span>${btn("roster-sample", "Dùng mẫu 09/10", null, "small ghost")}</div><textarea id="roster-text" rows="7" placeholder="09/10 VN7388 SGN-DLI 07:14-08:06&#10;VN7389 DLI-SGN 08:40-09:30"></textarea><p class="tiny muted" style="margin-top:9px">Parser preview hỗ trợ dòng ngày/tháng + VNxxxx + DEP-DEST + HH:MM-HH:MM (UTC). Bố cục khác cần sửa văn bản về định dạng này.</p><div class="error" data-error hidden></div><div id="roster-preview"></div></div>`,
    `${btn("close", "Hủy", null, "ghost")}${btn("roster-parse", "Đọc & xem trước", "arrow", "primary")}`,
  );
  modal.querySelector("#roster-file").onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    setImportBusy(true);
    try {
      modal.querySelector("#roster-text").value = await extractPDF(
        file,
        importProgress,
      );
      toast("Đã đọc PDF. Kiểm tra văn bản trước khi phân tích.");
    } catch (err) {
      error(err.message);
    } finally {
      setImportBusy(false);
    }
  };
}
function importProgress(text) {
  const el = modal.querySelector("#import-progress");
  if (el) el.textContent = text;
}
function setImportBusy(busy) {
  for (const b of modal.querySelectorAll('button[data-action$="parse"]'))
    b.disabled = busy;
}
function previewRoster() {
  try {
    const parsed = parseRoster(
      modal.querySelector("#roster-text").value,
      modal.querySelector("#roster-month").value,
    );
    if (!parsed.flights.length)
      throw Error(
        "Chưa nhận ra chuyến nào. Sửa dòng về định dạng mẫu, rồi đọc lại.",
      );
    importPreview = parsed.flights;
    const merge = mergeRoster(state.flights, parsed.flights);
    modal.querySelector("#roster-preview").innerHTML =
      `<div class="form-section"><span>${parsed.flights.length} chuyến cần kiểm tra</span><span class="pill amber">Chưa lưu</span></div>${parsed.unrecognized.length ? `<div class="source-card">${parsed.unrecognized.length} dòng chưa nhận diện:<br>${parsed.unrecognized.slice(0, 6).map(e).join("<br>")}<br>Kiểm tra lại file gốc để tránh sót chuyến / hoạt động.</div>` : ""}<div class="wide-note" style="margin-top:12px">${merge.changes.filter((x) => x.type === "new").length} mới · ${merge.changes.filter((x) => x.type === "updated").length} đổi lịch · ${merge.changes.filter((x) => x.type === "unchanged").length} không đổi. Không xóa chuyến bị thiếu.</div><form id="roster-review">${parsed.flights.map((f, i) => `<div class="import-row" data-row="${i}"><div class="import-row-head"><strong>${e(f.flightNo)} · ${e(f.dep)} → ${e(f.dest)}</strong><span class="pill gray">${merge.changes[i].type}</span></div><div class="form-grid">${input("date", "Ngày UTC", f.date, "date", "required")}${input("flightNo", "Flight", f.flightNo, "text", "required")}${input("dep", "DEP", f.dep, "text", "required")}${input("dest", "DEST", f.dest, "text", "required")}${timeInput("out", "Scheduled OUT", f.scheduled.out)}${timeInput("in", "Scheduled IN", f.scheduled.in)}</div></div>`).join("")}</form><label class="check" style="margin-top:15px"><input id="roster-confirm" type="checkbox">Tôi đã đối chiếu ngày, route và giờ UTC với file gốc.</label>`;
    modal.querySelector(".modal-footer").innerHTML =
      `${btn("close", "Hủy", null, "ghost")}${btn("roster-parse", "Đọc lại", null)}${btn("roster-save", "Xác nhận Scheduled", "check", "primary")}`;
    modal.querySelector("[data-error]").hidden = true;
    modal
      .querySelector("#roster-preview")
      .scrollIntoView({ block: "start", behavior: "smooth" });
  } catch (err) {
    error(err.message);
  }
}
async function saveRoster() {
  try {
    if (!modal.querySelector("#roster-confirm")?.checked)
      throw Error("Cần xác nhận đã kiểm tra với nguồn trước khi lưu.");
    const rows = [...modal.querySelectorAll("[data-row]")].map((row) => {
      const get = (name) => row.querySelector(`[name="${name}"]`).value;
      const f = {
        ...importPreview[Number(row.dataset.row)],
        date: get("date"),
        flightNo: get("flightNo").toUpperCase().replace(/\s/g, ""),
        dep: get("dep").toUpperCase(),
        dest: get("dest").toUpperCase(),
        scheduled: { out: toUTC(get("out")), in: toUTC(get("in")) },
      };
      validateFlight(f);
      return f;
    });
    const m = mergeRoster(state.flights, rows),
      next = { ...state, flights: m.flights };
    await commit(next, "Đã cập nhật Scheduled · Actual được giữ nguyên");
    month = rows[0].date.slice(0, 7);
    day = rows[0].date;
    modal.close();
    render();
  } catch (err) {
    error(err.message);
  }
}
function imageImport(targetId) {
  imageAttachment = null;
  imageIsSample = false;
  openModal(
    "Nhập từ ảnh FLT LOG",
    `<div class="modal-body"><div class="steps"><b>01 · Chọn ảnh</b><span>→</span><b>02 · OCR</b><span>→</span><span>03 · Xác nhận</span></div><p>Ảnh được đọc cục bộ. OCR có thể đọc sai chữ/số; không có dữ liệu nào tự lưu. Lần dùng đầu cần mạng để tải mô hình nhận dạng tiếng Anh.</p><div class="form-grid">${select(
      "family",
      "Aircraft family",
      "A320",
      Object.entries(families).map(([k, v]) => [k, v.label]),
    )}${input("image-date", "Ngày OUT · UTC", targetId ? find(targetId).date : day, "date", 'id="image-date" required')}</div><div class="file-zone">${icon("camera")}<strong>Chụp hoặc chọn MCDU / AOC FLT LOG</strong><input type="file" id="image-file" accept="image/jpeg,image/png,image/webp" capture="environment"><span class="tiny muted">JPG / PNG / WebP · tối đa 6 MB</span></div><div id="image-evidence"></div><div class="progress" id="import-progress"></div><div class="form-section"><span>Văn bản OCR · sửa khi cần</span>${btn("image-sample", "Dùng dữ liệu mẫu", null, "small ghost")}</div><textarea id="image-text" rows="8" placeholder="VN0605 VVTS VTBS&#10;OUT 04:29&#10;OFF 04:39&#10;ON 05:50&#10;IN 06:00"></textarea><div class="error" data-error hidden></div></div>`,
    `${btn("close", "Hủy", null, "ghost")}${btn("image-parse", "Xem trước Actual", "arrow", "primary", targetId ? `data-id="${e(targetId)}"` : "")}`,
  );
  modal.querySelector("#image-file").onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    imageIsSample = false;
    setImportBusy(true);
    try {
      if (file.size > 6 * 1024 * 1024) throw Error("Ảnh tối đa 6 MB");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw Error("Dùng JPG/PNG/WebP");
      imageAttachment = await asDataURL(file);
      modal.querySelector("#image-evidence").innerHTML =
        `<img class="image-preview" src="${safeImage(imageAttachment)}" alt="Ảnh FLT LOG đang nhập">`;
      modal.querySelector("#image-text").value = await extractImage(
        file,
        importProgress,
      );
      importProgress("OCR xong. Kiểm tra văn bản và bấm Xem trước.");
    } catch (err) {
      error(err.message);
    } finally {
      setImportBusy(false);
    }
  };
}
function previewImage(targetId) {
  try {
    const f = parseAircraft(
      modal.querySelector("#image-text").value,
      modal.querySelector('[name="family"]').value,
      modal.querySelector("#image-date").value,
    );
    const old = targetId
      ? find(targetId)
      : state.flights.find((x) => flightKey(x) === flightKey(f));
    const imported = {
      ...(old || {}),
      ...f,
      id: old?.id || f.id,
      dep: f.dep || old?.dep || "",
      dest: f.dest || old?.dest || "",
      aircraft: old?.aircraft || f.aircraft,
      role: old?.role || f.role,
      picMinutes: old?.picMinutes || 0,
      nightMinutes: old?.nightMinutes || 0,
      scheduled: old?.scheduled || {},
      attachment: imageAttachment || old?.attachment,
      source: imageIsSample ? "sample text · A320/A321" : f.source,
    };
    editFlight(old, imported);
  } catch (err) {
    error(err.message);
  }
}
function personEditor(id) {
  const p = state.people.find((x) => x.id === id) || {
    id: uid(),
    name: "",
    rank: "Captain",
    note: "",
  };
  openModal(
    "Crew profile",
    `<form id="person-form"><div class="modal-body"><p>Chỉ lưu thông tin cần thiết. Không cần mã nhân viên hoặc liên hệ cá nhân.</p><div class="form-grid">${input("name", "Tên / nickname", p.name, "text", 'required maxlength="80"')}${select(
      "rank",
      "Vai trò",
      p.rank,
      [
        ["Captain", "Captain"],
        ["FO", "First Officer"],
        ["Crew", "Cabin / Other crew"],
      ],
    )}<label class="full">Ghi chú<textarea name="note" maxlength="1000">${e(p.note)}</textarea></label></div><div class="error" data-error hidden></div></div></form>`,
    `${btn("close", "Hủy", null, "ghost")}<button class="btn primary" type="submit" form="person-form">Lưu profile</button>`,
  );
  modal.querySelector("form").onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      const fd = new FormData(ev.currentTarget),
        next = structuredClone(state),
        i = next.people.findIndex((x) => x.id === p.id),
        data = {
          ...p,
          name: fd.get("name").trim(),
          rank: fd.get("rank"),
          note: fd.get("note"),
        };
      if (!data.name) throw Error("Nhập tên hoặc nickname");
      if (i < 0) next.people.push(data);
      else next.people[i] = data;
      await commit(next, "Đã lưu crew");
      modal.close();
      render();
    } catch (err) {
      error(err.message);
    }
  };
}
function crewHistory(id) {
  const p = state.people.find((x) => x.id === id);
  const fs = state.flights.filter((f) =>
    [f.captainId, f.foId, ...(f.crewIds || [])].includes(id),
  );
  openModal(
    "Lịch sử · " + e(p.name),
    `<div class="modal-body"><p>${fs.length} chuyến đã gán crew này. Tổng giờ chỉ cộng Actual xác nhận.</p>${flightTable(fs)}</div>`,
  );
}
function dutyEditor(id) {
  const d = state.duties.find((x) => x.id === id) || {
    id: uid(),
    date: day,
    type: "FLIGHT",
    report: "",
    release: "",
    note: "",
  };
  openModal(
    "Duty & Rest",
    `<form id="duty-form"><div class="modal-body"><p>Nhập report / release thực tế hoặc kế hoạch bạn muốn theo dõi. Chưa áp dụng giới hạn FTL hãng.</p><div class="form-grid">${input("date", "Ngày duty", d.date, "date", "required")}${select(
      "type",
      "Loại hoạt động",
      d.type,
      [
        "FLIGHT",
        "STANDBY",
        "RESERVE",
        "DAY OFF",
        "POSITIONING",
        "SIM",
        "TRAINING",
      ].map((x) => [x, x]),
    )}${timeInput("report", "Report / Start · UTC", d.report)}${timeInput("release", "Release / End · UTC", d.release)}<label class="full">Ghi chú<textarea name="note" rows="3" maxlength="1000">${e(d.note)}</textarea></label><label class="full">Gom các chuyến vào duty này<select multiple size="5" name="flightIds">${state.flights.map((f) => `<option value="${e(f.id)}" ${f.dutyId === d.id || (f.dutyId === undefined && f.date === d.date && d.type === "FLIGHT") ? "selected" : ""}>${f.date} · ${e(f.flightNo)} ${e(f.dep)}-${e(f.dest)}</option>`).join("")}</select></label></div><div class="error" data-error hidden></div></div></form>`,
    `${state.duties.some((x) => x.id === d.id) ? btn("archive-duty", "Bỏ duty", null, "ghost danger", `data-id="${e(d.id)}"`) : ""}${btn("close", "Hủy", null, "ghost")}<button class="btn primary" type="submit" form="duty-form">Lưu duty</button>`,
  );
  modal.querySelector("form").onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      const fd = new FormData(ev.currentTarget),
        item = {
          id: d.id,
          date: validDate(fd.get("date")),
          type: fd.get("type"),
          report: toUTC(fd.get("report")) || "",
          release: toUTC(fd.get("release")) || "",
          note: fd.get("note"),
        };
      if (item.report && item.release && minutes(item.report, item.release) < 0)
        throw Error("Release phải sau report. Kiểm tra ngày UTC.");
      const ids = fd.getAll("flightIds");
      if (item.type !== "FLIGHT" && ids.length)
        throw Error(
          "Chỉ gom chuyến line flying vào FLIGHT duty; bỏ chọn chuyến cho loại hoạt động này.",
        );
      const next = structuredClone(state),
        i = next.duties.findIndex((x) => x.id === d.id);
      if (i < 0) next.duties.push(item);
      else next.duties[i] = item;
      next.flights = next.flights.map((f) =>
        ids.includes(f.id)
          ? { ...f, dutyId: d.id }
          : f.dutyId === d.id ||
              (f.dutyId === undefined &&
                f.date === d.date &&
                d.type === "FLIGHT")
            ? { ...f, dutyId: null }
            : f,
      );
      await commit(next, "Đã lưu duty");
      day = item.date;
      month = day.slice(0, 7);
      modal.close();
      render();
    } catch (err) {
      error(err.message);
    }
  };
}
function dutyList() {
  openModal(
    "Duty & Rest tracking",
    `<div class="modal-body"><p>SIM / training / positioning được theo dõi riêng, không cộng vào block hoặc sectors line flying.</p>${
      [...state.duties]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(
          (d) =>
            `<div class="notice-item"><div>${icon("clock")}</div><div><strong>${shortDate(d.date)} · ${e(d.type)}</strong>${clock(d.report)} → ${clock(d.release)} UTC<br>${e(d.note)}</div>${btn("duty", "Sửa", null, "small", `data-id="${e(d.id)}"`)}</div>`,
        )
        .join("") || '<div class="empty">Chưa có duty.</div>'
    }</div>`,
    `${btn("close", "Đóng", null, "ghost")}${btn("duty", "Thêm duty", "plus", "primary")}`,
  );
}
async function weather(id) {
  const f = find(id);
  const stations = [...new Set([icaoFor(f.dep), icaoFor(f.dest)])];
  openModal(
    "METAR / TAF · " + e(f.dep) + " → " + e(f.dest),
    `<div class="modal-body"><p>Situational awareness only. Xem thời điểm phát hành trong bản tin gốc; không dùng thay briefing thời tiết chính thức.</p><div id="weather-results"><div class="empty">Đang lấy bản tin mới nhất…</div></div></div>`,
  );
  const target = modal.querySelector("#weather-results");
  const reports = await Promise.all(
    stations.map(async (station) => {
      try {
        if (!/^[A-Z]{4}$/.test(station))
          throw Error("Chưa có ICAO cho mã sân bay này.");
        const r = await fetch("/api/weather?station=" + station, {
            signal: AbortSignal.timeout(12000),
          }),
          d = await r.json();
        if (!r.ok) throw Error(d.error);
        return `<div class="form-section"><span>${e(station)}</span><span class="pill ${d.stale ? "amber" : "green"}">${d.stale ? "STALE CACHE" : d.cached ? "CACHE" : "LATEST FETCH"}</span></div><div class="weather-meta">${e(d.provider)} · Lấy lúc ${e(d.fetchedAt)}${d.error ? "<br>" + e(d.error) : ""}</div><h3 style="margin-top:15px">METAR</h3><pre class="weather-report">${e(d.metar || "Không có METAR cho trạm này.")}</pre><h3>TAF</h3><pre class="weather-report">${e(d.taf || "Không có TAF cho trạm này.")}</pre>`;
      } catch (err) {
        return `<div class="source-card"><strong>${e(station)}</strong><p>${e(err.message)}</p></div>`;
      }
    }),
  );
  if (target.isConnected) target.innerHTML = reports.join("");
}
function rules() {
  const r = evaluateRules(state.duties, null);
  openModal(
    "FTL · Xem căn cứ",
    `<div class="modal-body"><span class="pill amber">Chưa đánh giá · no rules installed</span><div class="source-card">${e(r.message)}<br><br><strong>Version:</strong> chưa cài<br><strong>Ngày hiệu lực:</strong> chưa xác định<br><strong>Section / nguồn:</strong> chờ tài liệu bạn cung cấp<br><br>Engine đã tách version, nguồn và ngưỡng cảnh báo. Duty / Rest hiện là thông tin theo dõi cá nhân; không có kết luận đủ điều kiện khai thác.</div><p style="margin-top:18px">Các mức giao diện dự kiến khi có bộ quy định được xác minh:</p><div class="ftl-sample"><span class="pill green">Xanh · trong giới hạn</span><span class="pill amber">Vàng · gần giới hạn</span><span class="pill red">Đỏ · vượt giới hạn</span></div><p style="margin-top:15px">Ví dụ màu hiển thị, không phải kết quả đánh giá duty hiện tại.</p></div>`,
  );
}
function reminderModal() {
  const r = reminders(state);
  openModal(
    "Thông báo & nhắc lịch",
    `<div class="modal-body"><p>Lịch ngày mai và giờ report theo UTC. Preview chưa gửi push khi app đã đóng.</p>${r.map((n) => `<div class="notice-item"><div>${icon("bell")}</div><div><strong>${e(n.title)}</strong>${e(n.text)}</div>${n.flightId ? btn("edit", "Ghi Actual", null, "small", `data-id="${e(n.flightId)}"`) : ""}</div>`).join("") || '<div class="empty">Không có nhắc lịch mới.</div>'}</div>`,
    `${btn("close", "Đóng", null, "ghost")}${btn("tab", "Cài đặt nhắc lịch", null, "primary", 'data-tab="settings"')}`,
  );
}
async function notify() {
  if (
    !state?.settings.notifications ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  const ready = await navigator.serviceWorker?.ready;
  for (const r of reminders(state)) {
    if (
      r.id.startsWith("tomorrow:") &&
      new Date().getUTCHours() !== state.settings.eveningHour
    )
      continue;
    if (notificationShown.has(r.id)) continue;
    notificationShown.add(r.id);
    if (ready)
      await ready.showNotification(r.title, {
        body: r.text,
        tag: r.id,
        icon: "/icon-192.png",
      });
  }
}
function download(name, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function exportCSV() {
  const headers = [
    "Date UTC",
    "Flight",
    "DEP",
    "DEST",
    "Type",
    "Reg",
    "Scheduled OUT",
    "Scheduled IN",
    "Actual OUT",
    "Actual OFF",
    "Actual ON",
    "Actual IN",
    "Block minutes",
    "Airborne minutes",
    "PF/PM",
    "PIC minutes",
    "SIC minutes",
    "Takeoff by",
    "Landing by",
    "Landing mode",
    "Night minutes",
    "Confirmed",
    "Source",
    "Confidence",
    "Note",
  ];
  const rows = state.flights.map((f) => [
    f.date,
    f.flightNo,
    f.dep,
    f.dest,
    f.aircraft,
    f.reg,
    f.scheduled?.out,
    f.scheduled?.in,
    ...["out", "off", "on", "in"].map((k) => f.actual?.[k]),
    f.confirmed ? minutes(f.actual?.out, f.actual?.in) : "",
    f.confirmed ? minutes(f.actual?.off, f.actual?.on) : "",
    f.role,
    f.picMinutes,
    f.confirmed
      ? minutes(f.actual?.out, f.actual?.in) - (f.picMinutes || 0)
      : "",
    f.takeoffBy,
    f.landingBy,
    f.landingMode,
    f.nightMinutes,
    f.confirmed,
    f.source,
    f.confidence,
    f.note,
  ]);
  download(
    "avilog-logbook.csv",
    "\uFEFF" +
      [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
  toast("Đã xuất CSV");
}
function restoreDialog() {
  openModal(
    "Restore backup",
    `<div class="modal-body"><p>Chọn backup AviLog JSON. Dữ liệu được kiểm tra trước; chỉ gộp sau khi bạn xác nhận. Actual đang xác nhận sẽ được giữ nguyên.</p><div class="file-zone">${icon("upload")}<input type="file" id="backup-file" accept="application/json,.json"><span class="tiny muted">Tối đa 50 MB</span></div><div id="restore-preview"></div><div class="error" data-error hidden></div></div>`,
  );
  modal.querySelector("#backup-file").onchange = async (ev) => {
    try {
      const f = ev.target.files[0];
      if (!f) return;
      if (f.size > 50 * 1024 * 1024) throw Error("Backup tối đa 50 MB");
      const data = JSON.parse(await f.text());
      const m = restoreBackup(data, state.flights);
      if (!Array.isArray(data.people) || !Array.isArray(data.duties))
        throw Error("Backup thiếu people/duties");
      for (const p of data.people)
        if (
          typeof p.id !== "string" ||
          !p.id ||
          typeof p.name !== "string" ||
          typeof p.rank !== "string"
        )
          throw Error("Crew backup không hợp lệ");
      for (const d of data.duties) {
        validDate(d.date);
        if (
          typeof d.id !== "string" ||
          !d.id ||
          ![
            "FLIGHT",
            "STANDBY",
            "RESERVE",
            "DAY OFF",
            "POSITIONING",
            "SIM",
            "TRAINING",
          ].includes(d.type) ||
          (d.report &&
            (typeof d.report !== "string" ||
              !Number.isFinite(Date.parse(d.report)))) ||
          (d.release &&
            (typeof d.release !== "string" ||
              !Number.isFinite(Date.parse(d.release)))) ||
          (d.report &&
            d.release &&
            Date.parse(d.release) < Date.parse(d.report))
        )
          throw Error("Duty backup không hợp lệ");
      }
      for (const key of ["people", "duties"])
        if (new Set(data[key].map((x) => x.id)).size !== data[key].length)
          throw Error("Backup có ID trùng trong " + key);
      for (const f of data.flights)
        if (f.attachment && !safeImage(f.attachment))
          throw Error("Ảnh backup không hợp lệ");
      modal._backup = { ...data, flights: m.flights };
      modal.querySelector("#restore-preview").innerHTML =
        `<div class="source-card">${data.flights.length} chuyến trong backup<br>${m.flights.length - state.flights.length} chuyến mới<br>${data.people.length} crew profiles · ${data.duties.length} duties<br>Actual đã xác nhận hiện có sẽ được giữ nguyên.</div>`;
      modal.querySelector(".modal-footer").innerHTML =
        `${btn("close", "Hủy", null, "ghost")}${btn("restore-save", "Xác nhận gộp backup", "check", "primary")}`;
    } catch (err) {
      modal._backup = null;
      error(err.message);
    }
  };
}
async function restoreSave() {
  try {
    const data = modal._backup;
    if (!data) throw Error("Chưa có backup hợp lệ");
    const next = structuredClone(state);
    next.flights = data.flights;
    for (const key of ["people", "duties"])
      for (const item of data[key])
        if (!next[key].some((x) => x.id === item.id)) next[key].push(item);
    await commit(next, "Đã gộp backup; giữ nguyên Actual đã xác nhận");
    modal._backup = null;
    modal.close();
    render();
  } catch (err) {
    error(err.message);
  }
}
async function fresh() {
  openModal(
    "Bắt đầu logbook riêng",
    `<div class="modal-body"><p>Bước này bỏ dữ liệu demo khỏi workspace hiện tại. Bạn có thể xuất backup trước khi bắt đầu. Logbook mới sẽ trống để nhập roster và crew của bạn.</p><div class="source-card">${state.flights.length} chuyến hiện có · ${state.people.length} crew profiles.</div></div>`,
    `${btn("backup", "Backup trước", "download")}${btn("close", "Giữ hiện tại", null, "ghost")}${btn("fresh-confirm", "Bắt đầu trống", "check", "primary")}`,
  );
}
app.addEventListener("change", (ev) => {
  if (ev.target.matches('[data-filter="status"]')) {
    logFilter = ev.target.value;
    render();
  }
});
app.addEventListener("input", (ev) => {
  if (ev.target.matches('[data-filter="search"]')) {
    const start = ev.target.selectionStart;
    query = ev.target.value;
    render();
    const next = app.querySelector('[data-filter="search"]');
    next.focus();
    next.setSelectionRange(start, start);
  }
});
document.addEventListener("submit", async (ev) => {
  if (ev.target.id !== "settings-form") return;
  ev.preventDefault();
  try {
    const fd = new FormData(ev.target),
      next = structuredClone(state);
    next.settings = {
      ...next.settings,
      name: fd.get("name").trim(),
      base: fd.get("base").toUpperCase(),
      tomorrow: fd.has("tomorrow"),
      beforeDuty: fd.has("beforeDuty"),
      missingActual: fd.has("missingActual"),
      leadMinutes: Number(fd.get("leadMinutes")),
      eveningHour: Number(fd.get("eveningHour")),
    };
    await commit(next, "Đã lưu cài đặt");
    render();
  } catch (err) {
    error(err.message);
  }
});
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action,
    id = b.dataset.id;
  try {
    switch (action) {
      case "close":
        modal.close();
        break;
      case "tab":
        tab = b.dataset.tab;
        modal.close();
        render();
        window.scrollTo(0, 0);
        break;
      case "view":
        view = b.dataset.view;
        render();
        break;
      case "day":
        day = b.dataset.day;
        month = day.slice(0, 7);
        render();
        break;
      case "month-prev":
      case "month-next": {
        const d = new Date(month + "-01T12:00Z");
        d.setUTCMonth(d.getUTCMonth() + (action === "month-next" ? 1 : -1));
        month = d.toISOString().slice(0, 7);
        day = month + "-01";
        render();
        break;
      }
      case "today":
        day = new Date().toISOString().slice(0, 10);
        month = day.slice(0, 7);
        render();
        break;
      case "add":
        editFlight();
        break;
      case "edit":
        editFlight(find(id));
        break;
      case "import":
        importRoster();
        break;
      case "roster-sample":
        modal.querySelector("#roster-text").value = sampleRoster;
        modal.querySelector("#roster-month").value = "2026-10";
        break;
      case "roster-parse":
        previewRoster();
        break;
      case "roster-save":
        await saveRoster();
        break;
      case "image":
        imageImport(id);
        break;
      case "image-sample":
        modal.querySelector("#image-text").value = sampleAOC;
        imageAttachment = null;
        imageIsSample = true;
        modal.querySelector("#image-evidence").innerHTML = "";
        break;
      case "image-parse":
        previewImage(id);
        break;
      case "add-person":
        personEditor();
        break;
      case "edit-person":
        personEditor(id);
        break;
      case "crew-history":
        crewHistory(id);
        break;
      case "duty":
        dutyEditor(id);
        modal.querySelector('[name="type"]').onchange = (ev) => {
          if (ev.target.value !== "FLIGHT")
            for (const option of modal.querySelector('[name="flightIds"]')
              .options)
              option.selected = false;
        };
        break;
      case "duty-list":
        dutyList();
        break;
      case "weather":
        await weather(id);
        break;
      case "rules":
        rules();
        break;
      case "reminders":
        reminderModal();
        break;
      case "notifications": {
        if (state.settings.notifications) {
          await commit(
            { ...state, settings: { ...state.settings, notifications: false } },
            "Đã tắt thông báo",
          );
          render();
          break;
        }
        if (!("Notification" in window) || !("serviceWorker" in navigator))
          throw Error(
            "Trình duyệt chưa hỗ trợ thông báo PWA. Bạn vẫn xem nhắc lịch trong app.",
          );
        const permission = await Notification.requestPermission();
        if (permission !== "granted")
          throw Error(
            "Quyền thông báo chưa được cấp. Kiểm tra cài đặt trình duyệt.",
          );
        await commit(
          { ...state, settings: { ...state.settings, notifications: true } },
          "Đã bật thông báo khi app mở",
        );
        render();
        break;
      }
      case "backup":
        download(
          "avilog-backup-" + new Date().toISOString().slice(0, 10) + ".json",
          JSON.stringify(
            { ...state, exportedAt: new Date().toISOString() },
            null,
            2,
          ),
          "application/json",
        );
        toast("Đã xuất backup JSON");
        break;
      case "csv":
        exportCSV();
        break;
      case "restore":
        restoreDialog();
        break;
      case "restore-save":
        await restoreSave();
        break;
      case "archive-flight":
      case "archive-duty":
        await commit(
          archiveRecord(
            state,
            action === "archive-flight" ? "flight" : "duty",
            id,
          ),
          "Đã chuyển vào Thùng rác · có thể khôi phục trong Settings",
        );
        modal.close();
        render();
        break;
      case "trash":
        openModal(
          "Thùng rác · có thể khôi phục",
          `<div class="modal-body"><p>Các bản ghi dưới đây chưa bị xóa vĩnh viễn và không cộng vào thống kê.</p>${(state.trash || []).map((r) => `<div class="notice-item"><div><strong>${e(r.data.flightNo || r.data.type)} · ${e(r.data.date)}</strong>${e(r.kind)} · ${e(r.at)}</div>${btn("unarchive", "Khôi phục", null, "small", `data-id="${e(r.id)}"`)}</div>`).join("") || '<div class="empty">Thùng rác trống.</div>'}</div>`,
        );
        break;
      case "unarchive":
        await commit(restoreRecord(state, id), "Đã khôi phục");
        modal.close();
        render();
        break;
      case "fresh":
        await fresh();
        break;
      case "fresh-confirm":
        await commit(
          {
            ...sampleState(),
            flights: [],
            duties: [],
            people: [],
            trash: [],
            demo: false,
            settings: state.settings,
          },
          "Logbook riêng đã sẵn sàng",
        );
        day = new Date().toISOString().slice(0, 10);
        month = day.slice(0, 7);
        modal.close();
        render();
        break;
      case "plan":
        openModal(
          "AviLog · Free preview",
          `<div class="modal-body"><p>Tất cả luồng preview đang mở để bạn thử. Chưa có thanh toán hoặc quảng cáo thật.</p><div class="source-card">✓ Schedule / Actual & logbook<br>✓ PDF / A320 image import có xác nhận<br>✓ Crew Book & thống kê<br>✓ Backup JSON / CSV<br><br>Giai đoạn tiếp: xác minh monthplan.pdf thật, thêm FTL từ tài liệu hãng, tài khoản đồng bộ và push nền.</div></div>`,
        );
        break;
    }
  } catch (err) {
    error(err.message);
  }
});
try {
  state = await readState();
  if (!state) {
    state = sampleState();
    await writeState(state);
  }
  render();
} catch (err) {
  app.innerHTML = `<div class="loading"><h2>Không mở được bộ nhớ logbook</h2><p>${e(err.message)}</p><p>Thử tắt chế độ duyệt riêng tư hoặc cho phép lưu dữ liệu website rồi tải lại.</p></div>`;
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("/sw.js")
    .catch(() =>
      toast("Chưa bật được offline cache. Dữ liệu vẫn lưu trên thiết bị."),
    );
setInterval(() => {
  const c = document.querySelector("#utc-clock");
  if (c) c.innerHTML = new Date().toISOString().slice(11, 16) + " <b>UTC</b>";
  notify().catch(() => {});
}, 60000);
