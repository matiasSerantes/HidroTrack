import {expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createOwnerClosePdf,ownerCloseReceiptLines} from '../src/domain/ownerCloseReceipt';

const snapshot={id:'cierre-prueba-1',closed_at:'2026-10-25T19:00:00Z',trip:{id:'ruta-prueba',name:'Centro - Prueba ficticia',date:'2026-10-25',status:'closed'},cash:8300.25,transfer:3500.50,sales:7000,pending_visits:0,equipment_count:0,pending_closure:false,stock:[{product_id:'agua',name:'Bidón 20 litros',family:'article',ready:10,empties:20},{product_id:'equipo',name:'Dispenser frío/calor',family:'dispenser',ready:1,empties:0}],initial_load:[{product_id:'agua',name:'Bidón 20 litros',loaded:30},{product_id:'equipo',name:'Dispenser frío/calor',loaded:2}],note:'Conteo revisado (sin diferencias).'};
it('PDF real usa importes en pesos y separa ventas, cobros y cantidades históricas',()=>{
 const lines=ownerCloseReceiptLines(snapshot,'empresa-ficticia').join('\n');
 expect(lines).toContain('8.300,25');expect(lines).toContain('3.500,50');expect(lines).toContain('11.800,75');expect(lines).toContain('7.000,00');expect(lines).toContain('16:00:00');expect(lines).toContain('Bidón 20 litros: 30');expect(lines).toContain('Llenos / unidades listas: 10 | Vacíos: 20');expect(lines).toContain('Unidades disponibles que vuelven: 1');expect(lines).not.toContain('DEMO');expect(lines).toContain('no desglosa cambios ni series');
 mkdirSync('output/pdf',{recursive:true});writeFileSync('output/pdf/cierre-jefe-prueba.pdf',createOwnerClosePdf(snapshot,'empresa-ficticia'));
});
it('rechaza previsualización, datos incompletos e importes inválidos en vez de emitir un comprobante',()=>{
 for(const patch of [{trip:{...snapshot.trip,status:'active'}},{id:undefined},{cash:NaN},{transfer:-1},{stock:[{...snapshot.stock[0],ready:1.5}]},{closed_at:'invalida'}])expect(()=>createOwnerClosePdf({...snapshot,...patch},'empresa-ficticia')).toThrow();
});
it('pagina nombres extensos, escapa PDF y no consulta productos actuales',()=>{
 const long={...snapshot,stock:Array.from({length:70},(_,i)=>({...snapshot.stock[0],name:`Artículo ${i} (lote) \\ `+'nombre extenso '.repeat(12)}))};
 const text=new TextDecoder().decode(createOwnerClosePdf(long,'empresa-ficticia'));expect(text).toContain('\\050lote\\051');expect((text.match(/\/Type \/Page /g)||[]).length).toBeGreaterThan(2);expect(text).not.toContain('DEMO');
 mkdirSync('tmp/pdfs',{recursive:true});writeFileSync('tmp/pdfs/cierre-jefe-largo.pdf',createOwnerClosePdf(long,'empresa-ficticia'));
});
