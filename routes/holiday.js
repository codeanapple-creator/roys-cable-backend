const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all holidays
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM holidays ORDER BY holiday_date ASC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching holidays', error: error.message });
  }
});

// Add a holiday
router.post('/', async (req, res) => {
  try {
    const { holiday_date, holiday_name } = req.body;
    const result = await pool.query(
      'INSERT INTO holidays (holiday_date, holiday_name) VALUES ($1, $2) RETURNING *',
      [holiday_date, holiday_name]
    );
    res.json({ message: 'Holiday added!', holiday: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error adding holiday', error: error.message });
  }
});

// Delete a holiday
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM holidays WHERE id = $1', [req.params.id]);
    res.json({ message: 'Holiday deleted!' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting holiday', error: error.message });
  }
});

module.exports = router;