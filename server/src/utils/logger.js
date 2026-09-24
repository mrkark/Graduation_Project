const winston = require('winston');

// В dev — цветной консольный вывод, в prod — JSON (удобно для сборщиков логов)
const isDev = process.env.NODE_ENV !== 'production';

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(
          ({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`
        )
      )
    : winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
