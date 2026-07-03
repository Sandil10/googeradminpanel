const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.use(authMiddleware, adminOnly);

const SUSPENSION_DAYS = 7;
const PERMANENT_DEACTIVATION_MESSAGE = 'Your account is permanently deactivated.';

const ensureSuspensionColumns = async () => {
  await pool.query(`ALTER TABLE users ALTER COLUMN status TYPE VARCHAR(40)`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deactivated BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS self_deactivated_at TIMESTAMP DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS self_deleted_at TIMESTAMP DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_deactivated_at TIMESTAMP DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50) DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason_category VARCHAR(120) DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason_custom TEXT DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_action VARCHAR(80) DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_days INTEGER DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_ends_at TIMESTAMP DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_text TEXT DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_status VARCHAR(30) DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_submitted_at TIMESTAMP DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_reviewed_at TIMESTAMP DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_admin_note TEXT DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_id VARCHAR(12) DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_contact_email TEXT DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_phone_number TEXT DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS appeal_agreement_confirmed BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_wallet_access BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
};

const getUserColumnMap = async (client) => {
  const result = await client.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'users'`
  );
  return new Map(result.rows.map((row) => [row.column_name, row.data_type]));
};

const anonymizeUserForPermanentDeletion = async (client, id) => {
  await ensureSuspensionColumns();

  const current = await client.query(
    `SELECT id, email, phone_number, appeal_phone_number, password
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [id]
  );
  if (!current.rows.length) return null;

  const user = current.rows[0];
  const columns = await getUserColumnMap(client);
  const setParts = [];
  const params = [];
  const add = (column, value) => {
    if (!columns.has(column)) return;
    params.push(value);
    setParts.push(`${column} = $${params.length}`);
  };

  const phoneToKeep = user.phone_number || user.appeal_phone_number || null;
  const randomPassword = await bcrypt.hash(`permanently-deactivated-${id}-${Date.now()}-${Math.random()}`, 10);

  if (columns.has('user_id') && !['integer', 'bigint', 'smallint', 'numeric'].includes(columns.get('user_id'))) {
    add('user_id', `deleted-${id}`);
  }
  add('username', `deleted_user_${id}`);
  add('full_name', 'Deleted User');
  add('first_name', null);
  add('last_name', null);
  add('password', randomPassword);
  add('user_type', 'user');
  add('profile_picture', null);
  add('bio', null);
  add('country', null);
  add('province', null);
  add('date_of_birth', null);
  add('gender', null);
  add('relationship_status', null);
  add('shipping_address', null);
  add('contact_email', user.email || null);
  add('phone_number', phoneToKeep);
  add('wallet_balance', 0);
  add('hold_balance', 0);
  add('referral_code', null);
  add('status', 'Permanently Deactivated');
  add('is_deactivated', true);
  add('permanent_deactivated_at', new Date());
  add('deactivation_reason', PERMANENT_DEACTIVATION_MESSAGE);
  add('suspension_reason_category', 'Permanently Deactivated');
  add('suspension_reason_custom', null);
  add('suspension_action', 'Permanent Deactivation');
  add('suspension_days', null);
  add('suspended_at', null);
  add('suspension_ends_at', null);
  add('appeal_status', 'rejected');
  add('appeal_reviewed_at', new Date());
  add('appeal_admin_note', PERMANENT_DEACTIVATION_MESSAGE);
  add('suspended_wallet_access', false);
  add('appeal_agreement_confirmed', false);

  params.push(id);
  const result = await client.query(
    `UPDATE users
     SET ${setParts.join(', ')}
     WHERE id = $${params.length}
     RETURNING id, email, phone_number, status, is_deactivated, permanent_deactivated_at`,
    params
  );
  return result.rows[0] || null;
};

const buildReason = (category, customReason) => {
  const reasonCategory = String(category || '').trim();
  const custom = String(customReason || '').trim();
  return reasonCategory === 'Other (Custom Reason)' && custom ? custom : reasonCategory || custom;
};

// Create a new user (admin)
router.post('/', async (req, res) => {
  const { user_id, user_type, username, full_name, email, password, confirm_password } = req.body;

  if (!user_id || !user_type || !username || !full_name || !email || !password || !confirm_password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (!/^\d{6}$/.test(user_id)) {
    return res.status(400).json({ message: 'User ID must be exactly 6 digits.' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    await ensureSuspensionColumns();
    // Expand user_id column to accept 6+ digits if it was VARCHAR(4)
    await pool.query(`ALTER TABLE users ALTER COLUMN user_id TYPE VARCHAR(20)`).catch(() => {});

    // Check uniqueness
    const exists = await pool.query(
      `SELECT user_id, email, username, status, is_deactivated, appeal_status, self_deleted_at, permanent_deactivated_at
       FROM users
       WHERE user_id = $1 OR email = $2 OR username = $3`,
      [user_id, email, username]
    );
    if (exists.rows.length > 0) {
      const dup = exists.rows[0];
      if (dup.user_id === user_id)   return res.status(409).json({ message: 'User ID already in use.' });
      if (dup.email === email) {
        const blocked = Boolean(dup.self_deleted_at)
          || Boolean(dup.permanent_deactivated_at)
          || String(dup.status || '').toLowerCase() === 'permanently deactivated'
          || (dup.is_deactivated === true && String(dup.appeal_status || '').toLowerCase() === 'rejected');
        return res.status(blocked ? 403 : 409).json({ message: blocked ? PERMANENT_DEACTIVATION_MESSAGE : 'Email already registered.' });
      }
      if (dup.username === username) return res.status(409).json({ message: 'Username already taken.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const cleanName = username.substring(0, 3).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referralCode = `REF-${cleanName}-${randomStr}`;

    const normalizedType = user_type.toLowerCase();

    const result = await pool.query(
      `INSERT INTO users (user_id, username, full_name, email, password, user_type, referral_code, wallet_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, username, full_name, email, user_type, profile_picture, referral_code, wallet_balance, created_at`,
      [user_id, username, full_name, email, hashedPassword, normalizedType, referralCode, 0.00]
    );

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get all users
router.get('/all', async (req, res) => {
  try {
    await ensureSuspensionColumns();
    const result = await pool.query(`
      SELECT *
      FROM users
      WHERE marked_for_deletion_at IS NULL
        AND COALESCE(is_deactivated, false) = false
        AND COALESCE(status, 'Active') <> 'Deactivated'
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    // If the marked_for_deletion_at column doesn't exist yet (Vercel production DB missing it)
    if (err.code === '42703') {
      try {
        console.log("Auto-adding missing column 'marked_for_deletion_at' on the fly...");
        await pool.query("ALTER TABLE users ADD COLUMN marked_for_deletion_at TIMESTAMP DEFAULT NULL");
        await ensureSuspensionColumns();
        const retryResult = await pool.query(`
          SELECT *
          FROM users
          WHERE marked_for_deletion_at IS NULL
            AND COALESCE(is_deactivated, false) = false
            AND COALESCE(status, 'Active') <> 'Deactivated'
          ORDER BY created_at DESC
        `);
        return res.json(retryResult.rows);
      } catch (retryErr) {
        console.error("Migration fallback failed:", retryErr);
      }
    }
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Get deactivated users (both marked for deletion and manually deactivated)
router.get('/deactivated', async (req, res) => {
  try {
    await ensureSuspensionColumns();
    const result = await pool.query(`
      SELECT *
      FROM users
      WHERE (marked_for_deletion_at IS NOT NULL OR status = 'Deactivated' OR is_deactivated = true)
        AND permanent_deactivated_at IS NULL
        AND self_deleted_at IS NULL
        AND COALESCE(status, '') <> 'Permanently Deactivated'
        AND COALESCE(status, '') <> 'Deleted'
      ORDER BY COALESCE(marked_for_deletion_at, suspended_at, created_at) DESC, created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    if (err.code === '42703') {
      try {
        console.log("Auto-adding missing column 'marked_for_deletion_at' on the fly...");
        await pool.query("ALTER TABLE users ADD COLUMN marked_for_deletion_at TIMESTAMP DEFAULT NULL");
        const retryResult = await pool.query("SELECT * FROM users WHERE marked_for_deletion_at IS NOT NULL OR status = 'Deactivated' ORDER BY marked_for_deletion_at DESC, created_at DESC");
        return res.json(retryResult.rows);
      } catch (retryErr) {
        console.error("Migration fallback failed:", retryErr);
      }
    }
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Get permanently deleted/deactivated users. Only retained block details are returned.
router.get('/deleted', async (req, res) => {
  try {
    await ensureSuspensionColumns();
    const result = await pool.query(`
      SELECT id, user_id, username, email, phone_number, self_deleted_at, permanent_deactivated_at, status
      FROM users
      WHERE self_deleted_at IS NOT NULL
         OR permanent_deactivated_at IS NOT NULL
         OR status = 'Permanently Deactivated'
         OR status = 'Deleted'
      ORDER BY COALESCE(self_deleted_at, permanent_deactivated_at, created_at) DESC, created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Get user details — accepts numeric DB id or public user_id (e.g. "GG-12345")
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    let result;
    if (Number.isInteger(numericId) && numericId > 0) {
      result = await pool.query('SELECT * FROM users WHERE id = $1', [numericId]);
      if (result.rows.length === 0) {
        result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
      }
    } else {
      result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
    }
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Update user status (Activate/Deactivate)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Get user transaction history and earnings
router.get('/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch all accepted transactions where user is receiver
    const transactions = await pool.query(
      `SELECT t.*, 
              s.username as sender_username, s.full_name as sender_full_name, s.user_id as sender_readable_id,
              r.username as receiver_username, r.full_name as receiver_full_name, r.user_id as receiver_readable_id
       FROM wallet_transfers t
       JOIN users s ON t.sender_id = s.id
       JOIN users r ON t.receiver_id = r.id
       WHERE (t.sender_id = $1 OR t.receiver_id = $1)
       ORDER BY t.created_at DESC`,
      [id]
    );

    // Calculate total earnings (accepted transactions where user is receiver)
    // For 'sell' type, receiver gets (amount - commission)
    const earningsResult = await pool.query(
      `SELECT SUM(
         CASE 
           WHEN type = 'sell' THEN amount - COALESCE(commission, 0)
           ELSE amount 
         END
       ) as total_earnings
       FROM wallet_transfers 
       WHERE receiver_id = $1 AND status = 'accepted'`,
      [id]
    );

    res.json({
      transactions: transactions.rows,
      totalEarnings: earningsResult.rows[0].total_earnings || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Soft delete user (mark for deletion)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE users SET marked_for_deletion_at = CURRENT_TIMESTAMP, status = 'Deactivated' WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User marked for deletion successfully (Soft Delete)', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Permanently delete user
router.delete('/:id/permanent', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    const selfCheck = await client.query('SELECT self_deactivated_at, self_deleted_at FROM users WHERE id = $1', [id]);
    if (selfCheck.rows[0]?.self_deactivated_at && !selfCheck.rows[0]?.self_deleted_at) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'User-side deactivated accounts are view-only and cannot be deleted by admin.' });
    }
    const user = await anonymizeUserForPermanentDeletion(client, id);
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }
    await client.query('COMMIT');
    res.json({ message: 'User permanently deactivated successfully. Email and phone are retained to block future registration.', user });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

// Restore soft-deleted user
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    await ensureSuspensionColumns();
    const result = await pool.query(
      `UPDATE users
       SET marked_for_deletion_at = NULL,
           status = 'Active',
           is_deactivated = false,
           self_deleted_at = NULL,
           deactivation_reason = NULL,
           suspension_reason_category = NULL,
           suspension_reason_custom = NULL,
           suspension_action = NULL,
           suspension_days = NULL,
           suspended_at = NULL,
           suspension_ends_at = NULL,
           suspended_wallet_access = false,
           appeal_status = CASE WHEN appeal_status = 'pending' THEN 'approved' ELSE appeal_status END,
           appeal_reviewed_at = CASE WHEN appeal_status = 'pending' THEN NOW() ELSE appeal_reviewed_at END
       WHERE id = $1
         AND (self_deactivated_at IS NULL OR self_deleted_at IS NOT NULL)
       RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found or user-side deactivated account is view-only' });
    res.json({ message: 'User restored successfully', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// PATCH /:id/deactivate — deactivate or reactivate a user account with reason
router.patch('/:id/deactivate', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSuspensionColumns();

        const { id } = req.params;
        const { deactivate, reason, category, customReason } = req.body; // deactivate: boolean

        if (typeof deactivate !== 'boolean') {
            return res.status(400).json({ message: 'deactivate (boolean) is required' });
        }
        const finalReason = buildReason(category || reason, customReason);
        if (deactivate && !finalReason) {
            return res.status(400).json({ message: 'Reason is required when deactivating' });
        }

        await client.query('BEGIN');

        const selfCheck = await client.query('SELECT self_deactivated_at FROM users WHERE id = $1', [id]);
        if (selfCheck.rows[0]?.self_deactivated_at) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'User-side deactivated accounts are view-only.' });
        }

        const result = await client.query(
            `UPDATE users
             SET is_deactivated = $1,
                 status = CASE WHEN $1 THEN 'Deactivated' ELSE 'Active' END,
                 deactivation_reason = $2,
                 suspension_reason_category = $3,
                 suspension_reason_custom = $4,
                 suspension_action = CASE WHEN $1 THEN 'Temporary Suspension (7 Days)' ELSE NULL END,
                 suspension_days = CASE WHEN $1 THEN $5::int ELSE NULL END,
                 suspended_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
                 suspension_ends_at = CASE WHEN $1 THEN NOW() + ($5::int * INTERVAL '1 day') ELSE NULL END,
                 appeal_text = CASE WHEN $1 THEN NULL ELSE appeal_text END,
                 appeal_status = CASE WHEN $1 THEN NULL ELSE appeal_status END,
                 appeal_submitted_at = CASE WHEN $1 THEN NULL ELSE appeal_submitted_at END,
                 appeal_reviewed_at = CASE WHEN $1 THEN NULL ELSE appeal_reviewed_at END,
                 appeal_admin_note = CASE WHEN $1 THEN NULL ELSE appeal_admin_note END,
                 appeal_id = CASE WHEN $1 THEN NULL ELSE appeal_id END,
                 appeal_contact_email = CASE WHEN $1 THEN NULL ELSE appeal_contact_email END,
                 appeal_phone_number = CASE WHEN $1 THEN NULL ELSE appeal_phone_number END,
                 appeal_agreement_confirmed = CASE WHEN $1 THEN false ELSE appeal_agreement_confirmed END,
                 suspended_wallet_access = CASE WHEN $1 THEN COALESCE(suspended_wallet_access, false) ELSE false END
             WHERE id = $6
             RETURNING *`,
            [deactivate, deactivate ? finalReason : null, deactivate ? (category || reason || finalReason) : null, deactivate ? (customReason || null) : null, SUSPENSION_DAYS, id]
        );
        if (!result.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found' });
        }

        let paused_ads_count = 0;
        if (deactivate) {
            const pausedAds = await client.query(
                `UPDATE ads
                 SET status = 'Paused',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1
                   AND status IN ('Active', 'Approved')
                 RETURNING id`,
                [id]
            );
            paused_ads_count = pausedAds.rowCount || 0;
        }

        await client.query('COMMIT');
        res.json({ success: true, is_deactivated: deactivate, paused_ads_count, user: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.patch('/:id/wallet-access', async (req, res) => {
  try {
    await ensureSuspensionColumns();
    const { id } = req.params;
    const enabled = Boolean(req.body?.enabled);

    const result = await pool.query(
      `UPDATE users
       SET suspended_wallet_access = $1
       WHERE id = $2
         AND self_deactivated_at IS NULL
       RETURNING *`,
      [enabled, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'User not found or user-side deactivated account is view-only' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/appeal', async (req, res) => {
  try {
    await ensureSuspensionColumns();
    const { id } = req.params;
    const { action, adminNote } = req.body; // approve | reject
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    if (action === 'approve') {
      const result = await pool.query(
        `UPDATE users
         SET marked_for_deletion_at = NULL,
             status = 'Active',
             is_deactivated = false,
             deactivation_reason = NULL,
             suspension_reason_category = NULL,
             suspension_reason_custom = NULL,
             suspension_action = NULL,
             suspension_days = NULL,
             suspended_at = NULL,
             suspension_ends_at = NULL,
             suspended_wallet_access = false,
             appeal_status = 'approved',
             appeal_reviewed_at = NOW(),
             appeal_admin_note = $1
         WHERE id = $2 RETURNING *`,
        [adminNote || null, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: 'User not found' });
      return res.json({ success: true, user: result.rows[0] });
    }

    const result = await pool.query(
      `UPDATE users
       SET appeal_status = 'rejected',
           permanent_deactivated_at = COALESCE(permanent_deactivated_at, NOW()),
           status = 'Permanently Deactivated',
           is_deactivated = true,
           appeal_reviewed_at = NOW(),
           appeal_admin_note = COALESCE($1, $3)
       WHERE id = $2 RETURNING *`,
      [adminNote || null, id, PERMANENT_DEACTIVATION_MESSAGE]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
