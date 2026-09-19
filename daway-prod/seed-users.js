/**
 * seed-users.js — purge the `users` table and seed one known account per role.
 *
 * Hashing matches server.cjs exactly: bcryptjs with 10 salt rounds.
 * Run with: node seed-users.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import sqlite3verbose from 'sqlite3';

const sqlite3 = sqlite3verbose.verbose();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'daway.db');

const SALT_ROUNDS = 10;

/* email, password, role, pharmacy_name */
const SEED_USERS = [
  { email: 'admin@daway.com', password: 'admin123', role: 'admin', pharmacy_name: 'مدير النظام' },
  { email: 'owner@daway.com', password: 'owner123', role: 'pharmacy_owner', pharmacy_name: 'صيدلية النيل' },
  { email: 'staff@daway.com', password: 'staff123', role: 'pharmacy_staff', pharmacy_name: 'موظف صيدلية النيل' },
  { email: 'supplier@daway.com', password: 'supplier123', role: 'supplier', pharmacy_name: 'مورد النيل الطبي' },
  { email: 'customer@daway.com', password: 'customer123', role: 'customer', pharmacy_name: 'عميل تجريبي' },
];

const db = new sqlite3.Database(dbPath);

/* Promise wrappers around the callback-based sqlite3 API */
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve(this); // `this.lastID` / `this.changes`
    });
  });

const close = () =>
  new Promise((resolve, reject) => {
    db.close((error) => (error ? reject(error) : resolve()));
  });

async function seed() {
  await run('PRAGMA foreign_keys = OFF');

  const deleted = await run('DELETE FROM users');
  console.log(`Deleted ${deleted.changes} existing user(s).`);

  await run("DELETE FROM sqlite_sequence WHERE name = 'users'");
  console.log('Reset AUTOINCREMENT sequence for `users`.');

  // pharmacy_staff must hang off the owner, so insert sequentially and
  // remember the owner's new id.
  let ownerId = null;

  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    const owner_id = user.role === 'pharmacy_staff' ? ownerId : null;

    const result = await run(
      `INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id)
       VALUES (?, ?, ?, ?, ?)`,
      [user.pharmacy_name, user.email, passwordHash, user.role, owner_id],
    );

    if (user.role === 'pharmacy_owner') {
      ownerId = result.lastID;
      // server.cjs keeps owners self-referencing (`owner_id = id`); match it.
      await run('UPDATE users SET owner_id = ? WHERE id = ?', [ownerId, ownerId]);
    }

    console.log(
      `  + id=${result.lastID}  ${user.email.padEnd(22)} ${user.role.padEnd(15)} owner_id=${
        user.role === 'pharmacy_owner' ? ownerId : owner_id ?? 'NULL'
      }`,
    );
  }

  await run('PRAGMA foreign_keys = ON');
}

seed()
  .then(async () => {
    await close();
    console.log('Seeding completed successfully!');
  })
  .catch(async (error) => {
    console.error('Seeding failed:', error.message);
    try {
      await close();
    } catch {
      /* already closing down */
    }
    process.exitCode = 1;
  });
