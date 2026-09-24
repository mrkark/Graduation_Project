// Обёртка над zod-схемами: валидирует req.body/query/params
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.errors.map((e) => e.message).join('; '),
        },
      });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
