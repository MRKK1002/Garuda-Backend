// Showroom scoping - the backend decides which showrooms a user may touch, never the
// client. Two helpers:
//
// 1) scopeQuery: builds a Mongo filter fragment limiting results to the user's
//    showrooms (Super Admin / org-wide users get no restriction).
// 2) assertShowroomAccess: verifies a specific showroom id is allowed, else 403.
const ApiError = require("../utils/ApiError");

// Returns a filter object to merge into a query. `field` is the document field that
// references a showroom (default "showroom").
//
// Access rules:
//   - Super Admin  → no restriction (sees everything).
//   - Non-super-admin WITH assigned showrooms → limited to those showrooms.
//   - Non-super-admin WITHOUT any showroom → sees NOTHING (fail-closed). This
//     prevents a misconfigured/restricted user from accidentally seeing all data.
function scopeQuery(req, field = "showroom") {
  const { isSuperAdmin, showroomIds } = req.auth;
  if (isSuperAdmin) return {};
  if (showroomIds.length === 0) {
    // Fail-closed: match nothing.
    return { [field]: { $in: [] } };
  }
  return { [field]: { $in: showroomIds } };
}

// Throws 403 if the user cannot access the given showroom id.
// Super Admin always passes. A non-super-admin with no showrooms is denied.
function assertShowroomAccess(req, showroomId) {
  const { isSuperAdmin, showroomIds } = req.auth;
  if (isSuperAdmin) return;
  if (showroomIds.length === 0) {
    throw new ApiError(403, "You are not assigned to any showroom. Contact an administrator.");
  }
  if (!showroomId || !showroomIds.includes(String(showroomId))) {
    throw new ApiError(403, "You do not have access to this showroom.");
  }
}

module.exports = { scopeQuery, assertShowroomAccess };
