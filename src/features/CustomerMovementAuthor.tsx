type Profile={user_id:string;full_name:string;role?:string};
export function CustomerMovementAuthor({actorId,tripId,profiles,trips}:{actorId?:string;tripId?:string|null;userId?:string;profiles:Profile[];trips:{id:string;name:string}[]}){
 function name(id?:string|null){
  if(!id)return 'Usuario no identificado';
  const profile=profiles.find(p=>p.user_id===id),fullName=profile?.full_name.trim();
  return `${fullName||`Usuario ${id.slice(0,8)} · nombre no disponible`}${profile?.role==='driver'?' (empleado)':''}`;
 }
 const trip=trips.find(t=>t.id===tripId);
 return <><small>Registrado por: {name(actorId)}</small>{tripId&&<small>Reparto: {trip?.name||'Nombre no disponible'}</small>}</>;
}
