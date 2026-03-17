const pool = require('./config/database');
const fs = require('fs');

async function debugImages() {
    try {
        const result = await pool.query('SELECT id, title, image_url FROM market LIMIT 5');
        console.log('--- Market Data Debug ---');
        result.rows.forEach(row => {
            console.log(`ID: ${row.id}, Title: ${row.title}`);
            const url = row.image_url || '';
            console.log(`URL Length: ${url.length}`);
            console.log(`URL Start: ${url.substring(0, 100)}`);
            if (url.length > 200) {
                console.log(`URL End: ${url.substring(url.length - 100)}`);
            }
            console.log('--------------------------');
        });
        
        fs.writeFileSync('image_debug.json', JSON.stringify(result.rows, null, 2));
        console.log('Wrote full data to image_debug.json');
        
        process.exit(0);
    } catch (err) {
        console.error('Debug failed:', err);
        process.exit(1);
    }
}

debugImages();
