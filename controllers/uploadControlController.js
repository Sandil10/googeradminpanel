const pool = require('../config/database');

const DEFAULT_SETTINGS = {
    min_upload_price: 100,
    max_upload_price: 10000,
    flash_content_price: 100,
    flash_preview_seconds: 5,
    flash_auto_play: false,
    default_topic: 'Technology',
    default_content_access_mode: 'unblurred',
    normal_user_video_limit_seconds: 60,
    subscribed_user_video_limit_seconds: 180,
    commission_tiers: [],
    subscription_commission_tiers: [],
};

let tableReady = false;

const ensureTable = async () => {
    if (tableReady) return;

    await pool.query(`
        CREATE TABLE IF NOT EXISTS upload_control_settings (
            id SERIAL PRIMARY KEY,
            min_upload_price DECIMAL(12, 2) NOT NULL DEFAULT 100,
            max_upload_price DECIMAL(12, 2) NOT NULL DEFAULT 10000,
            flash_content_price DECIMAL(12, 2) NOT NULL DEFAULT 100,
            flash_preview_seconds INTEGER NOT NULL DEFAULT 5,
            flash_auto_play BOOLEAN NOT NULL DEFAULT false,
            default_topic VARCHAR(80) NOT NULL DEFAULT 'Technology',
            default_content_access_mode VARCHAR(20) NOT NULL DEFAULT 'unblurred',
            normal_user_video_limit_seconds INTEGER NOT NULL DEFAULT 60,
            subscribed_user_video_limit_seconds INTEGER NOT NULL DEFAULT 180,
            commission_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
            subscription_commission_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        ALTER TABLE upload_control_settings
        ADD COLUMN IF NOT EXISTS commission_tiers JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await pool.query(`
        ALTER TABLE upload_control_settings
        ADD COLUMN IF NOT EXISTS subscription_commission_tiers JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await pool.query(`ALTER TABLE upload_control_settings ADD COLUMN IF NOT EXISTS flash_content_price DECIMAL(12, 2) NOT NULL DEFAULT 100`);
    await pool.query(`ALTER TABLE upload_control_settings ADD COLUMN IF NOT EXISTS flash_preview_seconds INTEGER NOT NULL DEFAULT 5`);
    await pool.query(`ALTER TABLE upload_control_settings ADD COLUMN IF NOT EXISTS flash_auto_play BOOLEAN NOT NULL DEFAULT false`);

    await pool.query(`
        ALTER TABLE upload_control_settings
        ADD COLUMN IF NOT EXISTS normal_user_video_limit_seconds INTEGER NOT NULL DEFAULT 60
    `);

    await pool.query(`
        ALTER TABLE upload_control_settings
        ADD COLUMN IF NOT EXISTS subscribed_user_video_limit_seconds INTEGER NOT NULL DEFAULT 180
    `);

    await pool.query(`
        INSERT INTO upload_control_settings (
            min_upload_price,
            max_upload_price,
            flash_content_price,
            flash_preview_seconds,
            flash_auto_play,
            default_topic,
            default_content_access_mode
        )
        SELECT $1, $2, $3, $4, $5, $6, $7
        WHERE NOT EXISTS (
            SELECT 1 FROM upload_control_settings
        )
    `, [
        DEFAULT_SETTINGS.min_upload_price,
        DEFAULT_SETTINGS.max_upload_price,
        DEFAULT_SETTINGS.flash_content_price,
        DEFAULT_SETTINGS.flash_preview_seconds,
        DEFAULT_SETTINGS.flash_auto_play,
        DEFAULT_SETTINGS.default_topic,
        DEFAULT_SETTINGS.default_content_access_mode,
    ]);

    tableReady = true;
};

const normalizeRow = (row) => ({
    min_upload_price: Number(row?.min_upload_price ?? DEFAULT_SETTINGS.min_upload_price),
    max_upload_price: Number(row?.max_upload_price ?? DEFAULT_SETTINGS.max_upload_price),
    flash_content_price: Number(row?.flash_content_price ?? DEFAULT_SETTINGS.flash_content_price),
    flash_preview_seconds: Number(row?.flash_preview_seconds ?? DEFAULT_SETTINGS.flash_preview_seconds),
    flash_auto_play: Boolean(row?.flash_auto_play ?? DEFAULT_SETTINGS.flash_auto_play),
    default_topic: String(row?.default_topic || DEFAULT_SETTINGS.default_topic),
    default_content_access_mode: row?.default_content_access_mode === 'blurred' ? 'blurred' : 'unblurred',
    normal_user_video_limit_seconds: Number(row?.normal_user_video_limit_seconds ?? DEFAULT_SETTINGS.normal_user_video_limit_seconds),
    subscribed_user_video_limit_seconds: Number(row?.subscribed_user_video_limit_seconds ?? DEFAULT_SETTINGS.subscribed_user_video_limit_seconds),
    commission_tiers: Array.isArray(row?.commission_tiers) ? row.commission_tiers : DEFAULT_SETTINGS.commission_tiers,
    subscription_commission_tiers: Array.isArray(row?.subscription_commission_tiers) ? row.subscription_commission_tiers : DEFAULT_SETTINGS.subscription_commission_tiers,
    updated_at: row?.updated_at || null,
});

const normalizeCommissionTiers = (tiers) => (
    (Array.isArray(tiers) ? tiers : [])
        .map((tier) => ({
            min: Number(tier?.min ?? 0),
            max: Number(tier?.max ?? 0),
            commission: Number(tier?.commission ?? 0),
        }))
        .filter((tier) => Number.isFinite(tier.min) && Number.isFinite(tier.max) && Number.isFinite(tier.commission))
        .map((tier) => ({
            min: Math.max(0, tier.min),
            max: Math.max(0, tier.max),
            commission: Math.min(100, Math.max(0, tier.commission)),
        }))
        .filter((tier) => tier.max >= tier.min)
        .sort((a, b) => a.min - b.min || a.max - b.max)
);

const normalizeContentStatus = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'Pending Approval';
    const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ');
    if (normalized === 'approved' || normalized === 'active') return 'Approved';
    if (normalized === 'rejected' || normalized === 'declined') return 'Rejected';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
    return 'Pending Approval';
};

const normalizeVisibility = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return ['public', 'subscribers_only', 'private'].includes(normalized) ? normalized : 'public';
};

const toUtcIso = (value) => {
    if (!value) return null;
    const raw = value instanceof Date
        ? value.toISOString()
        : String(value).trim().replace(' ', 'T');
    const withTimezone = raw.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(raw)
        ? raw
        : `${raw}Z`;
    const parsed = new Date(withTimezone);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const mapUploadContentRow = (row) => {
    const mediaGallery = Array.isArray(row?.media_gallery)
        ? row.media_gallery
        : (() => {
            try {
                return JSON.parse(row?.media_gallery || '[]');
            } catch {
                return [];
            }
        })();

    return {
        id: row.id,
        contentId: row.content_id,
        content_id: row.content_id,
        user_id: row.user_id,
        owner_user_id: row.owner_user_id || null,
        owner_username: row.owner_username || null,
        content_type: row.content_type === 'flash' ? 'flash' : 'vault',
        description: row.description || '',
        topic: row.topic || DEFAULT_SETTINGS.default_topic,
        price: Number(row.price || 0),
        subscription_packages: Array.isArray(row?.subscription_packages) ? row.subscription_packages : [],
        affiliate_commission: Number(row.affiliate_commission || 0),
        show_link_on_home: !!row.show_link_on_home,
        external_link: row.external_link || '',
        media_type: row.media_type || '',
        media_preview: row.media_preview || '',
        media_gallery: mediaGallery,
        thumbnail_url: row.thumbnail_url || '',
        content_access_mode: row.content_access_mode === 'blurred' ? 'blurred' : 'unblurred',
        preview_mode: row.preview_mode === 'auto_preview' ? 'auto_preview' : 'thumbnail',
        preview_url: row.preview_url || '',
        visibility: normalizeVisibility(row.visibility),
        status: normalizeContentStatus(row.status),
        rejection_reason: row.rejection_reason || null,
        admin_note: row.admin_note || null,
        created_at: toUtcIso(row.created_at),
        updated_at: toUtcIso(row.updated_at),
        approved_at: toUtcIso(row.approved_at),
        username: row.user_username || row.owner_username || null,
        full_name: row.full_name || null,
        profile_picture: row.profile_picture || null,
        user_type: row.user_type || null,
    };
};

const loadSettings = async () => {
    await ensureTable();
    const { rows } = await pool.query(`
        SELECT *
        FROM upload_control_settings
        ORDER BY id ASC
        LIMIT 1
    `);
    return normalizeRow(rows[0]);
};

exports.getPublic = async (_req, res) => {
    try {
        const settings = await loadSettings();
        return res.json(settings);
    } catch (error) {
        console.error('[uploadControl] getPublic error:', error);
        return res.status(500).json({ message: 'Failed to fetch upload control settings' });
    }
};

exports.getAdmin = async (_req, res) => {
    try {
        const settings = await loadSettings();
        return res.json({ success: true, settings });
    } catch (error) {
        console.error('[uploadControl] getAdmin error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch upload control settings' });
    }
};

exports.update = async (req, res) => {
    try {
        await ensureTable();

        const currentSettings = await loadSettings();
        const minUploadPrice = Number(req.body?.min_upload_price ?? req.body?.minUploadPrice);
        const maxUploadPrice = Number(req.body?.max_upload_price ?? req.body?.maxUploadPrice);
        const flashContentPrice = Number(req.body?.flash_content_price ?? req.body?.flashContentPrice ?? currentSettings.flash_content_price);
        const flashPreviewSeconds = Number(req.body?.flash_preview_seconds ?? req.body?.flashPreviewSeconds ?? currentSettings.flash_preview_seconds);
        const flashAutoPlay = Boolean(req.body?.flash_auto_play ?? req.body?.flashAutoPlay ?? currentSettings.flash_auto_play);
        const normalUserVideoLimitSeconds = Number(req.body?.normal_user_video_limit_seconds ?? req.body?.normalUserVideoLimitSeconds);
        const subscribedUserVideoLimitSeconds = Number(req.body?.subscribed_user_video_limit_seconds ?? req.body?.subscribedUserVideoLimitSeconds);
        const defaultTopic = String(req.body?.default_topic ?? req.body?.defaultTopic ?? currentSettings.default_topic).trim();
        const defaultContentAccessMode = String(
            req.body?.default_content_access_mode ?? req.body?.defaultContentAccessMode ?? currentSettings.default_content_access_mode
        ).trim();
        const rawCommissionTiers = req.body?.commission_tiers ?? req.body?.commissionTiers ?? currentSettings.commission_tiers;
        const rawSubscriptionCommissionTiers = req.body?.subscription_commission_tiers ?? req.body?.subscriptionCommissionTiers ?? currentSettings.subscription_commission_tiers;
        const commissionTiers = normalizeCommissionTiers(rawCommissionTiers);
        const subscriptionCommissionTiers = normalizeCommissionTiers(rawSubscriptionCommissionTiers);

        if (!Number.isFinite(minUploadPrice) || minUploadPrice < 0) {
            return res.status(400).json({ success: false, message: 'Minimum upload price must be 0 or greater' });
        }

        if (!Number.isFinite(maxUploadPrice) || maxUploadPrice < minUploadPrice) {
            return res.status(400).json({ success: false, message: 'Maximum upload price must be greater than or equal to minimum upload price' });
        }
        for (let index = 0; index < commissionTiers.length; index += 1) {
            const tier = commissionTiers[index];
            if (tier.min < minUploadPrice || tier.max > maxUploadPrice) {
                return res.status(400).json({ success: false, message: 'Commission tier ranges must stay inside the vault upload price range' });
            }
            if (index > 0) {
                const previousTier = commissionTiers[index - 1];
                if (tier.min <= previousTier.max) {
                    return res.status(400).json({ success: false, message: 'Commission tiers cannot overlap. Adjust the price ranges and try again.' });
                }
            }
        }
        for (let index = 0; index < subscriptionCommissionTiers.length; index += 1) {
            const tier = subscriptionCommissionTiers[index];
            if (index > 0) {
                const previousTier = subscriptionCommissionTiers[index - 1];
                if (tier.min <= previousTier.max) {
                    return res.status(400).json({ success: false, message: 'Subscription commission tiers cannot overlap. Adjust the price ranges and try again.' });
                }
            }
        }
        if (!Number.isFinite(flashContentPrice) || flashContentPrice <= 0) {
            return res.status(400).json({ success: false, message: 'Flash content price must be greater than 0' });
        }
        if (!Number.isFinite(flashPreviewSeconds) || flashPreviewSeconds < 1) {
            return res.status(400).json({ success: false, message: 'Flash preview time must be at least 1 second' });
        }

        if (!defaultTopic) {
            return res.status(400).json({ success: false, message: 'Default topic is required' });
        }

        if (!['blurred', 'unblurred'].includes(defaultContentAccessMode)) {
            return res.status(400).json({ success: false, message: 'Default content access mode is invalid' });
        }

        if (!Number.isFinite(normalUserVideoLimitSeconds) || normalUserVideoLimitSeconds < 1) {
            return res.status(400).json({ success: false, message: 'Normal user video limit must be at least 1 second' });
        }

        if (!Number.isFinite(subscribedUserVideoLimitSeconds) || subscribedUserVideoLimitSeconds < normalUserVideoLimitSeconds) {
            return res.status(400).json({ success: false, message: 'Subscriber video limit must be greater than or equal to normal user video limit' });
        }

        const { rows } = await pool.query(`
            UPDATE upload_control_settings
            SET min_upload_price = $1,
                max_upload_price = $2,
                flash_content_price = $3,
                flash_preview_seconds = $4,
                flash_auto_play = $5,
                default_topic = $6,
                default_content_access_mode = $7,
                normal_user_video_limit_seconds = $8,
                subscribed_user_video_limit_seconds = $9,
                commission_tiers = $10::jsonb,
                subscription_commission_tiers = $11::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = (
                SELECT id
                FROM upload_control_settings
                ORDER BY id ASC
                LIMIT 1
            )
            RETURNING *
        `, [
            minUploadPrice,
            maxUploadPrice,
            flashContentPrice,
            Math.floor(flashPreviewSeconds),
            flashAutoPlay,
            defaultTopic,
            defaultContentAccessMode,
            normalUserVideoLimitSeconds,
            subscribedUserVideoLimitSeconds,
            JSON.stringify(commissionTiers),
            JSON.stringify(subscriptionCommissionTiers),
        ]);

        return res.json({ success: true, settings: normalizeRow(rows[0]) });
    } catch (error) {
        console.error('[uploadControl] update error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update upload control settings' });
    }
};

exports.getUploadContentsAdmin = async (req, res) => {
    try {
        await ensureTable();
        await pool.query(`
            CREATE TABLE IF NOT EXISTS upload_contents (
                id SERIAL PRIMARY KEY,
                content_id VARCHAR(24) NOT NULL UNIQUE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                owner_user_id VARCHAR(80),
                owner_username VARCHAR(120),
                content_type VARCHAR(20) NOT NULL DEFAULT 'vault',
                description TEXT NOT NULL DEFAULT '',
                topic VARCHAR(80) NOT NULL DEFAULT 'Technology',
                price NUMERIC(12, 2) NOT NULL DEFAULT 0,
                subscription_packages JSONB NOT NULL DEFAULT '[]'::jsonb,
                affiliate_commission NUMERIC(8, 2) NOT NULL DEFAULT 0,
                show_link_on_home BOOLEAN NOT NULL DEFAULT false,
                external_link TEXT,
                media_type VARCHAR(20) NOT NULL DEFAULT '',
                media_preview TEXT,
                media_gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
                thumbnail_url TEXT,
                content_access_mode VARCHAR(20) NOT NULL DEFAULT 'unblurred',
                preview_mode VARCHAR(20) NOT NULL DEFAULT 'thumbnail',
                preview_url TEXT,
                visibility VARCHAR(24) NOT NULL DEFAULT 'public',
                status VARCHAR(30) NOT NULL DEFAULT 'Pending Approval',
                rejection_reason TEXT,
                admin_note TEXT,
                approved_at TIMESTAMP NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            ALTER TABLE upload_contents
            ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'vault',
            ADD COLUMN IF NOT EXISTS visibility VARCHAR(24) NOT NULL DEFAULT 'public',
            ADD COLUMN IF NOT EXISTS preview_mode VARCHAR(20) NOT NULL DEFAULT 'thumbnail',
            ADD COLUMN IF NOT EXISTS preview_url TEXT
        `);

        const status = String(req.query.status || '').trim();
        const params = [];
        let where = '';
        if (status) {
            params.push(normalizeContentStatus(status));
            where = `WHERE uc.status = $${params.length}`;
        }

        const { rows } = await pool.query(`
            SELECT uc.*, u.full_name, u.username AS user_username, u.profile_picture, u.user_type
            FROM upload_contents uc
            INNER JOIN users u ON u.id = uc.user_id
            ${where}
            ORDER BY uc.created_at DESC
        `, params);

        return res.json({ success: true, contents: rows.map(mapUploadContentRow) });
    } catch (error) {
        console.error('[uploadControl] getUploadContentsAdmin error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch upload contents' });
    }
};

exports.updateUploadContentStatusAdmin = async (req, res) => {
    try {
        const contentId = String(req.params.contentId || '').trim();
        const requestedStatus = normalizeContentStatus(req.body?.status);
        const rejectionReason = String(req.body?.rejectionReason || req.body?.rejection_reason || '').trim();
        const adminNote = String(req.body?.adminNote || req.body?.admin_note || '').trim();

        if (!contentId) {
            return res.status(400).json({ success: false, message: 'Content ID is required' });
        }
        if (requestedStatus === 'Rejected' && !rejectionReason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required' });
        }

        const { rows } = await pool.query(`
            UPDATE upload_contents
            SET status = $2::varchar,
                rejection_reason = $3,
                admin_note = $4,
                approved_at = CASE WHEN $2::varchar = 'Approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE content_id = $1
            RETURNING *
        `, [
            contentId,
            requestedStatus,
            requestedStatus === 'Rejected' ? rejectionReason : null,
            adminNote || null,
        ]);

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Upload content not found' });
        }

        return res.json({ success: true, content: mapUploadContentRow(rows[0]) });
    } catch (error) {
        console.error('[uploadControl] updateUploadContentStatusAdmin error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update upload content status' });
    }
};

exports.deleteUploadContentAdmin = async (req, res) => {
    try {
        const contentId = String(req.params.contentId || '').trim();
        if (!contentId) {
            return res.status(400).json({ success: false, message: 'Content ID is required' });
        }

        const { rows } = await pool.query(`
            DELETE FROM upload_contents
            WHERE content_id = $1
            RETURNING content_id
        `, [contentId]);

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Upload content not found' });
        }

        return res.json({ success: true, contentId: rows[0].content_id });
    } catch (error) {
        console.error('[uploadControl] deleteUploadContentAdmin error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete upload content' });
    }
};
