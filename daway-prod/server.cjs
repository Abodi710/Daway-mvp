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

const ADMIN_EMAILS = new Set([
  'admin1@example.com',
  'admin2@example.com',
]);
const ROOT_ADMIN_EMAIL = 'abdulwahab.amir34@gmail.com';

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
  // Enable foreign key constraints
  db.run('PRAGMA foreign_keys=ON', (err) => {
    if (err) {
      console.error('Failed to enable foreign keys:', err.message);
    }
  });
});

// ------------------- دوال مساعدة لقاعدة البيانات -------------------
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.ROOT_ADMIN_EMAIL || 'abdulwahab.amir34@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('Fatal error: ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const existing = await dbGet('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (!existing) {
    await dbRun(
      'INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id) VALUES (?, ?, ?, ?, ?)',
      ['System Admin', adminEmail, passwordHash, 'admin', null]
    );
    ADMIN_EMAILS.add(adminEmail);
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
          }
        });
      }
    });

    if (!columns.some(col => col.name === 'owner_id')) {
      db.run('UPDATE medicines SET owner_id = user_id', (updateErr) => {
        if (updateErr) console.error('Failed to migrate owner_id:', updateErr.message);
      });
    }
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
      // مرفق إيصال بنكك — راجع POST /api/orders/upload-receipt
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
function createDatabaseBackup() {
  try {
    if (!fs.existsSync(dbPath)) return;
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `daway-backup-${timestamp}.db`;
    const backupPath = path.join(backupsDir, backupFileName);
    fs.copyFileSync(dbPath, backupPath);

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
app.use('/api/orders/upload-receipt', authLimiter);

app.post('/simple-test', (req, res) => res.json({ ok: true }));


// Simple in-memory cache for sales summary
const salesSummaryCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'مطلوب تسجيل الدخول' });
  }

  jwt.verify(token, JWT_SECRET, (error, payload) => {
    if (error) {
      return res.status(403).json({ error: 'التوكن غير صالح أو منتهي' });
    }
    req.userId = payload.user_id;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    req.ownerId = payload.owner_id || null;
    next();
  });
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
      'SELECT id, pharmacy_name, email, role, owner_id, created_at FROM users ORDER BY id DESC'
    );
    res.json(users);
  } catch (err) {
    console.error('خطأ في /api/users:', err);
    res.status(500).json({ error: 'فشل تحميل المستخدمين' });
  }
});

console.log('>>> تم تحميل مسار POST /api/users');

// إضافة مستخدم جديد (للأدمن)
app.post('/api/users', verifyToken, checkRole(ROLES.ADMIN), async (req, res) => {
  try {
    // استقبال الحقول مع دعم الاسم الكامل (name) أو pharmacy_name
    const { name, pharmacy_name, email, password, role, owner_id } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    }

    // إذا لم يرسل الـ Frontend كلمة مرور، نضع كلمة مرور افتراضية (مثلاً: 123456) لمنع الخطأ
    const finalPassword = password || '123456';
    const hash = await bcrypt.hash(finalPassword, 10);
    
    // استخدام name أو pharmacy_name حسب المتاح من الواجهة
    const displayName = name || pharmacy_name || '';

    const result = await dbRun(
      'INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id) VALUES (?,?,?,?,?)',
      [displayName, email, hash, role || 'pharmacy_staff', owner_id || null]
    );
    
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
      updateFields.push('role = ?');
      params.push(role);
    }
    if (owner_id !== undefined) {
      updateFields.push('owner_id = ?');
      params.push(owner_id === null ? null : parseInt(owner_id, 10));
    }
    if (password) {
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
    const user = await dbGet('SELECT status FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    await dbRun('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
    res.json({ message: `تم تحديث الحالة إلى ${newStatus}`, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تسجيل الحسابات العامة والعملاء
app.post('/api/register', async (req, res) => {
  try {
    const { pharmacy_name, email, password, role: requestedRole, owner_id, phone, country, gender, age } = req.body;

    const isCustomer = requestedRole === ROLES.CUSTOMER;
    if (!isCustomer && !pharmacy_name) {
      return res.status(400).json({ message: 'اسم الصيدلية مطلوب.' });
    }
    if (!email || !password) {
      return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبان.' });
    }

    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ message: 'البريد الإلكتروني مستخدم مسبقاً.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    let finalRole = requestedRole && Object.values(ROLES).includes(requestedRole) ? requestedRole : (isCustomer ? ROLES.CUSTOMER : ROLES.OWNER);
    let finalOwnerId = owner_id || null;

    const result = await dbRun(
      `INSERT INTO users (pharmacy_name, email, password_hash, role, owner_id, phone, country, gender, age)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        isCustomer ? (pharmacy_name || 'عميل') : pharmacy_name,
        email,
        password_hash,
        finalRole,
        finalOwnerId,
        phone || null,
        country || null,
        gender || null,
        age || null,
      ]
    );

    if (finalRole === ROLES.OWNER && !finalOwnerId) {
      await dbRun('UPDATE users SET owner_id = ? WHERE id = ?', [result.lastID, result.lastID]);
    }

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
      'SELECT id, pharmacy_name, email, password_hash, role, owner_id, phone, country, gender, age FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة.' });
    }

    const finalRole = ADMIN_EMAILS.has(user.email) || user.email === ROOT_ADMIN_EMAIL ? ROLES.ADMIN : user.role;
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

// ------------------- التقارير (مؤقت) -------------------
app.get('/api/reports/profits', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER), async (req, res) => {
  try {
    const userId = req.userId || req.ownerId;
    if (!userId) {
      return res.status(400).json({ message: 'Unable to determine user ID.' });
    }

    const sql = `
      SELECT
        name,
        SUM(price * quantity) AS profit
      FROM medicines
      WHERE user_id = ?
      GROUP BY name
      ORDER BY profit DESC
    `;
    const params = [userId];

    const result = await dbAll(sql, params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching profits:', error);
    res.status(500).json({ message: 'Failed to retrieve profit report.', error: error.message });
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
      'SELECT id, name, price, quantity, expire_date FROM medicines WHERE owner_id = ? AND quantity > 0 ORDER BY name',
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

    const medicine = await dbGet(
      'SELECT id, quantity, price FROM medicines WHERE id = ? AND owner_id = ?',
      [medicineId, pharmacyId]
    );

    if (!medicine) {
      return res.status(404).json({ message: 'الدواء غير متوفر في هذه الصيدلية.' });
    }

    if (medicine.quantity < requestedQuantity) {
      return res.status(400).json({ message: 'الكمية المطلوبة غير متوفرة.' });
    }

    const totalPrice = medicine.price * requestedQuantity;
    const newQuantity = medicine.quantity - requestedQuantity;

    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('UPDATE medicines SET quantity = ? WHERE id = ?', [newQuantity, medicineId]);
      const orderResult = await dbRun(
        'INSERT INTO orders (pharmacy_id, customer_id, status, total_amount) VALUES (?, ?, ?, ?)',
        [pharmacyId, req.userId, 'pending', totalPrice]
      );
      const orderId = orderResult.lastID;
      await dbRun(
        'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [orderId, medicineId, requestedQuantity, medicine.price, requestedQuantity * medicine.price]
      );
      await dbRun('COMMIT');

      res.status(201).json({
        message: 'تم تقديم الطلب بنجاح.',
        order: {
          id: orderId,
          medicine_id: medicineId,
          quantity: requestedQuantity,
          total_price: totalPrice,
        },
      });
    } catch (err) {
      await dbRun('ROLLBACK');
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'فشل إنشاء الطلب.', error: error.message });
  }
});

app.post('/api/customer/order-batch', verifyToken, checkRole(ROLES.CUSTOMER), async (req, res) => {
  try {
    const { pharmacyId, items } = req.body;
    if (!pharmacyId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'معرف الصيدلية ومוצרים مطلوبان' });
    }
    const pharmacyIdNum = Number(pharmacyId);
    if (!Number.isInteger(pharmacyIdNum)) {
      return res.status(400).json({ message: 'معرف الصيدلية غير صالح' });
    }
    // Verify pharmacy exists and is owner
    const pharmacy = await dbGet('SELECT id, role FROM users WHERE id = ? AND role = ?', [pharmacyIdNum, ROLES.OWNER]);
    if (!pharmacy) {
      return res.status(404).json({ message: 'الصيدلية غير موجودة أو ليست صيدلية' });
    }
    // Aggregate items by medicine_id to avoid duplicate updates? We'll just process sequentially.
    let totalAmount = 0;
    const updates = []; // each { medId, qty }
    for (const item of items) {
      const { medicine_id, quantity } = item;
      if (!medicine_id || !quantity) {
        return res.status(400).json({ message: 'كل عنصر يجب أن يحتوي على معرف الدواء والكمية' });
      }
      const medId = Number(medicine_id);
      const qty = Number(quantity);
      if (!Number.isInteger(medId) || !Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ message: 'قيم غير صالحة للعنصر' });
      }
      // `name` is selected because the out-of-stock message below interpolates it.
      const medicine = await dbGet('SELECT id, name, price, quantity, owner_id FROM medicines WHERE id = ?', [medId]);
      if (!medicine) {
        return res.status(404).json({ message: `الدواء بمعرف ${medId} غير موجود` });
      }
      if (medicine.owner_id !== pharmacyIdNum) {
        return res.status(403).json({ message: `الدواء بمعرف ${medId} لا يتبع هذه الصيدلية` });
      }
      if (medicine.quantity < qty) {
        return res.status(400).json({ message: `الكمية المطلوبة غير متوفرة للدواء ${medicine.name}` });
      }
      totalAmount += medicine.price * qty;
      updates.push({ medicine, qty });
    }
    // Begin transaction
    await dbRun('BEGIN TRANSACTION');
    try {
      // Update stock
      for (const { medicine, qty } of updates) {
        const newQty = medicine.quantity - qty;
        await dbRun('UPDATE medicines SET quantity = ? WHERE id = ?', [newQty, medicine.id]);
      }
      // Create order
      const orderResult = await dbRun(
        'INSERT INTO orders (pharmacy_id, customer_id, total_amount, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [pharmacyIdNum, req.userId, totalAmount]
      );
      const orderId = orderResult.lastID;
      // Insert order items
      for (const { medicine, qty } of updates) {
        await dbRun(
          'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [orderId, medicine.id, qty, medicine.price, medicine.price * qty]
        );
      }
      await dbRun('COMMIT');
      res.status(201).json({ message: 'تم إنشاء الطلب بنجاح', orderId });
    } catch (err) {
      await dbRun('ROLLBACK');
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'فشل إنشاء الطلب الدفعي', error: error.message });
  }
});

app.get('/api/customer/orders', verifyToken, checkRole(ROLES.CUSTOMER), async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT o.id AS id, o.status, o.created_at, o.total_amount,
             m.name AS medicine_name,
             oi.quantity, oi.unit_price, oi.total_price,
             u.pharmacy_name AS pharmacy_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN medicines m ON oi.medicine_id = m.id
      JOIN users u ON o.pharmacy_id = u.id
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC
    `, [req.userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'فشل 가져 التاريخ الطلبات', error: error.message });
  }
});

// ------------------- تحديث حالة الطلب -------------------
/**
 * PATCH /api/orders/:id/status — moves a customer order out of 'pending'.
 *
 * Only the pharmacy the order was placed against (its owner or one of its staff)
 * or an admin may do this. Cancelling returns the reserved stock to the shelf, so
 * the status change and the restore share a single transaction. The UPDATE is
 * guarded on status = 'pending' as well, so two concurrent calls cannot both win.
 */
app.patch('/api/orders/:id/status', verifyToken, checkRole(ROLES.ADMIN, ROLES.OWNER, ROLES.STAFF), async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ message: 'معرف الطلب غير صالح.' });
    }

    const { status } = req.body || {};
    if (status !== 'completed' && status !== 'cancelled') {
      return res.status(400).json({ message: "الحالة يجب أن تكون 'completed' أو 'cancelled'." });
    }

    const order = await dbGet('SELECT id, pharmacy_id, status FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود.' });
    }

    // Admins act on any order; owners and staff only on their own pharmacy's.
    // req.ownerId is the owner's user id for both roles, and orders.pharmacy_id
    // stores that same id.
    if (req.userRole !== ROLES.ADMIN && order.pharmacy_id !== req.ownerId) {
      return res.status(403).json({ message: 'لا يمكنك تعديل طلبات صيدلية أخرى.' });
    }

    if (order.status !== 'pending') {
      return res.status(409).json({ message: `لا يمكن تعديل طلب حالته '${order.status}'.` });
    }

    await dbRun('BEGIN TRANSACTION');
    try {
      if (status === 'cancelled') {
        const items = await dbAll(
          'SELECT medicine_id, quantity FROM order_items WHERE order_id = ?',
          [orderId]
        );
        for (const item of items) {
          await dbRun(
            'UPDATE medicines SET quantity = quantity + ? WHERE id = ?',
            [item.quantity, item.medicine_id]
          );
        }
      }

      const result = await dbRun(
        "UPDATE orders SET status = ? WHERE id = ? AND status = 'pending'",
        [status, orderId]
      );
      if (result.changes === 0) {
        // Another request moved the order between the read above and this write.
        await dbRun('ROLLBACK');
        return res.status(409).json({ message: 'تم تعديل حالة الطلب بواسطة عملية أخرى.' });
      }

      await dbRun('COMMIT');
      res.json({ message: 'تم تحديث حالة الطلب.', orderId, status });
    } catch (err) {
      await dbRun('ROLLBACK');
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'فشل تحديث حالة الطلب.', error: error.message });
  }
});

// ------------------- إيصال الدفع (بنكك) -------------------
/**
 * POST /api/orders/upload-receipt — يربط إيصال بنكك بالطلب.
 *
 * The deployment has no object storage and no multipart middleware, so this
 * records a *reference* to the receipt (the client-side file name) plus a
 * timestamp, and moves the order to payment_status = 'pending_review' for a
 * human to confirm. It deliberately does not claim the payment succeeded.
 *
 * Body: { orderId, receiptName }  (receiptRef / reference / fileName also accepted)
 *
 * A customer may only attach a receipt to their own order; admins to any.
 * Cancelled orders are refused — there is nothing left to pay.
 */
app.post('/api/orders/upload-receipt', verifyToken, checkRole(ROLES.CUSTOMER, ROLES.ADMIN), async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = Number(body.orderId ?? body.order_id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'معرف الطلب غير صالح.' });
    }

    const rawName = body.receiptName ?? body.receipt_name ?? body.receiptRef ?? body.reference ?? body.fileName;
    if (typeof rawName !== 'string' || !rawName.trim()) {
      return res.status(400).json({ error: 'اسم ملف الإيصال مطلوب.' });
    }
    // Stored as a reference, never opened as a path — but strip directory
    // components and control characters anyway so nothing traversal-shaped is
    // persisted, and cap the length the column has to carry.
    const receiptRef = path
      .basename(rawName.trim())
      // eslint-disable-next-line no-control-regex
      .replace(/[ -]/g, '')
      .slice(0, 200)
      .trim();
    if (!receiptRef) {
      return res.status(400).json({ error: 'اسم ملف الإيصال غير صالح.' });
    }

    const order = await dbGet('SELECT id, customer_id, status FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود.' });
    }
    if (req.userRole !== ROLES.ADMIN && order.customer_id !== req.userId) {
      return res.status(403).json({ error: 'لا يمكنك رفع إيصال لطلب مستخدم آخر.' });
    }
    if (order.status === 'cancelled') {
      return res.status(409).json({ error: 'لا يمكن رفع إيصال لطلب ملغي.' });
    }

    await dbRun(
      `UPDATE orders
          SET receipt_ref = ?,
              receipt_uploaded_at = CURRENT_TIMESTAMP,
              payment_status = 'pending_review'
        WHERE id = ?`,
      [receiptRef, orderId]
    );

    const updated = await dbGet(
      'SELECT receipt_uploaded_at, payment_status FROM orders WHERE id = ?',
      [orderId]
    );

    res.json({
      message: 'تم استلام الإيصال، بانتظار المراجعة.',
      orderId,
      receiptName: receiptRef,
      receiptRef,
      uploadedAt: updated ? updated.receipt_uploaded_at : null,
      paymentStatus: updated ? updated.payment_status : 'pending_review',
    });
  } catch (error) {
    console.error('خطأ في رفع الإيصال:', error);
    res.status(500).json({ error: 'فشل رفع الإيصال.' });
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
    const { name, price, description } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'اسم الدواء والسعر مطلوبان' });
    const result = await dbRun(
      'INSERT INTO supplier_medicines (supplier_id, name, price, description) VALUES (?, ?, ?, ?)',
      [req.userId, name, price, description || '']
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

    await dbRun('BEGIN TRANSACTION');
    try {
      const items = await dbAll(
        'SELECT id, medicine_id, qty_requested FROM purchase_order_items WHERE order_id = ?',
        [orderId]
      );

      let stockCredited = 0;
      let stockSkipped = 0;

      for (const item of items) {
        await dbRun(
          'UPDATE purchase_order_items SET qty_fulfilled = qty_requested WHERE id = ?',
          [item.id]
        );

        const credit = await dbRun(
          `UPDATE medicines
              SET quantity = COALESCE(quantity, 0) + ?
            WHERE id = ?
              AND (owner_id = ? OR user_id = ?)`,
          [item.qty_requested, item.medicine_id, order.pharmacy_id, order.pharmacy_id]
        );
        if (credit.changes > 0) stockCredited += 1;
        else stockSkipped += 1;
      }

      const result = await dbRun(
        `UPDATE purchase_orders
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'pending'`,
        [orderId]
      );
      if (result.changes === 0) {
        // Another request moved the order between the read above and this write.
        await dbRun('ROLLBACK');
        return res.status(409).json({ error: 'تم تعديل حالة أمر الشراء بواسطة عملية أخرى.' });
      }

      await dbRun('COMMIT');
      res.json({
        message: 'تم تنفيذ أمر الشراء بنجاح.',
        orderId,
        status: 'completed',
        items_fulfilled: items.length,
        stock_credited: stockCredited,
        stock_skipped: stockSkipped,
      });
    } catch (err) {
      await dbRun('ROLLBACK');
      throw err;
    }
  } catch (error) {
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

    const medicine = await dbGet('SELECT id, name, price, quantity, owner_id FROM medicines WHERE id = ?', [medId]);
    if (!medicine) {
      return res.status(404).json({ message: 'الدواء غير موجود.' });
    }
    if (medicine.owner_id !== req.ownerId) {
      return res.status(403).json({ message: 'لا يمكنك طلب دواء ليس من صيدليتك.' });
    }
    if (medicine.quantity < qty) {
      return res.status(400).json({ message: 'الكمية المطلوبة غير متوفرة.' });
    }

    const totalPrice = medicine.price * qty;

    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('UPDATE medicines SET quantity = quantity - ? WHERE id = ?', [qty, medId]);
      const orderResult = await dbRun(
        'INSERT INTO orders (pharmacy_id, customer_id, status, total_amount) VALUES (?, NULL, ?, ?)',
        [req.ownerId, 'completed', totalPrice]
      );
      const orderId = orderResult.lastID;
      await dbRun(
        'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [orderId, medId, qty, medicine.price, totalPrice]
      );
      await dbRun('COMMIT');

      res.status(201).json({
        message: 'تم إنشاء الطلب بنجاح.',
        orderId,
        order: { id: orderId, medicine_id: medId, quantity: qty, total_price: totalPrice }
      });
    } catch (err) {
      await dbRun('ROLLBACK');
      throw err;
    }
  } catch (error) {
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
      const [expiringSoon, lowStock] = await Promise.all([
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
      res.json({ expiringSoon, lowStock });
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
app.listen(PORT, async () => {
  try {
    await seedDemoData();
  } catch (err) {
    console.error('Seed failed:', err.message);
  }
  console.log(`Server is running at http://localhost:${PORT}`);
  createDatabaseBackup();
  setInterval(createDatabaseBackup, 24 * 60 * 60 * 1000);
  if (process.platform === 'win32' && process.env.NODE_ENV !== 'production') {
    exec(`start http://localhost:${PORT}`);
  }
});