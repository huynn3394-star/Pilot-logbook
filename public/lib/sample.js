import { normalizeEvents } from "./domain.js";
export const sampleRoster =
  "09/10 VN7388 SGN-DLI 07:14-08:06\nVN7389 DLI-SGN 08:40-09:30\nVN1186 SGN-HPH 10:52-12:57\nVN1187 HPH-SGN 13:40-15:32";
export const sampleAOC =
  "VN0605\nVVTS VTBS\nOUT 04:29\nOFF 04:39\nON 05:50\nIN 06:00\nFLIGHT 01:11\nBLOCK 01:31";
export function sampleState() {
  const make = (id, date, no, dep, dest, start, end, confirmed = false) => ({
    id,
    date,
    flightNo: no,
    dep,
    dest,
    aircraft: "A321",
    reg: "",
    scheduled: normalizeEvents(date, { out: start, in: end }),
    actual: confirmed
      ? normalizeEvents(date, {
          out: start,
          off: plus(start, 10),
          on: plus(end, -10),
          in: end,
        })
      : {},
    confirmed,
    role: confirmed ? "PF" : "PM",
    picMinutes: 0,
    nightMinutes: 0,
    takeoffBy: confirmed ? "self" : "captain",
    landingBy: confirmed ? "self" : "captain",
    landingMode: "manual",
    captainId: "crew-demo-1",
    foId: "self",
    crewIds: [],
    source: "Demo · dữ liệu bạn cung cấp",
    confidence: 100,
    note: "Dữ liệu mẫu. Kiểm tra lại trước khi dùng.",
  });
  const flights = [
    make(
      "demo-343",
      "2026-10-03",
      "VN0343",
      "NGO",
      "SGN",
      "23:55",
      "05:23",
      true,
    ),
    make(
      "demo-605",
      "2026-10-06",
      "VN0605",
      "SGN",
      "BKK",
      "04:29",
      "06:00",
      true,
    ),
    make("demo-7388", "2026-10-09", "VN7388", "SGN", "DLI", "07:14", "08:06"),
    make("demo-7389", "2026-10-09", "VN7389", "DLI", "SGN", "08:40", "09:30"),
    make("demo-1186", "2026-10-09", "VN1186", "SGN", "HPH", "10:52", "12:57"),
    make("demo-1187", "2026-10-09", "VN1187", "HPH", "SGN", "13:40", "15:32"),
  ];
  // Only supplied actuals are labelled confirmed. Intermediate 0343 events are not known.
  flights[0].confirmed = false;
  flights[0].actual = {
    out: "2026-10-03T23:55:00.000Z",
    in: "2026-10-04T05:23:00.000Z",
  };
  flights[0].note = "OUT/IN actual do bạn cung cấp; chờ OFF/ON để xác nhận.";
  return {
    version: 1,
    flights,
    duties: [
      {
        id: "duty-demo-9",
        date: "2026-10-09",
        type: "FLIGHT",
        report: "",
        release: "",
        note: "Chưa nhập giờ report/release",
      },
      {
        id: "duty-demo-off",
        date: "2026-10-10",
        type: "DAY OFF",
        report: "",
        release: "",
        note: "Hoạt động mẫu",
      },
    ],
    people: [
      {
        id: "crew-demo-1",
        name: "Captain Demo",
        rank: "Captain",
        note: "Nhân vật giả để xem thử Crew Book",
      },
      {
        id: "crew-demo-2",
        name: "First Officer Demo",
        rank: "FO",
        note: "Nhân vật giả",
      },
    ],
    settings: {
      name: "Pilot",
      base: "SGN",
      tomorrow: true,
      missingActual: true,
      beforeDuty: true,
      leadMinutes: 120,
      eveningHour: 18,
      notifications: false,
    },
    demo: true,
  };
}
function plus(s, n) {
  const [h, m] = s.split(":").map(Number);
  let t = (h * 60 + m + n + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
