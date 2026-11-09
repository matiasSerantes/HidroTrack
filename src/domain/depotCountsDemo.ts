import type {DemoProgramState} from './programDemo';
export function setDemoDepotCounts(state:DemoProgramState,actor:string,id:string,expectedReady:number,expectedEmpty:number,ready:number,empty:number){
 if(actor!=='owner')throw Error('Solo el jefe puede corregir el depósito.');
 const product=state.products.find(p=>p.id===id&&p.active);if(!product)throw Error('Producto no disponible.');
 if(product.depot!==expectedReady||(state.depotEmpties[id]||0)!==expectedEmpty)throw Error('El depósito cambió. Actualizá antes de guardar.');
 if(![ready,empty].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000)||Math.abs(ready-expectedReady)>100000||Math.abs(empty-expectedEmpty)>100000)throw Error('Revisá las cantidades del depósito.');
 if(empty>0&&(!product.returnable||product.kind==='rental'))throw Error('Este artículo no admite vacíos.');
 return {...state,products:state.products.map(p=>p.id===id?{...p,depot:ready}:p),depotEmpties:{...state.depotEmpties,[id]:empty}};
}
