export function captureDeviceClock(){return {at:new Date().toISOString(),zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'};}
export function movementClock(operation:{created_at:string;device_recorded_at?:string|null;device_time_zone?:string|null}){
 const device=!!operation.device_recorded_at,date=new Date(operation.device_recorded_at||operation.created_at);
 try{return `${device?'Hora del dispositivo':'Registro del servidor'}: ${date.toLocaleString('es-AR',{...(device&&operation.device_time_zone?{timeZone:operation.device_time_zone}:{}),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}`;}
 catch{return `Registro del servidor: ${new Date(operation.created_at).toLocaleString('es-AR',{hour12:false})}`;}
}
