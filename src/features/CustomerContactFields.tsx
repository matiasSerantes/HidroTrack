import {useState} from 'react';
export type CustomerContactData={phone?:string;phone2?:string;phone3?:string;delivery_notes?:string};
export function readContactPatch(form:FormData,original?:CustomerContactData){
 const patch:Record<string,string>={};
 for(const key of ['phone2','phone3','delivery_notes'] as const){const value=String(form.get(key)||'').trim();if(value||original?.[key])patch[key]=value;}
 return patch;
}
export function CustomerContactFields({initial,disabled=false}:{initial?:CustomerContactData;disabled?:boolean}){
 const [phones,setPhones]=useState(()=>{const all=[initial?.phone||'',initial?.phone2||'',initial?.phone3||''];while(all.length>1&&!all.at(-1))all.pop();return all;});
 return <><section className="customer-contact-fields"><h4>Teléfonos del cliente</h4>{phones.map((phone,i)=><div key={i}><label>{i===0?'Teléfono':`Teléfono ${i+1}`}<input name={i===0?'phone':`phone${i+1}`} type="tel" maxLength={40} disabled={disabled} value={phone} onChange={e=>setPhones(values=>values.map((v,j)=>j===i?e.target.value:v))}/></label>{i>0&&<button type="button" disabled={disabled} onClick={()=>setPhones(values=>values.filter((_,j)=>j!==i))}>Quitar número {i+1}</button>}</div>)}{phones.length<3&&<button type="button" disabled={disabled} onClick={()=>setPhones(values=>[...values,''])}>Agregar otro número</button>}</section><label>Descripción / indicaciones de entrega<textarea name="delivery_notes" maxLength={500} rows={3} defaultValue={initial?.delivery_notes||''} disabled={disabled} placeholder="Departamento, timbre, casa de adelante, referencias para llegar…"/></label></>;
}
export function CustomerContactDetails({customer}:{customer:CustomerContactData}){
 const phones=[customer.phone,customer.phone2,customer.phone3].filter((p):p is string=>!!p?.trim());
 return <>{phones.length>0&&<div className="customer-contact-details"><strong>Teléfonos</strong>{phones.map((phone,i)=><a key={i} href={`tel:${phone.replace(/[^\d+]/g,'')}`}>{phone}</a>)}</div>}{customer.delivery_notes&&<p className="notice"><strong>Indicaciones de entrega: </strong>{customer.delivery_notes}</p>}</>;
}
