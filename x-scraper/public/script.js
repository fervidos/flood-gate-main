const socket = io();
const scrapeBtn = document.getElementById('scrapeBtn');
const keywordInput = document.getElementById('keyword');
const logsDiv = document.getElementById('logs');
const resultsDiv = document.getElementById('results');
const resultCountSpan = document.getElementById('resultCount');

let tweetCount = 0;

scrapeBtn.addEventListener('click', () => {
    const keyword = keywordInput.value.trim();
    if (!keyword) return alert('Please enter a keyword');

    // Reset UI
    logsDiv.innerHTML = '';
    resultsDiv.innerHTML = '';
    tweetCount = 0;
    resultCountSpan.innerText = '(0)';

    addLog(`Sending request for keyword: ${keyword}...`);

    fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
    })
        .catch(err => addLog(`Error starting scrape: ${err}`));
});

socket.on('log', (message) => {
    addLog(message);
});

socket.on('tweet', (tweet) => {
    tweetCount++;
    resultCountSpan.innerText = `(${tweetCount})`;

    // Create card
    const card = document.createElement('div');
    card.className = 'tweet-card';
    card.innerHTML = `
        <div class="tweet-header">
            <div>
                <div class="tweet-user">${tweet.user}</div>
                <div class="tweet-handle">${tweet.handle}</div>
            </div>
        </div>
        <div class="tweet-text">${tweet.text}</div>
        <time class="tweet-time">${new Date(tweet.time).toLocaleString()}</time>
    `;
    resultsDiv.prepend(card);
});

socket.on('status', (message) => {
    addLog(`[STATUS] ${message}`);
});

function addLog(msg) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logsDiv.appendChild(entry);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}
