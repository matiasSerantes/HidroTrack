import {useId,useState} from 'react';
import './Time24Field.css';

export function Time24Field({label,name,value,defaultValue='',onChange,required=false,disabled=false}:{label:string;name?:string;value?:string;defaultValue?:string;onChange?:(value:string)=>void;required?:boolean;disabled?:boolean}){
 const id=useId(),[local,setLocal]=useState(defaultValue),current=value??local;
 const match=/^([01]\d|2[0-3]):([0-5]\d)(?::\d{2})?$/.exec(current),hour=match?.[1]||'',minute=match?.[2]||'00';
 function change(next:string){if(value===undefined)setLocal(next);onChange?.(next);}
 return <div className="time24-field"><div className="time24-controls"><label htmlFor={`${id}-hour`}>{label}<select id={`${id}-hour`} value={hour} disabled={disabled} required={required} onChange={e=>change(e.target.value?`${e.target.value}:${minute}`:'')}><option value="">{required?'Elegí la hora':'Sin horario'}</option>{Array.from({length:24},(_,n)=>String(n).padStart(2,'0')).map(h=><option key={h} value={h}>{h}</option>)}</select></label><label htmlFor={`${id}-minute`}>Minutos<select aria-label={`Minutos · ${label}`} id={`${id}-minute`} value={minute} disabled={disabled||!hour} onChange={e=>change(`${hour}:${e.target.value}`)}>{Array.from({length:60},(_,n)=>String(n).padStart(2,'0')).map(m=><option key={m} value={m}>{m}</option>)}</select></label></div>{name&&<input type="hidden" name={name} value={hour?`${hour}:${minute}`:''} disabled={disabled}/>}<p className="time24-preview" aria-live="polite">{hour?`${hour}:${minute}`:required?'Elegí hora y minutos':'Sin horario'}</p></div>;
}
