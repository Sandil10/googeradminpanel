const pool = require('../config/database');

function parseVariants(rawVariants) {
    if (!rawVariants) return [];
    if (Array.isArray(rawVariants)) return rawVariants;
    if (typeof rawVariants === 'string') {
        try {
            return JSON.parse(rawVariants);
        } catch {
            return [];
        }
    }
    return [];
}

async function adjustOrderItemStock(client, marketItem, orderLike, direction = 'decrease') {
    const quantity = parseInt(orderLike.quantity || 0, 10);
    if (!quantity) return;

    const delta = direction === 'decrease' ? -quantity : quantity;
    const variants = parseVariants(marketItem.variants);
    const variantIndex = orderLike.variant_index !== undefined && orderLike.variant_index !== null
        ? parseInt(orderLike.variant_index, 10)
        : null;
    const selectedSize = typeof orderLike.size === 'string' ? orderLike.size.trim() : null;
    const normalizedSelectedSize = selectedSize ? selectedSize.toLowerCase() : null;

    let stockAdjusted = false;

    if (variants.length > 0) {
        let targetVariant = null;

        if (variantIndex !== null && !Number.isNaN(variantIndex) && variants[variantIndex]) {
            targetVariant = variants[variantIndex];
        } else if (orderLike.color) {
            targetVariant = variants.find((variant) => variant.color === orderLike.color) || null;
        }

        if (targetVariant?.selections && Array.isArray(targetVariant.selections) && normalizedSelectedSize) {
            const selectionIndex = targetVariant.selections.findIndex((selection) => {
                const selectionValue = typeof selection?.value === 'string' ? selection.value.trim().toLowerCase() : '';
                return selectionValue === normalizedSelectedSize;
            });

            if (selectionIndex !== -1) {
                const currentStock = parseInt(targetVariant.selections[selectionIndex].stock || 0, 10) || 0;
                const nextStock = currentStock + delta;

                if (direction === 'decrease' && nextStock < 0) {
                    throw new Error(`Insufficient stock for ${selectedSize}`);
                }

                targetVariant.selections[selectionIndex].stock = String(Math.max(0, nextStock));
                stockAdjusted = true;
            }
        }

        if (!stockAdjusted && targetVariant) {
            const currentStock = parseInt(targetVariant.stock || targetVariant.quantity || 0, 10) || 0;
            const nextStock = currentStock + delta;

            if (direction === 'decrease' && nextStock < 0) {
                throw new Error('Insufficient stock for this variant');
            }

            targetVariant.stock = String(Math.max(0, nextStock));
            stockAdjusted = true;
        }

        if (!stockAdjusted && normalizedSelectedSize) {
            const legacyVariant = variants.find((variant) => {
                const variantSize = typeof (variant.size || variant.selection) === 'string'
                    ? (variant.size || variant.selection).trim().toLowerCase()
                    : '';
                const sameColor = orderLike.color ? variant.color === orderLike.color : true;

                return variantSize === normalizedSelectedSize && sameColor;
            });

            if (legacyVariant) {
                const currentStock = parseInt(legacyVariant.stock || legacyVariant.quantity || 0, 10) || 0;
                const nextStock = currentStock + delta;

                if (direction === 'decrease' && nextStock < 0) {
                    throw new Error(`Insufficient stock for ${selectedSize}`);
                }

                legacyVariant.stock = String(Math.max(0, nextStock));
                stockAdjusted = true;
            }
        }
    }

    if (variants.length > 0 && stockAdjusted) {
        const totalStock = variants.reduce((sum, variant) => {
            if (Array.isArray(variant?.selections) && variant.selections.length > 0) {
                return sum + variant.selections.reduce((selectionSum, selection) => {
                    return selectionSum + (parseInt(selection?.stock || 0, 10) || 0);
                }, 0);
            }

            return sum + (parseInt(variant?.stock || variant?.quantity || 0, 10) || 0);
        }, 0);

        await client.query(
            'UPDATE market SET variants = $1, stock = $2 WHERE id = $3',
            [JSON.stringify(variants), totalStock, marketItem.id]
        );
        return;
    }

    const currentStock = parseInt(marketItem.stock || 0, 10) || 0;
    const nextStock = currentStock + delta;

    if (direction === 'decrease' && nextStock < 0) {
        throw new Error('Insufficient overall stock');
    }

    await client.query('UPDATE market SET stock = $1 WHERE id = $2', [Math.max(0, nextStock), marketItem.id]);
}

async function cancelTransferIfUnused(client, transferColumn, transferId, currentOrderId) {
    if (!transferId) return;

    const allowedColumns = new Set([
        'wallet_transfer_id',
        'seller_commission_transfer_id',
        'seller_discount_transfer_id'
    ]);

    if (!allowedColumns.has(transferColumn)) {
        throw new Error(`Unsupported transfer column: ${transferColumn}`);
    }

    const otherActive = await client.query(
        `SELECT 1
         FROM orders
         WHERE ${transferColumn} = $1
           AND id != $2
           AND status NOT IN ('cancelled', 'returned')
         LIMIT 1`,
        [transferId, currentOrderId]
    );

    if (otherActive.rows.length === 0) {
        await client.query("UPDATE wallet_transfers SET status = 'cancelled' WHERE id = $1", [transferId]);
    }
}

async function refundCancelledOrder(client, order) {
    if (order.wallet_transfer_id) {
        const buyerRefundAmount = parseFloat(order.total_price || 0) + parseFloat(order.shipping_fee || 0);
        await client.query(
            'UPDATE users SET hold_balance = hold_balance - $1, wallet_balance = wallet_balance + $1 WHERE id = $2',
            [buyerRefundAmount, order.buyer_id]
        );
        await cancelTransferIfUnused(client, 'wallet_transfer_id', order.wallet_transfer_id, order.id);
    }

    if (order.seller_commission_transfer_id) {
        const commRes = await client.query('SELECT amount FROM wallet_transfers WHERE id = $1', [order.seller_commission_transfer_id]);
        if (commRes.rows.length > 0) {
            const commAmount = parseFloat(commRes.rows[0].amount || 0);
            await client.query(
                'UPDATE users SET hold_balance = hold_balance - $1, wallet_balance = wallet_balance + $1 WHERE id = $2',
                [commAmount, order.seller_id]
            );
            await cancelTransferIfUnused(client, 'seller_commission_transfer_id', order.seller_commission_transfer_id, order.id);
        }
    }

    if (order.seller_discount_transfer_id) {
        const discRes = await client.query('SELECT amount, status FROM wallet_transfers WHERE id = $1', [order.seller_discount_transfer_id]);
        if (discRes.rows.length > 0) {
            const discAmount = parseFloat(discRes.rows[0].amount || 0);
            const discountStatus = String(discRes.rows[0].status || '').toLowerCase();

            if (order.payment_method === 'wallet_manual') {
                await client.query(
                    'UPDATE users SET hold_balance = hold_balance - $1, wallet_balance = wallet_balance + $1 WHERE id = $2',
                    [discAmount, order.seller_id]
                );
            } else if (discountStatus === 'pending') {
                await client.query(
                    'UPDATE users SET hold_balance = hold_balance - $1, wallet_balance = wallet_balance + $1 WHERE id = $2',
                    [discAmount, order.seller_id]
                );
            } else if (order.payment_method !== 'wallet_manual') {
                await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [discAmount, order.seller_id]);
            }

            await cancelTransferIfUnused(client, 'seller_discount_transfer_id', order.seller_discount_transfer_id, order.id);
        }
    }
}

async function finalizeReceivedOrder(client, order) {
    if (order.wallet_transfer_id) {
        const holdTxRes = await client.query('SELECT amount FROM wallet_transfers WHERE id = $1', [order.wallet_transfer_id]);
        const totalReleased = holdTxRes.rows.length > 0
            ? parseFloat(holdTxRes.rows[0].amount || 0)
            : (parseFloat(order.total_price || 0) + parseFloat(order.shipping_fee || 0));

        await client.query('UPDATE users SET hold_balance = hold_balance - $1 WHERE id = $2', [totalReleased, order.buyer_id]);
        await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [totalReleased, order.seller_id]);
        await client.query("UPDATE wallet_transfers SET status = 'completed' WHERE id = $1", [order.wallet_transfer_id]);
    }

    if (order.seller_commission_transfer_id) {
        const commRes = await client.query('SELECT amount FROM wallet_transfers WHERE id = $1', [order.seller_commission_transfer_id]);
        if (commRes.rows.length > 0) {
            const commAmount = parseFloat(commRes.rows[0].amount || 0);
            await client.query('UPDATE users SET hold_balance = hold_balance - $1 WHERE id = $2', [commAmount, order.seller_id]);
            await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = 1', [commAmount]);
            await client.query("UPDATE wallet_transfers SET status = 'completed', receiver_id = 1 WHERE id = $1", [order.seller_commission_transfer_id]);
        }
    }

    if (order.seller_discount_transfer_id) {
        const discRes = await client.query('SELECT amount, status FROM wallet_transfers WHERE id = $1', [order.seller_discount_transfer_id]);
        if (discRes.rows.length > 0) {
            const discAmount = parseFloat(discRes.rows[0].amount || 0);
            const discountStatus = String(discRes.rows[0].status || '').toLowerCase();

            if (order.payment_method === 'wallet_manual') {
                await client.query('UPDATE users SET hold_balance = hold_balance - $1 WHERE id = $2', [discAmount, order.seller_id]);
                if (discountStatus !== 'completed') {
                    await client.query("UPDATE wallet_transfers SET status = 'completed' WHERE id = $1", [order.seller_discount_transfer_id]);
                }
            } else if (discountStatus === 'pending') {
                await client.query("UPDATE wallet_transfers SET status = 'completed' WHERE id = $1", [order.seller_discount_transfer_id]);
            }
        }
    }
}

async function autoReceiveExpiredCodOrders(client) {
    const expiredOrdersRes = await client.query(
        `SELECT *
         FROM orders
         WHERE status = 'delivered'
           AND payment_method = 'cod'
           AND updated_at <= CURRENT_TIMESTAMP - INTERVAL '7 days'
         FOR UPDATE`
    );

    for (const order of expiredOrdersRes.rows) {
        await finalizeReceivedOrder(client, order);
        await client.query(
            `UPDATE orders
             SET status = 'received',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [order.id]
        );
    }
}

async function buildOrdersQuery(status) {
    let query = `
        SELECT
            o.*,
            m.title,
            m.image_url,
            m.category,
            m.price AS listed_price,
            m.promo_price,
            bu.username AS buyer_username,
            bu.full_name AS buyer_name,
            bu.user_id AS buyer_googer_id,
            bu.profile_picture AS buyer_profile_picture,
            su.username AS seller_username,
            su.full_name AS seller_name,
            su.user_id AS seller_googer_id,
            su.profile_picture AS seller_profile_picture
        FROM orders o
        JOIN market m ON o.item_id = m.id
        LEFT JOIN users bu ON o.buyer_id = bu.id
        LEFT JOIN users su ON o.seller_id = su.id
        WHERE 1 = 1
    `;
    const params = [];

    if (status && status !== 'all') {
        params.push(status.split(','));
        query += ` AND o.status = ANY($${params.length})`;
    }

    query += ' ORDER BY o.created_at DESC';
    return { query, params };
}

async function performStatusUpdate(client, order, status, options = {}) {
    const isAdminOverride = options.isAdminOverride === true;

    if (order.status === 'cancelled' && status !== 'cancelled') {
        throw new Error('Cancelled orders cannot be reopened because refund and stock restoration are already processed.');
    }

    if (order.status === 'received' && status !== 'received') {
        throw new Error('Received orders cannot be reopened because funds have already been released.');
    }

    let finalStatus = status;
    let reportStatusToSet = null;

    if (!isAdminOverride) {
        const userId = options.userId;
        const isBuyer = order.buyer_id === userId;
        const isSeller = order.seller_id === userId;

        if (status === 'received' && !isBuyer) {
            throw new Error('Only buyer can confirm receipt');
        }

        if (['processing', 'shipped', 'delivered'].includes(status) && !isSeller) {
            throw new Error('Only seller can update status');
        }

        if (status === 'accepted_report' && !isBuyer) {
            throw new Error('Only buyer can accept a seller report');
        }

        if (status === 'rejected_report') {
            const canRejectBuyerReport = order.report_by === 'buyer' && isSeller;
            const canRejectSellerReport = order.report_by === 'seller' && isBuyer;
            if (!canRejectBuyerReport && !canRejectSellerReport) {
                throw new Error('Not authorized to reject this report');
            }
        }

        if (status === 'reshipped' && !(order.report_by === 'buyer' && isSeller)) {
            throw new Error('Only seller can mark a buyer report as reshipped');
        }

        if (status === 'cancelled') {
            if (isBuyer && order.status !== 'pending') {
                throw new Error('Buyers can only cancel orders that are still pending.');
            }

            if (!isSeller && !isBuyer) {
                throw new Error('Only the buyer (if pending) or the seller can cancel this order.');
            }

            if (['received', 'delivered', 'shipped'].includes(order.status)) {
                throw new Error('Cannot cancel an order that is already shipped, delivered or received.');
            }
        }
    }

    if (status === 'received' && order.status !== 'received') {
        await finalizeReceivedOrder(client, order);
    }

    if (status === 'reshipped') {
        reportStatusToSet = 'reshipped';
        finalStatus = 'reshipped';
    } else if (status === 'rejected_report') {
        reportStatusToSet = 'rejected';
        finalStatus = order.status;
    } else if (status === 'accepted_report') {
        reportStatusToSet = 'accepted';
        finalStatus = order.status;
    }

    if (status === 'cancelled' && order.status !== 'cancelled') {
        await refundCancelledOrder(client, order);
        const marketItemRes = await client.query('SELECT * FROM market WHERE id = $1 FOR UPDATE', [order.item_id]);
        if (marketItemRes.rows.length > 0) {
            await adjustOrderItemStock(client, marketItemRes.rows[0], order, 'increase');
        }
    }

    const updated = await client.query(
        `UPDATE orders
         SET status = $1,
             report_status = COALESCE($2, report_status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [finalStatus, reportStatusToSet, order.id]
    );

    return updated.rows[0];
}

exports.createOrder = async (req, res) => {
    try {
        const { item_id } = req.body;
        const buyer_id = req.user.id;

        const itemResult = await pool.query('SELECT * FROM market WHERE id = $1', [item_id]);
        if (itemResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const item = itemResult.rows[0];
        const seller_id = item.user_id;

        if (buyer_id === seller_id) {
            return res.status(400).json({ success: false, message: 'You cannot buy your own product' });
        }

        const newOrder = await pool.query(
            'INSERT INTO orders (item_id, buyer_id, seller_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [item_id, buyer_id, seller_id, 'pending']
        );

        res.status(201).json({ success: true, data: newOrder.rows[0] });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, message: 'Server error while creating order' });
    }
};

exports.getBuyerOrders = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await autoReceiveExpiredCodOrders(client);
        await client.query('COMMIT');

        const { status } = req.query;
        let query = `
            SELECT
                o.*,
                m.title,
                m.image_url,
                m.category,
                u.username AS seller_username,
                u.profile_picture AS profile_picture
            FROM orders o
            JOIN market m ON o.item_id = m.id
            JOIN users u ON o.seller_id = u.id
            WHERE o.buyer_id = $1
        `;
        const params = [req.user.id];

        if (status) {
            params.push(status.split(','));
            query += ` AND o.status = ANY($${params.length})`;
        }

        query += ' ORDER BY o.created_at DESC';

        const result = await pool.query(query, params);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {}
        console.error('Get buyer orders error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
};

exports.getSellerOrders = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await autoReceiveExpiredCodOrders(client);
        await client.query('COMMIT');

        const { status } = req.query;
        let query = `
            SELECT
                o.*,
                m.title,
                m.image_url,
                m.category,
                bu.username AS buyer_username,
                bu.profile_picture AS profile_picture
            FROM orders o
            JOIN market m ON o.item_id = m.id
            JOIN users bu ON o.buyer_id = bu.id
            WHERE o.seller_id = $1
        `;
        const params = [req.user.id];

        if (status) {
            params.push(status.split(','));
            query += ` AND o.status = ANY($${params.length})`;
        }

        query += ' ORDER BY o.created_at DESC';

        const result = await pool.query(query, params);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {}
        console.error('Get seller orders error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
};

exports.getAllOrders = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await autoReceiveExpiredCodOrders(client);
        await client.query('COMMIT');

        const { status } = req.query;
        const { query, params } = await buildOrdersQuery(status);
        const result = await pool.query(query, params);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {}
        console.error('Get all orders error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch orders' });
    } finally {
        client.release();
    }
};

exports.updateOrderStatus = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body;

        await client.query('BEGIN');

        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const updatedOrder = await performStatusUpdate(client, orderRes.rows[0], status, {
            userId: req.user.id,
            isAdminOverride: false,
        });

        await client.query('COMMIT');
        res.status(200).json({ success: true, data: updatedOrder });
    } catch (error) {
        await client.query('ROLLBACK');
        const message = error?.message || 'Server error';
        const statusCode = message === 'Order not found' ? 404 : 400;
        console.error('Update order status error:', error);
        res.status(statusCode).json({ success: false, message });
    } finally {
        client.release();
    }
};

exports.updateAdminOrderStatus = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body;

        await client.query('BEGIN');

        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const updatedOrder = await performStatusUpdate(client, orderRes.rows[0], status, {
            isAdminOverride: true,
        });

        await client.query('COMMIT');
        res.status(200).json({ success: true, data: updatedOrder });
    } catch (error) {
        await client.query('ROLLBACK');
        const message = error?.message || 'Failed to update order status';
        const statusCode = message === 'Order not found' ? 404 : 400;
        console.error('Admin update order status error:', error);
        res.status(statusCode).json({ success: false, message });
    } finally {
        client.release();
    }
};
