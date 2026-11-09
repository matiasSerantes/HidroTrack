import {useState,type FormEvent} from 'react';
import {stockToday} from './OwnerStockIncident';
import './DepotCountsEditor.css';
type Command={name:string;args:Record<string,unknown>;message:string};
export function DepotCountsEditor({tenantId,product,ready,empty,locked,onSubmit}:{tenantId:string;product:{id:string;name:string;returnable:boolean;family?:string};ready:number;empty:number;locked:boolean;onSubmit:(command:Command)=>void}){
 const bottles=product.returnable&&product.family!=='dispenser';
 const [filled,setFilled]=useState(String(ready)),[empties,setEmpties]=useState(String(empty)),[error,setError]=useState('');
 const nextReady=Number(filled),nextEmpty=bottles?Number(empties):0;
 const valid=filled!==''&&(!bottles||empties!=='')&&[nextReady,nextEmpty].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000)&&Math.abs(nextReady-ready)<=100000&&Math.abs(nextEmpty-empty)<=100000;
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(locked)return;
  const data=new FormData(event.currentTarget),date=String(data.get('count_date')||''),note=String(data.get('count_note')||'').trim();
  if(!valid||!date||date>stockToday()||!note||note.length>360){setError('Revisá cantidades enteras, fecha y motivo. Cada ajuste admite hasta 100.000 unidades por estado.');return;}
  if(nextReady===ready&&nextEmpty===empty){setError('Las cantidades ya coinciden. No hace falta guardar un ajuste.');return;}
  if(!confirm(`¿Guardar el conteo de ${product.name}?\n${ready} disponibles → ${nextReady}${bottles?`\n${empty} vacíos → ${nextEmpty}`:''}\nSe corrige solo el depósito.`))return;
  setError('');onSubmit({name:'inventory_set_depot_counts',args:{p_tenant:tenantId,p_id:crypto.randomUUID(),p_product:product.id,p_expected_ready:ready,p_expected_empty:empty,p_ready:nextReady,p_empty:nextEmpty,p_date:date,p_note:note},message:'Conteo del depósito actualizado. Clientes y camiones conservan sus cantidades.'});
 }
 return <details className="depot-counts-editor"><summary>{bottles?'Editar llenos y vacíos':'Editar disponibles'}</summary><form onSubmit={submit}><h4>Conteo de {product.name}</h4><p>Escribí cuántos tenés hoy en el depósito. No incluyas lo que está en clientes o camiones.</p><fieldset disabled={locked}><label>{bottles?'Llenos en depósito':'Disponibles en depósito'}<input type="number" inputMode="numeric" min="0" max="1000000000" step="1" required value={filled} onChange={e=>setFilled(e.target.value)}/></label>{bottles&&<label>Vacíos en depósito<input type="number" inputMode="numeric" min="0" max="1000000000" step="1" required value={empties} onChange={e=>setEmpties(e.target.value)}/></label>}<label>Fecha del conteo<input name="count_date" type="date" defaultValue={stockToday()} max={stockToday()} required/></label><label>Motivo<input name="count_note" defaultValue="Conteo físico del depósito" maxLength={360} required/></label>{valid&&<p role="status">Depósito: {ready+empty} → {nextReady+nextEmpty} unidades. {nextReady+nextEmpty===ready+empty?'Se conserva el total.':'El total propio se corrige por la diferencia.'}</p>}{error&&<p role="alert">{error}</p>}<button className="hd-btn primary" type="submit">{bottles?'Guardar llenos y vacíos':'Guardar disponibles'}</button></fieldset></form></details>;
}
