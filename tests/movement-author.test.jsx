// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {CustomerMovementAuthor} from '../src/features/CustomerMovementAuthor';
afterEach(cleanup);
it('no atribuye al usuario actual una accion sin autor o con perfil historico inaccesible',()=>{
 const props={profiles:[],trips:[],userId:'owner'};
 const {rerender}=render(<CustomerMovementAuthor {...props} actorId="former-driver" tripId="old-route"/>);
 expect(screen.getByText('Registrado por: Usuario former-d · nombre no disponible')).toBeTruthy();
 expect(screen.getByText('Reparto: Nombre no disponible')).toBeTruthy();
 rerender(<CustomerMovementAuthor {...props}/>);expect(screen.getByText('Registrado por: Usuario no identificado')).toBeTruthy();expect(screen.queryByText(/Vos/)).toBeNull();
});
