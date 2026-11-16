export type AddressResult={label:string;lat:number;lng:number;hasNumber:boolean;street?:string;number?:string};
export function addressSearchUrl(query:string){
 const q=query.trim();if(q.length<5||q.length>300)throw new Error('Escribí calle, número y localidad, entre 5 y 300 caracteres.');
 const url=new URL('https://photon.komoot.io/api/');url.searchParams.set('q',normalizeAddressQuery(q));url.searchParams.set('countrycode','AR');url.searchParams.set('limit','5');return url.href;
}
export function parseAddressResults(data:unknown):AddressResult[]{
 if(!data||typeof data!=='object'||!Array.isArray((data as {features?:unknown}).features))throw new Error('La búsqueda no devolvió una respuesta válida.');
 const results:AddressResult[]=[];
 for(const f of (data as {features:unknown[]}).features){
  if(!f||typeof f!=='object')continue;const feature=f as {geometry?:{type?:string;coordinates?:unknown[]};properties?:Record<string,unknown>},p=feature.properties||{},coordinates=feature.geometry?.coordinates;
  if(feature.geometry?.type!=='Point'||!Array.isArray(coordinates)||coordinates.length<2)continue;
  const [lng,lat]=coordinates;if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)continue;
  if(typeof p.countrycode==='string'&&p.countrycode.toUpperCase()!=='AR')continue;
  const text=(key:string)=>typeof p[key]==='string'?(p[key] as string).slice(0,300):'';
  const street=[text('street')||text('name'),text('housenumber')].filter(Boolean).join(' '),label=[...new Set([street,text('city')||text('town')||text('village')||text('district'),text('state'),text('country')].filter(Boolean))].join(', ');
  if(!label||results.some(r=>r.label===label&&r.lat===lat&&r.lng===lng))continue;
  results.push({label,lat,lng,hasNumber:Boolean(text('housenumber')),street:text('street')||text('name'),number:text('housenumber')});if(results.length===5)break;
 }
 return results;
}

// A number typed by the user is retained only when the chosen street matches.
export function selectedAddressText(result:AddressResult,query:string){
 if(result.hasNumber)return {label:result.label,numberFromQuery:false};
 const street=result.label.split(',')[0].trim(),normal=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const first=query.match(/^\s*(\d{1,6}[a-z]?)\s*[, ]\s*(.+)$/i),last=query.split(',')[0].match(/^(.+?)\s+(\d{1,6}[a-z]?)\s*$/i);
 const number=first&&(normal(first[2])===normal(street)||normal(first[2]).startsWith(normal(street)+' '))?first[1]:last&&normal(last[1])===normal(street)?last[2]:'';
 return {label:number?result.label.replace(street,`${street} ${number}`):result.label,numberFromQuery:!!number};
}

/** Put a leading house number after the street, keeping locality and province. */
export function normalizeAddressQuery(query:string){
 const text=query.trim(),match=text.match(/^([0-9]{1,6}[a-z]?)\s*,\s*([^,]+)(.*)$/i);
 return match?`${match[2].trim()} ${match[1]}${match[3]}`:text;
}
const addressNormal=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function prioritizeAddressResults(results:AddressResult[],query:string){
 const normalized=normalizeAddressQuery(query),first=normalized.split(',')[0].trim(),match=first.match(/^(.+?)\s+([0-9]{1,6}[a-z]?)$/i);
 if(!match)return results;
 const street=addressNormal(match[1]),number=addressNormal(match[2]);
 const score=(r:AddressResult)=>{const candidate=addressNormal(r.street||r.label.split(',')[0].replace(/\s+[0-9]{1,6}[a-z]?$/i,''));return candidate===street?(r.hasNumber&&addressNormal(r.number||r.label.split(',')[0].split(' ').at(-1)||'')===number?0:r.hasNumber?2:1):3;};
 return results.map((r,i)=>({r,i,score:score(r)})).sort((a,b)=>a.score-b.score||a.i-b.i).map(x=>x.r);
}
