const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const helmet = require('helmet');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your_secret_key_here') {
  console.error('Fatal error: JWT_SECRET must be set in .env and must not be the default insecure value.');
  process.exit(1);
}

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = {
  ADMIN: 'admin',
  SUPPLIER: 'supplier',
  OWNER: 'pharmacy_owner',
  STAFF: 'pharmacy_staff',
  CUSTOMER: 'customer',
};

const dbPath = path.join(__dirname, 'daway.db');
const backupsDir = path.join(__dirname, 'backups');

// ------------------- إعداد قاعدة البيانات -------------------
if (!fs.existsSync(dbPath)) {
  fs.closeSync(fs.openSync(dbPath, 'a'));
}

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (error) => {
  if (error) {
    console.error('Database connection failed:', error.message);
    return;
  }
  console.log('Local SQLite database connected successfully.');
});

// Every request shares `db`, so a BEGIN issued on it would sweep other requests'
// statements into the transaction (and a ROLLBACK would discard them). Multi-
// statement writes therefore run on this second connection, one transaction at
// a time (see withTransaction). WAL lets `db` keep reading meanwhile, and the
// busy timeout makes a plain write on `db` wait for the transaction's lock
// instead of failing with SQLITE_BUSY.
const txDb = new sqlite3.Database(dbPath);

for (const connection of [db, txDb]) {
  connection.configure('busyTimeout', 5000);
  connection.run('PRAGMA foreign_keys=ON', (err) => {
    if (err) console.error('Failed to enable foreign keys:', err.message);
  });
}
db.run('PRAGMA journal_mode=WAL', (err) => {
  if (err) console.error('Failed to enable WAL:', err.message);
});

// ------------------- دوال مساعدة لقاعدة البيانات -------------------
function queryHelpers(connection) {
  return {
    all: (sql, params = []) => new Promise((resolve, reject) => {
      connection.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    }),
    get: (sql, params = []) => new Promise((resolve, reject) => {
      connection.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    }),
    run: (sql, params = []) => new Promise((resolve, reject) => {
      connection.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }),
  };
}

const { all: dbAll, get: dbGet, run: dbRun } = queryHelpers(db);
const tx = queryHelpers(txDb);

/** Thrown inside a transaction to roll it back and answer with this status/body. */
class HttpError extends Error {
  constructor(status, body) {
    super(body.message || body.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

let txQueue = Promise.resolve();

/**
 * Runs `work(tx)` inside BEGIN IMMEDIATE … COMMIT on the transaction connection.
 * Transactions are queued so only one is open at a time; any throw rolls back.
 * Reads that decide the outcome (stock, order status) must go through `tx` so
 * they see the locked state.
 */
function withTransaction(work) {
  const result = txQueue.then(async () => {
    await tx.run('BEGIN IMMEDIATE');
    try {
      const value = await work(tx);
      await tx.run('COMMIT');
      return value;
    } catch (err) {
      await tx.run('ROLLBACK').catch(() => {});
      throw err;
    }
  });
  txQueue = result.catch(() => {});
  return result;
}

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.ROOT_ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('Fatal error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }
  const existing = await dbGet('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await dbRun(
      'INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id) VALUES (?, ?, ?, ?, ?)',
      ['System Admin', adminEmail, passwordHash, 'admin', null]
    );
    console.log(`Admin user created with email ${adminEmail}`);
  } else {
    console.log(`Admin user already exists with email ${adminEmail}`);
  }
}

// ------------------- إنشاء الجداول وتحديثها -------------------
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacy_name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'pharmacy_owner',
      owner_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pharmacies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      name TEXT,
      license_number TEXT,
      address TEXT,
      status TEXT,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      quantity INTEGER,
      batch_number TEXT,
      expire_date TEXT,
      price REAL,
      supplier_id INTEGER,
      category TEXT,
      barcode TEXT,
      cost_price REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS medicine_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacy_id INTEGER,
      medicine_id INTEGER,
      stock_quantity INTEGER,
      price REAL,
      FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacy_id INTEGER,
      customer_id INTEGER,
      status TEXT DEFAULT 'pending',
      total_amount REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pharmacy_id) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pharmacy_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacy_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_by INTEGER,
      reviewed_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL,
      description TEXT,
      bulk_qty INTEGER,
      bulk_price REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Purchase orders
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacy_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pharmacy_id) REFERENCES users(id),
      FOREIGN KEY (supplier_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      qty_requested INTEGER NOT NULL,
      qty_fulfilled INTEGER DEFAULT 0,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    )
  `);

  db.all('PRAGMA table_info(pharmacy_registrations)', (err, cols) => {
    if (!err) {
      if (!cols.some(c => c.name === 'password_hash')) {
        db.run('ALTER TABLE pharmacy_registrations ADD COLUMN password_hash TEXT');
      }
      if (!cols.some(c => c.name === 'rejection_reason')) {
        db.run('ALTER TABLE pharmacy_registrations ADD COLUMN rejection_reason TEXT');
      }
      if (!cols.some(c => c.name === 'notified')) {
        db.run('ALTER TABLE pharmacy_registrations ADD COLUMN notified INTEGER DEFAULT 0');
      }
    }
  });

  db.all('PRAGMA table_info(medicines)', (error, columns) => {
    if (error) {
      console.error('Failed to inspect medicines table:', error.message);
      return;
    }

    const neededColumns = [
      { name: 'user_id', type: 'INTEGER' },
      { name: 'supplier_id', type: 'INTEGER' },
      { name: 'category', type: 'TEXT' },
      { name: 'barcode', type: 'TEXT' },
      { name: 'cost_price', type: 'REAL' },
      { name: 'owner_id', type: 'INTEGER' },
    ];

    neededColumns.forEach((column) => {
      const exists = columns.some((col) => col.name === column.name);
      if (!exists) {
        db.run(`ALTER TABLE medicines ADD COLUMN ${column.name} ${column.type}`, (alterError) => {
          if (alterError) {
            console.error(`Failed to add ${column.name} column:`, alterError.message);
            return;
          }
          // Backfill only once the column exists; queued alongside the ALTER it
          // could be prepared first and fail with "no such column".
          if (column.name === 'owner_id') {
            db.run('UPDATE medicines SET owner_id = user_id', (updateErr) => {
              if (updateErr) console.error('Failed to migrate owner_id:', updateErr.message);
            });
          }
        });
      }
    });
  });

  db.all('PRAGMA table_info(users)', (error, columns) => {
    if (error) {
      console.error('Failed to inspect users table:', error.message);
      return;
    }

    const neededColumns = [
      { name: 'role', type: 'TEXT', defaultValue: "'pharmacy_owner'" },
      { name: 'owner_id', type: 'INTEGER', defaultValue: null },
      { name: 'phone', type: 'TEXT' },
      { name: 'country', type: 'TEXT' },
      { name: 'gender', type: 'TEXT' },
      { name: 'age', type: 'INTEGER' },
      { name: 'status', type: 'TEXT', defaultValue: "'active'" },
      { name: 'pharmacy_id', type: 'INTEGER', defaultValue: null },
    ];

    neededColumns.forEach((column) => {
      const exists = columns.some((col) => col.name === column.name);
      if (!exists) {
        const defaultClause = column.defaultValue !== undefined ? ` DEFAULT ${column.defaultValue}` : '';
        db.run(
          `ALTER TABLE users ADD COLUMN ${column.name} ${column.type}${defaultClause}`,
          (alterError) => {
            if (alterError) console.error(`Failed to add ${column.name} column:`, alterError.message);
          }
        );
      }
    });

    const hasRoleColumn = columns.some((col) => col.name === 'role');
    if (hasRoleColumn) {
      db.run("UPDATE users SET role = COALESCE(role, 'pharmacy_owner')");
    }
    const hasOwnerIdColumn = columns.some((col) => col.name === 'owner_id');
    if (hasOwnerIdColumn) {
      db.run("UPDATE users SET owner_id = id WHERE role = 'pharmacy_owner' AND (owner_id IS NULL OR owner_id = 0)");
    }
  });

  db.all('PRAGMA table_info(supplier_medicines)', (err, cols) => {
    if (!err) {
      if (!cols.some(c => c.name === 'bulk_qty')) {
        db.run('ALTER TABLE supplier_medicines ADD COLUMN bulk_qty INTEGER');
      }
      if (!cols.some(c => c.name === 'bulk_price')) {
        db.run('ALTER TABLE supplier_medicines ADD COLUMN bulk_price REAL');
      }
    }
  });

  db.all('PRAGMA table_info(orders)', (error, columns) => {
    if (error) {
      console.error('Failed to inspect orders table:', error.message);
      return;
    }

    const neededColumns = [
      { name: 'customer_id', type: 'INTEGER' },
      // مرفق إيصال بنكك — راجع POST /api/orders/:id/receipt
      { name: 'receipt_ref', type: 'TEXT' },
      { name: 'receipt_uploaded_at', type: 'TEXT' },
      { name: 'payment_status', type: 'TEXT', defaultValue: "'unpaid'" },
    ];

    neededColumns.forEach((column) => {
      const exists = columns.some((col) => col.name === column.name);
      if (!exists) {
        const defaultClause = column.defaultValue !== undefined ? ` DEFAULT ${column.defaultValue}` : '';
        db.run(`ALTER TABLE orders ADD COLUMN ${column.name} ${column.type}${defaultClause}`, (alterError) => {
          if (alterError) console.error(`Failed to add ${column.name} column:`, alterError.message);
        });
      }
    });
    db.all('PRAGMA table_info(purchase_orders)', (err, cols) => {
      if (!err) {
        if (!cols.some(c => c.name === 'total_amount')) {
          db.run('ALTER TABLE purchase_orders ADD COLUMN total_amount REAL');
        }
      }
    });
  });
});

// سييد أدمين أولي
seedAdmin().catch(err => {
  console.error('Failed to seed admin:', err);
  process.exit(1);
});


// ------------------- النسخ الاحتياطي -------------------
async function createDatabaseBackup() {
  try {
    if (!fs.existsSync(dbPath)) return;
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `daway-backup-${timestamp}.db`;
    const backupPath = path.join(backupsDir, backupFileName);
    // Copying the file is not safe in WAL mode (recent commits live in the
    // -wal file); VACUUM INTO writes a consistent snapshot.
    await dbRun('VACUUM INTO ?', [backupPath]);

    const backupFiles = fs
      .readdirSync(backupsDir)
      .filter((fileName) => fileName.startsWith('daway-backup-') && fileName.endsWith('.db'))
      .map((fileName) => {
        const fullPath = path.join(backupsDir, fileName);
        const stats = fs.statSync(fullPath);
        return { fileName, fullPath, time: stats.mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    backupFiles.slice(7).forEach((backup) => {
      fs.unlinkSync(backup.fullPath);
    });

    console.log(`Backup created: ${backupFileName}`);
  } catch (error) {
    console.error('Backup failed:', error.message);
  }
}

// ------------------- Middleware -------------------
// قائمة النطاقات المسموح بها (مفصولة بفاصلة في ALLOWED_ORIGIN)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // بدون Origin: طلبات same-origin أو أدوات مثل curl/Postman
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS: blocked origin ${origin}`);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(helmet());
app.use(compression());

// RATE LIMITING SETUP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiter specifically to sensitive routes
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/change-password', authLimiter);
app.use('/api/customer/order-batch', authLimiter);
app.use('/api/pos/order', authLimiter);
app.use('/api/supplier/purchase-order', authLimiter);



// Simple in-memory cache for sales summary
const salesSummaryCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Authenticates the bearer token, then loads the account from the database so
 * that a suspension, deletion or role change takes effect on the next request
 * rather than when the 7-day token expires. The token only proves identity;
 * role and owner_id always come from the row.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'مطلوب تسجيل الدخول' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'التوكن غير صالح أو منتهي' });
  }

  try {
    const user = await dbGet(
      'SELECT id, email, role, owner_id, status FROM users WHERE id = ?',
      [payload.user_id]
    );
    if (!user) {
      return res.status(401).json({ error: 'الحساب غير موجود' });
    }
    if (user.status === 'suspended') {
      return res.status(401).json({ error: 'تم إيقاف هذا الحساب' });
    }
    req.userId = user.id;
    req.userEmail = user.email;
    req.userRole = user.role;
    req.ownerId = user.owner_id || null;
    next();
  } catch (err) {
    console.error('verifyToken:', err);
    res.status(500).json({ error: 'تعذّر التحقق من الجلسة' });
  }
}

/** Returns an Arabic error message, or null when the password is acceptable. */
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} خانات على الأقل.`;
  }
  return null;
}

/** Returns an Arabic error for impossible stock/price/date values, or null. */
function medicineValuesProblem({ quantity, price, expire_date }) {
  if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0) return 'الكمية يجب أن تكون عدداً صحيحاً غير سالب.';
  if (!Number.isFinite(Number(price)) || Number(price) < 0) return 'السعر يجب أن يكون رقماً غير سالب.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expire_date)) || Number.isNaN(Date.parse(expire_date))) {
    return 'تاريخ الصلاحية غير صالح (الصيغة YYYY-MM-DD).';
  }
  return null;
}

/** Resolves a user id to an active pharmacy owner row, or null. */
function findOwner(ownerId) {
  const id = Number(ownerId);
  if (!Number.isInteger(id)) return Promise.resolve(null);
  return dbGet('SELECT id FROM users WHERE id = ? AND role = ?', [id, ROLES.OWNER]);
}

// ------------------- الصلاحيات -------------------
function checkRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ error: 'تسجيل الدخول مطلوب' });
    }
    if (roles.length > 0 && !roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية' });
    }
    next();
  };
}

// ------------------- المسارات العامة -------------------
app.get('/status', (req, res) => res.json({ status: 'running', timestamp: new Date() }));

// ------------------- إدارة المستخدمين -------------------
app.get('/api/users', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  try {
    const users = await dbAll(
      "SELECT id, pharmacy_name, email, role, owner_id, COALESCE(status, 'active') AS status, created_at FROM users ORDER BY id DESC"
    );
    res.json(users);
  } catch (err) {
    console.error('خطأ في /api/users:', err);
    res.status(500).json({ error: 'فشل تحميل المستخدمين' });
  }
});

// إضافة مستخدم جديد (للأدمن)
app.post('/api/users', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  try {
    // استقبال الحقول مع دعم الاسم الكامل (name) أو pharmacy_name
    const { name, pharmacy_name, email, password, role = ROLES.STAFF, owner_id } = req.body;

    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    }
    const weakPassword = passwordProblem(password);
    if (weakPassword) {
      return res.status(400).json({ error: weakPassword });
    }
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: 'دور غير صالح.' });
    }

    // Staff must hang off an existing owner; an owner is its own owner_id (set
    // after insert); every other role has none.
    let finalOwnerId = null;
    if (role === ROLES.STAFF) {
      const owner = await findOwner(owner_id);
      if (!owner) {
        return res.status(400).json({ error: 'يجب اختيار الصيدلية التي يتبع لها الموظف.' });
      }
      finalOwnerId = owner.id;
    }

    const hash = await bcrypt.hash(password, 10);

    // استخدام name أو pharmacy_name حسب المتاح من الواجهة
    const displayName = name || pharmacy_name || '';

    const result = await dbRun(
      'INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id) VALUES (?,?,?,?,?)',
      [displayName, email, hash, role, finalOwnerId]
    );
    if (role === ROLES.OWNER) {
      await dbRun('UPDATE users SET owner_id = ? WHERE id = ?', [result.lastID, result.lastID]);
    }

    res.json({ id: result.lastID, message: 'User created', email, role });
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE constraint failed: users.email')) {
      return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل.' });
    }
    res.status(500).json({ error: 'فشل إضافة المستخدم.' });
  }
});

// تعديل مستخدم
app.put('/api/users/:id', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  try {
    const userId = req.params.id;
    const { pharmacy_name, email, role, owner_id, password } = req.body;

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود.' });
    }

    let updateFields = [];
    let params = [];

    if (pharmacy_name !== undefined) {
      updateFields.push('pharmacy_name = ?');
      params.push(pharmacy_name);
    }
    if (email !== undefined) {
      const existing = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existing) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل.' });
      updateFields.push('email = ?');
      params.push(email);
    }
    if (role !== undefined) {
      if (!Object.values(ROLES).includes(role)) {
        return res.status(400).json({ error: 'دور غير صالح.' });
      }
      if (user.id === req.userId && role !== user.role) {
        return res.status(400).json({ error: 'لا يمكنك تغيير دور حسابك الحالي.' });
      }
      updateFields.push('role = ?');
      params.push(role);
    }

    // owner_id follows the resulting role: owners point at themselves, staff at
    // a real owner, everyone else at nothing.
    const nextRole = role !== undefined ? role : user.role;
    let nextOwnerId = null;
    if (nextRole === ROLES.OWNER) {
      nextOwnerId = user.id;
    } else if (nextRole === ROLES.STAFF) {
      const owner = await findOwner(owner_id !== undefined ? owner_id : user.owner_id);
      if (!owner) {
        return res.status(400).json({ error: 'يجب تحديد الصيدلية التي يتبع لها الموظف.' });
      }
      nextOwnerId = owner.id;
    }
    if (nextOwnerId !== user.owner_id) {
      updateFields.push('owner_id = ?');
      params.push(nextOwnerId);
    }

    if (password) {
      const weakPassword = passwordProblem(password);
      if (weakPassword) return res.status(400).json({ error: weakPassword });
      const password_hash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(password_hash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'لم يتم توفير أي حقول للتحديث.' });
    }

    params.push(userId);
    await dbRun(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'تم تحديث المستخدم بنجاح.' });
  } catch (err) {
    console.error('خطأ في تعديل المستخدم:', err);
    res.status(500).json({ error: err.message });
  }
});

// حذف مستخدم
app.delete('/api/users/:id', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  try {
    const userId = req.params.id;

    if (parseInt(userId) === req.userId) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك الحالي.' });
    }

    const user = await dbGet('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود.' });
    }

    await dbRun('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'تم حذف المستخدم بنجاح.' });
  } catch (err) {
    console.error('خطأ في حذف المستخدم:', err);
    res.status(500).json({ error: err.message });
  }
});

// Toggle user status (admin only)
app.put('/api/users/:id/toggle-status', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  try {
    const userId = req.params.id;
    if (Number(userId) === req.userId) {
      return res.status(400).json({ error: 'لا يمكنك إيقاف حسابك الحالي.' });
    }
    const user = await dbGet('SELECT status FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    await dbRun('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
    res.json({ message: `تم تحديث الحالة إلى ${newStatus}`, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تسجيل العملاء
// Public self-registration only ever creates a customer. `role` and `owner_id`
// in the body are ignored on purpose: pharmacies apply through
// /api/pharmacy/register (admin-reviewed), staff are created by their owner,
// and admins/suppliers by an admin.
app.post('/api/register', async (req, res) => {
  try {
    const { pharmacy_name, email, password, phone, country, gender, age } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبان.' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صالح.' });
    }
    const weakPassword = passwordProblem(password);
    if (weakPassword) {
      return res.status(400).json({ message: weakPassword });
    }

    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ message: 'البريد الإلكتروني مستخدم مسبقاً.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await dbRun(
      `INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id, phone, country, gender, age)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        pharmacy_name || 'عميل',
        email,
        password_hash,
        ROLES.CUSTOMER,
        phone || null,
        country || null,
        gender || null,
        age || null,
      ]
    );

    res.status(201).json({ message: 'تم تسجيل المستخدم بنجاح.' });
  } catch (error) {
    res.status(500).json({ message: 'فشل التسجيل.', error: error.message });
  }
});

// طلب تسجيل الصيدليات
app.post('/api/pharmacy/register', async (req, res) => {
  try {
    const { pharmacy_name, owner_name, email, phone, address, password } = req.body;
    if (!pharmacy_name || !owner_name || !email || !password) {
      return res.status(400).json({ error: 'جميع الحقول الأساسية (بما فيها كلمة المرور) مطلوبة' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    }
    const weakPassword = passwordProblem(password);
    if (weakPassword) {
      return res.status(400).json({ error: weakPassword });
    }

    const existing = await dbGet('SELECT id FROM pharmacy_registrations WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل في طلب تسجيل' });

    const userExists = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (userExists) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل كمستخدم' });

    const password_hash = await bcrypt.hash(password, 10);

    const result = await dbRun(
      'INSERT INTO pharmacy_registrations (pharmacy_name, owner_name, email, password_hash, phone, address) VALUES (?,?,?,?,?,?)',
      [pharmacy_name, owner_name, email, password_hash, phone || null, address || null]
    );
    res.status(201).json({ message: 'تم تقديم الطلب بنجاح، بانتظار المراجعة', id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/pending-pharmacies', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM pharmacy_registrations ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/approve-pharmacy/:id', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  const { id } = req.params;
  try {
    const reg = await dbGet('SELECT * FROM pharmacy_registrations WHERE id = ? AND status = ?', [id, 'pending']);
    if (!reg) return res.status(404).json({ error: 'الطلب غير موجود أو تم البت فيه مسبقاً' });

    const password_hash = reg.password_hash;

    const userResult = await dbRun(
      'INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id, phone) VALUES (?,?,?,?,?,?)',
      [reg.pharmacy_name, reg.email, password_hash, ROLES.OWNER, null, reg.phone]
    );
    const userId = userResult.lastID;
    await dbRun('UPDATE users SET owner_id = ? WHERE id = ?', [userId, userId]);

    await dbRun(
      'UPDATE pharmacy_registrations SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['approved', req.userId, id]
    );

    res.json({ message: 'تمت الموافقة وإنشاء حساب الصيدلية بنجاح', user_id: userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/reject-pharmacy/:id', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { rejection_reason = '' } = req.body;
  try {
    const result = await dbRun(
      'UPDATE pharmacy_registrations SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?, notified = 1 WHERE id = ? AND status = ?',
      ['rejected', req.userId, rejection_reason, id, 'pending']
    );
    if (result.changes === 0) return res.status(404).json({ error: 'الطلب غير موجود أو تم البت فيه مسبقاً' });
    res.json({ message: 'تم رفض الطلب وتسجيل سبب الرفض', rejection_reason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- تسجيل الدخول -------------------
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبان.' });
    }

    
    const user = await dbGet(
      'SELECT id, pharmacy_name, email, password_hash, role, owner_id, phone, country, gender, age, status FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة.' });
    }

    // Checked after the password so the response does not reveal which
    // addresses belong to suspended accounts.
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'تم إيقاف هذا الحساب. يرجى التواصل مع إدارة المنصّة.' });
    }

    const finalRole = user.role;

    // A staff account's own name lives in pharmacy_name (the column doubles as a
    // display name), so its pharmacy's name is looked up from the owner row.
    let pharmacyLabel = null;
    if (finalRole === ROLES.OWNER) {
      pharmacyLabel = user.pharmacy_name;
    } else if (finalRole === ROLES.STAFF && user.owner_id) {
      const owner = await dbGet('SELECT pharmacy_name FROM users WHERE id = ?', [user.owner_id]);
      pharmacyLabel = owner ? owner.pharmacy_name : null;
    }

    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        role: finalRole,
        owner_id: user.owner_id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        pharmacy_name: user.pharmacy_name,
        email: user.email,
        role: finalRole,
        owner_id: user.owner_id,
        pharmacy_label: pharmacyLabel,
        phone: user.phone || '',
        country: user.country || '',
        gender: user.gender || '',
        age: user.age || '',
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'فشل تسجيل الدخول.', error: error.message });
  }
});

// ------------------- تغيير كلمة المرور -------------------
app.post('/api/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    const weakPassword = passwordProblem(newPassword);
    if (weakPassword) {
      return res.status(400).json({ success: false, message: weakPassword });
    }

    const user = await dbGet('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);

    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل تغيير كلمة المرور.', error: error.message });
  }
});

// ------------------- الأدوية -------------------
app.post('/api/medicines', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER, ROLES.STAFF), async (req, res) => {
  try {
    const { name, quantity, batch_number, expire_date, price, supplier_id, category, barcode, cost_price } = req.body;

    if (!name || quantity === undefined || !batch_number || !expire_date || price === undefined) {
      return res.status(400).json({ message: 'جميع حقول الدواء الأساسية مطلوبة.' });
    }
    const invalid = medicineValuesProblem({ quantity, price, expire_date });
    if (invalid) return res.status(400).json({ message: invalid });

    let ownerId;
    if (req.userRole === ROLES.ADMIN) {
      ownerId = req.body.owner_id;
      if (!ownerId) return res.status(400).json({ message: 'يجب تحديد owner_id للصيدلية.' });
    } else {
      ownerId = req.ownerId;
    }

    const result = await dbRun(
      `INSERT INTO medicines (user_id, name, quantity, batch_number, expire_date, price, supplier_id, category, barcode, cost_price, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, name, quantity, batch_number, expire_date, price, supplier_id || null, category || null, barcode || null, cost_price || null, ownerId]
    );

    res.status(201).json({
      message: 'تمت إضافة الدواء بنجاح.',
      medicine: { id: result.lastID, name, quantity, owner_id: ownerId },
    });
  } catch (error) {
    res.status(500).json({ message: 'فشل إضافة الدواء.', error: error.message });
  }
});

app.get('/api/medicines', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER, ROLES.STAFF), async (req, res) => {
  try {
    let sql = 'SELECT * FROM medicines';
    const params = [];

    if (req.userRole !== ROLES.ADMIN) {
      sql += ' WHERE owner_id = ?';
      params.push(req.ownerId);
    } else if (req.query.owner_id) {
      sql += ' WHERE owner_id = ?';
      params.push(req.query.owner_id);
    }

    sql += ' ORDER BY id DESC';
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'فشل جلب الأدوية.', error: error.message });
  }
});

app.put('/api/medicines/:id', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER), async (req, res) => {
  try {
    const medicineId = req.params.id;
    const { name, quantity, batch_number, expire_date, price } = req.body;

    // The UPDATE writes every column, so a missing field would blank it.
    if (!name || quantity === undefined || !batch_number || !expire_date || price === undefined) {
      return res.status(400).json({ message: 'جميع حقول الدواء الأساسية مطلوبة.' });
    }
    const invalid = medicineValuesProblem({ quantity, price, expire_date });
    if (invalid) return res.status(400).json({ message: invalid });

    if (req.userRole !== ROLES.ADMIN) {
      const med = await dbGet('SELECT id FROM medicines WHERE id = ? AND owner_id = ?', [medicineId, req.ownerId]);
      if (!med) return res.status(404).json({ message: 'الدواء غير موجود أو لا تملك صلاحية تعديله.' });
    }

    const result = await dbRun(
      `UPDATE medicines SET name = ?, quantity = ?, batch_number = ?, expire_date = ?, price = ?
       WHERE id = ?`,
      [name, quantity, batch_number, expire_date, price, medicineId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'الدواء غير موجود.' });
    }
    res.json({ message: 'تم تحديث الدواء بنجاح.' });
  } catch (error) {
    res.status(500).json({ message: 'فشل تعديل الدواء.', error: error.message });
  }
});

app.delete('/api/medicines/:id', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER), async (req, res) => {
  try {
    const medicineId = req.params.id;

    if (req.userRole !== ROLES.ADMIN) {
      const med = await dbGet('SELECT id FROM medicines WHERE id = ? AND owner_id = ?', [medicineId, req.ownerId]);
      if (!med) return res.status(404).json({ message: 'الدواء غير موجود أو لا تملك صلاحية حذفه.' });
    }

    const result = await dbRun('DELETE FROM medicines WHERE id = ?', [medicineId]);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'الدواء غير موجود.' });
    }
    res.json({ message: 'تم حذف الدواء بنجاح.' });
  } catch (error) {
    res.status(500).json({ message: 'فشل حذف الدواء.', error: error.message });
  }
});

// عرض جميع المبيعات (للأدمن)
app.get('/api/admin/sales', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  try {
    let sql = `
      SELECT oi.id AS id,
             o.id AS order_id,
             oi.quantity,
             oi.total_price,
             o.created_at AS sold_at,
             m.name AS medicine_name,
             u_pharmacy.pharmacy_name AS pharmacy_name,
             u_customer.pharmacy_name AS customer_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN medicines m ON oi.medicine_id = m.id
      JOIN users u_pharmacy ON o.pharmacy_id = u_pharmacy.id
      LEFT JOIN users u_customer ON o.customer_id = u_customer.id
    `;
    const params = [];

    if (req.query.owner_id) {
      sql += ' WHERE o.pharmacy_id = ?';
      params.push(req.query.owner_id);
    }

    sql += ' ORDER BY o.created_at DESC';

    const sales = await dbAll(sql, params);
    res.json(sales);
  } catch (err) {
    console.error('خطأ في جلب المبيعات:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/medicines/expiry-alerts', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER, ROLES.STAFF), async (req, res) => {
  try {
    let sql = `SELECT * FROM medicines WHERE (date(expire_date) <= date('now', '+90 day') OR date(expire_date) <= date('now'))`;
    const params = [];

    if (req.userRole !== ROLES.ADMIN) {
      sql += ' AND owner_id = ?';
      params.push(req.ownerId);
    }

    sql += ' ORDER BY date(expire_date) ASC';
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'فشل جلب تنبيهات الصلاحية.', error: error.message });
  }
});

app.get('/api/medicines/low-stock', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER, ROLES.STAFF), async (req, res) => {
  try {
    let sql = 'SELECT * FROM medicines WHERE quantity <= 5';
    const params = [];

    if (req.userRole !== ROLES.ADMIN) {
      sql += ' AND owner_id = ?';
      params.push(req.ownerId);
    }

    sql += ' ORDER BY quantity ASC, id DESC';
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'فشل جلب الأدوية منخفضة المخزون.', error: error.message });
  }
});

// ------------------- الكتالوج العام (بدون تسجيل دخول) -------------------
/*
 * What a patient may see before signing in: which active pharmacy sells which
 * medicine, at what price, and whether it is in stock. Deliberately NOT exposed:
 * cost price, barcode, batch number, supplier, exact stock level, owner email.
 *
 * "Sellable" = in stock, not expired, and the pharmacy account is active. The
 * same predicate guards the order endpoints, so the catalog never lists
 * something the checkout would then refuse.
 */
const SELLABLE_MEDICINE = `
  m.quantity > 0
  AND date(m.expire_date) >= date('now')
  AND u.role = 'pharmacy_owner'
  AND COALESCE(u.status, 'active') = 'active'
`;

/** Address given on the pharmacy's approved application (users has no address column). */
const PHARMACY_ADDRESS = `(
  SELECT r.address FROM pharmacy_registrations r
  WHERE r.email = u.email AND r.status = 'approved'
  ORDER BY r.id DESC LIMIT 1
)`;

app.get('/api/catalog/medicines', async (req, res) => {
  try {
    const { q, category, maxPrice, pharmacyId } = req.query;
    let sql = `
      SELECT m.id, m.name, m.category, m.price, m.expire_date,
             u.id AS pharmacy_id, u.pharmacy_name, ${PHARMACY_ADDRESS} AS pharmacy_address
      FROM medicines m
      JOIN users u ON u.id = m.owner_id
      WHERE ${SELLABLE_MEDICINE}
    `;
    const params = [];
    if (q && String(q).trim()) {
      sql += ' AND m.name LIKE ?';
      params.push(`%${String(q).trim()}%`);
    }
    if (category) {
      sql += ' AND m.category = ?';
      params.push(String(category));
    }
    if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(Number(maxPrice))) {
      sql += ' AND m.price <= ?';
      params.push(Number(maxPrice));
    }
    if (pharmacyId !== undefined && pharmacyId !== '') {
      sql += ' AND u.id = ?';
      params.push(Number(pharmacyId));
    }
    sql += ' ORDER BY m.name COLLATE NOCASE, m.price LIMIT 200';
    res.json(await dbAll(sql, params));
  } catch (err) {
    console.error('خطأ في /api/catalog/medicines:', err);
    res.status(500).json({ error: 'تعذّر تحميل الكتالوج' });
  }
});

app.get('/api/catalog/pharmacies', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT u.id, u.pharmacy_name, ${PHARMACY_ADDRESS} AS address,
             COUNT(m.id) AS medicine_count
      FROM users u
      JOIN medicines m ON m.owner_id = u.id
      WHERE ${SELLABLE_MEDICINE}
      GROUP BY u.id
      ORDER BY u.pharmacy_name COLLATE NOCASE
    `);
    res.json(rows);
  } catch (err) {
    console.error('خطأ في /api/catalog/pharmacies:', err);
    res.status(500).json({ error: 'تعذّر تحميل الصيدليات' });
  }
});

// ------------------- مسارات العميل -------------------
app.get('/api/pharmacies', verifyToken, checkRole(ROLES.CUSTOMER, ROLES.ADMIN), async (req, res) => {
  try {
    let sql = `
      SELECT DISTINCT u.id, u.pharmacy_name, u.email
      FROM users u
      INNER JOIN medicines m ON u.id = m.owner_id
      WHERE u.role = ?
    `;
    const params = [ROLES.OWNER];

    // The customer UI sends `?search=`; `?q=` is the original spelling. Both
    // filter on pharmacy name/email, so either one works.
    const { q, search, medicine } = req.query;
    const nameTerm = q || search;
    if (nameTerm) {
      sql += ' AND (u.pharmacy_name LIKE ? OR u.email LIKE ?)';
      const likeTerm = `%${nameTerm}%`;
      params.push(likeTerm, likeTerm);
    }
    if (medicine) {
      sql += ' AND m.name LIKE ?';
      params.push(`%${medicine}%`);
    }

    sql += ' ORDER BY u.pharmacy_name';

    const pharmacies = await dbAll(sql, params);
    res.json(pharmacies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer/medicines/:pharmacyId', verifyToken, checkRole(ROLES.CUSTOMER), async (req, res) => {
  try {
    const medicines = await dbAll(
      "SELECT id, name, price, quantity, expire_date FROM medicines WHERE owner_id = ? AND quantity > 0 AND date(expire_date) >= date('now') ORDER BY name",
      [req.params.pharmacyId]
    );
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customer/order', verifyToken, checkRole(ROLES.CUSTOMER), async (req, res) => {
  try {
    const { medicine_id, quantity, owner_id } = req.body;
    if (!medicine_id || !quantity || !owner_id) {
      return res.status(400).json({ message: 'معرف الدواء والكمية ومعرف الصيدلية مطلوبون.' });
    }

    const requestedQuantity = Number(quantity);
    const medicineId = Number(medicine_id);
    const pharmacyId = Number(owner_id);

    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0 || !Number.isInteger(medicineId) || !Number.isInteger(pharmacyId)) {
      return res.status(400).json({ message: 'قيم غير صالحة.' });
    }

    const order = await withTransaction(async (t) => {
      const medicine = await t.get(
        "SELECT id, price, date(expire_date) < date('now') AS expired FROM medicines WHERE id = ? AND owner_id = ?",
        [medicineId, pharmacyId]
      );
      if (!medicine) {
        throw new HttpError(404, { message: 'الدواء غير متوفر في هذه الصيدلية.' });
      }
      if (medicine.expired) {
        throw new HttpError(400, { message: 'هذا الدواء منتهي الصلاحية ولا يمكن طلبه.' });
      }

      // Decrement only if enough stock remains, in one statement.
      const stock = await t.run(
        'UPDATE medicines SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
        [requestedQuantity, medicineId, requestedQuantity]
      );
      if (stock.changes === 0) {
        throw new HttpError(400, { message: 'الكمية المطلوبة غير متوفرة.' });
      }

      const totalPrice = medicine.price * requestedQuantity;
      const orderResult = await t.run(
        'INSERT INTO orders (pharmacy_id, customer_id, status, total_amount) VALUES (?, ?, ?, ?)',
        [pharmacyId, req.userId, 'pending', totalPrice]
      );
      await t.run(
        'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [orderResult.lastID, medicineId, requestedQuantity, medicine.price, totalPrice]
      );
      return {
        id: orderResult.lastID,
        medicine_id: medicineId,
        quantity: requestedQuantity,
        total_price: totalPrice,
      };
    });

    res.status(201).json({ message: 'تم تقديم الطلب بنجاح.', order });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json(error.body);
    res.status(500).json({ message: 'فشل إنشاء الطلب.', error: error.message });
  }
});

app.post('/api/customer/order-batch', verifyToken, checkRole(ROLES.CUSTOMER), async (req, res) => {
  try {
    const { pharmacyId, items } = req.body;
    if (!pharmacyId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'معرف الصيدلية والمنتجات مطلوبان' });
    }
    const pharmacyIdNum = Number(pharmacyId);
    if (!Number.isInteger(pharmacyIdNum)) {
      return res.status(400).json({ message: 'معرف الصيدلية غير صالح' });
    }
    // Validate the payload shape up front and merge repeated lines, so each
    // medicine is checked and decremented once for its full quantity.
    const quantities = new Map();
    for (const item of items) {
      const { medicine_id, quantity } = item || {};
      if (!medicine_id || !quantity) {
        return res.status(400).json({ message: 'كل عنصر يجب أن يحتوي على معرف الدواء والكمية' });
      }
      const medId = Number(medicine_id);
      const qty = Number(quantity);
      if (!Number.isInteger(medId) || !Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ message: 'قيم غير صالحة للعنصر' });
      }
      quantities.set(medId, (quantities.get(medId) || 0) + qty);
    }

    const orderId = await withTransaction(async (t) => {
      const pharmacy = await t.get(
        "SELECT id FROM users WHERE id = ? AND role = ? AND COALESCE(status, 'active') = 'active'",
        [pharmacyIdNum, ROLES.OWNER]
      );
      if (!pharmacy) {
        throw new HttpError(404, { message: 'الصيدلية غير موجودة أو غير متاحة حالياً' });
      }

      let totalAmount = 0;
      const lines = [];
      for (const [medId, qty] of quantities) {
        const medicine = await t.get(
          "SELECT id, name, price, owner_id, date(expire_date) < date('now') AS expired FROM medicines WHERE id = ?",
          [medId]
        );
        if (!medicine) {
          throw new HttpError(404, { message: `الدواء بمعرف ${medId} غير موجود` });
        }
        if (medicine.owner_id !== pharmacyIdNum) {
          throw new HttpError(403, { message: `الدواء بمعرف ${medId} لا يتبع هذه الصيدلية` });
        }
        if (medicine.expired) {
          throw new HttpError(400, { message: `الدواء ${medicine.name} منتهي الصلاحية ولا يمكن طلبه` });
        }
        const stock = await t.run(
          'UPDATE medicines SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
          [qty, medId, qty]
        );
        if (stock.changes === 0) {
          throw new HttpError(400, { message: `الكمية المطلوبة غير متوفرة للدواء ${medicine.name}` });
        }
        totalAmount += medicine.price * qty;
        lines.push({ medicine, qty });
      }

      const orderResult = await t.run(
        'INSERT INTO orders (pharmacy_id, customer_id, total_amount, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [pharmacyIdNum, req.userId, totalAmount]
      );
      for (const { medicine, qty } of lines) {
        await t.run(
          'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [orderResult.lastID, medicine.id, qty, medicine.price, medicine.price * qty]
        );
      }
      return orderResult.lastID;
    });

    res.status(201).json({ message: 'تم إنشاء الطلب بنجاح', orderId });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json(error.body);
    res.status(500).json({ message: 'فشل إنشاء الطلب الدفعي', error: error.message });
  }
});

/**
 * Loads orders matching `where` (a SQL fragment over alias `o`) as one object
 * per order with its line items nested, newest first. `receipt_ref` (the stored
 * file name) is reduced to a `has_receipt` flag; the file is served by
 * GET /api/orders/:id/receipt after an ownership check.
 */
async function loadOrders(where, params) {
  const rows = await dbAll(`
    SELECT o.id AS order_id, o.status, o.created_at, o.total_amount,
           COALESCE(o.payment_status, 'unpaid') AS payment_status,
           o.receipt_uploaded_at, o.receipt_ref IS NOT NULL AS has_receipt,
           o.pharmacy_id, p.pharmacy_name,
           o.customer_id, c.pharmacy_name AS customer_name, c.phone AS customer_phone,
           oi.id AS item_id, oi.medicine_id, m.name AS medicine_name,
           oi.quantity, oi.unit_price, oi.total_price
    FROM orders o
    JOIN users p ON p.id = o.pharmacy_id
    LEFT JOIN users c ON c.id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN medicines m ON m.id = oi.medicine_id
    WHERE ${where}
    ORDER BY datetime(o.created_at) DESC, o.id DESC, oi.id ASC
  `, params);

  const byId = new Map();
  for (const row of rows) {
    let order = byId.get(row.order_id);
    if (!order) {
      order = {
        id: row.order_id,
        status: row.status,
        created_at: row.created_at,
        total_amount: Number(row.total_amount) || 0,
        payment_status: row.payment_status,
        has_receipt: Boolean(row.has_receipt),
        receipt_uploaded_at: row.receipt_uploaded_at,
        pharmacy_id: row.pharmacy_id,
        pharmacy_name: row.pharmacy_name,
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        items: [],
      };
      byId.set(row.order_id, order);
    }
    if (row.item_id != null) {
      order.items.push({
        id: row.item_id,
        medicine_id: row.medicine_id,
        medicine_name: row.medicine_name || 'دواء محذوف',
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_price: row.total_price,
      });
    }
  }
  return [...byId.values()];
}

const ORDER_STATUSES = new Set(['pending', 'completed', 'cancelled']);

app.get('/api/customer/orders', verifyToken, checkRole(ROLES.CUSTOMER), async (req, res) => {
  try {
    res.json(await loadOrders('o.customer_id = ?', [req.userId]));
  } catch (error) {
    res.status(500).json({ message: 'فشل جلب سجل الطلبات', error: error.message });
  }
});

/**
 * GET /api/pharmacy/orders — customer orders placed against the caller's
 * pharmacy (owner or staff). POS sales (customer_id NULL) are excluded; they
 * appear under /api/owner/sales. Optional ?status=pending|completed|cancelled.
 */
app.get('/api/pharmacy/orders', verifyToken, checkRole(ROLES.OWNER, ROLES.STAFF), async (req, res) => {
  try {
    let where = 'o.pharmacy_id = ? AND o.customer_id IS NOT NULL';
    const params = [req.ownerId];
    if (req.query.status) {
      if (!ORDER_STATUSES.has(req.query.status)) {
        return res.status(400).json({ error: 'حالة غير صالحة' });
      }
      where += ' AND o.status = ?';
      params.push(req.query.status);
    }
    res.json(await loadOrders(where, params));
  } catch (err) {
    console.error('خطأ في /api/pharmacy/orders:', err);
    res.status(500).json({ error: 'تعذّر تحميل الطلبات' });
  }
});

// ------------------- تحديث حالة الطلب -------------------
/**
 * PATCH /api/orders/:id/status — moves a customer order out of 'pending'.
 *
 * The pharmacy the order was placed against (its owner or one of its staff) or
 * an admin may complete or cancel it; the customer who placed it may cancel it.
 * Cancelling returns the reserved stock to the shelf, so the status change and
 * the restore share a single transaction. The UPDATE is guarded on
 * status = 'pending' as well, so two concurrent calls cannot both win.
 */
app.patch('/api/orders/:id/status', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER, ROLES.STAFF, ROLES.CUSTOMER), async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ message: 'معرف الطلب غير صالح.' });
    }

    const { status } = req.body || {};
    if (status !== 'completed' && status !== 'cancelled') {
      return res.status(400).json({ message: "الحالة يجب أن تكون 'completed' أو 'cancelled'." });
    }

    const order = await dbGet('SELECT id, pharmacy_id, customer_id, status FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود.' });
    }

    // Admins act on any order; owners and staff only on their own pharmacy's
    // (req.ownerId is the owner's user id for both roles, and orders.pharmacy_id
    // stores that same id); customers may only cancel their own.
    if (req.userRole === ROLES.CUSTOMER) {
      if (order.customer_id !== req.userId) {
        return res.status(404).json({ message: 'الطلب غير موجود.' });
      }
      if (status !== 'cancelled') {
        return res.status(403).json({ message: 'يمكنك إلغاء طلبك فقط.' });
      }
    } else if (req.userRole !== ROLES.ADMIN && order.pharmacy_id !== req.ownerId) {
      return res.status(403).json({ message: 'لا يمكنك تعديل طلبات صيدلية أخرى.' });
    }

    if (order.status !== 'pending') {
      const label = order.status === 'completed' ? 'مكتمل' : order.status === 'cancelled' ? 'ملغي' : order.status;
      return res.status(409).json({ message: `لا يمكن تعديل هذا الطلب لأنه ${label}.` });
    }

    await withTransaction(async (t) => {
      // Claim the order first; the status guard means only one request wins.
      const result = await t.run(
        "UPDATE orders SET status = ? WHERE id = ? AND status = 'pending'",
        [status, orderId]
      );
      if (result.changes === 0) {
        // Another request moved the order between the read above and this write.
        throw new HttpError(409, { message: 'تم تعديل حالة الطلب بواسطة عملية أخرى.' });
      }

      if (status === 'cancelled') {
        const items = await t.all(
          'SELECT medicine_id, quantity FROM order_items WHERE order_id = ?',
          [orderId]
        );
        for (const item of items) {
          await t.run(
            'UPDATE medicines SET quantity = quantity + ? WHERE id = ?',
            [item.quantity, item.medicine_id]
          );
        }
      }
    });

    res.json({ message: 'تم تحديث حالة الطلب.', orderId, status });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json(error.body);
    res.status(500).json({ message: 'فشل تحديث حالة الطلب.', error: error.message });
  }
});

// ------------------- إيصال الدفع (بنكك) -------------------
/*
 * Receipts are stored on local disk under uploads/receipts (git-ignored) and
 * `orders.receipt_ref` keeps only the generated file name — never a client-
 * supplied path. The type is decided by the file's leading bytes, not by the
 * Content-Type header, and only images and PDFs are accepted.
 */
const receiptsDir = path.join(__dirname, 'uploads', 'receipts');
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const RECEIPT_TYPES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', mime: 'image/png', test: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { ext: 'pdf', mime: 'application/pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
];
const receiptTypeFor = (fileName) => RECEIPT_TYPES.find((t) => fileName.endsWith(`.${t.ext}`));

const receiptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات رفع كثيرة، حاول لاحقاً.' },
});

/** Loads an order and works out which party the caller is to it. */
async function orderForParty(orderId, req) {
  const order = await dbGet(
    `SELECT id, customer_id, pharmacy_id, status, receipt_ref,
            COALESCE(payment_status, 'unpaid') AS payment_status
     FROM orders WHERE id = ?`,
    [orderId]
  );
  if (!order) return { order: null };
  return {
    order,
    isCustomer: req.userRole === ROLES.CUSTOMER && order.customer_id === req.userId,
    isPharmacy: (req.userRole === ROLES.OWNER || req.userRole === ROLES.STAFF) && order.pharmacy_id === req.ownerId,
    isAdmin: req.userRole === ROLES.ADMIN,
  };
}

function removeReceiptFile(fileName) {
  if (!fileName) return;
  fs.promises.unlink(path.join(receiptsDir, path.basename(fileName))).catch(() => {});
}

/**
 * POST /api/orders/:id/receipt — the customer uploads their Bankak transfer
 * receipt as the raw request body (image/jpeg|png|webp or application/pdf,
 * max 5 MB). Moves payment_status to 'pending_review' for the pharmacy to
 * confirm; it never marks the order paid by itself. A replacement upload is
 * allowed until the payment is confirmed (e.g. after a rejection).
 */
app.post(
  '/api/orders/:id/receipt',
  receiptLimiter,
  verifyToken,
  checkRole(ROLES.CUSTOMER),
  express.raw({ type: ['image/*', 'application/pdf', 'application/octet-stream'], limit: MAX_RECEIPT_BYTES }),
  async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ error: 'معرف الطلب غير صالح.' });
      }
      const { order, isCustomer } = await orderForParty(orderId, req);
      if (!order || !isCustomer) {
        return res.status(404).json({ error: 'الطلب غير موجود.' });
      }
      if (order.status === 'cancelled') {
        return res.status(409).json({ error: 'لا يمكن رفع إيصال لطلب ملغي.' });
      }
      if (order.payment_status === 'paid') {
        return res.status(409).json({ error: 'تم تأكيد الدفع لهذا الطلب مسبقاً.' });
      }

      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({ error: 'يرجى اختيار ملف الإيصال (صورة أو PDF).' });
      }
      const type = RECEIPT_TYPES.find((t) => t.test(body));
      if (!type) {
        return res.status(415).json({ error: 'نوع الملف غير مدعوم. المسموح: JPG أو PNG أو WEBP أو PDF.' });
      }

      await fs.promises.mkdir(receiptsDir, { recursive: true });
      const fileName = `order-${orderId}-${Date.now()}.${type.ext}`;
      await fs.promises.writeFile(path.join(receiptsDir, fileName), body);

      await dbRun(
        `UPDATE orders
            SET receipt_ref = ?, receipt_uploaded_at = CURRENT_TIMESTAMP, payment_status = 'pending_review'
          WHERE id = ?`,
        [fileName, orderId]
      );
      removeReceiptFile(order.receipt_ref);

      res.json({ message: 'تم استلام الإيصال، بانتظار مراجعة الصيدلية.', orderId, payment_status: 'pending_review' });
    } catch (error) {
      console.error('خطأ في رفع الإيصال:', error);
      res.status(500).json({ error: 'فشل رفع الإيصال.' });
    }
  }
);

/** GET /api/orders/:id/receipt — the file, for the order's customer, its pharmacy or an admin. */
app.get('/api/orders/:id/receipt', verifyToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { order, isCustomer, isPharmacy, isAdmin } = await orderForParty(orderId, req);
    if (!order || !(isCustomer || isPharmacy || isAdmin) || !order.receipt_ref) {
      return res.status(404).json({ error: 'لا يوجد إيصال لهذا الطلب.' });
    }
    const fileName = path.basename(order.receipt_ref);
    const type = receiptTypeFor(fileName);
    const filePath = path.join(receiptsDir, fileName);
    if (!type || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'ملف الإيصال غير متوفر.' });
    }
    res.setHeader('Content-Type', type.mime);
    res.setHeader('Content-Disposition', `inline; filename="receipt-${orderId}.${type.ext}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(filePath);
  } catch (error) {
    console.error('خطأ في عرض الإيصال:', error);
    res.status(500).json({ error: 'تعذّر عرض الإيصال.' });
  }
});

/**
 * PATCH /api/orders/:id/payment — the pharmacy (or an admin) reviews an uploaded
 * receipt: { status: 'paid' | 'rejected' }. Only a 'pending_review' payment can
 * be decided; after a rejection the customer may upload a new receipt.
 */
app.patch('/api/orders/:id/payment', verifyToken, checkRole(ROLES.OWNER, ROLES.STAFF, ROLES.ADMIN), async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body || {};
    if (status !== 'paid' && status !== 'rejected') {
      return res.status(400).json({ error: "الحالة يجب أن تكون 'paid' أو 'rejected'." });
    }
    const { order, isPharmacy, isAdmin } = await orderForParty(orderId, req);
    if (!order || !(isPharmacy || isAdmin)) {
      return res.status(404).json({ error: 'الطلب غير موجود.' });
    }
    const result = await dbRun(
      "UPDATE orders SET payment_status = ? WHERE id = ? AND payment_status = 'pending_review'",
      [status, orderId]
    );
    if (result.changes === 0) {
      return res.status(409).json({ error: 'لا يوجد إيصال بانتظار المراجعة لهذا الطلب.' });
    }
    res.json({ message: status === 'paid' ? 'تم تأكيد الدفع.' : 'تم رفض الإيصال.', orderId, payment_status: status });
  } catch (error) {
    console.error('خطأ في مراجعة الدفع:', error);
    res.status(500).json({ error: 'تعذّر تحديث حالة الدفع.' });
  }
});

// ============ مسارات الموردين ============
app.get('/api/suppliers', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER), async (req, res) => {
  try {
    const suppliers = await dbAll('SELECT id, pharmacy_name AS name, email FROM users WHERE role = ?', [ROLES.SUPPLIER]);
    res.json(suppliers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/supplier/medicines', verifyToken, checkRole(ROLES.SUPPLIER), async (req, res) => {
  try {
    const { name, price, description, bulk_qty, bulk_price } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'اسم الدواء والسعر مطلوبان' });
    if (!(Number(price) >= 0)) return res.status(400).json({ error: 'السعر غير صالح' });
    // Bulk terms are optional; stored only as a complete, positive pair.
    const bulkQty = Number(bulk_qty);
    const bulkPrice = Number(bulk_price);
    const hasBulk = Number.isInteger(bulkQty) && bulkQty > 0 && bulkPrice > 0;
    const result = await dbRun(
      'INSERT INTO supplier_medicines (supplier_id, name, price, description, bulk_qty, bulk_price) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userId, name, Number(price), description || '', hasBulk ? bulkQty : null, hasBulk ? bulkPrice : null]
    );
    res.json({ id: result.lastID, message: 'تمت إضافة الدواء إلى قائمتك' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/supplier/medicines', verifyToken, checkRole(ROLES.SUPPLIER), async (req, res) => {
  try {
    const medicines = await dbAll(
      'SELECT * FROM supplier_medicines WHERE supplier_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(medicines);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/supplier/:id/medicines', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER), async (req, res) => {
  try {
    const medicines = await dbAll(
      'SELECT * FROM supplier_medicines WHERE supplier_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(medicines);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ أوامر الشراء (المورد) ============
/**
 * GET /api/supplier/purchase-orders — أوامر الشراء الواردة للمورد الحالي.
 *
 * One row per purchase order, with its line items nested under `items`.
 *
 * `purchase_order_items.medicine_id` carries a FK to `medicines(id)`, so with
 * PRAGMA foreign_keys=ON that is the authoritative name source; the join to
 * `supplier_medicines` is only a fallback for rows written before the
 * constraint was enforced. Hence COALESCE(m.name, sm.name).
 *
 * `quantity` / `unit_price` / `medicine` are flattened conveniences for the
 * single-item purchase orders the supplier dashboard renders today — for a
 * multi-item order `unit_price` is the quantity-weighted average, and the
 * authoritative per-line figures stay in `items`.
 */
app.get('/api/supplier/purchase-orders', verifyToken, checkRole(ROLES.SUPPLIER), async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT po.id             AS po_id,
             po.status         AS status,
             po.created_at     AS created_at,
             po.updated_at     AS updated_at,
             po.total_amount   AS total_amount,
             po.pharmacy_id    AS pharmacy_id,
             u.pharmacy_name   AS pharmacy_name,
             poi.id            AS item_id,
             poi.medicine_id   AS medicine_id,
             poi.qty_requested AS qty_requested,
             poi.qty_fulfilled AS qty_fulfilled,
             poi.unit_price    AS unit_price,
             COALESCE(m.name, sm.name) AS medicine_name
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
      LEFT JOIN users u                  ON u.id = po.pharmacy_id
      LEFT JOIN medicines m              ON m.id = poi.medicine_id
      LEFT JOIN supplier_medicines sm    ON sm.id = poi.medicine_id
      WHERE po.supplier_id = ?
      ORDER BY datetime(po.created_at) DESC, poi.id ASC
    `, [req.userId]);

    const byId = new Map();
    for (const row of rows) {
      let order = byId.get(row.po_id);
      if (!order) {
        order = {
          id: row.po_id,
          status: row.status || 'pending',
          created_at: row.created_at,
          updated_at: row.updated_at,
          pharmacy_id: row.pharmacy_id,
          pharmacy_name: row.pharmacy_name || null,
          total_amount: row.total_amount,
          items: [],
        };
        byId.set(row.po_id, order);
      }
      // LEFT JOIN: an order with no line items yields a single null-item row.
      if (row.item_id !== null && row.item_id !== undefined) {
        order.items.push({
          id: row.item_id,
          medicine_id: row.medicine_id,
          medicine_name: row.medicine_name || null,
          qty_requested: Number(row.qty_requested) || 0,
          qty_fulfilled: Number(row.qty_fulfilled) || 0,
          unit_price: Number(row.unit_price) || 0,
        });
      }
    }

    const purchaseOrders = [...byId.values()].map((order) => {
      const quantity = order.items.reduce((sum, item) => sum + item.qty_requested, 0);
      const lineTotal = order.items.reduce((sum, item) => sum + item.qty_requested * item.unit_price, 0);
      const first = order.items[0] || null;
      const extra = order.items.length - 1;

      return {
        ...order,
        quantity,
        unit_price: order.items.length === 1
          ? first.unit_price
          : (quantity > 0 ? Math.round((lineTotal / quantity) * 100) / 100 : 0),
        medicine: first
          ? {
            id: first.medicine_id,
            name: extra > 0
              ? `${first.medicine_name || 'دواء'} + ${extra} أخرى`
              : first.medicine_name,
          }
          : null,
        // total_amount is nullable (added by migration); fall back to the lines.
        total_amount: order.total_amount === null || order.total_amount === undefined
          ? lineTotal
          : Number(order.total_amount),
      };
    });

    res.json(purchaseOrders);
  } catch (err) {
    console.error('خطأ في /api/supplier/purchase-orders:', err);
    res.status(500).json({ error: 'فشل تحميل أوامر الشراء' });
  }
});

/**
 * POST /api/supplier/purchase-order/:id/fulfill — المورد ينفّذ أمر شراء.
 *
 * Only the supplier the order was raised against may fulfill it, and only while
 * it is still 'pending'. Marking the order, filling in qty_fulfilled and
 * crediting the pharmacy's shelf all share one transaction; the final UPDATE is
 * guarded on status = 'pending' so two concurrent calls cannot both win.
 *
 * The stock credit is deliberately scoped to the ordering pharmacy
 * (owner_id/user_id = po.pharmacy_id). `medicine_id` is only guaranteed to be a
 * valid `medicines` row — not necessarily one belonging to *this* pharmacy — so
 * an unguarded UPDATE could add stock to another pharmacy's inventory. Lines
 * that match no row of the ordering pharmacy are reported as `stock_skipped`
 * rather than silently credited elsewhere.
 */
app.post('/api/supplier/purchase-order/:id/fulfill', verifyToken, checkRole(ROLES.SUPPLIER), async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'معرف أمر الشراء غير صالح.' });
    }

    const order = await dbGet(
      'SELECT id, supplier_id, pharmacy_id, status FROM purchase_orders WHERE id = ?',
      [orderId]
    );
    if (!order) {
      return res.status(404).json({ error: 'أمر الشراء غير موجود.' });
    }
    if (order.supplier_id !== req.userId) {
      return res.status(403).json({ error: 'لا يمكنك تنفيذ أمر شراء مورد آخر.' });
    }
    if (order.status !== 'pending') {
      return res.status(409).json({ error: `لا يمكن تنفيذ أمر حالته '${order.status}'.` });
    }

    const outcome = await withTransaction(async (t) => {
      // Claim the order first; the status guard means only one request wins.
      const result = await t.run(
        `UPDATE purchase_orders
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'pending'`,
        [orderId]
      );
      if (result.changes === 0) {
        // Another request moved the order between the read above and this write.
        throw new HttpError(409, { error: 'تم تعديل حالة أمر الشراء بواسطة عملية أخرى.' });
      }

      const items = await t.all(
        'SELECT id, medicine_id, qty_requested FROM purchase_order_items WHERE order_id = ?',
        [orderId]
      );

      let stockCredited = 0;
      let stockSkipped = 0;

      for (const item of items) {
        await t.run(
          'UPDATE purchase_order_items SET qty_fulfilled = qty_requested WHERE id = ?',
          [item.id]
        );

        const credit = await t.run(
          `UPDATE medicines
              SET quantity = COALESCE(quantity, 0) + ?
            WHERE id = ?
              AND (owner_id = ? OR user_id = ?)`,
          [item.qty_requested, item.medicine_id, order.pharmacy_id, order.pharmacy_id]
        );
        if (credit.changes > 0) stockCredited += 1;
        else stockSkipped += 1;
      }

      return { itemsFulfilled: items.length, stockCredited, stockSkipped };
    });

    res.json({
      message: 'تم تنفيذ أمر الشراء بنجاح.',
      orderId,
      status: 'completed',
      items_fulfilled: outcome.itemsFulfilled,
      stock_credited: outcome.stockCredited,
      stock_skipped: outcome.stockSkipped,
    });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json(error.body);
    console.error('خطأ في تنفيذ أمر الشراء:', error);
    res.status(500).json({ error: 'فشل تنفيذ أمر الشراء.' });
  }
});

app.post('/api/pos/order', verifyToken, checkRole(ROLES.STAFF, ROLES.OWNER), async (req, res) => {
  try {
    const { medicine_id, quantity } = req.body;
    if (!medicine_id || !quantity) {
      return res.status(400).json({ message: 'معرف الدواء والكمية مطلوبان.' });
    }

    const medId = Number(medicine_id);
    const qty = Number(quantity);
    if (!Number.isInteger(medId) || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: 'قيم غير صالحة.' });
    }

    const order = await withTransaction(async (t) => {
      const medicine = await t.get(
        "SELECT id, price, owner_id, date(expire_date) < date('now') AS expired FROM medicines WHERE id = ?",
        [medId]
      );
      if (!medicine) {
        throw new HttpError(404, { message: 'الدواء غير موجود.' });
      }
      if (medicine.owner_id !== req.ownerId) {
        throw new HttpError(403, { message: 'لا يمكنك طلب دواء ليس من صيدليتك.' });
      }
      if (medicine.expired) {
        throw new HttpError(400, { message: 'هذا الدواء منتهي الصلاحية ولا يجوز بيعه.' });
      }
      const stock = await t.run(
        'UPDATE medicines SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
        [qty, medId, qty]
      );
      if (stock.changes === 0) {
        throw new HttpError(400, { message: 'الكمية المطلوبة غير متوفرة.' });
      }

      const totalPrice = medicine.price * qty;
      const orderResult = await t.run(
        'INSERT INTO orders (pharmacy_id, customer_id, status, total_amount) VALUES (?, NULL, ?, ?)',
        [req.ownerId, 'completed', totalPrice]
      );
      await t.run(
        'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [orderResult.lastID, medId, qty, medicine.price, totalPrice]
      );
      return { id: orderResult.lastID, medicine_id: medId, quantity: qty, total_price: totalPrice };
    });

    res.status(201).json({ message: 'تم إنشاء الطلب بنجاح.', orderId: order.id, order });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json(error.body);
    res.status(500).json({ message: 'فشل إنشاء الطلب.', error: error.message });
  }
});

// ============ مسارات مالك الصيدلية ============
app.get('/api/owner/staff', verifyToken, checkRole(ROLES.OWNER), async (req, res) => {
  try {
    const staff = await dbAll('SELECT id, pharmacy_name, email, role, owner_id FROM users WHERE owner_id = ? AND role = ?', [req.ownerId, ROLES.STAFF]);
    res.json(staff);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/owner/staff', verifyToken, checkRole(ROLES.OWNER), async (req, res) => {
  try {
    const { pharmacy_name, email, password } = req.body;
    if (!pharmacy_name || !email || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    const weakPassword = passwordProblem(password);
    if (weakPassword) return res.status(400).json({ error: weakPassword });
    const exists = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (exists) return res.status(409).json({ error: 'البريد مستخدم مسبقاً' });
    const hash = await bcrypt.hash(password, 10);
    const result = await dbRun(
      'INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id) VALUES (?, ?, ?, ?, ?)',
      [pharmacy_name, email, hash, ROLES.STAFF, req.ownerId]
    );
    res.json({ id: result.lastID, message: 'تم إضافة الموظف' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/owner/staff/:id', verifyToken, checkRole(ROLES.OWNER), async (req, res) => {
  try {
    const staffId = req.params.id;
    const { pharmacy_name, email, password } = req.body;
    const staff = await dbGet('SELECT id FROM users WHERE id = ? AND owner_id = ?', [staffId, req.ownerId]);
    if (!staff) return res.status(404).json({ error: 'الموظف غير موجود' });
    const updates = [], params = [];
    if (pharmacy_name) { updates.push('pharmacy_name = ?'); params.push(pharmacy_name); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (password) {
      const weakPassword = passwordProblem(password);
      if (weakPassword) return res.status(400).json({ error: weakPassword });
    }
    if (password) { const hash = await bcrypt.hash(password, 10); updates.push('password_hash = ?'); params.push(hash); }
    if (updates.length === 0) return res.status(400).json({ error: 'لا توجد تغييرات' });
    params.push(staffId);
    await dbRun(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'تم تحديث الموظف' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/owner/staff/:id', verifyToken, checkRole(ROLES.OWNER), async (req, res) => {
  try {
    const staffId = req.params.id;
    const staff = await dbGet('SELECT id FROM users WHERE id = ? AND owner_id = ?', [staffId, req.ownerId]);
    if (!staff) return res.status(404).json({ error: 'الموظف غير موجود' });
    await dbRun('DELETE FROM users WHERE id = ?', [staffId]);
    res.json({ message: 'تم حذف الموظف' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/owner/sales', verifyToken, checkRole(ROLES.OWNER), async (req, res) => {
  try {
    const orders = await dbAll(`
      SELECT oi.id AS id,
             o.id AS order_id,
             oi.quantity AS quantity,
             oi.total_price AS total_price,
             o.created_at AS sold_at,
             m.name AS medicine_name,
             u_customer.pharmacy_name AS customer_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN medicines m ON oi.medicine_id = m.id
      LEFT JOIN users u_customer ON o.customer_id = u_customer.id
      WHERE o.pharmacy_id = ?
      ORDER BY o.created_at DESC
    `, [req.ownerId]);
    res.json(orders);
  } catch (err) {
    console.error('Error in /api/owner/sales:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/owner/sales/summary', verifyToken, checkRole(ROLES.OWNER), async (req, res) => {
    const ownerId = req.ownerId;
    const now = Date.now();
    const cached = salesSummaryCache.get(ownerId);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return res.json(cached.data);
    }
    try {
      // Get summary data (total, today, month, order count)
      const summaryResult = await dbGet(`
        SELECT
          COALESCE(SUM(oi.total_price), 0) AS total_sales,
          COALESCE(SUM(CASE WHEN date(o.created_at) = date('now') THEN oi.total_price END), 0) AS today_sales,
          COALESCE(SUM(CASE WHEN strftime('%Y-%m', o.created_at) = strftime('%Y-%m', 'now') THEN oi.total_price END), 0) AS month_sales,
          COUNT(DISTINCT o.id) AS order_count
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.pharmacy_id = ?
      `, [ownerId]);

      // Get daily sales for the last 7 days (including today)
      const dailySales = await dbAll(`
        SELECT
          date(o.created_at) as sale_date,
          SUM(oi.total_price) as daily_total
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.pharmacy_id = ?
          AND date(o.created_at) >= date('now', '-6 days')
        GROUP BY date(o.created_at)
        ORDER BY date(o.created_at)
      `, [ownerId]);

      // Combine results
      const result = {
        ...summaryResult,
        daily_sales: dailySales
      };
      salesSummaryCache.set(ownerId, { data: result, timestamp: now });
      res.json(result);
    } catch (err) {
      console.error('Error in /api/owner/sales/summary:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/owner/notifications', verifyToken, checkRole(ROLES.OWNER), async (req, res) => {
    try {
      const [expired, expiringSoon, lowStock] = await Promise.all([
        // Still on the shelf past its date: must be pulled, cannot be sold.
        dbAll(`
          SELECT m.id, m.name, m.quantity, m.expire_date, m.price
          FROM medicines m
          WHERE m.owner_id = ?
            AND m.quantity > 0
            AND date(m.expire_date) < date('now')
          ORDER BY date(m.expire_date) ASC
        `, [req.ownerId]),
        dbAll(`
          SELECT m.id, m.name, m.quantity, m.expire_date, m.price
          FROM medicines m
          WHERE m.owner_id = ?
            AND date(m.expire_date) BETWEEN date('now') AND date('now', '+30 days')
          ORDER BY date(m.expire_date) ASC
        `, [req.ownerId]),
        dbAll(`
          SELECT m.id, m.name, m.quantity, m.expire_date, m.price
          FROM medicines m
          WHERE m.owner_id = ?
            AND m.quantity < 10
          ORDER BY m.quantity ASC
        `, [req.ownerId])
      ]);
      res.json({ expired, expiringSoon, lowStock });
    } catch (err) {
      console.error('Error in /api/owner/notifications:', err);
      res.status(500).json({ error: err.message });
    }
  });

// ------------------- بيانات تجريبية أولية -------------------
async function seedDemoData() {
  const defaultPassword = '123456';
  const hash = await bcrypt.hash(defaultPassword, 10);
  const demoUsers = [
    { pharmacy_name: 'صيدلية الشفاء', email: 'owner@pharmacy.com', role: ROLES.OWNER },
    { pharmacy_name: 'المتحدة للمستودعات', email: 'supplier@dist.com', role: ROLES.SUPPLIER },
    { pharmacy_name: 'مدير النظام', email: 'admin@daway.com', role: ROLES.ADMIN },
    { pharmacy_name: 'عميل تجريبي', email: 'customer@test.com', role: ROLES.CUSTOMER },
  ];
  const ownerIds = {};
  for (const u of demoUsers) {
    const existing = await dbGet('SELECT id, role FROM users WHERE email = ?', [u.email]);
    if (existing) {
      await dbRun(
        'UPDATE users SET pharmacy_name = ?, password_hash = ?, role = ? WHERE email = ?',
        [u.pharmacy_name, hash, u.role, u.email]
      );
      ownerIds[u.email] = existing.id;
      if (u.role === ROLES.OWNER) {
        await dbRun('UPDATE users SET owner_id = ? WHERE id = ?', [existing.id, existing.id]);
      }
    } else {
      const result = await dbRun(
        'INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id) VALUES (?, ?, ?, ?, ?)',
        [u.pharmacy_name, u.email, hash, u.role, null]
      );
      ownerIds[u.email] = result.lastID;
      if (u.role === ROLES.OWNER) {
        await dbRun('UPDATE users SET owner_id = ? WHERE id = ?', [result.lastID, result.lastID]);
      }
    }
  }

  const ownerId = ownerIds['owner@pharmacy.com'];
  const staff = await dbGet('SELECT id FROM users WHERE email = ?', ['staff@pharmacy.com']);
  if (staff) {
    await dbRun(
      'UPDATE users SET pharmacy_name = ?, password_hash = ?, role = ?, owner_id = ? WHERE email = ?',
      ['أحمد الصيدلي', hash, ROLES.STAFF, ownerId, 'staff@pharmacy.com']
    );
  } else {
    await dbRun(
      'INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id) VALUES (?, ?, ?, ?, ?)',
      ['أحمد الصيدلي', 'staff@pharmacy.com', hash, ROLES.STAFF, ownerId]
    );
  }

  const medCount = await dbGet('SELECT COUNT(*) AS c FROM medicines');
  if (!medCount || medCount.c === 0) {
    await dbRun(
      `INSERT INTO medicines (user_id, name, quantity, batch_number, expire_date, price, barcode, cost_price, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ownerId, 'بنادول إكسترا', 120, 'B001', '2026-12-01', 15, '62810001', 10, ownerId]
    );
    await dbRun(
      `INSERT INTO medicines (user_id, name, quantity, batch_number, expire_date, price, barcode, cost_price, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ownerId, 'أوميبرازول 20 ملغ', 5, 'B002', '2024-07-15', 45, '62810002', 30, ownerId]
    );
  }

  const pendingCount = await dbGet("SELECT COUNT(*) AS c FROM pharmacy_registrations WHERE status = 'pending'");
  if (!pendingCount || pendingCount.c === 0) {
    await dbRun(
      `INSERT INTO pharmacy_registrations (pharmacy_name, owner_name, email, password_hash, phone, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['صيدلية النور', 'خالد العتيبي', 'nour@test.com', hash, '+9665000000', '', 'pending']
    );
  }

  console.log('Demo accounts ready. Password for all test users: 123456');
}

// ------------------- تشغيل الخادم -------------------
// ------------------- الواجهة المبنيّة (production) -------------------
// After `npm run build`, the same process serves the SPA, so one `npm start`
// runs the whole app. Unknown /api paths still answer JSON 404, and every other
// GET falls back to index.html for client-side routes.
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'المسار غير موجود' }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Body-parser failures (oversized upload, malformed JSON) and anything a route
// did not catch: answer JSON the client can show, never Express's HTML page or
// a stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'حجم البيانات المرسلة كبير جداً (الحد 5 ميغابايت للإيصال).' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'صيغة البيانات المرسلة غير صالحة.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم.' });
});

// Demo accounts share a known password (and an admin among them), and the seed
// resets them on every boot — so it runs only on an explicit opt-in, and never
// in production.
const shouldSeedDemoData =
  process.env.SEED_DEMO_DATA === 'true' && process.env.NODE_ENV !== 'production';

app.listen(PORT, async () => {
  if (shouldSeedDemoData) {
    try {
      await seedDemoData();
    } catch (err) {
      console.error('Seed failed:', err.message);
    }
  }
  console.log(`Server is running at http://localhost:${PORT}`);
  createDatabaseBackup();
  setInterval(createDatabaseBackup, 24 * 60 * 60 * 1000);
  if (process.platform === 'win32' && process.env.NODE_ENV !== 'production') {
    exec(`start http://localhost:${PORT}`);
  }
});