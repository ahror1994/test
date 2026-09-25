import { rmSync } from 'node:fs';
import { DB_PATH } from './db.ts';

// Deleting the file is enough: the server recreates schema and demo data on start.
for (const suffix of ['', '-wal', '-shm']) rmSync(DB_PATH + suffix, { force: true });
console.log('Database removed:', DB_PATH);
