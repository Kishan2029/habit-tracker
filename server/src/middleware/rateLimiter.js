const rateLimitStore = new Map();

const rateLimiter = ({ windowMs = 15 * 60 * 1000, max = 100 } = {}) => {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now - record.startTime > windowMs) {
      rateLimitStore.set(key, { startTime: now, count: 1 });
      return next();
    }

    record.count++;
    if (record.count > max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
      });
    }

    next();
  };
};

export default rateLimiter;
