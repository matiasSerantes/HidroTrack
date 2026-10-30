type SearchableCustomer={name:string;address:string;phone:string};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function matchesCustomerStreet(customer:{address:string},query:string){
 const address=normalize(customer.address);
 return normalize(query).split(/\s+/).filter(Boolean).every(token=>address.includes(token));
}
export function matchesCustomer(customer:SearchableCustomer,query:string){
 const text=normalize(`${customer.name} ${customer.address} ${customer.phone}`),phone=customer.phone.replace(/\D/g,'');
 return normalize(query).split(/\s+/).filter(Boolean).every(token=>text.includes(token)||(/^\+?[\d().-]+$/.test(token)&&phone.includes(token.replace(/\D/g,''))));
}
