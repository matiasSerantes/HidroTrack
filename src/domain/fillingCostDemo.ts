import type { DemoProgramState, Product, Trip } from './programDemo';

export type FillingCostBasis = 'refilled';
export type FillingCostSnapshot = {basis:FillingCostBasis;items:{productId:string;name:string;quantity:number;unitCost:number}[];total:number};
export function fillingCostPreview(s:DemoProgramState,quantities:Record<string,number>,refill:boolean):FillingCostSnapshot|undefined {
  if(!s.fillingCost?.enabled)return undefined;
  const basis='refilled';
  const items=s.products.filter(p=>p.active&&p.returnable&&p.kind==='sale'&&p.fillingCostEnabled).flatMap(p=>{
    const loaded=quantities[p.id]||0,quantity=refill?Math.max(0,loaded-p.depot):0;
    if(!Number.isSafeInteger(quantity)||quantity<0||quantity>100000)throw new Error('Revisá las cantidades de llenado.');
    const unitCost=p.fillingCost??0;
    if(!Number.isSafeInteger(unitCost)||unitCost<0)throw new Error(`Revisá el costo de llenado de ${p.name}.`);
    return quantity?[{productId:p.id,name:p.name,quantity,unitCost}]:[];
  });
  const total=items.reduce((sum,item)=>sum+item.quantity*item.unitCost,0);
  if(!Number.isSafeInteger(total))throw new Error('El costo de la carga supera el rango permitido.');
  return {basis,items,total};
}
export function setProductFillingCost(p:Product,enabled:boolean,cost:number):Product {
  if(!enabled)return {...p,fillingCostEnabled:false};
  if(!p.returnable||p.kind!=='sale')throw new Error('El llenado corresponde a envases retornables de venta, no a dispenser.');
  if(!Number.isSafeInteger(cost)||cost<0)throw new Error('Ingresá un costo de llenado válido.');
  return {...p,fillingCostEnabled:true,fillingCost:cost};
}
export function tripFillingResult(s:DemoProgramState,t:Trip){
  const sold=s.sales.filter(v=>v.tripId===t.id).reduce((total,sale)=>total+sale.items.reduce((sum,item)=>sum+item.price*item.quantity,0),0);
  return {sold,cost:t.fillingCost?.total,result:t.fillingCost?sold-t.fillingCost.total:undefined};
}
