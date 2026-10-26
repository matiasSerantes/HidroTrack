import {it,expect} from 'vitest';
import {matchesCustomer} from '../src/domain/customerSearch';
const c={name:'María José',address:'San Martín 123',phone:'+54 (11) 5982-6508'};
it('encuentra cliente por nombre sin acentos, direccion y telefono',()=>{
 for(const query of ['  MARIA  ','jose maria','martin 123','59826508','11 5982','+541159826508'])expect(matchesCustomer(c,query)).toBe(true);
 expect(matchesCustomer(c,'martin 999')).toBe(false);expect(matchesCustomer(c,'')).toBe(true);
});
