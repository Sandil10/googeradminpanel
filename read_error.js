const fs = require('fs');
const content = fs.readFileSync('error_log.txt', 'utf16le');
console.log(content.toString('utf8'));
