const columns = [
  "isPreviousExperience", "isSimulator", "flightDate", "startTime", "takeoffTime", "landingTime", "parkingTime",
  "flightNumber", "depAirport", "arrAirport", "aircraftTailnumber", "aircraftType", "simType", "function", "pilotName1",
  "totalTime", "picTime", "sicTime", "picusTime", "simTraineeTime", "simTrainerTime",
  "crossCountryTime", "actualInstrumentTime", "ifrTime", "nightTime",
  "dayTakeoffs", "nightTakeoffs", "dayLandings", "nightLandings", "remarks",
];
const escape = value => /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;

export const overnight = {
  isPreviousExperience: "false", isSimulator: "false", flightDate: "2026-10-31",
  startTime: "23:40", takeoffTime: "23:55", landingTime: "00:40", parkingTime: "00:55",
  flightNumber: "ZZ123", depAirport: "VVTS", arrAirport: "VVNB", aircraftTailnumber: "ZZ-TEST", aircraftType: "A321",
  function: "SIC", pilotName1: "Synthetic Pilot", totalTime: "75", picTime: "0", sicTime: "75", picusTime: "0",
  crossCountryTime: "75", actualInstrumentTime: "40", ifrTime: "75", nightTime: "35",
  dayTakeoffs: "0", nightTakeoffs: "1", dayLandings: "0", nightLandings: "1", remarks: 'Fixture "remark", with comma',
};
export const partial = {
  ...overnight, flightDate: "2026-11-01", flightNumber: "", startTime: "10:00",
  takeoffTime: "", landingTime: "", parkingTime: "11:15", actualInstrumentTime: "75",
};
export const simulator = {
  isPreviousExperience: "false", isSimulator: "true", flightDate: "2026-11-01",
  startTime: "13:00", parkingTime: "17:00", simType: "FFS", aircraftType: "A321", simTraineeTime: "240", totalTime: "0",
};

export function waderCsv(rows, { unquotedPilotName = false } = {}) {
  return "\ufeff" + columns.join(",") + "\r\n" +
    rows.map(row => columns.map(key => unquotedPilotName && key === "pilotName1" ? row[key] || "" : escape(row[key] || "")).join(",") + ",").join("\r\n");
}
