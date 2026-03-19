const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all products
router.get('/all', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT m.*, 
             COALESCE(u.id, m.user_id) as user_id,
             COALESCE(u.user_id, m.owner_user_id) as seller_id,
             COALESCE(u.username, m.username) as username,
             u.full_name
      FROM market m
      LEFT JOIN users u ON (m.user_id = u.id OR m.owner_user_id = u.user_id)
    `;
    let params = [];
    
    if (status) {
      const statusArray = status.split(',');
      query += ' WHERE m.status = ANY($1)';
      params.push(statusArray);
    }
    
    query += ' ORDER BY m.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT m.*, 
             COALESCE(u.id, m.user_id) as user_id,
             COALESCE(u.user_id, m.owner_user_id) as seller_id,
             COALESCE(u.username, m.username) as username,
             u.full_name
      FROM market m
      LEFT JOIN users u ON (m.user_id = u.id OR m.owner_user_id = u.user_id)
      WHERE m.id = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Update product status (Approve, Reject, Activate, Deactivate)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 
    const result = await pool.query(
      'UPDATE market SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM market WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted successfully', product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

module.exports = router;
