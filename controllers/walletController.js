const pool = require('../config/database');

const REFERRAL_TRANSFER_TYPE = 'referral_commission';

function normalizePercentage(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(100, Math.max(0, number));
}

async function resolveGoogerMainWalletUserId(client) {
    const configuredId = Number.parseInt(String(process.env.GOOGER_MAIN_USER_ID || '').trim(), 10);
    if (Number.isFinite(configuredId) && configuredId > 0) {
        const configuredResult = await client.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [configuredId]);
        if (configuredResult.rows.length > 0) return configuredResult.rows[0].id;
    }

    const adminResult = await client.query(
        `SELECT id FROM users
         WHERE LOWER(COALESCE(user_type, '')) = 'admin'
         ORDER BY id ASC
         LIMIT 1`
    );
    if (adminResult.rows.length > 0) return adminResult.rows[0].id;

    const googerResult = await client.query(
        `SELECT id FROM users
         WHERE LOWER(username) = 'googer'
         ORDER BY id ASC
         LIMIT 1`
    );
    if (googerResult.rows.length > 0) return googerResult.rows[0].id;

    return 1;
}

async function distributeWalletDiscountCommission(client, {
    buyerId,
    payerId,
    discountAmount,
    sourceId,
    description,
}) {
    const buyer = Number(buyerId);
    const payer = Number(payerId) || buyer;
    const poolAmount = Number(Number(discountAmount || 0).toFixed(2));
    if (!Number.isFinite(buyer) || buyer <= 0 || !Number.isFinite(poolAmount) || poolAmount <= 0 || !sourceId) {
        return [];
    }

    await client.query(`
        CREATE TABLE IF NOT EXISTS referral_commission_payouts (
            id SERIAL PRIMARY KEY,
            source_type VARCHAR(40) NOT NULL,
            source_id VARCHAR(120) NOT NULL,
            buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            earner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            level INTEGER NOT NULL,
            pool_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
            commission_percentage NUMERIC(8,2) NOT NULL DEFAULT 0,
            amount NUMERIC(12,2) NOT NULL DEFAULT 0,
            wallet_transfer_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(source_type, source_id, earner_id, level)
        )
    `);

    const sourceType = 'wallet_discount';
    const existingForSource = await client.query(
        `SELECT 1
         FROM referral_commission_payouts
         WHERE source_type = $1
           AND source_id::text = $2
         LIMIT 1`,
        [sourceType, String(sourceId)]
    );
    if (existingForSource.rows.length > 0) return [];

    const creditPayout = async ({
        earnerId,
        level,
        levelName,
        commissionPercentage,
        amount,
        note,
        transferType = REFERRAL_TRANSFER_TYPE,
    }) => {
        const safeAmount = Number(Number(amount || 0).toFixed(2));
        if (!Number.isFinite(safeAmount) || safeAmount <= 0) return null;

        const inserted = await client.query(
            `INSERT INTO referral_commission_payouts
                (source_type, source_id, buyer_id, earner_id, level, pool_amount, commission_percentage, amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [sourceType, String(sourceId), buyer, earnerId, level, poolAmount, commissionPercentage, safeAmount]
        );

        await client.query(
            'UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
            [safeAmount, earnerId]
        );

        const transfer = await client.query(
            `INSERT INTO wallet_transfers
                (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'completed', $3, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [payer, earnerId, safeAmount, note, transferType, commissionPercentage]
        );

        await client.query(
            'UPDATE referral_commission_payouts SET wallet_transfer_id = $1 WHERE id = $2',
            [transfer.rows[0].id, inserted.rows[0].id]
        );

        return { level, levelName, earnerId: Number(earnerId), amount: safeAmount, commissionPercentage, poolAmount };
    };

    const payouts = [];
    let distributedAmount = 0;

    const googerLevel = await client.query(
        `SELECT level, name AS level_name, commission_percentage
         FROM referral_level_settings
         WHERE level = 0 AND is_active = TRUE
         LIMIT 1`
    );

    if (googerLevel.rows.length > 0) {
        const googerUserId = await resolveGoogerMainWalletUserId(client);
        const googerPercentage = normalizePercentage(googerLevel.rows[0].commission_percentage);
        const googerAmount = Math.min(poolAmount, Number(((poolAmount * googerPercentage) / 100).toFixed(2)));

        if (googerUserId && googerUserId !== buyer && googerAmount > 0) {
            const payout = await creditPayout({
                earnerId: googerUserId,
                level: 0,
                levelName: googerLevel.rows[0].level_name || 'Googer',
                commissionPercentage: googerPercentage,
                amount: googerAmount,
                note: `Wallet Discount Distribution - Googer - ${description}`,
            });
            if (payout) {
                distributedAmount = Number((distributedAmount + payout.amount).toFixed(2));
                payouts.push(payout);
            }
        }
    }

    const uplines = await client.query(
        `WITH RECURSIVE uplines AS (
            SELECT rr.referred_by AS earner_id, 1 AS level
            FROM referral_relationships rr
            WHERE rr.user_id = $1

            UNION ALL

            SELECT rr.referred_by AS earner_id, uplines.level + 1 AS level
            FROM referral_relationships rr
            JOIN uplines ON rr.user_id = uplines.earner_id
            WHERE uplines.level < (
                SELECT GREATEST(1, COALESCE(MAX(level), 5))
                FROM referral_level_settings
                WHERE level <> 99
            )
        )
        SELECT uplines.earner_id,
               uplines.level,
               rls.name AS level_name,
               COALESCE(rls.commission_percentage, 0)::numeric AS commission_percentage
        FROM uplines
        JOIN referral_level_settings rls
          ON rls.level = uplines.level
         AND rls.is_active = TRUE
        WHERE uplines.earner_id <> $1
          AND rls.level <> 99
        ORDER BY uplines.level ASC`,
        [buyer]
    );

    for (const row of uplines.rows) {
        const remaining = Number((poolAmount - distributedAmount).toFixed(2));
        if (remaining <= 0) break;
        const commissionPercentage = normalizePercentage(row.commission_percentage);
        const levelAmount = Math.min(remaining, Number(((poolAmount * commissionPercentage) / 100).toFixed(2)));
        if (levelAmount <= 0) continue;

        const payout = await creditPayout({
            earnerId: row.earner_id,
            level: Number(row.level),
            levelName: row.level_name,
            commissionPercentage,
            amount: levelAmount,
            note: `Wallet Discount Distribution - Level ${row.level}${row.level_name ? ` ${row.level_name}` : ''} - ${description}`,
        });

        if (payout) {
            distributedAmount = Number((distributedAmount + payout.amount).toFixed(2));
            payouts.push(payout);
        }
    }

    const buyerRemainder = Number(Math.max(0, poolAmount - distributedAmount).toFixed(2));
    if (buyerRemainder > 0) {
        const buyerPercentage = Number(((buyerRemainder / poolAmount) * 100).toFixed(2));
        const payout = await creditPayout({
            earnerId: buyer,
            level: 99,
            levelName: 'Buyer',
            commissionPercentage: buyerPercentage,
            amount: buyerRemainder,
            note: `Wallet Discount Balance - Buyer - ${description}`,
            transferType: 'discount_refund',
        });
        if (payout) payouts.push(payout);
    }

    return payouts;
}

// Search users by user_id or username
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) {
            return res.status(400).json({ success: false, message: 'Query too short' });
        }

        const result = await pool.query(
            `SELECT id, user_id, username, full_name, profile_picture, user_type 
             FROM users 
             WHERE (user_id ILIKE $1 OR username ILIKE $1 OR full_name ILIKE $1)
             AND id != $2
             LIMIT 10`,
            [`%${query}%`, req.user.id]
        );

        res.status(200).json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ success: false, message: 'Server error searching users' });
    }
};

exports.initiateTransferRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        const { receiverId, amount, note, commissionPercentage, type = 'request' } = req.body;
        const senderId = req.user.id; // User A (the requester/sender)

        if (!receiverId || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid receiver or amount' });
        }

        await client.query('BEGIN');

        const baseAmount = parseFloat(amount);
        const commPercent = parseFloat(commissionPercentage || 0);
        let calculatedCommission = 0;

        // Calculate commission if any
        if (commPercent > 0) {
            calculatedCommission = (baseAmount * commPercent) / 100;
        }

        // ============================================
        // NEW: DIRECT TRANSFER IF NO COMMISSION
        // ============================================
        if (type === 'sell' && commPercent === 0) {
            // Check sender's balance
            const senderResult = await client.query(
                'SELECT wallet_balance FROM users WHERE id = $1',
                [senderId]
            );
            const senderBalance = parseFloat(senderResult.rows[0].wallet_balance);

            if (senderBalance < baseAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Insufficient balance' });
            }

            // Deduct from sender
            await client.query(
                'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
                [baseAmount, senderId]
            );

            // Add to receiver DIRECTLY
            await client.query(
                'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
                [baseAmount, receiverId]
            );

            // Record as completed transaction (status = 'accepted', not 'pending')
            const txNote = note || 'Direct Money Transfer';
            const result = await client.query(
                `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission_percentage, commission)
                 VALUES ($1, $2, $3, $4, $5, 'accepted', $6, $7)
                 RETURNING *`,
                [senderId, receiverId, baseAmount, txNote, type, 0, 0]
            );

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: `Transfer successful! ${baseAmount} coins sent directly.`,
                transfer: result.rows[0]
            });
        }

        // ============================================
        // ORIGINAL: PENDING REQUEST IF WITH COMMISSION
        // ============================================
        let amountToHold = 0;

        if (type === 'sell') {
            // Hold the full amount (e.g., 100)
            amountToHold = baseAmount;

            // Calculate commission (e.g., 10% of 100 = 10)
            if (commPercent > 0) {
                calculatedCommission = (baseAmount * commPercent) / 100;
            }

            // Check sender's balance
            const senderResult = await client.query(
                'SELECT wallet_balance FROM users WHERE id = $1',
                [senderId]
            );
            const senderBalance = parseFloat(senderResult.rows[0].wallet_balance);

            if (senderBalance < amountToHold) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Insufficient balance' });
            }

            // Deduct full amount from sender's wallet_balance and add to hold_balance
            await client.query(
                'UPDATE users SET wallet_balance = wallet_balance - $1, hold_balance = hold_balance + $1 WHERE id = $2',
                [amountToHold, senderId]
            );
        } else {
            // For 'request' (buy), calculate the amount that will be requested
            if (commPercent > 0) {
                calculatedCommission = (baseAmount * commPercent) / 100;
            }
            amountToHold = baseAmount; // This is what will be requested from receiver
        }

        const txNote = note || (commPercent > 0 ? `Commission ${type === 'sell' ? 'Transfer' : 'Request'} (${commPercent}%)` : type === 'sell' ? 'Money Transfer' : 'Money Request');

        // Insert transfer record with status 'pending'
        // Store the full amount and commission separately
        const result = await client.query(
            `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission_percentage, commission)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
             RETURNING *`,
            [senderId, receiverId, amountToHold, txNote, type, commPercent, calculatedCommission]
        );

        await client.query('COMMIT');

        const successMessage = type === 'sell'
            ? `Money transfer initiated. ${amountToHold} coins on hold until receiver accepts.`
            : 'Money request sent successfully.';

        res.status(201).json({
            success: true,
            message: successMessage,
            transfer: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Initiate transfer error:', error);
        res.status(500).json({ success: false, message: 'Server error initiating transfer' });
    } finally {
        client.release();
    }
};

// Get pending requests for the current user (where current user is the receiver/payer)
exports.getPendingRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT t.*, u.username as sender_username, u.full_name as sender_full_name, u.profile_picture as sender_profile_picture
             FROM wallet_transfers t
             JOIN users u ON t.sender_id = u.id
             WHERE t.receiver_id = $1 AND t.status = 'pending'
             ORDER BY t.created_at DESC`,
            [userId]
        );

        res.status(200).json({
            success: true,
            requests: result.rows
        });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching requests' });
    }
};

// Respond to a request (Accept/Reject)
exports.respondToRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        const { requestId, action } = req.body; // action: 'accept' or 'reject'
        const userId = req.user.id; // User B (the receiver who needs to accept/reject)

        await client.query('BEGIN');

        // 1. Get request details
        const requestResult = await client.query(
            'SELECT * FROM wallet_transfers WHERE id = $1 AND receiver_id = $2 AND status = \'pending\'',
            [requestId, userId]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Request not found or already processed' });
        }

        const transfer = requestResult.rows[0];
        const transferAmount = parseFloat(transfer.amount);
        const transferType = transfer.type; // 'sell' or 'request' (buy)
        const rawCommission = parseFloat(transfer.commission || 0);
        const commission = Math.min(
            transferAmount,
            Math.max(0, Number.isFinite(rawCommission) ? rawCommission : 0)
        );

        if (action === 'reject') {
            // If type is 'sell', return the held amount back to sender
            if (transferType === 'sell') {
                // Remove from hold_balance and add back to wallet_balance
                await client.query(
                    'UPDATE users SET hold_balance = hold_balance - $1, wallet_balance = wallet_balance + $1 WHERE id = $2',
                    [transferAmount, transfer.sender_id]
                );
            }
            // If type is 'request' (buy), nothing to return (no money was held)

            // Update transfer status to rejected
            await client.query(
                'UPDATE wallet_transfers SET status = \'rejected\', updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [requestId]
            );

            await client.query('COMMIT');
            const rejectMessage = transferType === 'sell'
                ? 'Request rejected. Amount returned to sender.'
                : 'Request rejected.';
            return res.status(200).json({ success: true, message: rejectMessage });
        }

        if (action === 'accept') {
            if (transferType === 'sell') {
                // For 'sell': Split the held amount
                // Example: transferAmount = 100, commission = 10
                // Receiver gets: 100 - 10 = 90
                // Discount/commission is distributed through the referral tree

                const amountToReceiver = Math.max(0, transferAmount - commission); 

                // Remove full amount from sender's hold_balance
                await client.query(
                    'UPDATE users SET hold_balance = hold_balance - $1 WHERE id = $2',
                    [transferAmount, transfer.sender_id]
                );

                // Give (amount - commission) to receiver
                await client.query(
                    'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
                    [amountToReceiver, userId]
                );

                if (commission > 0) {
                    await distributeWalletDiscountCommission(client, {
                        buyerId: userId,
                        payerId: transfer.sender_id,
                        discountAmount: commission,
                        sourceId: `wallet-${transfer.id}`,
                        description: `Wallet Sell Transfer #${transfer.id}`,
                    });
                }
            } else {
                // For 'request' (buy): Deduct from receiver and give to sender
                // Check receiver's balance first
                const receiverResult = await client.query(
                    'SELECT wallet_balance FROM users WHERE id = $1',
                    [userId]
                );
                const receiverBalance = parseFloat(receiverResult.rows[0].wallet_balance);

                if (receiverBalance < transferAmount) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Insufficient balance' });
                }

                // Deduct from receiver (User B)
                await client.query(
                    'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
                    [transferAmount, userId]
                );

                const amountToSender = Math.max(0, transferAmount - commission);

                // Add the net amount to sender (User A who requested)
                await client.query(
                    'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
                    [amountToSender, transfer.sender_id]
                );

                if (commission > 0) {
                    await distributeWalletDiscountCommission(client, {
                        buyerId: userId,
                        payerId: transfer.sender_id,
                        discountAmount: commission,
                        sourceId: `wallet-${transfer.id}`,
                        description: `Wallet Buy Request #${transfer.id}`,
                    });
                }
            }

            // Update transfer status to accepted
            await client.query(
                `UPDATE wallet_transfers 
                 SET status = 'accepted', 
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $1`,
                [requestId]
            );

            await client.query('COMMIT');
            const acceptMessage = transferType === 'sell'
                ? `Transfer accepted. You received ${(transferAmount - parseFloat(transfer.commission || 0)).toFixed(2)} coins.`
                : 'Request accepted. Payment sent.';
            return res.status(200).json({ success: true, message: acceptMessage });
        }

        await client.query('ROLLBACK');
        res.status(400).json({ success: false, message: 'Invalid action' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Respond to request error:', error);
        res.status(500).json({ success: false, message: 'Server error processing request' });
    } finally {
        client.release();
    }
};

// Direct Transfer (User A sends money to User B)
exports.directTransfer = async (req, res) => {
    const client = await pool.connect();
    try {
        const { receiverId, amount, note, commissionPercentage } = req.body;
        const senderId = req.user.id;

        if (!receiverId || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid receiver or amount' });
        }

        let baseAmount = parseFloat(amount);
        let commInput = parseFloat(commissionPercentage || 0);
        let finalTransferAmount = 0;
        let calculatedCommission = 0;
        let amountToDeduct = 0;

        if (commInput > 0) {
            // Case: Commission is being charged on the transfer
            calculatedCommission = (baseAmount * commInput) / 100;
            finalTransferAmount = baseAmount - calculatedCommission;
            // The sender pays baseAmount, the receiver gets finalTransferAmount, 
            // and Googer gets calculatedCommission.
            amountToDeduct = baseAmount;
        } else {
            // Normal transfer of the base amount
            finalTransferAmount = baseAmount;
            amountToDeduct = baseAmount;
        }

        if (finalTransferAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Final transfer amount must be greater than 0' });
        }

        await client.query('BEGIN');

        // Check sender balance
        const sender = await client.query('SELECT wallet_balance FROM users WHERE id = $1', [senderId]);
        const balance = parseFloat(sender.rows[0].wallet_balance);

        if (balance < finalTransferAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        // Deduct from sender
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
            [amountToDeduct, senderId]
        );

        // Add to receiver
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
            [finalTransferAmount, receiverId]
        );

        // Generate descriptive note if none provided
        let txNote = note;
        if (!txNote) {
            txNote = commInput > 0 ? `Commission Transfer (${commInput}%)` : 'Direct Transfer';
        }

        // Log transfer with commission details
        await client.query(
            `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
             VALUES ($1, $2, $3, $4, 'transfer', 'accepted', $5, $6)`,
            [senderId, receiverId, finalTransferAmount, txNote, calculatedCommission, commInput]
        );

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Transfer successful', transferAmount: finalTransferAmount });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Direct transfer error:', error);
        res.status(500).json({ success: false, message: 'Server error processing transfer' });
    } finally {
        client.release();
    }
};
// Transfer to Main Googer Balance
exports.transferToGooger = async (req, res) => {
    const client = await pool.connect();
    try {
        const { amount, note } = req.body;
        const senderId = req.user.id;
        const transferAmount = parseFloat(amount);

        if (!transferAmount || transferAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        await client.query('BEGIN');

        // Check sender balance
        const sender = await client.query('SELECT wallet_balance FROM users WHERE id = $1', [senderId]);
        const balance = parseFloat(sender.rows[0].wallet_balance);

        if (balance < transferAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        // Deduct from sender
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
            [transferAmount, senderId]
        );

        // Add to Googer Balance by recording the amount as commission
        const txNote = note || 'Transfer to Main Googer Balance';

        await client.query(
            `INSERT INTO wallet_transfers (sender_id, receiver_id, amount, note, type, status, commission, commission_percentage)
             VALUES ($1, $1, 0, $2, 'system_topup', 'accepted', $3, 100)`,
            [senderId, txNote, transferAmount]
        );

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Transferred to Main Googer Balance successfully', transferAmount });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transfer to Googer error:', error);
        res.status(500).json({ success: false, message: 'Server error processing transfer' });
    } finally {
        client.release();
    }
};

// Get transaction history for current user
exports.getTransactionHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT t.*, 
                    s.username as sender_username, s.full_name as sender_full_name, s.user_id as sender_readable_id,
                    r.username as receiver_username, r.full_name as receiver_full_name, r.user_id as receiver_readable_id
             FROM wallet_transfers t
             JOIN users s ON t.sender_id = s.id
             JOIN users r ON t.receiver_id = r.id
             WHERE t.sender_id = $1 OR t.receiver_id = $1
             ORDER BY t.created_at DESC
             LIMIT 50`,
            [userId]
        );

        res.status(200).json({
            success: true,
            transactions: result.rows
        });
    } catch (error) {
        console.error('Get transaction history error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching transaction history' });
    }
};
