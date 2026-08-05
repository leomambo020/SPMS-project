const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/** Place after a chain of express-validator checks on a route to turn
 * validation failures into a consistent 400 response. */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new AppError(
        'Validation failed.',
        400,
        errors.array().map((e) => ({ field: e.path, message: e.msg }))
      )
    );
  }
  next();
}

module.exports = validate;
