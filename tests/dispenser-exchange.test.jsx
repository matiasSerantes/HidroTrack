// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DispenserExchange } from '../src/features/DispenserExchange';
afterEach(cleanup);
const assignment={id:'contract',product_id:'old',mode:'rental',monthly:1000,occurred_on:'2026-01-01'};
const products=[{id:'new',name:'Dispenser frio calor',family:'dispenser',active:true}];
it('confirma retiro y reemplazo en un solo comando sin recrear contrato',()=>{
 const onSubmit=vi.fn();render(<DispenserExchange tenantId="a" assignment={assignment} products={products} balances={[{product_id:'new',depot_ready:1}]} truck={[]} trips={[]} locked={false} onSubmit={onSubmit}/>);
 fireEvent.click(screen.getByRole('button',{name:'Cambiar dispenser'}));fireEvent.change(screen.getByLabelText('Dispenser de reemplazo'),{target:{value:'new:depot'}});
 fireEvent.click(screen.getByRole('button',{name:'Confirmar retiro y reemplazo'}));
 expect(onSubmit).toHaveBeenCalledTimes(1);const command=onSubmit.mock.calls[0][0];expect(command.name).toBe('inventory_exchange_dispenser');expect(command.args).toMatchObject({p_assignment:'contract',p_product:'new',p_trip:null,p_state:'good',p_involved:null});expect(command.args.p_id).not.toBe(command.args.p_replacement_id);
});
it('rotura explicita baja definitiva y registra responsable del camion',()=>{
 const onSubmit=vi.fn();render(<DispenserExchange tenantId="a" assignment={assignment} products={products} balances={[]} truck={[{product_id:'new',trip_id:'trip',ready:1}]} trips={[{id:'trip',name:'Reparto 1',status:'active'}]} locked={false} onSubmit={onSubmit}/>);
 fireEvent.click(screen.getByRole('button',{name:'Cambiar dispenser'}));fireEvent.change(screen.getByLabelText('Dispenser de reemplazo'),{target:{value:'new:trip'}});fireEvent.change(screen.getByLabelText('Estado del dispenser retirado'),{target:{value:'broken'}});
 expect(screen.getByText(/Para un equipo reparable/)).toBeTruthy();fireEvent.change(screen.getByLabelText('Con quién se rompió'),{target:{value:'driver'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar retiro y reemplazo'}));
 expect(onSubmit.mock.calls[0][0].args).toMatchObject({p_trip:'trip',p_state:'broken',p_involved:'driver'});
});
