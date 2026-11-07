export type SaleCombo={usual_quantity?:number;id:string;name:string;price:number;version:number;active:boolean;available:number;items:{product_id:string;quantity:number}[]};
export type ComboProduct={id:string;name:string;price:number;ready:number;held:number;active:boolean;returnable:boolean};
export function comboUnits(combo:Pick<SaleCombo,'items'>,stock:(id:string)=>number){return Math.max(0,Math.min(...combo.items.map(i=>Math.floor(stock(i.product_id)/Number(i.quantity)))));}
export function comboDelivery(products:ComboProduct[],quantities:Record<string,{quantity:number;returned:number}>,combos:SaleCombo[],selection:Record<string,number>){
 if(Object.entries(selection).some(([id,q])=>!Number.isSafeInteger(q)||q<0||q>100000||(q>0&&!combos.some(c=>c.id===id))))throw new Error('Promociones no disponibles. Actualizá la planilla.');
 const bundled:Record<string,number>={};let total=0;const requests:{id:string;version:number;quantity:number}[]=[];
 for(const combo of combos){const q=selection[combo.id]||0;if(!Number.isSafeInteger(q)||q<0||q>100000)throw new Error('Revisá la cantidad de promociones.');if(!q)continue;if(!combo.active)throw new Error('Promoción no disponible.');requests.push({id:combo.id,version:combo.version,quantity:q});total+=Math.round(Number(combo.price)*100)*q;for(const i of combo.items)bundled[i.product_id]=(bundled[i.product_id]||0)+Number(i.quantity)*q;}
 const items=products.map(p=>{const extra=quantities[p.id]?.quantity||0,returned=quantities[p.id]?.returned||0;total+=Math.round(Number(p.price)*100)*extra;return {product_id:p.id,quantity:extra+(bundled[p.id]||0),returned};}).filter(i=>i.quantity+i.returned>0);
 if(Object.keys(bundled).some(id=>!products.some(p=>p.id===id)))throw new Error('Faltan artículos de la promoción en el camión.');
 for(const i of items){const p=products.find(p=>p.id===i.product_id)!;if(![i.quantity,i.returned].every(q=>Number.isSafeInteger(q)&&q>=0&&q<=100000)||i.quantity>Number(p.ready)||i.returned>Number(p.held)+i.quantity)throw new Error('No alcanza el stock del camión o la devolución supera los envases del cliente.');}
 if(!Number.isSafeInteger(total)||total<0)throw new Error('Importe de entrega inválido.');
 return {total,items,requests,bundled};
}
