import {useState} from 'react';
export type CustomerContactData={phone?:string;phone2?:string;phone3?:string;phone2_name?:string;phone3_name?:string;delivery_notes?:string};
export function readContactPatch(form:FormData,original?:CustomerContactData){
 const patch:Record<string,string>={};
 for(const key of ['phone2','phone3','delivery_notes'] as const){const value=String(form.get(key)||'').trim();if(value||original?.[key])patch[key]=value;}
 for(const [number,key] of [['phone2','phone2_name'],['phone3','phone3_name']] as const){const value=String(form.get(number)||'').trim()?String(form.get(key)||'').trim():'';if(value||original?.[key])patch[key]=value;}
 return patch;
}
export function CustomerContactFields({initial,disabled=false}:{initial?:CustomerContactData;disabled?:boolean}){
 const [phones,setPhones]=useState(()=>{const all=[{phone:initial?.phone||'',name:''},{phone:initial?.phone2||'',name:initial?.phone2_name||''},{phone:initial?.phone3||'',name:initial?.phone3_name||''}];while(all.length>1&&!all.at(-1)?.phone&&!all.at(-1)?.name)all.pop();return all;});
 return <><section className="customer-contact-fields"><h4>Teléfonos del cliente</h4>{phones.map((entry,i)=><div key={i}><label>{i===0?'Teléfono':`Teléfono ${i+1}`}<input name={i===0?'phone':`phone${i+1}`} type="tel" maxLength={40} required={i>0&&!!entry.name.trim()} disabled={disabled} value={entry.phone} onChange={e=>setPhones(values=>values.map((v,j)=>j===i?{...v,phone:e.target.value}:v))}/></label>{i>0&&<><label>Nombre del contacto {i+1}<input name={`phone${i+1}_name`} maxLength={100} placeholder="Ej.: Ana, hija del cliente" disabled={disabled} value={entry.name} onChange={e=>setPhones(values=>values.map((v,j)=>j===i?{...v,name:e.target.value}:v))}/></label><button type="button" disabled={disabled} onClick={()=>setPhones(values=>values.filter((_,j)=>j!==i))}>Quitar número {i+1}</button></>}</div>)}{phones.length<3&&<button type="button" disabled={disabled} onClick={()=>setPhones(values=>[...values,{phone:'',name:''}])}>Agregar otro número</button>}</section><label>Descripción / indicaciones de entrega<textarea name="delivery_notes" maxLength={500} rows={3} defaultValue={initial?.delivery_notes||''} disabled={disabled} placeholder="Departamento, timbre, casa de adelante, referencias para llegar…"/></label></>;
}
export function CustomerContactDetails({customer}:{customer:CustomerContactData}){
 const phones=[{phone:customer.phone,name:''},{phone:customer.phone2,name:customer.phone2_name},{phone:customer.phone3,name:customer.phone3_name}].filter(p=>!!p.phone?.trim());
 return <>{phones.length>0&&<div className="customer-contact-details"><strong>Teléfonos</strong>{phones.map((p,i)=><a key={i} href={`tel:${p.phone!.replace(/[^\d+]/g,'')}`}>{p.name?`${p.name} · `:''}{p.phone}</a>)}</div>}{customer.delivery_notes&&<p className="notice"><strong>Indicaciones de entrega: </strong>{customer.delivery_notes}</p>}</>;
}
