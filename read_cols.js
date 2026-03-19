const fs = require('fs');
const content = fs.readFileSync('full_cols.txt', 'utf16le');
console.log(content.toString('utf8'));
