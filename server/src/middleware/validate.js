import { validationResult } from 'express-validator';
import { sendError } from '../utils/responseFormatter.js';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return sendError(res, 'Validation failed', 400, extractedErrors);
  }
  next();
};

export default validate;
