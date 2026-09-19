const winston = require('winston');
const { combine, timestamp, errors } = winston.format;

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    })
  ]
});

module.exports = logger;