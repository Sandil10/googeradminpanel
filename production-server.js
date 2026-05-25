process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.SERVE_NEXT = 'true';

require('./server');
