import {it,expect} from 'vitest';
import {readCustomerSince} from '../src/domain/customerSince';
it('conserva la fecha historica sin convertirla por zona horaria y permite desconocida',()=>{
 expect(readCustomerSince('2019-06-12','2026-10-30')).toBe('2019-06-12');
 expect(readCustomerSince('','2026-10-30')).toBeNull();
 expect(readCustomerSince('2024-02-29','2026-10-30')).toBe('2024-02-29');
});
it('rechaza futuras y fechas imposibles antes de enviar el formulario',()=>{
 for(const date of ['2026-10-31','2025-02-29','2026-04-31','1899-12-31','no-fecha'])expect(()=>readCustomerSince(date,'2026-10-30')).toThrow();
});
