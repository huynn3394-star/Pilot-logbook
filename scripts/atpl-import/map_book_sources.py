"""Map immutable Word question UIDs to curated, page-checked book passages.

Matching uses question stems (not explanatory prose). Word boundaries matter:
CAS must not match 'case', nor magnetic deviation an off-track deviation.
The checked-in JSON is the reviewable source; this script reproduces it.
"""
from pathlib import Path
import json,re,collections
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'data/atpl-additions'
Q=json.loads((D/'source-questions.json').read_text())
DB=json.loads((D/'book-sources.json').read_text())
OVERRIDES={
 'GNAV-01-059':['wind','time-distance'], 'GNAV-01-142':['wind-finding','wind'],
 'GNAV-01-174':['great-circle','gc-formula'], 'GNAV-01-264':['airspeed','descent'],
 'GNAV-02-003':['pilotage','wind-drift'], 'GNAV-02-011':['dead-reckoning','wind-finding'],
 'GNAV-02-015':['relief'], 'GNAV-02-016':['course-correction','time-distance'],
 'GNAV-02-018':['rhumb-formula'], 'GNAV-02-026':['visual-hazards','pilotage'],
 'GNAV-02-034':['stereographic'], 'GNAV-02-039':['pilotage'],
 'GNAV-02-043':['pilotage','visual-hazards'], 'GNAV-02-055':['time-distance','pilotage'],
 'GNAV-02-056':['ifr-chart'], 'GNAV-02-065':['relief'],
 'GNAV-02-066':['visual-hazards','pilotage'], 'GNAV-02-067':['pilotage','compass'],
 'GNAV-02-068':['visual-hazards'], 'GNAV-02-070':['visual-hazards','pilotage'],
 'GNAV-02-088':['conformal','great-circle'], 'GNAV-02-091':['mercator'],
 'FPL-03-001':['nam-ngm','wind'], 'FPL-03-002':['ifr-altitudes','ifr-chart'],
 'FPL-03-003':['ifr-chart'], 'FPL-03-008':['ifr-altitudes','ifr-chart'],
 'FPL-03-014':['preflight','ifr-chart'], 'FPL-03-016':['ifr-altitudes'],
 'FPL-03-029':['fpl-speed','fpl-route'], 'FPL-03-048':['fuel-math','flight-log'],
 'FPL-03-054':['fpl-destination'], 'FPL-04-055':['ifr-chart'],
 'FPL-04-069':['fpl-speed'],
 'FPL-05-001':['fpl-route-spacing'], 'FPL-05-002':['fpl-speed','fpl-route'],
 'FPL-05-003':['fpl-route'], 'FPL-05-004':['fpl-wake'],
 'FPL-05-005':['fpl-route','fpl-level'], 'FPL-05-006':['fuel-math','fuel-scheme'],
 'FPL-05-007':['fuel-math','fuel-scheme'], 'FPL-05-008':['fpl-route','fpl-speed'],
 'FPL-05-009':['fpl-destination'], 'FPL-05-010':['fpl-level'],
 'FPL-05-011':['fpl-route'], 'FPL-05-012':['fpl-supplement'],
 'FPL-05-013':['fpl-status','supp-fpl-status'],
 'FPL-05-014':['fpl-departure','fpl-filing'], 'FPL-05-015':['fpl-supplement'],
 'FPL-06-005':['fuel-reserve'], 'FPL-06-010':['fuel-checks'],
 'FPL-06-019':['time-distance','flight-log'], 'FPL-06-028':['course-correction','wind-correct'],
 'FPL-06-046':['fpl-route'], 'FPL-06-059':['computer-plan','fuel-math'],
}
def choose(q):
 s=q['question'];bank=q['uid'].split('-')[0];sec=q['section']
 def has(p):return bool(re.search(p,s,re.I))
 if q['uid'] in OVERRIDES:return OVERRIDES[q['uid']]
 if bank=='GNAV' and sec==5:
  n=q['sourceNumber']
  if n in [11,12,19,26]:return ['twilight']
  if n in [2,30]:return ['sunrise','longitude-time']
  if n in [1,17,28,34,35]:return ['solar-time']
  if n in [3,4,6,9,16,21,25,29,31,36]:return ['seasons','sunrise']
  if n in [5,20,22,37]:return ['date-line','standard-time']
  if n in [7,14,18,23,24,32,33]:return ['standard-time','longitude-time']
  return ['longitude-time','date-line']
 if has(r'safe return|\bPSR\b|point of no return'):return ['psr','fuel-math']
 if has(r'equal time|\bPET\b|\bETP\b'):return ['etp','time-distance']
 if has(r'NOTAM|NOTAMC|NOTAMR'):
  key='notam-time' if has(r'valid|date|time|period|hours|when|until|close|winter|summer') else 'notam-qline'
  return [key,'supp-'+key]
 if has(r'temporary danger areas|short unserviceability'):return ['notam-time','supp-notam-time']
 if has(r'current flight plan|filed flight plan'):return ['fpl-definitions']
 if bank=='FPL' and has(r'RVSM|semi.circular|semi-circular'):return ['cruise-levels']
 if bank=='FPL' and has(r'\bSID\b|\bSTAR\b|\bSIDS\b|\bSTARS\b'):return ['sid-star','ifr-chart']
 if bank=='FPL' and has(r'\bAPV\b|Baro|SBAS'):return ['ifr-gnss','supp-ifr-gnss']
 if bank=='FPL' and has(r'3500T|5000T|FL 80 1500|quadrant.*longitude'):return ['ifr-altitudes']
 if bank=='FPL' and has(r'ATC flight plan|ATS flight plan|Item ?(?:7|8|9|10|13|15|16|18|19)\b'):
  if has(r'Item ?19|persons on board|passengers|endurance'):return ['fpl-supplement']
  if has(r'Item ?16|destination.*EET'):return ['fpl-destination']
  if has(r'wake'):return ['fpl-wake']
  if has(r'special handling|STS/'):return ['fpl-status','supp-fpl-status']
  if has(r'Item ?10|equipment'):return ['fpl-equipment']
  if has(r'Item ?13|off.block|parking'):return ['fpl-departure']
  if has(r'cruising speed|\bMach\b'):return ['fpl-speed']
  if has(r'cruising.*(?:level|altitude)|\bF\d{3}\b'):return ['fpl-level','fpl-route']
  return ['fpl-rules','fpl-route']
 if has(r'GNSS|\bLPV\b|\bLNAV\b|\bVNAV\b|\bRNP\b|\bRNAV\b') and bank=='FPL':return ['ifr-gnss','supp-ifr-gnss']
 if bank=='FPL' and has(r'approach categor|\bVat\b'):return ['ifr-category','supp-ifr-category']
 if bank=='FPL' and has(r'\bminima\b|minimum.*(?:visibility|RVR)|\bMDA\b|\bDA/H\b|decision height|decision altitude'):return ['ifr-minima']
 if bank=='FPL' and has(r'\b(?:MEA|MOCA|MORA|MRA|MCA|MAA)\b|minimum.*altitude|obstacle clearance') and not has(r'QNH|temperature'):return ['ifr-altitudes','ifr-chart']
 if bank=='FPL' and has(r'frequenc|call ?sign|contact|\bMHz\b|\bkHz\b') and not has(r'fuel|wind'):return ['ifr-frequency','ifr-chart']
 if has(r'landing mass|landing weight|dry operating mass|traffic load|\bDOM\b'):return ['mass','fuel-math']
 if bank=='FPL' and has(r'\bETOPS\b|extended twin'):return ['etops']
 if has(r'computer.*(?:plan|planning)|operational impact factors'):return ['computer-plan']
 if has(r'\bNAM\b|\bNGM\b|nautical air miles|nautical ground miles'):return ['nam-ngm','time-distance']
 # Visual navigation and terrain before generic speed/latitude words in scenarios.
 if bank=='GNAV' and has(r'contour|layer tint|relief|steepest terrain|spot elevation'):return ['relief','chart-symbols']
 if bank=='GNAV' and has(r'checkpoint|ground feature|map read|map.to.ground|ground.to.map|landmark|night VFR|VFR.*night|VFR.*(?:terrain|snow)|lost|unsure.*position') and not has(r'calculate|given.*TAS|\bFL\d'):return ['pilotage','visual-hazards']
 if has(r'\bgrid\b') and not has(r'Grid MORA'):return ['grid']
 if has(r'gnomonic'):return ['gnomonic']
 if has(r'transverse.*mercator'):return ['transverse']
 if has(r'polar.*stereographic|stereographic.*polar'):return ['stereographic']
 if has(r'Lambert|constant of.*cone|cone.*constant|convergence factor'):
  return ['lambert-convergence','lambert'] if has(r'convergen|constant|origin|course|track|angle') else ['lambert']
 if has(r'Mercator'):
  return ['mercator-scale','mercator'] if has(r'scale|distance|\bcm\b|\bmm\b') else ['mercator']
 if has(r'conformal|conformality|orthomorph|projection') and bank=='GNAV':return ['conformal','mercator']
 if has(r'conversion angle|angle.*(?:great.circle|rhumb)|(?:great.circle|rhumb).*angle'):return ['conversion-angle','convergence']
 if has(r'convergency|convergence|great.circle.*(?:bearing|track)|great circle.*(?:bearing|track)'):return ['convergence','great-circle']
 if has(r'vertex|vertices|most northerly|maximum Northern|highest or lowest North'):return ['vertex','great-circle']
 if has(r'rhumb|loxodrom'):return ['rhumb','rhumb-formula']
 if has(r'great.circle|great circle|orthodrom'):return ['great-circle','gc-formula']
 if has(r'oblate|ellipsoid|WGS.?84|datum|geodetic|geocentric|flattening|shape of.*earth'):return ['earth','latitude']
 if has(r'\b(?:scale|millimetres|millimeters)\b|\bcm\b|\bmm\b|\binch') and bank=='GNAV':return ['scale']
 if has(r'twilight'):return ['twilight']
 if has(r'sunrise|sunset'):return ['sunrise','longitude-time']
 if has(r'equinox|solstice|ecliptic|declination|season|orbit|day.*night|night.*day|zenith'):return ['seasons','sunrise']
 if has(r'sidereal|apparent solar|mean solar|solar day|solar time'):return ['solar-time']
 if has(r'date line|dateline'):return ['date-line','longitude-time']
 if has(r'standard time|summer time|zone time|daylight saving'):return ['standard-time','longitude-time']
 if bank=='GNAV' and sec==5:return ['longitude-time','date-line']
 if has(r'\bdip\b|magnetic pole|earth.*magnetic|horizontal component|vertical component'):return ['magnetic-field']
 if has(r'secular|isogonal.*(?:year|annual)|variation.*(?:year|annual)'):return ['magnetic-change','variation']
 if has(r'\bdeviation\b') and has(r'magnetic|compass|aircraft heading|electronic equipment'):return ['deviation','compass']
 if has(r'variation|isogonic|isogonal|agonic|magnetic compass|compass (?:heading|correction)|magnetic north|compass north') and not has(r'wind|TAS'):return ['variation','compass']
 if has(r'latitude|longitude|meridian|parallel|equator|antipod|circumference|nautical mile') and bank=='GNAV' and not has(r'TAS|wind|\bGS\b'):
  return ['rhumb-formula','coordinates'] if has(r'distance|\bNM\b') else ['latitude','coordinates']
 if has(r'track error|off.track|off course|closing angle|one.in.sixty|1.in.60'):return ['course-correction','wind-correct']
 if has(r'descent|gradient|rate of climb|rate of descent|glide.*(?:slope|angle)') and not has(r'chart|performance graph|table'):return ['descent','time-distance']
 if has(r'QNH|QNE|QFE|altimeter|true altitude|pressure altitude') and not has(r'fuel|table|performance'):
  return ['altitude','cold-correction'] if has(r'cold|temperature') else ['altitude','isa']
 if has(r'density altitude'):return ['density-altitude']
 if has(r'\bMach\b|speed of sound|\bLSS\b') and not has(r'fuel|table|performance|flight plan'):return ['mach','wind' if has(r'wind') else 'compressibility']
 if has(r'\b(?:CAS|EAS|IAS)\b|indicated airspeed|calibrated airspeed|equivalent airspeed') and not has(r'fuel|table|performance'):
  return ['compressibility','density'] if has(r'compressib|\bEAS\b') else ['airspeed','density']
 if has(r'specific gravity|\bSG\b|\bgallons?\b|\blitres?\b|\bliters?\b|fuel density'):return ['fuel-units','fuel-math']
 if bank=='FPL' and sec==6:
  if has(r'minimum fuel|final reserve') and has(r'Commander|what action|must ensure|MAYDAY|best decision|receives|land at'):return ['fuel-minimum','supp-fuel-minimum']
  if has(r'fuel|consumption'):return ['flight-log','fuel-math']
  return ['time-distance','wind']
 if bank=='FPL' and has(r'final reserve|reserve fuel|contingency|additional fuel|extra fuel|alternate fuel'):
  if has(r'contingency'):return ['fuel-reserve','fuel-math']
  if has(r'additional fuel'):return ['fuel-additional','fuel-scheme']
  if has(r'extra fuel'):return ['fuel-extra','fuel-scheme']
  return ['fuel-scheme','fuel-math']
 if has(r'\bMRJT\b|medium.range jet|brake release|integrated range'):return ['jet-chart','specific-range']
 if has(r'\bMEP\b|multi.engine.*piston'):return ['mep-chart','performance-chart']
 if has(r'\bSEP\b|single.engine.*piston'):return ['sep-climb','performance-chart'] if has(r'climb') else ['performance-chart','range-endurance']
 if has(r'specific range|specific endurance|maximum range|maximum endurance|long.range cruise'):return ['specific-range','range-endurance']
 if has(r'fuel|consumption|kg/h|lb/h'):return ['fuel-math','performance-chart']
 if has(r'range|endurance') and bank=='FPL':return ['range-endurance','endurance']
 if has(r'wind|drift|TAS|heading|track') and not has(r'Jeppesen|GSPRM|annex|image'):
  if has(r'crosswind|tailwind limit|headwind component|wind component'):return ['wind-components','wind']
  if has(r'find.*wind|calculate.*wind|wind velocity|actual.*wind'):return ['wind-finding','wind']
  return ['wind','wind-drift']
 if has(r'relative bearing|\bradial\b|\bVOR\b|\bNDB\b|\bDME\b|\bQDM\b|\bQDR\b|\bbearing\b') and bank=='GNAV':return ['fix','bearing']
 if has(r'dead.reckon|DR position|air position|fix position'):return ['dead-reckoning','wind']
 if has(r'\btime\b|\bspeed\b|\bdistance\b|\bGS\b|\bETA\b|\bETO\b|\bknot|\bTAS\b') and not has(r'Jeppesen|chart|annex'):return ['time-distance','wind']
 if bank=='GNAV':return ['pilotage','chart-symbols']
 if sec==1:return ['vfr-chart','preflight']
 if has(r'approach|ILS|RVR|DH\b'):return ['ifr-minima']
 return ['ifr-chart','preflight']
def main():
 out={q['uid']:list(dict.fromkeys(choose(q))) for a in Q.values() for q in a}
 for uid,ids in out.items():
  assert 1<=len(ids)<=2 and all(i in DB['citations'] for i in ids),(uid,ids)
  assert DB['books'][DB['citations'][ids[0]]['book']]['role']=='primary',uid
 (D/'question-book-sources.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 print('Mapped',len(out),'questions;',collections.Counter(i for ids in out.values() for i in ids))
if __name__=='__main__':main()
