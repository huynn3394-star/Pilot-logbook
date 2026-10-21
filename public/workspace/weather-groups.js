const copy=structuredClone;
const airportList=value=>Array.isArray(value)&&value.length<=40&&new Set(value).size===value.length&&value.every(v=>typeof v==='string'&&/^[A-Z]{4}$/.test(v));
const nameKey=name=>name.trim().normalize('NFKC').toLocaleLowerCase('vi');
export function validateWeatherGroups(groups,airports){
 if(!Array.isArray(groups)||groups.length>8)throw Error('Tối đa 8 nhóm sân bay.');
 const ids=new Set(),names=new Set();
 for(const group of groups){
  if(!group||typeof group!=='object'||Array.isArray(group)||Object.keys(group).some(k=>!['id','name','airports'].includes(k))||typeof group.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(group.id)||typeof group.name!=='string'||!group.name.trim()||group.name.length>60||!airportList(group.airports))throw Error('Nhóm sân bay không hợp lệ.');
  const name=nameKey(group.name);if(ids.has(group.id)||names.has(name))throw Error('Tên hoặc định danh nhóm đã tồn tại.');ids.add(group.id);names.add(name);
 }
 const union=[...new Set(groups.flatMap(group=>group.airports))];if(union.length>40)throw Error('Tối đa 40 sân bay khác nhau trong các nhóm.');
 if(airports!==undefined&&(!airportList(airports)||JSON.stringify(union)!==JSON.stringify(airports)))throw Error('Danh sách sân bay không khớp các nhóm.');return groups;
}
export function readWeatherGroups(settings={}){
 if(settings.weatherGroups!==undefined){validateWeatherGroups(settings.weatherGroups,settings.weatherAirports);return copy(settings.weatherGroups);}
 const airports=settings.weatherAirports||[];if(!airportList(airports))throw Error('Danh sách sân bay không hợp lệ.');return airports.length?[{id:'legacy',name:'Danh sách hiện tại',airports:copy(airports)}]:[];
}
export function saveWeatherGroups(settings,groups){
 validateWeatherGroups(groups);return {...copy(settings),weatherGroups:copy(groups),weatherAirports:[...new Set(groups.flatMap(group=>group.airports))]};
}
