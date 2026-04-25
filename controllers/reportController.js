const pool = require('../db');

// Save a monthly report
const saveReport = async (req, res) => {
  try {
    const {
      month, year, monthLabel, workingDays, totalDays,
      totalEmployees, totalPP, avgAtt, zeroCount,
      lateCount, hdCount, misCount,
      holidayDays, deptSummary, employeesData
    } = req.body;

    if (month === undefined || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    // Upsert — if month/year exists, overwrite it
    const result = await pool.query(`
      INSERT INTO monthly_reports
        (month, year, month_label, working_days, total_days,
         total_employees, total_pp, avg_att, zero_count,
         late_count, hd_count, mis_count,
         holiday_days, dept_summary, employees_data, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (month, year)
      DO UPDATE SET
        month_label     = EXCLUDED.month_label,
        working_days    = EXCLUDED.working_days,
        total_days      = EXCLUDED.total_days,
        total_employees = EXCLUDED.total_employees,
        total_pp        = EXCLUDED.total_pp,
        avg_att         = EXCLUDED.avg_att,
        zero_count      = EXCLUDED.zero_count,
        late_count      = EXCLUDED.late_count,
        hd_count        = EXCLUDED.hd_count,
        mis_count       = EXCLUDED.mis_count,
        holiday_days    = EXCLUDED.holiday_days,
        dept_summary    = EXCLUDED.dept_summary,
        employees_data  = EXCLUDED.employees_data,
        uploaded_at     = NOW(),
        uploaded_by     = EXCLUDED.uploaded_by
      RETURNING id, month, year, month_label, uploaded_at
    `, [
      month, year, monthLabel, workingDays, totalDays,
      totalEmployees, totalPP, avgAtt, zeroCount,
      lateCount, hdCount, misCount,
      JSON.stringify(holidayDays || []),
      JSON.stringify(deptSummary  || []),
      JSON.stringify(employeesData || []),
      req.user?.id || null
    ]);

    res.json({ message: 'Report saved!', report: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error saving report', error: err.message });
  }
};

// Get all reports (summary list)
const getAllReports = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, month, year, month_label, uploaded_at,
             working_days, total_employees, total_pp,
             avg_att, zero_count, late_count, hd_count, mis_count,
             holiday_days, dept_summary
      FROM monthly_reports
      ORDER BY year DESC, month DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reports', error: err.message });
  }
};

// Get one full report by id
const getReport = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM monthly_reports WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Report not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching report', error: err.message });
  }
};

// Get report by month+year
const getReportByMonth = async (req, res) => {
  try {
    const { month, year } = req.params;
    const result = await pool.query(
      'SELECT * FROM monthly_reports WHERE month=$1 AND year=$2',
      [month, year]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Report not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching report', error: err.message });
  }
};

// Delete a report
const deleteReport = async (req, res) => {
  try {
    await pool.query('DELETE FROM monthly_reports WHERE id=$1', [req.params.id]);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting report', error: err.message });
  }
};

// Year summary — 12-month overview
const getYearSummary = async (req, res) => {
  try {
    const { year } = req.params;
    const result = await pool.query(`
      SELECT month, month_label, working_days, total_employees,
             total_pp, avg_att, zero_count, late_count, dept_summary
      FROM monthly_reports
      WHERE year = $1
      ORDER BY month ASC
    `, [year]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching year summary', error: err.message });
  }
};

module.exports = { saveReport, getAllReports, getReport, getReportByMonth, deleteReport, getYearSummary };
