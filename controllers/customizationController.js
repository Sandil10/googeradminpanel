const pool = require('../config/database');

let schemaReady = null;

const DEFAULT_SETTINGS = {
    google_commission_percent: 0,
    referral_multiplier: 1.5,
    ad_click_commission: 0.05,
    pre_ad_commission: 2,
    general_category_commission: 10,
    manual_category_commission_enabled: 0,
};

const LEGACY_LEVEL1_CATEGORY_RENAMES = {
    FASHION1: 'Fashion',
    Food: 'Food & Beverages',
    Parfums: 'Perfumes',
    'xdax axa': 'Electronics',
};

const normalizeName = (value) => String(value || '').trim();
const parseLevel = (value) => {
    const level = Number.parseInt(value, 10);
    return [1, 2, 3].includes(level) ? level : null;
};

const parseCommission = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const appendCategoryNode = (rootMap, level1Name, level2Name, level3Name) => {
    if (!level1Name) return;

    if (!rootMap.has(level1Name)) {
        rootMap.set(level1Name, {
            name: level1Name,
            level: 1,
            parent_id: null,
            commission_percent: 0,
            children: new Map(),
        });
    }

    const level1Node = rootMap.get(level1Name);
    if (!level2Name) return;

    if (!level1Node.children.has(level2Name)) {
        level1Node.children.set(level2Name, {
            name: level2Name,
            level: 2,
            parent_id: null,
            commission_percent: 0,
            children: new Map(),
        });
    }

    const level2Node = level1Node.children.get(level2Name);
    if (!level3Name) return;

    if (!level2Node.children.has(level3Name)) {
        level2Node.children.set(level3Name, {
            name: level3Name,
            level: 3,
            parent_id: null,
            commission_percent: 0,
            children: new Map(),
        });
    }
};

const mapToTree = (map) => {
    let nextId = -1;
    const convert = (node, parentId = null) => {
        const id = nextId--;
        const children = Array.from(node.children.values())
            .sort((left, right) => String(left.name).localeCompare(String(right.name)))
            .map((child) => convert(child, id));

        return {
            id,
            name: node.name,
            level: node.level,
            parent_id: parentId,
            commission_percent: node.commission_percent ?? 0,
            children,
        };
    };

    return Array.from(map.values())
        .sort((left, right) => String(left.name).localeCompare(String(right.name)))
        .map((node) => convert(node));
};

const renameLevel1Category = async (client, oldName, newName) => {
    const legacyResult = await client.query(
        'SELECT id FROM category_nodes WHERE level = 1 AND LOWER(name) = LOWER($1) ORDER BY id',
        [oldName]
    );

    if (legacyResult.rows.length === 0) {
        await client.query(
            `UPDATE market
             SET category = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE LOWER(category) = LOWER($2)`,
            [newName, oldName]
        );
        return;
    }

    const targetResult = await client.query(
        'SELECT id FROM category_nodes WHERE level = 1 AND LOWER(name) = LOWER($1) LIMIT 1',
        [newName]
    );

    const targetId = targetResult.rows[0]?.id || legacyResult.rows[0].id;

    if (!targetResult.rows[0]) {
        await client.query(
            `UPDATE category_nodes
             SET name = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [newName, targetId]
        );
    }

    for (const row of legacyResult.rows) {
        if (row.id === targetId) continue;

        await client.query(
            `UPDATE category_nodes
             SET parent_id = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE parent_id = $2`,
            [targetId, row.id]
        );

        await client.query('DELETE FROM category_nodes WHERE id = $1', [row.id]);
    }

    await client.query(
        `UPDATE market
         SET category = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE LOWER(category) = LOWER($2)`,
        [newName, oldName]
    );
};

const migrateLegacyCategoryNames = async (client) => {
    for (const [oldName, newName] of Object.entries(LEGACY_LEVEL1_CATEGORY_RENAMES)) {
        await renameLevel1Category(client, oldName, newName);
    }
};

const ensureSchema = async () => {
    if (!schemaReady) {
        schemaReady = (async () => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                await client.query(`
                    CREATE TABLE IF NOT EXISTS category_nodes (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(120) NOT NULL,
                        level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
                        parent_id INTEGER REFERENCES category_nodes(id) ON DELETE RESTRICT,
                        commission_percent NUMERIC(10, 2) NOT NULL DEFAULT 0,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS managed_categories (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(120) NOT NULL,
                        parent_id INTEGER REFERENCES managed_categories(id) ON DELETE RESTRICT,
                        level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
                        commission_percentage NUMERIC(10, 2) NOT NULL DEFAULT 0,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        is_active BOOLEAN NOT NULL DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                await client.query(`
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_managed_categories_active_level_name
                    ON managed_categories (level, COALESCE(parent_id, 0), LOWER(name))
                    WHERE is_active = true
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_managed_categories_parent_active
                    ON managed_categories (parent_id)
                    WHERE is_active = true
                `);

                await client.query(`
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_category_nodes_level_name
                    ON category_nodes (level, LOWER(name))
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_category_nodes_parent
                    ON category_nodes (parent_id)
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS commission_settings (
                        setting_key VARCHAR(80) PRIMARY KEY,
                        setting_value NUMERIC(12, 4) NOT NULL DEFAULT 0,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS ad_coin_collections (
                        id SERIAL PRIMARY KEY,
                        ad_id VARCHAR(120) NOT NULL,
                        ad_type VARCHAR(80) NOT NULL,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (ad_id, ad_type, user_id)
                    )
                `);

                const categoryCount = await client.query('SELECT COUNT(*)::int AS count FROM category_nodes');
                if (Number(categoryCount.rows[0]?.count || 0) === 0) {
                    const marketRows = await client.query(`
                        SELECT DISTINCT category, sub_category, level3_category
                        FROM market
                        WHERE COALESCE(NULLIF(TRIM(category), ''), NULL) IS NOT NULL
                    `);

                    const level1Map = new Map();
                    const level2Map = new Map();

                    for (const row of marketRows.rows) {
                        const level1Name = normalizeName(row.category);
                        const level2Name = normalizeName(row.sub_category);
                        const level3Name = normalizeName(row.level3_category);

                        if (!level1Name) continue;

                        if (!level1Map.has(level1Name)) {
                            const insertedLevel1 = await client.query(
                                `INSERT INTO category_nodes (name, level, parent_id, commission_percent)
                                 VALUES ($1, 1, NULL, 0)
                                 ON CONFLICT (level, LOWER(name)) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                                 RETURNING id, name`,
                                [level1Name]
                            );
                            const id = insertedLevel1.rows[0]?.id || (await client.query('SELECT id FROM category_nodes WHERE level = 1 AND LOWER(name) = LOWER($1) LIMIT 1', [level1Name])).rows[0]?.id;
                            if (id) level1Map.set(level1Name, id);
                        }

                        const level1Id = level1Map.get(level1Name);
                        if (!level1Id || !level2Name) continue;

                        const level2Key = `${level1Id}:${level2Name}`;
                        if (!level2Map.has(level2Key)) {
                            const insertedLevel2 = await client.query(
                                `INSERT INTO category_nodes (name, level, parent_id, commission_percent)
                                 VALUES ($1, 2, $2, 0)
                                 ON CONFLICT (level, LOWER(name)) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                                 RETURNING id, name`,
                                [level2Name, level1Id]
                            );
                            const id = insertedLevel2.rows[0]?.id || (await client.query('SELECT id FROM category_nodes WHERE level = 2 AND LOWER(name) = LOWER($1) LIMIT 1', [level2Name])).rows[0]?.id;
                            if (id) level2Map.set(level2Key, id);
                        }

                        const level2Id = level2Map.get(level2Key);
                        if (!level2Id || !level3Name) continue;

                        await client.query(
                            `INSERT INTO category_nodes (name, level, parent_id, commission_percent)
                             VALUES ($1, 3, $2, 0)
                             ON CONFLICT (level, LOWER(name)) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
                            [level3Name, level2Id]
                        );
                    }
                }

                await migrateLegacyCategoryNames(client);

                for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
                    await client.query(
                        `INSERT INTO commission_settings (setting_key, setting_value)
                         VALUES ($1, $2)
                         ON CONFLICT (setting_key) DO NOTHING`,
                        [key, value]
                    );
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                schemaReady = null;
                throw error;
            } finally {
                client.release();
            }
        })();
    }

    return schemaReady;
};

const buildTree = (rows) => {
    const byId = new Map();
    const roots = [];

    for (const row of rows) {
        byId.set(row.id, { ...row, children: [] });
    }

    for (const node of byId.values()) {
        if (node.parent_id && byId.has(node.parent_id)) {
            byId.get(node.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    }

    const sortNodes = (items) => {
        items.sort((left, right) => {
            const orderDelta = Number(left.sort_order || 0) - Number(right.sort_order || 0);
            if (orderDelta !== 0) return orderDelta;
            return String(left.name || '').localeCompare(String(right.name || ''));
        });
        items.forEach((item) => sortNodes(item.children));
    };

    sortNodes(roots);
    return roots;
};

const loadLiveMarketCategories = async () => {
    const result = await pool.query(`
        SELECT category, sub_category, level3_category
        FROM market
        WHERE COALESCE(NULLIF(TRIM(category), ''), NULL) IS NOT NULL
    `);

    const rootMap = new Map();
    for (const row of result.rows) {
        const level1Name = normalizeName(row.category);
        const level2Name = normalizeName(row.sub_category);
        const level3Name = normalizeName(row.level3_category);
        appendCategoryNode(rootMap, level1Name, level2Name, level3Name);
    }

    const categories = mapToTree(rootMap);
    const flatCategories = buildTree(
        categories.flatMap((level1) => [
            level1,
            ...(level1.children || []).flatMap((level2) => [level2, ...(level2.children || [])]),
        ])
    );

    return {
        categories,
        flatCategories,
    };
};

const loadCategories = async () => {
    await ensureSchema();
    const result = await pool.query(`
        SELECT id,
               name,
               level,
               parent_id,
               commission_percentage AS commission_percent,
               sort_order,
               created_at,
               updated_at
        FROM managed_categories
        WHERE is_active = true
        ORDER BY level, sort_order, name, id
    `);

    return {
        flatCategories: result.rows,
        categories: buildTree(result.rows),
    };
};

const loadCommissionSettings = async () => {
    await ensureSchema();
    const result = await pool.query(`SELECT setting_key, setting_value FROM commission_settings`);
    const settings = { ...DEFAULT_SETTINGS };

    for (const row of result.rows) {
        settings[row.setting_key] = Number(row.setting_value);
    }

    return {
        googleCommission: Number(settings.google_commission_percent || 0),
        referralMultiplier: Number(settings.referral_multiplier || 0),
        adClickCommission: Number(settings.ad_click_commission || 0),
        preAdCommission: Number(settings.pre_ad_commission || 0),
        generalCategoryCommission: Number(settings.general_category_commission || 0),
        manualCategoryCommissionEnabled: Number(settings.manual_category_commission_enabled || 0) === 1,
    };
};

exports.getPublicCategoryTree = async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const { categories } = await loadCategories();
        res.status(200).json({ success: true, categories });
    } catch (error) {
        console.error('Get public categories error:', error);
        res.status(500).json({ success: false, message: 'Failed to load categories' });
    }
};

const buildCustomizationOverview = async () => {
    const [managedPayload, livePayload, commissionPayload] = await Promise.all([
        loadCategories(),
        loadLiveMarketCategories(),
        loadCommissionSettings(),
    ]);

    return {
        categories: managedPayload.categories,
        flatCategories: managedPayload.flatCategories,
        liveCategories: livePayload.categories,
        liveFlatCategories: livePayload.flatCategories,
        commissions: commissionPayload,
    };
};

exports.getCustomizationOverview = async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(200).json({ success: true, ...(await buildCustomizationOverview()) });
    } catch (error) {
        console.error('Get customization overview error:', error);
        res.status(500).json({ success: false, message: 'Failed to load customization data' });
    }
};

exports.getPublicCustomizationOverview = async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(200).json({ success: true, ...(await buildCustomizationOverview()) });
    } catch (error) {
        console.error('Get public customization overview error:', error);
        res.status(500).json({ success: false, message: 'Failed to load customization data' });
    }
};

exports.createCategory = async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSchema();
        const { level, name, parentId, commissionPercent } = req.body;
        const levelNumber = parseLevel(level);
        const trimmedName = normalizeName(name);
        const commissionValue = parseCommission(commissionPercent);

        if (!levelNumber || !trimmedName) {
            return res.status(400).json({ success: false, message: 'Level and category name are required' });
        }

        await client.query('BEGIN');

        let parentRow = null;
        if (levelNumber > 1) {
            if (!parentId) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Parent category is required' });
            }

            const parentResult = await client.query(
                'SELECT id, level FROM managed_categories WHERE id = $1 AND is_active = true LIMIT 1',
                [parentId]
            );

            parentRow = parentResult.rows[0];
            if (!parentRow || Number(parentRow.level) !== levelNumber - 1) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Parent category level is invalid' });
            }
        }

        const duplicateResult = await client.query(
            `SELECT id
             FROM managed_categories
             WHERE level = $1
               AND LOWER(name) = LOWER($2)
               AND is_active = true
             LIMIT 1`,
            [levelNumber, trimmedName]
        );

        if (duplicateResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'That category name already exists for this level' });
        }

        const insertResult = await client.query(
            `INSERT INTO managed_categories (name, level, parent_id, commission_percentage, is_active)
             VALUES ($1, $2, $3, $4, true)
             RETURNING id,
                       name,
                       level,
                       parent_id,
                       commission_percentage AS commission_percent,
                       sort_order,
                       created_at,
                       updated_at`,
            [trimmedName, levelNumber, levelNumber === 1 ? null : parentId, commissionValue]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, category: insertResult.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'That category name already exists for this level' });
        }
        console.error('Create category error:', error);
        res.status(500).json({ success: false, message: 'Failed to create category' });
    } finally {
        client.release();
    }
};

exports.updateCategory = async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSchema();
        const { id } = req.params;
        const { name, parentId, commissionPercent } = req.body;

        await client.query('BEGIN');

        const categoryResult = await client.query(
            `SELECT id, name, level, parent_id, commission_percentage AS commission_percent
             FROM managed_categories
             WHERE id = $1
               AND is_active = true
             LIMIT 1
             FOR UPDATE`,
            [id]
        );

        const currentCategory = categoryResult.rows[0];
        if (!currentCategory) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const nextName = normalizeName(name) || currentCategory.name;
        const nextCommission = commissionPercent === undefined ? currentCategory.commission_percent : parseCommission(commissionPercent);
        let nextParentId = currentCategory.parent_id;

        if (parentId !== undefined) {
            if (Number(currentCategory.level) === 1 && parentId) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Level 1 categories cannot have a parent' });
            }

            if (Number(currentCategory.level) > 1) {
                const parentResult = await client.query(
                    'SELECT id, level FROM managed_categories WHERE id = $1 AND is_active = true LIMIT 1',
                    [parentId]
                );

                const parentRow = parentResult.rows[0];
                if (!parentRow || Number(parentRow.level) !== Number(currentCategory.level) - 1) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Parent category level is invalid' });
                }
                nextParentId = parentId;
            }
        }

        const duplicateResult = await client.query(
            `SELECT id
             FROM managed_categories
             WHERE level = $1
               AND LOWER(name) = LOWER($2)
               AND id <> $3
               AND is_active = true
             LIMIT 1`,
            [currentCategory.level, nextName, id]
        );

        if (duplicateResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'That category name already exists for this level' });
        }

        const updateResult = await client.query(
            `UPDATE managed_categories
             SET name = $1,
                 parent_id = $2,
                 commission_percentage = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING id,
                       name,
                       level,
                       parent_id,
                       commission_percentage AS commission_percent,
                       sort_order,
                       created_at,
                       updated_at`,
            [nextName, Number(currentCategory.level) === 1 ? null : nextParentId, nextCommission, id]
        );

        if (normalizeName(name) && normalizeName(name) !== currentCategory.name) {
            const marketColumn = Number(currentCategory.level) === 1
                ? 'category'
                : Number(currentCategory.level) === 2
                    ? 'sub_category'
                    : 'level3_category';

            await client.query(
                `UPDATE market
                 SET ${marketColumn} = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE ${marketColumn} = $2`,
                [nextName, currentCategory.name]
            );
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, category: updateResult.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'That category name already exists for this level' });
        }
        console.error('Update category error:', error);
        res.status(500).json({ success: false, message: 'Failed to update category' });
    } finally {
        client.release();
    }
};

exports.deleteCategory = async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSchema();
        const { id } = req.params;

        await client.query('BEGIN');

        const categoryResult = await client.query(
            'SELECT id, name, level, parent_id FROM managed_categories WHERE id = $1 AND is_active = true LIMIT 1 FOR UPDATE',
            [id]
        );

        const category = categoryResult.rows[0];
        if (!category) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const childResult = await client.query(
            'SELECT COUNT(*)::int AS count FROM managed_categories WHERE parent_id = $1 AND is_active = true',
            [id]
        );

        if (Number(childResult.rows[0]?.count || 0) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Delete child categories first' });
        }

        const marketColumn = Number(category.level) === 1
            ? 'category'
            : Number(category.level) === 2
                ? 'sub_category'
                : 'level3_category';

        const usageResult = await client.query(
            `SELECT COUNT(*)::int AS count FROM market WHERE ${marketColumn} = $1`,
            [category.name]
        );

        if (Number(usageResult.rows[0]?.count || 0) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'This category is already used by products. Reassign or clear those products first.',
            });
        }

        await client.query(
            `UPDATE managed_categories
             SET is_active = false,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [id]
        );
        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete category error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    } finally {
        client.release();
    }
};

exports.getCommissionSettings = async (req, res) => {
    try {
        const settings = await loadCommissionSettings();
        res.status(200).json({ success: true, commissions: settings });
    } catch (error) {
        console.error('Get commission settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to load commission settings' });
    }
};

exports.updateGoogleCommission = async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSchema();
        const value = parseCommission(req.body?.value);

        await client.query(
            `INSERT INTO commission_settings (setting_key, setting_value, updated_at)
             VALUES ('google_commission_percent', $1, CURRENT_TIMESTAMP)
             ON CONFLICT (setting_key)
             DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP`,
            [value]
        );

        res.status(200).json({ success: true, googleCommission: value });
    } catch (error) {
        console.error('Update google commission error:', error);
        res.status(500).json({ success: false, message: 'Failed to update Google commission' });
    } finally {
        client.release();
    }
};

exports.resetGoogleCommission = async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSchema();
        await client.query(
            `INSERT INTO commission_settings (setting_key, setting_value, updated_at)
             VALUES ('google_commission_percent', 0, CURRENT_TIMESTAMP)
             ON CONFLICT (setting_key)
             DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP`
        );
        res.status(200).json({ success: true, googleCommission: 0 });
    } catch (error) {
        console.error('Reset google commission error:', error);
        res.status(500).json({ success: false, message: 'Failed to reset Google commission' });
    } finally {
        client.release();
    }
};

exports.updateAdCommission = async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSchema();
        const payload = {
            referral_multiplier: parseCommission(req.body?.referralMultiplier),
            ad_click_commission: parseCommission(req.body?.adClickCommission),
            pre_ad_commission: parseCommission(req.body?.preAdCommission),
            general_category_commission: parseCommission(req.body?.generalCategoryCommission),
            manual_category_commission_enabled: req.body?.manualCategoryCommissionEnabled ? 1 : 0,
        };

        await client.query('BEGIN');
        for (const [key, value] of Object.entries(payload)) {
            await client.query(
                `INSERT INTO commission_settings (setting_key, setting_value, updated_at)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (setting_key)
                 DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP`,
                [key, value]
            );
        }
        await client.query('COMMIT');

        res.status(200).json({ success: true, commissions: await loadCommissionSettings() });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update ad commission error:', error);
        res.status(500).json({ success: false, message: 'Failed to update commission values' });
    } finally {
        client.release();
    }
};

exports.ensureCustomizationSchema = ensureSchema;
