export type AddressResult={label:string;lat:number;lng:number;hasNumber:boolean};
export function addressSearchUrl(query:string){
 const q=query.trim();if(q.length<5||q.length>300)throw new Error('Escribí calle, número y localidad, entre 5 y 300 caracteres.');
 const url=new URL('https://photon.komoot.io/api/');url.searchParams.set('q',q);url.searchParams.set('countrycode','AR');url.searchParams.set('limit','5');return url.href;
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
  results.push({label,lat,lng,hasNumber:Boolean(text('housenumber'))});if(results.length===5)break;
 }
 return results;
}
