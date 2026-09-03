// Authentication middleware. Verifies the JWT, loads the user with their role, and
// attaches a normalized auth context to req.auth for downstream checks.
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../utils/jwt");

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "Authentication required.");

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired token.");
  }

  // Load user + role. lean() returns a plain object (faster, no Mongoose overhead)
  // since we only read here.
  const user = await User.findById(decoded.sub)
    .populate("role")
    .select("-password")
    .lean();

  if (!user) throw new ApiError(401, "User no longer exists.");
  if (user.status !== "active") throw new ApiError(403, "Account is not active.");

  const isSuperAdmin = Boolean(user.role?.isSuperAdmin);

  // Precompute a Set of permission keys for O(1) lookups per request.
  const permissionSet = new Set(user.role?.permissions || []);

  // Normalize showroom access to an array of string ids.
  const showroomIds = (user.showrooms || []).map((id) => String(id));

  req.auth = {
    user,
    isSuperAdmin,
    permissions: permissionSet,
    showroomIds,
    // Helper reused by middleware and controllers.
    can(permissionKey) {
      return isSuperAdmin || permissionSet.has(permissionKey);
    },
  };

  next();
});

module.exports = { authenticate };
