const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// Middleware to verify JWT token
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const jwt = require('jsonwebtoken');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Create table if not exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monthly_reports (
      id              SERIAL PRIMARY KEY,
      month           INTEGER NOT NULL,
      year            INTEGER NOT NULL,
      month_label     VARCHAR(20),
      uploaded_at     TIMESTAMP DEFAULT NOW(),
      uploaded_by     INTEGER,
      working_days    INTEGER,
      total_days      INTEGER,
      total_employees INTEGER,
      total_pp        INTEGER,
      avg_att         DECIMAL(5,2),
      zero_count      INTEGER,
      late_count      INTEGER,
      hd_count        INTEGER,
      mis_count       INTEGER,
      holiday_days    JSONB DEFAULT '[]'::jsonb,
      dept_summary    JSONB DEFAULT '[]'::jsonb,
      employees_data  JSONB DEFAULT '[]'::jsonb,
      UNIQUE(month, year)
    )
  `);
}
ensureTable().catch(console.error);

// POST /api/reports — save or overwrite a monthly report
router.post('/', auth, async (req, res) => {
  try {
    const {
      month, year, monthLabel, workingDays, totalDays,
      totalEmployees, totalPP, avgAtt, zeroCount,
      lateCount, hdCount, misCount,
      holidayDays, deptSummary, employeesData
    } = req.body;

    const result = await pool.query(`
      INSERT INTO monthly_reports
        (month, year, month_label, working_days, total_days,
         total_employees, total_pp, avg_att, zero_count,
         late_count, hd_count, mis_count,
         holiday_days, dept_summary, employees_data, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (month, year) DO UPDATE SET
        month_label=EXCLUDED.month_label, working_days=EXCLUDED.working_days,
        total_days=EXCLUDED.total_days, total_employees=EXCLUDED.total_employees,
        total_pp=EXCLUDED.total_pp, avg_att=EXCLUDED.avg_att,
        zero_count=EXCLUDED.zero_count, late_count=EXCLUDED.late_count,
        hd_count=EXCLUDED.hd_count, mis_count=EXCLUDED.mis_count,
        holiday_days=EXCLUDED.holiday_days, dept_summary=EXCLUDED.dept_summary,
        employees_data=EXCLUDED.employees_data, uploaded_at=NOW()
      RETURNING id, month, year, month_label, uploaded_at
    `, [
      month, year, monthLabel, workingDays, totalDays,
      totalEmployees, totalPP, avgAtt, zeroCount,
      lateCount, hdCount, misCount,
      JSON.stringify(holidayDays||[]),
      JSON.stringify(deptSummary||[]),
      JSON.stringify(employeesData||[]),
      req.user?.id || null
    ]);

    res.json({ message: 'Report saved!', report: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error saving report', error: err.message });
  }
});

// GET /api/reports — all reports summary
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, month, year, month_label, uploaded_at,
             working_days, total_employees, total_pp,
             avg_att, zero_count, late_count, hd_count, mis_count,
             holiday_days, dept_summary
      FROM monthly_reports ORDER BY year DESC, month DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reports', error: err.message });
  }
});

// GET /api/reports/year/:year — year summary
router.get('/year/:year', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT month, month_label, working_days, total_employees,
              total_pp, avg_att, zero_count, late_count, dept_summary
       FROM monthly_reports WHERE year=$1 ORDER BY month ASC`,
      [req.params.year]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// GET /api/reports/:id — single full report
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM monthly_reports WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM monthly_reports WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

module.exports = router;
