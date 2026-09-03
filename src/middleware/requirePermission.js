// Authorization middleware. Blocks the request unless the authenticated user has the
// given "<module>.<action>" permission (Super Admin always passes).
const ApiError = require("../utils/ApiError");

function requirePermission(permissionKey) {
  return function check(req, res, next) {
    if (!req.auth) return next(new ApiError(401, "Authentication required."));
    if (req.auth.can(permissionKey)) return next();
    return next(new ApiError(403, `Missing permission: ${permissionKey}`));
  };
}

module.exports = { requirePermission };
