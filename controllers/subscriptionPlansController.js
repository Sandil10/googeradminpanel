const pool = require('../config/database');

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
            || CASE WHEN extra->>'text_messaging'        IS NULL THEN '{"text_messaging":true}'::jsonb       ELSE '{}'::jsonb END
            || CASE WHEN extra->>'voice_calls'           IS NULL THEN '{"voice_calls":true}'::jsonb          ELSE '{}'::jsonb END
            || CASE WHEN extra->>'chat_auto_delete_24h'  IS NULL THEN '{"chat_auto_delete_24h":true}'::jsonb ELSE '{}'::jsonb END,
            updated_at = NOW()
        WHERE is_default = TRUE
          AND (
              extra->>'ads_expiry_value'    IS NULL OR
              extra->>'ads_expiry_unit'     IS NULL OR
              extra->>'text_messaging'      IS NULL OR
              extra->>'voice_calls'         IS NULL OR
              extra->>'chat_auto_delete_24h' IS NULL
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
            extra    = '{"write_goog_limit":25,"goog_letter_limit":150,"product_upload_limit":20,"ad_videos":3,"ad_photos":5,"chat_save":0,"free_promo_code":false,"text_messaging":"colors","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":false,"chat_auto_delete_days":7,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            updated_at = NOW()
        WHERE slug = 'package-1' AND extra->>'voice_calls' IS NULL
    `);
    await pool.query(`
        UPDATE subscription_plans SET
            features = '["Verification tick","Write Goog (color) – 50 limit","Write goog (280 letters)","🔻 Product Upload Limit – 30","5 Videos (ads) save","10 Photos (ads) save","Chat features","Text messaging (colors, stickers)","Voice calls","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 30 days)"]'::jsonb,
            extra    = '{"write_goog_limit":50,"goog_letter_limit":280,"product_upload_limit":30,"ad_videos":5,"ad_photos":10,"chat_save":0,"free_promo_code":false,"text_messaging":"colors,stickers","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":false,"chat_auto_delete_days":30,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            updated_at = NOW()
        WHERE slug = 'package-2' AND extra->>'voice_calls' IS NULL
    `);
    await pool.query(`
        UPDATE subscription_plans SET
            features = '["Verification tick","Write Goog (color) – 100 limit","Write goog (500 letters)","🔻 Product Upload Limit – 50","10 Videos (ads) save","20 Photos (ads) save","Free ad promo code (profile)","Chat features","Text messaging (colors, stickers)","Voice calls","Video calls (240p / 360p limited quality)","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 60 days)"]'::jsonb,
            extra    = '{"write_goog_limit":100,"goog_letter_limit":500,"product_upload_limit":50,"ad_videos":10,"ad_photos":20,"chat_save":0,"free_promo_code":true,"text_messaging":"colors,stickers","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":true,"chat_auto_delete_days":60,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
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
            '{"write_goog_limit":25,"goog_letter_limit":150,"product_upload_limit":20,"ad_videos":3,"ad_photos":5,"chat_save":0,"free_promo_code":false,"text_messaging":"colors","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":false,"chat_auto_delete_days":7,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            TRUE, FALSE, FALSE, 1
        ),
        (
            'package-2', 'Package 2', 499, 30, 'blue', 'blue', 50, TRUE,
            '["Verification tick","Write Goog (color) – 50 limit","Write goog (280 letters)","🔻 Product Upload Limit – 30","5 Videos (ads) save","10 Photos (ads) save","Chat features","Text messaging (colors, stickers)","Voice calls","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 30 days)"]'::jsonb,
            '{"write_goog_limit":50,"goog_letter_limit":280,"product_upload_limit":30,"ad_videos":5,"ad_photos":10,"chat_save":0,"free_promo_code":false,"text_messaging":"colors,stickers","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":false,"chat_auto_delete_days":30,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
            TRUE, FALSE, FALSE, 2
        ),
        (
            'package-3', 'Package 3', 999, 30, 'gold', 'amber', 100, TRUE,
            '["Verification tick","Write Goog (color) – 100 limit","Write goog (500 letters)","🔻 Product Upload Limit – 50","10 Videos (ads) save","20 Photos (ads) save","Free ad promo code (profile)","Chat features","Text messaging (colors, stickers)","Voice calls","Video calls (240p / 360p limited quality)","Voice notes to text conversion","Text to voice note conversion","Chat auto-delete (customizable up to 60 days)"]'::jsonb,
            '{"write_goog_limit":100,"goog_letter_limit":500,"product_upload_limit":50,"ad_videos":10,"ad_photos":20,"chat_save":0,"free_promo_code":true,"text_messaging":"colors,stickers","voice_calls":true,"voice_notes_to_text":true,"text_to_voice_note":true,"video_calls":true,"chat_auto_delete_days":60,"labels":{"write_goog_limit":"Write Goog (color)","product_upload_limit":"🔻 Product Upload Limit"}}'::jsonb,
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
             '{"write_goog_limit":5,"product_upload_limit":15,"goog_letter_limit":75,"ads_expiry_value":30,"ads_expiry_unit":"days","text_messaging":true,"voice_calls":true,"chat_auto_delete_24h":true}'::jsonb,
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

        const expiryValue = req.body.extra?.ads_expiry_value;
        const expiryUnit = req.body.extra?.ads_expiry_unit;
        if (expiryValue !== undefined || expiryUnit !== undefined) {
            const currentExpiry = getExpiryFromPlan(rows[0]);
            await syncSharedAdExpiry(currentExpiry.value, currentExpiry.unit);
        }

        const refreshed = await pool.query('SELECT * FROM subscription_plans WHERE id = $1', [id]);
        res.json({ data: normalizePlanRows(refreshed.rows)[0], message: 'Plan updated' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'A plan with this slug already exists' });
        res.status(500).json({ message: err.message });
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

module.exports = { getAll, getPublic, create, update, remove, seedBasic };
