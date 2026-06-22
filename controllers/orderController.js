const pool = require('../config/database');
const { adjustOrderItemStock, parseVariants } = require('../../shared/utils/orderStockHelpers');
const { cancelTransferIfUnused } = require('../../shared/utils/orderTransferHelpers');
const { refundCancelledOrder } = require('../../shared/utils/orderRefundHelpers');
const { finalizeReceivedOrder } = require('../../shared/utils/orderSettlementHelpers');
const { autoReceiveExpiredCodOrders } = require('../../shared/utils/orderAutoReceiveHelpers');

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
        await finalizeReceivedOrder(client, order, {
            adminGoogerUserId: 1,
        });
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
        await refundCancelledOrder(client, order, {
            allowedTransferColumns: [
                'wallet_transfer_id',
                'seller_commission_transfer_id',
                'seller_discount_transfer_id',
            ],
        });
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
        await autoReceiveExpiredCodOrders(client, {
            ageInterval: '7 days',
            finalizeReceivedOrder,
            finalizeOptions: {
                adminGoogerUserId: 1,
            },
        });
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
        await autoReceiveExpiredCodOrders(client, {
            ageInterval: '7 days',
            finalizeReceivedOrder,
            finalizeOptions: {
                adminGoogerUserId: 1,
            },
        });
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
        await autoReceiveExpiredCodOrders(client, {
            ageInterval: '7 days',
            finalizeReceivedOrder,
            finalizeOptions: {
                adminGoogerUserId: 1,
            },
        });
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
