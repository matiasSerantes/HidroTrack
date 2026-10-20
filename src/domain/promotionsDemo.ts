import { demoDay, uid, type DemoProgramState } from './programDemo';

export type Promotion = {
  id:string; name:string; address:string; phone:string; terms:string; startedOn:string; followUp:string;
  status:'trial'|'recovery'|'converted'|'closed'; delivered:Record<string,number>; held:Record<string,number>;
  damaged:Record<string,number>; clientId?:string; history:string[];
};
function owner(s:DemoProgramState, actor:string) {
  if(!s.members.some(m=>m.id===actor&&m.active&&m.role==='owner'))throw new Error('Solo el jefe administra promociones en esta demo.');
}
function quantity(q:number) { if(!Number.isSafeInteger(q)||q<0||q>100000)throw new Error('Ingresá cantidades enteras entre 0 y 100.000.'); }
export function createPromotion(state:DemoProgramState,actor:string,input:{name:string;address:string;phone:string;terms:string;followUp:string;items:Record<string,number>}) {
  owner(state,actor);
  if(!input.name.trim()||!input.address.trim()||!input.terms.trim())throw new Error('Completá nombre, dirección y condiciones de la promoción.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.followUp)||!Number.isFinite(Date.parse(input.followUp))||new Date(input.followUp).toISOString().slice(0,10)!==input.followUp||input.followUp<demoDay)throw new Error('Elegí una fecha de seguimiento desde el día de la demo.');
  const s=structuredClone(state),items:Record<string,number>={};
  for(const [id,q] of Object.entries(input.items)){
    quantity(q);if(!q)continue;
    const p=s.products.find(p=>p.id===id&&p.active&&(p.returnable||p.kind==='rental'));
    if(!p||q>p.depot)throw new Error('No hay suficientes unidades disponibles en depósito.');
    p.depot-=q;items[id]=q;
  }
  if(!Object.keys(items).length)throw new Error('Indicá qué entregás para probar.');
  s.promotions=[{id:uid(),name:input.name.trim(),address:input.address.trim(),phone:input.phone.trim(),terms:input.terms.trim(),startedOn:demoDay,followUp:input.followUp,status:'trial',delivered:items,held:{...items},damaged:{},history:[`${demoDay}: entrega de prueba desde depósito.`]},...(s.promotions||[])];
  return s;
}
export function decidePromotion(state:DemoProgramState,actor:string,id:string,accept:boolean,monthly:Record<string,number>={}){
  owner(state,actor);const s=structuredClone(state),p=s.promotions?.find(p=>p.id===id);
  if(!p||p.status!=='trial')throw new Error('La promoción ya fue resuelta.');
  if(!accept){p.status='recovery';p.history.push(`${demoDay}: no continúa; recuperar todos los bienes.`);return s;}
  for(const value of Object.values(monthly))if(!Number.isSafeInteger(value)||value<0||value>10000000000)throw new Error('Ingresá una cuota mensual válida.');
  const clientId=uid();
  s.clients.push({id:clientId,promotionId:p.id,name:p.name,address:p.address,phone:p.phone,locality:s.company.locality,block:'',x:50,y:50,active:true,debt:0,joinedOn:demoDay,usual:'Definir próxima visita',note:`Alta desde promoción. ${p.terms}`,held:Object.fromEntries(Object.entries(p.held).filter(([id])=>s.products.find(v=>v.id===id)?.returnable&&s.products.find(v=>v.id===id)?.kind!=='rental')),rentals:Object.entries(p.held).flatMap(([id,q])=>s.products.find(v=>v.id===id)?.kind==='rental'?Array.from({length:q},()=>({id:uid(),productId:id,serial:'PROMO-DEMO',monthly:monthly[id]||0,mode:(monthly[id]?'rental':'loan') as 'rental'|'loan'})):[])});
  p.clientId=clientId;p.status='converted';p.held={};p.history.push(`${demoDay}: acepta el servicio; alta sin duplicar inventario.`);
  return s;
}
export function recoverPromotion(state:DemoProgramState,actor:string,id:string,returns:Record<string,{good:number;damaged:number}>){
  owner(state,actor);const s=structuredClone(state),p=s.promotions?.find(p=>p.id===id);
  if(!p||p.status!=='recovery')throw new Error('Primero marcá que no continúa.');
  let total=0;
  for(const [productId,r] of Object.entries(returns)){
    quantity(r.good);quantity(r.damaged);const q=r.good+r.damaged;if(!q)continue;
    if(q>(p.held[productId]||0))throw new Error('No puede devolver más de lo que tiene.');
    const product=s.products.find(v=>v.id===productId);if(!product)throw new Error('Artículo inexistente.');
    p.held[productId]-=q;
    if(product.returnable)s.depotEmpties[productId]=(s.depotEmpties[productId]||0)+r.good;
    else product.depot+=r.good;
    p.damaged[productId]=(p.damaged[productId]||0)+r.damaged;
    p.history.push(`${demoDay}: ${product.name}: ${r.good} devueltos en buen estado, ${r.damaged} dañados.`);total+=q;
  }
  if(!total)throw new Error('Ingresá una devolución.');
  if(Object.values(p.held).every(q=>q===0)){p.status='closed';p.history.push(`${demoDay}: cerrada; sin bienes pendientes.`);}
  return s;
}
