// Showroom scoping - the backend decides which showrooms a user may touch, never the
// client. Two helpers:
//
// 1) scopeQuery: builds a Mongo filter fragment limiting results to the user's
//    showrooms (Super Admin / org-wide users get no restriction).
// 2) assertShowroomAccess: verifies a specific showroom id is allowed, else 403.
const ApiError = require("../utils/ApiError");

// Returns a filter object to merge into a query. `field` is the document field that
// references a showroom (default "showroom").
function scopeQuery(req, field = "showroom") {
  const { isSuperAdmin, showroomIds } = req.auth;
  // Super Admin or users with no showroom restriction see everything.
  if (isSuperAdmin || showroomIds.length === 0) return {};
  return { [field]: { $in: showroomIds } };
}

// Throws 403 if the user cannot access the given showroom id.
function assertShowroomAccess(req, showroomId) {
  const { isSuperAdmin, showroomIds } = req.auth;
  if (isSuperAdmin || showroomIds.length === 0) return;
  if (!showroomId || !showroomIds.includes(String(showroomId))) {
    throw new ApiError(403, "You do not have access to this showroom.");
  }
}

module.exports = { scopeQuery, assertShowroomAccess };
