const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = require('./db');

const uploadRoute = require('./routes/upload');
const holidayRoute = require('./routes/holiday');
const authRoute = require('./routes/auth');

app.use('/api/upload', uploadRoute);
app.use('/api/reports', require('./routes/reports'));
app.use('/api/holidays', holidayRoute);
app.use('/api/auth', authRoute);

app.get('/', (req, res) => {
  res.json({ message: 'Server running!', status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});