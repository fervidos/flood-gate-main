const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const scraper = require('./scraper');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Use the specific authenticated proxy requested
const proxies = [
    'http://cannabass:LdreuNbxxdjR_8863Y@dc.decodo.com:10000'
];

console.log(`Loaded ${proxies.length} proxy (Decodo).`);

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('disconnect', () => console.log('Client disconnected'));
});

// API Endpoint to start scraping
app.post('/api/scrape', async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

    res.json({ message: 'Scraping started', keyword });

    try {
        await scraper.scrape(keyword, proxies, (log) => {
            io.emit('log', log);
        }, (tweet) => {
            io.emit('tweet', tweet);
        });
        io.emit('status', 'Scraping completed');
    } catch (error) {
        console.error('Scraping error:', error);
        io.emit('status', 'Scraping failed: ' + error.message);
    }
});

server.listen(port, () => {
    console.log(`X-Scraper running at http://localhost:${port}`);
});
