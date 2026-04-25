const pool = require('../db');

const getDashboard = async (req, res) => {
  try {
    // Total employees
    const totalResult = await pool.query(
      'SELECT COUNT(DISTINCT employee_id) as total FROM attendance'
    );

    // Status counts for today
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM attendance 
      WHERE date = CURRENT_DATE
      GROUP BY status
    `);

    // Department wise summary
    const deptResult = await pool.query(`
      SELECT 
        department,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) as half_day,
        SUM(CASE WHEN status = 'Early Leave' THEN 1 ELSE 0 END) as early_leave,
        SUM(CASE WHEN status = 'Late + Early Leave' THEN 1 ELSE 0 END) as late_early_leave
      FROM attendance
      WHERE date = CURRENT_DATE
      GROUP BY department
      ORDER BY department
    `);

    // All attendance records
    const recordsResult = await pool.query(
      'SELECT * FROM attendance ORDER BY date DESC, name ASC'
    );

    // Build status summary
    const statusSummary = {};
    statusResult.rows.forEach(row => {
      statusSummary[row.status.toLowerCase().replace(/ /g, '_')] = parseInt(row.count);
    });

    res.json({
      summary: {
        total_employees: parseInt(totalResult.rows[0].total),
        ...statusSummary
      },
      department_wise: deptResult.rows,
      records: recordsResult.rows
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error fetching dashboard', error: error.message });
  }
};

module.exports = { getDashboard };