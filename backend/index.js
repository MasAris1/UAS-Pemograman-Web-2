// backend/index.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send('Backend Server is Running!');
});

app.get('/api/hello', (req, res) => {
    res.json({ message: 'Halo dari Express.js Backend!' });
});

app.listen(PORT, () => {
    console.log(`Backend berjalan di port ${PORT}`);
});