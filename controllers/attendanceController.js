const xlsx = require('xlsx');
const path = require('path');
const pool = require('../db');

const processAttendance = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Get holidays
    const holidaysResult = await pool.query('SELECT holiday_date FROM holidays');
    const holidays = holidaysResult.rows.map(row =>
      new Date(row.holiday_date).toISOString().split('T')[0]
    );

    // Find header row — row with "Employee Code"
    let headerRowIndex = -1;
    let headerRow = [];
    for (let i = 0; i < allRows.length; i++) {
      const rowStr = allRows[i].join('|').toLowerCase();
      if (rowStr.includes('employee code') || rowStr.includes('emp code')) {
        headerRowIndex = i;
        headerRow = allRows[i];
        break;
      }
    }

    if (headerRowIndex === -1) {
      return res.status(400).json({ message: 'Could not find header row' });
    }

    // Find column indexes with fallback
    const findCol = (names) => {
      for (const name of names) {
        const idx = headerRow.findIndex(h =>
          String(h).toLowerCase().includes(name.toLowerCase())
        );
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const empCodeCol = findCol(['employee code', 'emp code']) !== -1
      ? findCol(['employee code', 'emp code']) : 3;
    const empNameCol = findCol(['employee name', 'emp name']) !== -1
      ? findCol(['employee name', 'emp name']) : 1;
    const deptCol = findCol(['department', 'dept']) !== -1
      ? findCol(['department', 'dept']) : 4;

    console.log('Header row index:', headerRowIndex);
    console.log('empCodeCol:', empCodeCol, 'empNameCol:', empNameCol, 'deptCol:', deptCol);

    // Find day columns like 1(Sun), 2(Mon) etc
    const dayColumns = [];
    headerRow.forEach((col, idx) => {
      const match = String(col).match(/^(\d+)\((\w+)\)/);
      if (match) {
        dayColumns.push({
          idx,
          day: parseInt(match[1]),
          dayName: match[2]
        });
      }
    });

    console.log('Day columns found:', dayColumns.length);

    // Get month/year from file content row 0
    let fileMonth = new Date().getMonth();
    let fileYear  = new Date().getFullYear();

    const firstRowContent = String(allRows[0][0] || '').toLowerCase();
    const monthNames = ['january','february','march','april','may','june',
                        'july','august','september','october','november','december'];
    const shortMonths = ['jan','feb','mar','apr','may','jun',
                         'jul','aug','sep','oct','nov','dec'];

    monthNames.forEach((m, i) => {
      if (firstRowContent.includes(m)) fileMonth = i;
    });
    shortMonths.forEach((m, i) => {
      if (firstRowContent.includes(m)) fileMonth = i;
    });

    const yearInContent = firstRowContent.match(/20\d\d/);
    if (yearInContent) fileYear = parseInt(yearInContent[0]);

    console.log('File month:', fileMonth + 1, 'File year:', fileYear);

    // Map status codes
    const mapStatus = (code, dateStr) => {
      const s = String(code || '').trim().toUpperCase();
      if (holidays.includes(dateStr)) return 'Holiday';
      switch(s) {
        case 'P':   return 'Present';
        case 'A':   return 'Absent';
        case 'WO':  return 'Weekly Off';
        case 'WOP': return 'Weekly Off Present';
        case 'HD':  return 'Half Day';
        case 'LC':  return 'Late';
        case 'ED':  return 'Early Leave';
        case 'MIS': return 'Mis-punch';
        case 'L':   return 'Leave';
        case 'SL':  return 'Sick Leave';
        case 'CL':  return 'Casual Leave';
        case 'PL':  return 'Paid Leave';
        default:
          if (s === '') return 'Absent';
          return s;
      }
    };

    let inserted = 0;
    let skipped  = 0;
    let i = headerRowIndex + 1;

    while (i < allRows.length) {
      const row = allRows[i];

      if (!row || row.every(c => c === '' || c === null || c === '-')) {
        i++;
        continue;
      }

      const empCode = String(row[empCodeCol] || '').trim();

      // Skip invalid rows
      if (!empCode ||
          empCode === '-' ||
          empCode.toLowerCase() === 'shift name' ||
          empCode.toLowerCase() === 'in' ||
          empCode.toLowerCase() === 'out' ||
          empCode.toLowerCase() === 'dur.' ||
          empCode.toLowerCase() === 'ot.' ||
          empCode.toLowerCase() === 'status' ||
          empCode.toLowerCase() === 'employee code' ||
          empCode.toLowerCase() === 'employee name' ||
          !empCode.match(/[A-Z0-9]/i)) {
        i++;
        continue;
      }

      const name       = String(row[empNameCol] || '').trim();
      const department = String(row[deptCol]    || 'General').trim();

      // Sub-rows:
      // i+0 = Shift Name
      // i+1 = IN time
      // i+2 = OUT time
      // i+3 = DUR
      // i+4 = OT
      // i+5 = STATUS
      const inRow     = allRows[i + 1] || [];
      const outRow    = allRows[i + 2] || [];
      const statusRow = allRows[i + 5] || [];

      console.log(`Processing: ${empCode} - ${name}`);

      for (const dayCol of dayColumns) {
        const colIdx  = dayCol.idx;
        const day     = dayCol.day;

        const dateStr = `${fileYear}-${String(fileMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

        const rawStatus = statusRow[colIdx];
        const status    = mapStatus(rawStatus, dateStr);

        let punch_in  = null;
        let punch_out = null;

        const inVal  = String(inRow[colIdx]  || '').trim();
        const outVal = String(outRow[colIdx] || '').trim();

        if (inVal && inVal !== '-' && inVal !== '') {
          punch_in = inVal.substring(0, 5);
        }
        if (outVal && outVal !== '-' && outVal !== '') {
          punch_out = outVal.substring(0, 5);
        }

        try {
          await pool.query(
            `INSERT INTO attendance
              (employee_id, name, date, punch_in, punch_out, status, department)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [empCode, name, dateStr, punch_in, punch_out, status, department]
          );
          inserted++;
        } catch (err) {
          skipped++;
        }
      }

      i += 6;
    }

    res.json({
      message: 'Attendance processed successfully!',
      inserted,
      skipped
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      message: 'Error processing file',
      error: error.message
    });
  }
};

module.exports = { processAttendance };