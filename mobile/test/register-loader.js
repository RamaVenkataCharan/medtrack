import { register } from 'node:module';

process.env.NODE_ENV = 'test';
globalThis.__DEV__ = true;

register('./mock-loader.js', import.meta.url);

