document.addEventListener('DOMContentLoaded', () => {
    const tableList = document.getElementById('table-list');
    const queryEditor = document.getElementById('query-editor');
    const runBtn = document.getElementById('run-query-btn');
    const resultsTable = document.getElementById('results-table');
    const errorMsg = document.getElementById('error-msg');

    // Load tables on startup
    loadTables();

    async function loadTables() {
        try {
            const response = await fetch('/api/db/tables');
            const tables = await response.json();

            tableList.innerHTML = '';
            tables.forEach(table => {
                const li = document.createElement('li');
                li.textContent = table;
                li.onclick = () => {
                    queryEditor.value = `SELECT * FROM ${table} LIMIT 100`;
                    runQuery();
                };
                tableList.appendChild(li);
            });
        } catch (error) {
            console.error('Failed to load tables:', error);
        }
    }

    runBtn.onclick = runQuery;

    // Allow Ctrl+Enter to run query
    queryEditor.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            runQuery();
        }
    });

    async function runQuery() {
        const sql = queryEditor.value;
        if (!sql) return;

        runBtn.disabled = true;
        runBtn.textContent = 'Running...';
        errorMsg.style.display = 'none';
        resultsTable.querySelector('thead').innerHTML = '';
        resultsTable.querySelector('tbody').innerHTML = '';

        try {
            const response = await fetch('/api/db/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql })
            });
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            renderResults(data.result);
        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.style.display = 'block';
        } finally {
            runBtn.disabled = false;
            runBtn.textContent = 'Run Query';
        }
    }

    function renderResults(results) {
        const thead = resultsTable.querySelector('thead');
        const tbody = resultsTable.querySelector('tbody');

        if (!results || (Array.isArray(results) && results.length === 0)) {
            tbody.innerHTML = '<tr><td colspan="100" style="text-align: center; color: #aaa;">No results found or query executed successfully.</td></tr>';
            return;
        }

        // Handle non-array results (e.g. from UPDATE/INSERT)
        if (!Array.isArray(results)) {
            thead.innerHTML = '<tr><th>Result</th></tr>';
            tbody.innerHTML = `<tr><td><pre>${JSON.stringify(results, null, 2)}</pre></td></tr>`;
            return;
        }

        // Create headers from first row keys
        const columns = Object.keys(results[0]);
        const headerRow = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Create rows
        results.forEach(row => {
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                const val = row[col];
                td.textContent = val !== null ? val : 'NULL';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
});
