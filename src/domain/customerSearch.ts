type SearchableCustomer={name:string;address:string;phone:string;phone2?:string;phone3?:string;phone4?:string;phone5?:string;phone6?:string};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function matchesCustomerStreet(customer:{address:string},query:string){
 const address=normalize(customer.address);
 return normalize(query).split(/\s+/).filter(Boolean).every(token=>address.includes(token));
}
export function matchesCustomer(customer:SearchableCustomer,query:string){
 const numbers=[customer.phone,customer.phone2,customer.phone3,customer.phone4,customer.phone5,customer.phone6].filter(Boolean).join(' '),text=normalize(`${customer.name} ${customer.address} ${numbers}`),phone=numbers.replace(/\D/g,'');
 return normalize(query).split(/\s+/).filter(Boolean).every(token=>text.includes(token)||(/^\+?[\d().-]+$/.test(token)&&phone.includes(token.replace(/\D/g,''))));
}
