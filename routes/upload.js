const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { processAttendance } = require('../controllers/attendanceController');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.mimetype === 'text/csv'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel and CSV files allowed!'), false);
  }
};

const upload = multer({ storage, fileFilter });

router.post('/', upload.single('file'), processAttendance);

module.exports = router;