import {formatMETARReport,formatTAFReport,highlightWeatherReport} from '../workspace/weather-attention.js';

// Existing flight-weather dialogs are rendered by app.js. Observe this one container,
// not all app content. Forecast line breaks are display-only; stored reports stay intact.
export function mountWeatherReportHighlights(root){
 if(!root)return {dispose(){}};
 const seen=new WeakMap();
 const paint=()=>{for(const node of root.querySelectorAll('pre.weather-report')){
  if(seen.get(node)===node.innerHTML)continue;
  const isTAF=node.previousElementSibling?.textContent.trim()==='TAF'||/^\s*TAF\b/.test(node.textContent);
  const format=isTAF?formatTAFReport:formatMETARReport;
  const html=highlightWeatherReport(format(node.textContent));
  if(node.innerHTML!==html)node.innerHTML=html;
  // Cache the browser's serialization, not our escaped input (quotes may normalize).
  seen.set(node,node.innerHTML);
 }};
 paint();const observer=new MutationObserver(paint);
 observer.observe(root,{childList:true,characterData:true,subtree:true});
 return {dispose(){observer.disconnect();}};
}
mountWeatherReportHighlights(document.querySelector('#modal'));
