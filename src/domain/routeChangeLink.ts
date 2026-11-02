export function readRouteChangeLink(search:string){
 const query=new URLSearchParams(search),tenant=query.get('empresa'),trip=query.get('recorrido');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 return query.get('cambios')==='1'&&tenant&&trip&&uuid.test(tenant)&&uuid.test(trip)?{tenant,trip}:null;
}
