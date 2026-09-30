const pool = require('../config/database');
const { writeAdminAuditEvent } = require('../utils/adminAuditLogger');

const SHARED_EXPIRY_PLAN_SLUGS = ['basic', 'package-1', 'package-2', 'package-3'];

function getExpiryFromPlan(plan) {
    const extra = plan?.extra || {};
    return {
        value: Number(extra.ads_expiry_value ?? extra.ads_expiry_days ?? extra.ad_photo_expiry_days ?? 30) || 30,
        unit: extra.ads_expiry_unit || 'days',
    };
}

function getSharedExpiry(rows) {
    const defaultPlan = rows.find(plan => plan.is_default) || rows.find(plan => plan.slug === 'basic') || rows[0];
    return getExpiryFromPlan(defaultPlan);
}

function normalizePlanRows(rows) {
    const sharedExpiry = getSharedExpiry(rows);
    return rows.map(plan => {
        const features = Array.isArray(plan.features)
            ? plan.features.filter(feature => !/^ad\s*expiry/i.test(String(feature || '').trim()))
            : [];

        return {
            ...plan,
            features: [...features, `Ad expiry - ${sharedExpiry.value} ${sharedExpiry.unit}`],
            extra: {
                ...(plan.extra || {}),
                ads_expiry_value: sharedExpiry.value,
                ads_expiry_unit: sharedExpiry.unit,
            },
        };
    });
}

async function syncSharedAdExpiry(value = 30, unit = 'days') {
    const expiryValue = Number(value) || 30;
    const expiryUnit = unit || 'days';

    await pool.query(
        `
        UPDATE subscription_plans
        SET extra = jsonb_set(
                jsonb_set(COALESCE(extra, '{}'::jsonb), '{ads_expiry_value}', to_jsonb($1::int), true),
                '{ads_expiry_unit}', to_jsonb($2::text), true
            ),
            features = (
                SELECT COALESCE(jsonb_agg(feature), '[]'::jsonb)
                FROM jsonb_array_elements_text(COALESCE(features, '[]'::jsonb)) AS feature
                WHERE feature !~* '^ad\\s*expiry'
            ),
            updated_at = NOW()
        WHERE slug = ANY($3)
        `,
        [expiryValue, expiryUnit, SHARED_EXPIRY_PLAN_SLUGS]
    );
}

function validateGracePeriodExtra(extra) {
    if (!extra || typeof extra !== 'object') return;
    const hasValue = extra.grace_period_value !== undefined || extra.subscription_grace_value !== undefined;
    const hasUnit = extra.grace_period_unit !== undefined || extra.subscription_grace_unit !== undefined;
    if (!hasValue && !hasUnit) return;

    const value = Number(extra.grace_period_value ?? extra.subscription_grace_value);
    const unit = String(extra.grace_period_unit ?? extra.subscription_grace_unit ?? '').toLowerCase();
    if (!Number.isInteger(value) || value < 1 || !['minutes', 'hours', 'days'].includes(unit)) {
        const error = new Error('Grace period must be a positive whole number in minutes, hours, or days');
        error.statusCode = 400;
        throw error;
    }
}

async function syncApprovedUploadExpiryForPlan(plan) {
    const unit = String(plan?.extra?.content_expiry_unit || 'unlimited').toLowerCase();
    const allowedUnits = new Set(['minutes', 'hours', 'days', 'months', 'unlimited']);
    const expiryUnit = allowedUnits.has(unit) ? unit : 'unlimited';
    const rawValue = Number(plan?.extra?.content_expiry_value ?? 1);
    const expiryValue = Number.isFinite(rawValue) ? Math.max(1, Math.floor(rawValue)) : 1;

    await pool.query(
        `UPDATE upload_contents
         SET approval_expiry_value = CASE WHEN $2 = 'unlimited' THEN NULL ELSE $3::int END,
             approval_expiry_unit = $2,
             expires_at = CASE $2
                 WHEN 'minutes' THEN (CASE WHEN LOWER($4) = 'basic' AND basic_fallback_owner_only THEN CURRENT_TIMESTAMP ELSE approved_at END) + ($3::int * INTERVAL '1 minute')
                 WHEN 'hours' THEN (CASE WHEN LOWER($4) = 'basic' AND basic_fallback_owner_only THEN CURRENT_TIMESTAMP ELSE approved_at END) + ($3::int * INTERVAL '1 hour')
                 WHEN 'days' THEN (CASE WHEN LOWER($4) = 'basic' AND basic_fallback_owner_only THEN CURRENT_TIMESTAMP ELSE approved_at END) + ($3::int * INTERVAL '1 day')
                 WHEN 'months' THEN (CASE WHEN LOWER($4) = 'basic' AND basic_fallback_owner_only THEN CURRENT_TIMESTAMP ELSE approved_at END) + ($3::int * INTERVAL '1 month')
                 ELSE NULL
             END,
             updated_at = NOW()
         WHERE status = 'Approved'
           AND approved_at IS NOT NULL
           AND (
               approval_plan_id = $1
               OR (
                   approval_plan_id IS NULL
                   AND LOWER(COALESCE(approval_plan_slug, '')) = LOWER($4)
               )
           )`,
        [plan.id, expiryUnit, expiryValue, String(plan.slug || '')]
    );
}

async function audit(req, event) {
    try {
        await writeAdminAuditEvent(req, event);
    } catch (err) {
        console.error('[admin-audit] failed to write log:', err.message);
    }
}

async function ensureTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id              SERIAL PRIMARY KEY,
            slug            VARCHAR(60)   NOT NULL UNIQUE,
            name            VARCHAR(120)  NOT NULL,
            price           DECIMAL(12,2) NOT NULL DEFAULT 0,
            duration_days   INTEGER       NOT NULL DEFAULT 30,
            badge_color     VARCHAR(40)   DEFAULT 'silver',
            accent_color    VARCHAR(40)   DEFAULT 'zinc',
            googs_limit     INTEGER       NOT NULL DEFAULT 5,
            verified_tick   BOOLEAN       NOT NULL DEFAULT FALSE,
            features        JSONB         NOT NULL DEFAULT '[]'::jsonb,
            extra           JSONB         NOT NULL DEFAULT '{}'::jsonb,
            is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
            is_free         BOOLEAN       NOT NULL DEFAULT FALSE,
            is_default      BOOLEAN       NOT NULL DEFAULT FALSE,
            sort_order      INTEGER       NOT NULL DEFAULT 0,
            created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Safe upgrades for existing tables missing these columns
    await pool.query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_free    BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE`);

    // Remove old default-seeded plans that are no longer needed
    await pool.query(`DELETE FROM subscription_plans WHERE slug IN ('starter', 'pro', 'elite')`);

    // Force-correct is_free/is_default for the basic plan if it already exists with wrong values
    await pool.query(`
        UPDATE subscription_plans
        SET is_free = TRUE, is_default = TRUE, updated_at = NOW()
        WHERE slug = 'basic' AND (is_free = FALSE OR is_default = FALSE)
    `);

    // Remove old incorrectly-named paid plans
    await pool.query(`DELETE FROM subscription_plans WHERE slug IN ('silver','gold','platinum')`);

    // Add missing basic-plan extra fields for existing rows
    await pool.query(`
        UPDATE subscription_plans
        SET extra = extra
            || CASE WHEN extra->>'ads_expiry_value'     IS NULL THEN '{"ads_expiry_value":30}'::jsonb        ELSE '{}'::jsonb END
            || CASE WHEN extra->>'ads_expiry_unit'      IS NULL THEN '{"ads_expiry_unit":"days"}'::jsonb     ELSE '{}'::jsonb END
            || CASE WHEN extra->>'content_upload_limit' IS NULL THEN '{"content_upload_limit":5}'::jsonb ELSE '{}'::jsonb END
            || CASE WHEN extra->>'content_daily_upload_limit' IS NULL THEN '{"content_daily_upload_limit":1}'::jsonb ELSE '{}'::jsonb END
            || CASE WHEN extra->>'content_video_limit_minutes' IS NULL THEN '{"content_video_limit_minutes":1}'::jsonb ELSE '{}'::jsonb END
            || CASE WHEN extra->>'text_messaging'        IS NULL THEN '{"text_messaging":true}'::jsonb       ELSE '{}'::jsonb END
            || CASE WHEN extra->>'voice_calls'           IS NULL THEN '{"voice_calls":true}'::jsonb          ELSE '{}'::jsonb END
            || CASE WHEN extra->>'chat_auto_delete_24h'  IS NULL THEN '{"chat_auto_delete_24h":true}'::jsonb ELSE '{}'::jsonb END,
            updated_at = NOW()
        WHERE is_default = TRUE
          AND (
              extra->>'ads_expiry_value'    IS NULL OR
              extra->>'ads_expiry_unit'     IS NULL OR
              extra->>'content_upload_limit' IS NULL OR
              extra->>'content_daily_upload_limit' IS NULL OR
              extra->>'content_video_limit_minutes' IS NULL OR
              extra->>'text_messaging'      IS NULL OR
              extra->>'voice_calls'         IS NULL OR
              extra->>'chat_auto_delete_24h' IS NULL
          )
    `);

    await pool.query(`
        UPDATE subscription_plans
        SET extra = extra
            || CASE WHEN extra->>'content_upload_limit' IS NULL THEN jsonb_build_object('content_upload_limit', CASE slug WHEN 'package-1' THEN 15 WHEN 'package-2' THEN 30 WHEN 'package-3' THEN 50 ELSE 15 END) ELSE '{}'::jsonb END
            || CASE WHEN extra->>'content_daily_upload_limit' IS NULL THEN jsonb_build_object('content_daily_upload_limit', CASE slug WHEN 'package-1' THEN 3 WHEN 'package-2' THEN 5 WHEN 'package-3' THEN 10 ELSE 3 END) ELSE '{}'::jsonb END
            || CASE WHEN extra->>'content_video_limit_minutes' IS NULL THEN jsonb_build_object('content_video_limit_minutes', CASE slug WHEN 'package-1' THEN 5 WHEN 'package-2' THEN 10 WHEN 'package-3' THEN 20 ELSE 5 END) ELSE '{}'::jsonb END,
            updated_at = NOW()
        WHERE slug IN ('package-1', 'package-2', 'package-3')
          AND (
              extra->>'content_upload_limit' IS NULL OR
              extra->>'content_daily_upload_limit' IS NULL OR
              extra->>'content_video_limit_minutes' IS NULL
          )
    `);

    // Fix existing plans that have the old label without the emoji stored in extra.labels
    await pool.query(`
        UPDATE subscription_plans
        SET extra = jsonb_set(
            extra,
            '{labels,product_upload_limit}',
            '"🔻 Product Upload Limit"'
        ),
        updated_at = NOW()
        WHERE extra->'labels'->>'product_upload_limit' = 'Product Upload Limit'
    `);

    // One-time migration: update packages to the new chat-features spec when voice_calls is missing
    await pool.query(`
        UPDATE subscription_plans SET
            features = '["Verification tick","Write Goog (color) – 25 limit","Write goog (150 letters)","🔻 Product Upload Limit – 20","3 Videos (ads) save","5 Photos (ads) save","Chat features","Text messaging (colors)","Voice calls","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 7 days)"]'::jsonb,
            extra    = '{"write_goog_limit":25,"goog_letter_limit":150,"product_upload_limit":20,"content_upload_limit":15,"content_daily_upload_limit":3,"content_video_limit_minutes":5,"ad_videos":3,"ad_photos":5,"chat_save":0,"free_promo_code":false,"text_messaging":"colors","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":false,"chat_auto_delete_days":7,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            updated_at = NOW()
        WHERE slug = 'package-1' AND extra->>'voice_calls' IS NULL
    `);
    await pool.query(`
        UPDATE subscription_plans SET
            features = '["Verification tick","Write Goog (color) – 50 limit","Write goog (280 letters)","🔻 Product Upload Limit – 30","5 Videos (ads) save","10 Photos (ads) save","Chat features","Text messaging (colors, stickers)","Voice calls","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 30 days)"]'::jsonb,
            extra    = '{"write_goog_limit":50,"goog_letter_limit":280,"product_upload_limit":30,"content_upload_limit":30,"content_daily_upload_limit":5,"content_video_limit_minutes":10,"ad_videos":5,"ad_photos":10,"chat_save":0,"free_promo_code":false,"text_messaging":"colors,stickers","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":false,"chat_auto_delete_days":30,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            updated_at = NOW()
        WHERE slug = 'package-2' AND extra->>'voice_calls' IS NULL
    `);
    await pool.query(`
        UPDATE subscription_plans SET
            features = '["Verification tick","Write Goog (color) – 100 limit","Write goog (500 letters)","🔻 Product Upload Limit – 50","10 Videos (ads) save","20 Photos (ads) save","Free ad promo code (profile)","Chat features","Text messaging (colors, stickers)","Voice calls","Video calls (240p / 360p limited quality)","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 60 days)"]'::jsonb,
            extra    = '{"write_goog_limit":100,"goog_letter_limit":500,"product_upload_limit":50,"content_upload_limit":50,"content_daily_upload_limit":10,"content_video_limit_minutes":20,"ad_videos":10,"ad_photos":20,"chat_save":0,"free_promo_code":true,"text_messaging":"colors,stickers","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":true,"chat_auto_delete_days":60,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            updated_at = NOW()
        WHERE slug = 'package-3' AND extra->>'voice_calls' IS NULL
    `);

    // Seed paid packages — ON CONFLICT DO NOTHING preserves any admin edits after first install
    await pool.query(`
        INSERT INTO subscription_plans
            (slug, name, price, duration_days, badge_color, accent_color,
             googs_limit, verified_tick, features, extra, is_active, is_free, is_default, sort_order)
        VALUES
        (
            'package-1', 'Package 1', 299, 30, 'silver', 'zinc', 25, TRUE,
            '["Verification tick","Write Goog (color) – 25 limit","Write goog (150 letters)","🔻 Product Upload Limit – 20","3 Videos (ads) save","5 Photos (ads) save","Chat features","Text messaging (colors)","Voice calls","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 7 days)"]'::jsonb,
            '{"write_goog_limit":25,"goog_letter_limit":150,"product_upload_limit":20,"content_upload_limit":15,"content_daily_upload_limit":3,"content_video_limit_minutes":5,"ad_videos":3,"ad_photos":5,"chat_save":0,"free_promo_code":false,"text_messaging":"colors","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":false,"chat_auto_delete_days":7,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            TRUE, FALSE, FALSE, 1
        ),
        (
            'package-2', 'Package 2', 499, 30, 'blue', 'blue', 50, TRUE,
            '["Verification tick","Write Goog (color) – 50 limit","Write goog (280 letters)","🔻 Product Upload Limit – 30","5 Videos (ads) save","10 Photos (ads) save","Chat features","Text messaging (colors, stickers)","Voice calls","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 30 days)"]'::jsonb,
            '{"write_goog_limit":50,"goog_letter_limit":280,"product_upload_limit":30,"content_upload_limit":30,"content_daily_upload_limit":5,"content_video_limit_minutes":10,"ad_videos":5,"ad_photos":10,"chat_save":0,"free_promo_code":false,"text_messaging":"colors,stickers","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":false,"chat_auto_delete_days":30,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            TRUE, FALSE, FALSE, 2
        ),
        (
            'package-3', 'Package 3', 999, 30, 'gold', 'amber', 100, TRUE,
            '["Verification tick","Write Goog (color) – 100 limit","Write goog (500 letters)","🔻 Product Upload Limit – 50","10 Videos (ads) save","20 Photos (ads) save","Free ad promo code (profile)","Chat features","Text messaging (colors, stickers)","Voice calls","Video calls (240p / 360p limited quality)","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 60 days)"]'::jsonb,
            '{"write_goog_limit":100,"goog_letter_limit":500,"product_upload_limit":50,"content_upload_limit":50,"content_daily_upload_limit":10,"content_video_limit_minutes":20,"ad_videos":10,"ad_photos":20,"chat_save":0,"free_promo_code":true,"text_messaging":"colors,stickers","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":true,"chat_auto_delete_days":60,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            TRUE, FALSE, FALSE, 3
        )
        ON CONFLICT (slug) DO NOTHING
    `);

    // Seed the Basic free plan only if it doesn't exist yet.
    // ON CONFLICT only fixes the flags — never overwrites admin-customised limits.
    await pool.query(`
        INSERT INTO subscription_plans
            (slug, name, price, duration_days, badge_color, accent_color,
             googs_limit, verified_tick, features, extra, is_active, is_free, is_default, sort_order)
        VALUES
            ('basic', 'Basic', 0, 0, 'silver', 'zinc', 5, FALSE,
             '["Write goog (up to 5)", "Goog letter limit – 75 characters", "🔻 Product Upload Limit – 15"]'::jsonb,
             '{"write_goog_limit":5,"product_upload_limit":15,"goog_letter_limit":75,"content_upload_limit":5,"content_daily_upload_limit":1,"content_video_limit_minutes":1,"ads_expiry_value":30,"ads_expiry_unit":"days","text_messaging":true,"voice_calls":true,"chat_auto_delete_24h":true}'::jsonb,
             TRUE, TRUE, TRUE, 0)
        ON CONFLICT (slug) DO UPDATE SET
            is_free    = TRUE,
            is_default = TRUE,
            updated_at = NOW()
    `);

    const expiryRes = await pool.query(
        `SELECT slug, is_default, extra FROM subscription_plans WHERE slug = ANY($1) ORDER BY is_default DESC, sort_order`,
        [SHARED_EXPIRY_PLAN_SLUGS]
    );
    const sharedExpiry = getSharedExpiry(expiryRes.rows);
    await syncSharedAdExpiry(sharedExpiry.value, sharedExpiry.unit);
}

const getPublic = async (req, res) => {
    try {
        await ensureTable();
        const { rows } = await pool.query(
            `SELECT * FROM subscription_plans WHERE is_active = TRUE AND is_free = FALSE ORDER BY sort_order`
        );
        res.json({ data: normalizePlanRows(rows) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getAll = async (req, res) => {
    try {
        await ensureTable();
        const { rows } = await pool.query('SELECT * FROM subscription_plans ORDER BY sort_order');
        res.json({ data: normalizePlanRows(rows) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const create = async (req, res) => {
    try {
        const {
            slug, name, price, duration_days,
            badge_color, accent_color, googs_limit,
            verified_tick, features, extra, is_active, sort_order,
        } = req.body;

        if (!slug || !name || price == null) {
            return res.status(400).json({ message: 'slug, name, and price are required' });
        }

        const { rows } = await pool.query(
            `INSERT INTO subscription_plans
                (slug, name, price, duration_days, badge_color, accent_color, googs_limit, verified_tick, features, extra, is_active, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [
                slug.trim(), name.trim(), price,
                duration_days ?? 30,
                badge_color || 'silver', accent_color || 'zinc',
                googs_limit ?? 5,
                verified_tick !== false,
                JSON.stringify(features || []),
                JSON.stringify(extra || {}),
                is_active !== false,
                sort_order ?? 0,
            ]
        );
        res.status(201).json({ data: rows[0], message: 'Plan created' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'A plan with this slug already exists' });
        res.status(500).json({ message: err.message });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;

        const planRes = await pool.query('SELECT is_default FROM subscription_plans WHERE id = $1', [id]);
        if (planRes.rows.length === 0) return res.status(404).json({ message: 'Plan not found' });

        const isDefault = planRes.rows[0].is_default;
        const allowed = isDefault
            ? ['googs_limit', 'extra', 'features']
            : ['slug', 'name', 'price', 'duration_days', 'badge_color', 'accent_color',
               'googs_limit', 'verified_tick', 'features', 'extra', 'is_active', 'sort_order'];

        const jsonFields = new Set(['features', 'extra']);
        const sets = [];
        const values = [];
        let i = 1;

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                if (key === 'extra') validateGracePeriodExtra(req.body[key]);
                sets.push(`${key} = $${i}`);
                values.push(jsonFields.has(key) ? JSON.stringify(req.body[key]) : req.body[key]);
                i++;
            }
        }

        if (sets.length === 0) return res.status(400).json({ message: 'No valid fields to update' });
        sets.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE subscription_plans SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Plan not found' });

        if (
            req.body.extra?.content_expiry_value !== undefined ||
            req.body.extra?.content_expiry_unit !== undefined
        ) {
            await syncApprovedUploadExpiryForPlan(rows[0]);
        }

        const expiryValue = req.body.extra?.ads_expiry_value;
        const expiryUnit = req.body.extra?.ads_expiry_unit;
        if (expiryValue !== undefined || expiryUnit !== undefined) {
            const currentExpiry = getExpiryFromPlan(rows[0]);
            await syncSharedAdExpiry(currentExpiry.value, currentExpiry.unit);
        }

        // If badge_color or verified_tick changed, propagate to all active subscribers of this plan
        const updatedPlan = rows[0];
        const badgeColorChanged = req.body.badge_color !== undefined;
        const verifiedTickChanged = req.body.verified_tick !== undefined;

        if (badgeColorChanged || verifiedTickChanged) {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_color VARCHAR(40) DEFAULT NULL`).catch(() => {});

            if (updatedPlan.verified_tick) {
                // Plan has tick ON — update badge color for all active subscribers who are verified
                await pool.query(`
                    UPDATE users u
                    SET verification_badge_color = $1,
                        is_verified = true,
                        verification_status = 'Verified'
                    FROM user_plan_subscriptions ups
                    WHERE ups.user_id = u.id
                      AND ups.plan_id = $2
                      AND ups.status = 'active'
                      AND u.is_verified = true
                `, [updatedPlan.badge_color || 'blue', id]);
            } else if (verifiedTickChanged && !updatedPlan.verified_tick) {
                // Admin turned verified_tick OFF on the plan — do NOT strip badges
                // (admin may have manually assigned badges; only plan-driven ones should be removed)
                // For safety, we leave existing badges — admin can revoke manually per user
            }
        }

        const refreshed = await pool.query('SELECT * FROM subscription_plans WHERE id = $1', [id]);
        res.json({ data: normalizePlanRows(refreshed.rows)[0], message: 'Plan updated' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'A plan with this slug already exists' });
        res.status(err.statusCode || 500).json({ message: err.message });
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT is_default FROM subscription_plans WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Plan not found' });
        if (check.rows[0].is_default) return res.status(403).json({ message: 'Cannot delete the default free plan' });

        await pool.query('DELETE FROM subscription_plans WHERE id = $1', [id]);
        res.json({ message: 'Plan deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const seedBasic = async (req, res) => {
    try {
        await ensureTable();
        const { rows } = await pool.query(`SELECT * FROM subscription_plans WHERE slug = 'basic' LIMIT 1`);
        res.json({ message: 'Basic plan saved to database', data: rows[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /purchases — all users who currently have an active paid subscription
const getPurchases = async (req, res) => {
    try {
        // Ensure verification columns exist
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'None'`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_color VARCHAR(40) DEFAULT NULL`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_tick_color VARCHAR(40) DEFAULT NULL`).catch(() => {});

        const { rows } = await pool.query(`
            SELECT
                ups.id,
                ups.user_id,
                ups.plan_id,
                ups.plan_slug,
                ups.plan_name,
                ups.price_paid,
                ups.duration_days,
                ups.status,
                ups.auto_renew,
                ups.started_at,
                ups.expires_at,
                ups.created_at,
                u.username,
                u.full_name,
                u.email,
                u.user_id AS readable_user_id,
                u.user_type,
                u.is_verified,
                u.verification_badge_color,
                u.verification_badge_tick_color,
                u.profile_picture,
                sp.badge_color,
                sp.verified_tick,
                sp.price AS plan_price
            FROM user_plan_subscriptions ups
            JOIN users u ON u.id = ups.user_id
            LEFT JOIN subscription_plans sp ON sp.id = ups.plan_id
            WHERE ups.plan_slug != 'basic'
              AND ups.status IN ('active', 'cancelled')

            UNION

            SELECT
                0 AS id,
                u.id AS user_id,
                NULL::integer AS plan_id,
                'badge_only' AS plan_slug,
                'Badge Only' AS plan_name,
                0::numeric AS price_paid,
                0 AS duration_days,
                'active' AS status,
                FALSE AS auto_renew,
                NULL::timestamp AS started_at,
                NULL::timestamp AS expires_at,
                NULL::timestamp AS created_at,
                u.username,
                u.full_name,
                u.email,
                u.user_id AS readable_user_id,
                u.user_type,
                u.is_verified,
                u.verification_badge_color,
                u.verification_badge_tick_color,
                u.profile_picture,
                u.verification_badge_color AS badge_color,
                TRUE AS verified_tick,
                NULL::numeric AS plan_price
            FROM users u
            WHERE u.is_verified = TRUE
              -- Only an *active* paid plan replaces the Badge Only row. A user
              -- whose old plan was cancelled used to vanish from the default
              -- (active) view after the admin saved a badge for them.
              AND NOT EXISTS (
                SELECT 1 FROM user_plan_subscriptions ups2
                WHERE ups2.user_id = u.id
                  AND ups2.plan_slug != 'basic'
                  AND ups2.status = 'active'
              )

            ORDER BY started_at DESC NULLS LAST
        `);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /assign — admin assigns a plan to a user for free (no wallet deduction)
const assignPlan = async (req, res) => {
    const client = await pool.connect();
    try {
        const { user_id, plan_id } = req.body;
        if (!user_id || !plan_id) {
            return res.status(400).json({ message: 'user_id and plan_id are required' });
        }

        const planRes = await client.query(
            `SELECT id, slug, name, duration_days, is_active, verified_tick, badge_color, extra FROM subscription_plans WHERE id = $1`,
            [plan_id]
        );
        if (planRes.rows.length === 0) return res.status(404).json({ message: 'Plan not found' });
        const plan = planRes.rows[0];
        if (!plan.is_active) return res.status(400).json({ message: 'Plan is not active' });

        const userRes = await client.query(`SELECT id FROM users WHERE id = $1`, [user_id]);
        if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });

        await client.query('BEGIN');

        // Cancel any existing active subscription for this user
        await client.query(
            `UPDATE user_plan_subscriptions SET status = 'cancelled', cancelled_at = NOW()
             WHERE user_id = $1 AND status = 'active'`,
            [user_id]
        );

        // Calculate expires_at — null for lifetime (duration_days = 0)
        const durationDays = plan.duration_days || 0;
        const expiresAt = durationDays > 0
            ? new Date(Date.now() + durationDays * 86400 * 1000)
            : null;

        const { rows } = await client.query(
            `INSERT INTO user_plan_subscriptions
                (user_id, plan_id, plan_slug, plan_name, price_paid, duration_days, status, auto_renew, started_at, expires_at)
             VALUES ($1, $2, $3, $4, 0, $5, 'active', FALSE, NOW(), $6)
             RETURNING *`,
            [user_id, plan.id, plan.slug, plan.name, durationDays, expiresAt]
        );

        // Auto-apply badge if plan has verified_tick
        if (plan.verified_tick) {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_tick_color VARCHAR(40) DEFAULT NULL`).catch(() => {});
            await client.query(
                `UPDATE users SET is_verified = true, verification_status = 'Verified',
                 verification_badge_color = $1,
                 verification_badge_tick_color = $2 WHERE id = $3`,
                [plan.extra?.badge_custom_color || plan.badge_color || 'blue', plan.extra?.badge_tick_color || null, user_id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ data: rows[0], message: `Plan "${plan.name}" assigned to user` });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
};

// DELETE /assign/:userId — remove assigned plan, revert user to basic
const removeAssign = async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(
            `UPDATE user_plan_subscriptions
             SET status = 'cancelled', cancelled_at = NOW()
             WHERE user_id = $1 AND status = 'active' AND plan_slug != 'basic'
             RETURNING id`,
            [userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'No active paid subscription found for this user' });
        }

        res.json({ message: 'Subscription removed. User reverted to basic plan.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /purchases/:id/toggle-status — admin activates or cancels a subscription
const togglePurchaseStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const row = await pool.query(`SELECT id, status FROM user_plan_subscriptions WHERE id = $1`, [id]);
        if (row.rows.length === 0) return res.status(404).json({ message: 'Subscription not found' });
        const current = row.rows[0].status;
        const next = current === 'active' ? 'cancelled' : 'active';
        if (next === 'cancelled') {
            await pool.query(
                `UPDATE user_plan_subscriptions SET status = $1, cancelled_at = NOW() WHERE id = $2`,
                [next, id]
            );
        } else {
            await pool.query(
                `UPDATE user_plan_subscriptions SET status = $1, cancelled_at = NULL WHERE id = $2`,
                [next, id]
            );
        }
        res.json({ message: `Subscription ${next}`, status: next });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /assign-badge/:userId — admin assigns/removes verification badge with optional color
const assignVerificationBadge = async (req, res) => {
    try {
        const { userId } = req.params;
        const { is_verified, verification_badge_color, verification_badge_tick_color } = req.body;

        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_color VARCHAR(40) DEFAULT NULL`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_tick_color VARCHAR(40) DEFAULT NULL`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'None'`).catch(() => {});

        const fields = [];
        const values = [];
        let idx = 1;

        if (typeof is_verified === 'boolean') {
            fields.push(`is_verified = $${idx++}`);
            values.push(is_verified);
            fields.push(`verification_status = $${idx++}`);
            values.push(is_verified ? 'Verified' : 'None');
        }
        if (verification_badge_color !== undefined) {
            fields.push(`verification_badge_color = $${idx++}`);
            values.push(verification_badge_color || null);
        }
        if (verification_badge_tick_color !== undefined) {
            fields.push(`verification_badge_tick_color = $${idx++}`);
            values.push(verification_badge_tick_color || null);
        }

        if (fields.length === 0) return res.status(400).json({ message: 'Nothing to update' });

        values.push(userId);
        await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);

        const updated = await pool.query(`SELECT id, username, is_verified, verification_status, verification_badge_color, verification_badge_tick_color FROM users WHERE id = $1`, [userId]);
        await audit(req, {
            action: 'admin.verification_badge.assign',
            status: 'success',
            target: { userId: Number(userId) || userId },
            details: {
                is_verified: updated.rows[0]?.is_verified ?? null,
                verification_badge_color: updated.rows[0]?.verification_badge_color ?? null,
                verification_badge_tick_color: updated.rows[0]?.verification_badge_tick_color ?? null,
            },
        });
        res.json({ message: 'Verification badge updated', data: updated.rows[0] });
    } catch (err) {
        await audit(req, {
            action: 'admin.verification_badge.assign',
            status: 'error',
            target: { userId: req.params?.userId || null },
            error: err.message,
        });
        res.status(err.statusCode || 500).json({ message: err.message });
    }
};

// POST /apply-plan-badge — called by main panel after user purchases a plan
// Reads plan's verified_tick + badge_color and applies to the user
const applyPlanBadge = async (req, res) => {
    try {
        const { user_id, plan_id } = req.body;
        if (!user_id || !plan_id) return res.status(400).json({ message: 'user_id and plan_id required' });

        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_color VARCHAR(40) DEFAULT NULL`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_tick_color VARCHAR(40) DEFAULT NULL`).catch(() => {});

        const planRes = await pool.query(
            `SELECT verified_tick, badge_color, extra FROM subscription_plans WHERE id = $1`,
            [plan_id]
        );
        if (planRes.rows.length === 0) return res.json({ applied: false });
        const plan = planRes.rows[0];

        if (plan.verified_tick) {
            await pool.query(
                `UPDATE users SET is_verified = true, verification_status = 'Verified',
                 verification_badge_color = $1,
                 verification_badge_tick_color = $2 WHERE id = $3`,
                [plan.extra?.badge_custom_color || plan.badge_color || 'blue', plan.extra?.badge_tick_color || null, user_id]
            );
            await audit(req, {
                action: 'subscription.plan_badge.apply',
                status: 'success',
                target: { userId: user_id, planId: plan_id },
                details: {
                    applied: true,
                    badgeColor: plan.extra?.badge_custom_color || plan.badge_color || 'blue',
                    badgeTickColor: plan.extra?.badge_tick_color || null,
                },
            });
            return res.json({ applied: true, badge_color: plan.extra?.badge_custom_color || plan.badge_color || 'blue', badge_tick_color: plan.extra?.badge_tick_color || null });
        }

        await audit(req, {
            action: 'subscription.plan_badge.apply',
            status: 'success',
            target: { userId: user_id, planId: plan_id },
            details: { applied: false, reason: 'plan_has_no_verified_tick' },
        });
        res.json({ applied: false });
    } catch (err) {
        await audit(req, {
            action: 'subscription.plan_badge.apply',
            status: 'error',
            target: {
                userId: req.body?.user_id || null,
                planId: req.body?.plan_id || null,
            },
            error: err.message,
        });
        res.status(500).json({ message: err.message });
    }
};

// GET /badge/:userId — public, returns user's verification badge color if verified
const getBadgeForUser = async (req, res) => {
    try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_color VARCHAR(40) DEFAULT NULL`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_badge_tick_color VARCHAR(40) DEFAULT NULL`).catch(() => {});
        const { userId } = req.params;
        const { rows } = await pool.query(
            `SELECT is_verified, verification_badge_color, verification_badge_tick_color FROM users WHERE id = $1`,
            [userId]
        );
        if (rows.length === 0 || !rows[0].is_verified) {
            return res.json({ badge: null });
        }
        res.json({ badge: { color: rows[0].verification_badge_color || 'blue', tickColor: rows[0].verification_badge_tick_color || null } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAll, getPublic, create, update, remove, seedBasic, getPurchases, assignPlan, removeAssign, togglePurchaseStatus, assignVerificationBadge, getBadgeForUser, applyPlanBadge };

