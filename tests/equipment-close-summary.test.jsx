// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {EquipmentCloseSummary} from '../src/features/EquipmentCloseSummary';
afterEach(cleanup);
it('resumen muestra retirado roto y equipo por serie como detalle sin aumentar stock',()=>{
 render(<EquipmentCloseSummary detail={{version:1,models:[{id:'x',date:'2026-10-25',kind:'exchanged',name:'Básico',replacement:'Frío/calor',quantity:1,state:'broken'}],serialized:[{id:'s',date:'2026-10-25',kind:'returned',name:'Equipo identificado',serial:'EQ-TEST',quantity:1}]}}/>);
 expect(screen.getByText('Reemplazo entregado: Frío/calor')).toBeTruthy();expect(screen.getByText(/Retirado roto: baja definitiva/)).toBeTruthy();expect(screen.getByText('Identificación: EQ-TEST')).toBeTruthy();expect(screen.getByText(/No se suman otra vez al regreso/)).toBeTruthy();
});
it('un cierre anterior sin detalle no inventa una lista de cambios',()=>{const view=render(<EquipmentCloseSummary/>);expect(view.container.textContent).toBe('');});
