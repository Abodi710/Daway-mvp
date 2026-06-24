const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });

const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_here';
const dbPath = path.join(__dirname, 'daway.db');
const backupsDir = path.join(__dirname, 'backups');

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

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function createDatabaseBackup() {
  try {
    if (!fs.existsSync(dbPath)) {
      return;
    }

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
      .sort((left, right) => right.time - left.time);

    backupFiles.slice(7).forEach((backup) => {
      fs.unlinkSync(backup.fullPath);
    });

    console.log(`Backup created: ${backupFileName}`);
  } catch (error) {
    console.error('Backup failed:', error.message);
  }
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacy_name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pharmacies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT
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
      price REAL
    )
  `);

  db.all("PRAGMA table_info(medicines)", (error, columns) => {
    if (error) {
      console.error('Failed to inspect medicines table:', error.message);
      return;
    }

    const hasUserId = columns.some((column) => column.name === 'user_id');
    if (!hasUserId) {
      db.run('ALTER TABLE medicines ADD COLUMN user_id INTEGER', (alterError) => {
        if (alterError) {
          console.error('Failed to add user_id column:', alterError.message);
        }
      });
    }
  });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authorization token is required.' });
  }

  jwt.verify(token, JWT_SECRET, (error, payload) => {
    if (error) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    req.userId = payload.user_id;
    req.userEmail = payload.email;
    next();
  });
}

app.get('/status', (req, res) => res.json({ status: 'running', timestamp: new Date() }));

app.post('/api/register', async (req, res) => {
  try {
    const { pharmacy_name, email, password } = req.body;

    if (!pharmacy_name || !email || !password) {
      return res.status(400).json({ message: 'All registration fields are required.' });
    }

    const existingUser = await getQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await runQuery(
      'INSERT INTO users (pharmacy_name, email, password_hash) VALUES (?, ?, ?)',
      [pharmacy_name, email, password_hash]
    );

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await getQuery(
      'SELECT id, pharmacy_name, email, password_hash FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const token = jwt.sign(
      { user_id: user.id, email: user.email, pharmacy_name: user.pharmacy_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        pharmacy_name: user.pharmacy_name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed.', error: error.message });
  }
});

// ===== تغيير كلمة المرور =====
app.post('/api/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.userId;

  // جلب المستخدم الحالي
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    // التحقق من كلمة المرور الحالية
    bcrypt.compare(currentPassword, user.password_hash, (err, match) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
      }
      if (!match) {
        return res.status(401).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
      }

      // تشفير كلمة المرور الجديدة
      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'خطأ في التشفير' });
        }

        // تحديث قاعدة البيانات
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId], function (err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'فشل التحديث' });
          }
          res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
        });
      });
    });
  });
});

app.post('/api/medicines', authenticateToken, async (req, res) => {
  try {
    const { name, quantity, batch_number, expire_date, price } = req.body;

    if (!name || quantity === undefined || !batch_number || !expire_date || price === undefined) {
      return res.status(400).json({ message: 'All medicine fields are required.' });
    }

    const result = await runQuery(
      `INSERT INTO medicines (user_id, name, quantity, batch_number, expire_date, price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.userId, name, quantity, batch_number, expire_date, price]
    );

    res.status(201).json({
      message: 'Medicine added successfully.',
      medicine: {
        id: result.lastID,
        user_id: req.userId,
        name,
        quantity,
        batch_number,
        expire_date,
        price,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save medicine.', error: error.message });
  }
});

app.get('/api/medicines', authenticateToken, async (req, res) => {
  try {
    const rows = await allQuery(
      'SELECT * FROM medicines WHERE user_id = ? ORDER BY id DESC',
      [req.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch medicines.', error: error.message });
  }
});

app.put('/api/medicines/:id', authenticateToken, async (req, res) => {
  try {
    const medicineId = req.params.id;
    const { name, quantity, batch_number, expire_date, price } = req.body;

    const existingMedicine = await getQuery(
      'SELECT id FROM medicines WHERE id = ? AND user_id = ?',
      [medicineId, req.userId]
    );

    if (!existingMedicine) {
      return res.status(404).json({ message: 'Medicine not found.' });
    }

    const result = await runQuery(
      `UPDATE medicines
       SET name = ?, quantity = ?, batch_number = ?, expire_date = ?, price = ?
       WHERE id = ? AND user_id = ?`,
      [name, quantity, batch_number, expire_date, price, medicineId, req.userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Medicine not found.' });
    }

    res.json({ message: 'Medicine updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update medicine.', error: error.message });
  }
});

app.delete('/api/medicines/:id', authenticateToken, async (req, res) => {
  try {
    const medicineId = req.params.id;

    const existingMedicine = await getQuery(
      'SELECT id FROM medicines WHERE id = ? AND user_id = ?',
      [medicineId, req.userId]
    );

    if (!existingMedicine) {
      return res.status(404).json({ message: 'Medicine not found.' });
    }

    const result = await runQuery(
      'DELETE FROM medicines WHERE id = ? AND user_id = ?',
      [medicineId, req.userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Medicine not found.' });
    }

    res.json({ message: 'Medicine deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete medicine.', error: error.message });
  }
});

app.get('/api/medicines/expiry-alerts', authenticateToken, async (req, res) => {
  try {
    const rows = await allQuery(
      `SELECT *
       FROM medicines
       WHERE user_id = ?
         AND (
           date(expire_date) <= date('now', '+90 day')
           OR date(expire_date) <= date('now')
         )
       ORDER BY date(expire_date) ASC`,
      [req.userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch expiry alerts.', error: error.message });
  }
});

app.get('/api/medicines/low-stock', authenticateToken, async (req, res) => {
  try {
    const rows = await allQuery(
      `SELECT *
       FROM medicines
       WHERE user_id = ?
         AND quantity <= 5
       ORDER BY quantity ASC, id DESC`,
      [req.userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch low stock medicines.', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log('Database and tables are ready for local use.');
  createDatabaseBackup();
  setInterval(createDatabaseBackup, 24 * 60 * 60 * 1000);
  if (process.platform === 'win32' && process.env.NODE_ENV !== 'production') {
    exec(`start http://localhost:${PORT}`);
  }
});
