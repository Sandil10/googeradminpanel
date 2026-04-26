const pool = require('../config/database');

let tablesReadyPromise = null;

const ensureChatTables = async () => {
    if (!tablesReadyPromise) {
        tablesReadyPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id SERIAL PRIMARY KEY,
                    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
                    message_text TEXT,
                    image_url TEXT,
                    file_name TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'sent',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    delivered_at TIMESTAMP,
                    read_at TIMESTAMP,
                    deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE,
                    CHECK (message_type IN ('text', 'image')),
                    CHECK (status IN ('sending', 'sent', 'delivered', 'read'))
                );
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS chat_presence (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    active_participant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_chat_messages_pair_created
                ON chat_messages(sender_id, receiver_id, created_at DESC);
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_status
                ON chat_messages(receiver_id, status, created_at DESC);
            `);
        })().catch((tableError) => {
            tablesReadyPromise = null;
            throw tableError;
        });
    }

    return tablesReadyPromise;
};

const mapMessageRow = (row) => ({
    id: Number(row.id),
    sender_id: Number(row.sender_id),
    receiver_id: Number(row.receiver_id),
    type: row.message_type,
    text: row.message_text,
    image_url: row.image_url,
    file_name: row.file_name,
    status: row.status,
    created_at: row.created_at,
    delivered_at: row.delivered_at,
    read_at: row.read_at,
    sender_name: row.sender_name || null,
    receiver_name: row.receiver_name || null,
});

const resolveAdminUserId = async () => {
    const adminResult = await pool.query(
        `SELECT id
         FROM users
         WHERE user_type = 'admin'
         ORDER BY id ASC
         LIMIT 1`
    );

    if (adminResult.rows[0]?.id) {
        return Number(adminResult.rows[0].id);
    }

    const fallbackResult = await pool.query(
        `SELECT id
         FROM users
         ORDER BY id ASC
         LIMIT 1`
    );

    return Number(fallbackResult.rows[0]?.id || 0);
};

const resolveChatUserId = async (req) => {
    if (req.user?.id) {
        return Number(req.user.id);
    }

    return resolveAdminUserId();
};

exports.updatePresence = async (req, res) => {
    try {
        await ensureChatTables();

        const userId = await resolveChatUserId(req);
        const activeParticipantId = req.body.activeParticipantId ? Number(req.body.activeParticipantId) : null;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required.', data: null });
        }

        await pool.query(
            `
                INSERT INTO chat_presence (user_id, active_participant_id, last_seen_at, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    active_participant_id = EXCLUDED.active_participant_id,
                    last_seen_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
            `,
            [userId, activeParticipantId || null]
        );

        await pool.query(
            `
                UPDATE chat_messages
                SET status = 'delivered',
                    delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
                WHERE receiver_id = $1
                  AND status = 'sent'
            `,
            [userId]
        );

        if (activeParticipantId) {
            await pool.query(
                `
                    UPDATE chat_messages
                    SET status = 'read',
                        delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
                        read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
                    WHERE receiver_id = $1
                      AND sender_id = $2
                      AND status IN ('sent', 'delivered')
                `,
                [userId, activeParticipantId]
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Presence updated',
            data: { user_id: userId, active_participant_id: activeParticipantId },
        });
    } catch (err) {
        console.error('updatePresence error:', err);
        return res.status(500).json({ success: false, message: 'Server error updating chat presence', data: null });
    }
};

exports.getMessages = async (req, res) => {
    try {
        await ensureChatTables();

        const userId = await resolveChatUserId(req);
        const participantId = Number(req.params.participantId);
        const markSeen = String(req.query.markSeen || '') === '1';

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required.', data: null });
        }

        if (!participantId || participantId === userId) {
            return res.status(400).json({ success: false, message: 'Invalid participant selected.', data: null });
        }

        if (markSeen) {
            await pool.query(
                `
                    UPDATE chat_messages
                    SET status = 'read',
                        delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
                        read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
                    WHERE receiver_id = $1
                      AND sender_id = $2
                      AND status IN ('sent', 'delivered')
                `,
                [userId, participantId]
            );
        } else {
            await pool.query(
                `
                    UPDATE chat_messages
                    SET status = 'delivered',
                        delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
                    WHERE receiver_id = $1
                      AND sender_id = $2
                      AND status = 'sent'
                `,
                [userId, participantId]
            );
        }

        const result = await pool.query(
            `
                SELECT
                    m.*,
                    sender.full_name AS sender_name,
                    receiver.full_name AS receiver_name
                FROM chat_messages m
                JOIN users sender ON sender.id = m.sender_id
                JOIN users receiver ON receiver.id = m.receiver_id
                WHERE ((m.sender_id = $1 AND m.receiver_id = $2)
                    OR (m.sender_id = $2 AND m.receiver_id = $1))
                  AND m.deleted_for_everyone = FALSE
                ORDER BY m.created_at ASC, m.id ASC
            `,
            [userId, participantId]
        );

        return res.status(200).json({
            success: true,
            message: 'Messages fetched',
            data: result.rows.map(mapMessageRow),
        });
    } catch (err) {
        console.error('getMessages error:', err);
        return res.status(500).json({ success: false, message: 'Server error fetching messages', data: null });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        await ensureChatTables();

        const senderId = await resolveChatUserId(req);
        const receiverId = Number(req.body.receiverId);
        const type = req.body.type === 'image' ? 'image' : 'text';
        const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
        const imageUrl = typeof req.body.image_url === 'string' ? req.body.image_url : null;
        const fileName = typeof req.body.file_name === 'string' ? req.body.file_name : null;

        if (!senderId) {
            return res.status(401).json({ success: false, message: 'Authentication required.', data: null });
        }

        if (!receiverId || receiverId === senderId) {
            return res.status(400).json({ success: false, message: 'Invalid receiver selected.', data: null });
        }

        if (type === 'text' && !text) {
            return res.status(400).json({ success: false, message: 'Message text is required.', data: null });
        }

        if (type === 'image' && !imageUrl) {
            return res.status(400).json({ success: false, message: 'Image message data is required.', data: null });
        }

        const presenceResult = await pool.query(
            `
                SELECT last_seen_at
                FROM chat_presence
                WHERE user_id = $1
                LIMIT 1
            `,
            [receiverId]
        );

        const receiverPresence = presenceResult.rows[0];
        const isReceiverOnline = receiverPresence?.last_seen_at
            ? Date.now() - new Date(receiverPresence.last_seen_at).getTime() < 20000
            : false;

        const initialStatus = isReceiverOnline ? 'delivered' : 'sent';

        const result = await pool.query(
            `
                INSERT INTO chat_messages (
                    sender_id, receiver_id, message_type, message_text,
                    image_url, file_name, status, delivered_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                senderId,
                receiverId,
                type,
                type === 'text' ? text : null,
                imageUrl,
                fileName,
                initialStatus,
                initialStatus === 'delivered' ? new Date() : null,
            ]
        );

        const senderNameResult = await pool.query(
            'SELECT full_name FROM users WHERE id = $1 LIMIT 1',
            [senderId]
        );

        return res.status(200).json({
            success: true,
            message: 'Message sent',
            data: mapMessageRow({
                ...result.rows[0],
                sender_name: senderNameResult.rows[0]?.full_name || null,
            }),
        });
    } catch (err) {
        console.error('sendMessage error:', err);
        return res.status(500).json({ success: false, message: 'Server error sending message', data: null });
    }
};
