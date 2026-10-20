export type AssetMovement = { id: string; direction: 'delivered' | 'collected'; quantity: number; createdAt: string; note: string };
export type CustomerAsset = { id: string; name: string; kind: 'bottle' | 'base' | 'dispenser' | 'other'; owner: 'reparto' | 'customer'; openingQuantity: number; createdAt: string; movements: AssetMovement[] };
export function assetQuantity(asset: CustomerAsset) {
 return asset.movements.reduce((quantity,m) => quantity + (m.direction === 'delivered' ? m.quantity : -m.quantity),asset.openingQuantity);
}
export function addAssetMovement(asset: CustomerAsset, direction: AssetMovement['direction'], quantity: number, note: string): CustomerAsset {
 if (!['delivered','collected'].includes(direction) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error('Ingresá una cantidad entera entre 1 y 10000.');
 if (direction === 'collected' && quantity > assetQuantity(asset)) throw new Error('No podés retirar más unidades de las que tiene el cliente.');
 return { ...asset, movements: [...asset.movements,{id:crypto.randomUUID(),direction,quantity,createdAt:new Date().toISOString(),note:note.trim()}] };
}
export function exampleAssets(customerId:string):CustomerAsset[]|undefined {
 if(!['maria','ana'].includes(customerId))return undefined;
 const createdAt='2026-10-17T12:00:00Z';
 const base={owner:'reparto' as const,createdAt,movements:[]};
 return [
  {...base,id:`${customerId}-bottles`,name:'Bidón retornable 20 L',kind:'bottle',openingQuantity:customerId==='maria'?3:4},
  {...base,id:`${customerId}-bases`,name:'Base de bidón',kind:'base',openingQuantity:customerId==='maria'?2:1},
  ...(customerId==='ana'?[{...base,id:'ana-dispenser',name:'Dispenser frío / calor',kind:'dispenser' as const,openingQuantity:1}]:[]),
 ];
}
