import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import {assertPublicSupabaseConfig} from './tools/public-config.mjs';
export default defineConfig(({mode,command})=>{
  if(command==='build')assertPublicSupabaseConfig(loadEnv(mode,'.','VITE_'));
  return {plugins:[react()]};
});
