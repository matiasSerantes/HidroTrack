// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {Time24Field} from '../src/features/Time24Field';
import {movementClock} from '../src/domain/deviceClock';
afterEach(cleanup);
it('guarda 15:30 sin conversion AM/PM ni selector de reloj del telefono',()=>{
 const {container}=render(<form><Time24Field label="Hora para volver" name="time" required/></form>);
 expect(container.querySelector('input[type="time"]')).toBeNull();expect(container.querySelector('form').checkValidity()).toBe(false);
 fireEvent.change(screen.getByLabelText('Hora para volver'),{target:{value:'15'}});fireEvent.change(screen.getByLabelText('Minutos \u00b7 Hora para volver'),{target:{value:'30'}});
 expect(new FormData(container.querySelector('form')).get('time')).toBe('15:30');expect(screen.getByText('15:30')).toBeTruthy();expect(container.querySelector('form').checkValidity()).toBe(true);
});
it('admite medianoche y 23:59, y permite quitar un horario opcional',()=>{
 const {container}=render(<form><Time24Field label="Visita" name="time" defaultValue="00:00"/></form>),form=container.querySelector('form');
 expect(new FormData(form).get('time')).toBe('00:00');fireEvent.change(screen.getByLabelText('Visita'),{target:{value:'23'}});fireEvent.change(screen.getByLabelText('Minutos \u00b7 Visita'),{target:{value:'59'}});expect(new FormData(form).get('time')).toBe('23:59');
 fireEvent.change(screen.getByLabelText('Visita'),{target:{value:''}});expect(new FormData(form).get('time')).toBe('');expect(form.checkValidity()).toBe(true);
});
it('el historial usa 00:00 al iniciar el dia y 15:00 por la tarde',()=>{
 const clock=at=>movementClock({created_at:at,device_recorded_at:at,device_time_zone:'America/Argentina/Buenos_Aires'});
 expect(clock('2026-11-23T03:00:00Z')).toContain('00:00:00');expect(clock('2026-11-23T18:00:00Z')).toContain('15:00:00');expect(clock('2026-11-23T18:00:00Z')).not.toMatch(/a\.?m\.?|p\.?m\.?/i);
});
