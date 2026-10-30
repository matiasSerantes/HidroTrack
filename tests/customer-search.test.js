import {it,expect} from 'vitest';
import {matchesCustomer,matchesCustomerStreet} from '../src/domain/customerSearch';
const c={name:'María José',address:'San Martín 123',phone:'+54 (11) 5982-6508'};
it('encuentra cliente por nombre sin acentos, direccion y telefono',()=>{
 for(const query of ['  MARIA  ','jose maria','martin 123','59826508','11 5982','+541159826508'])expect(matchesCustomer(c,query)).toBe(true);
 expect(matchesCustomer(c,'martin 999')).toBe(false);expect(matchesCustomer(c,'')).toBe(true);
});
it('filtra todos los domicilios de una calle sin buscar en nombres ni telefonos',()=>{
 const customers=[c,{name:'Otro',address:'San Martín 8771',phone:''},{name:'San Martín',address:'Belgrano 123',phone:'123'}];
 expect(customers.filter(item=>matchesCustomerStreet(item,'  SAN martin '))).toEqual(customers.slice(0,2));
 expect(matchesCustomerStreet(c,'martin 999')).toBe(false);
 expect(matchesCustomerStreet(c,'5982')).toBe(false);
 expect(matchesCustomerStreet(c,'')).toBe(true);
 expect(matchesCustomerStreet({address:'9 de Julio 300'},'9 de julio')).toBe(true);
 expect(customers.filter(item=>matchesCustomerStreet(item,'martin')&&matchesCustomer(item,'jose'))).toEqual([c]);
});
