// Auth controller: login and the "me" endpoint that returns the current user plus
// their resolved permissions and showroom access (used to build the sidebar).
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken } = require("../utils/jwt");

// Shapes the user object the frontend needs: profile + role + permissions + showrooms.
function serializeAuthUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role
      ? {
          id: user.role._id,
          name: user.role.name,
          isSuperAdmin: Boolean(user.role.isSuperAdmin),
        }
      : null,
    permissions: user.role?.permissions || [],
    isSuperAdmin: Boolean(user.role?.isSuperAdmin),
    showrooms: user.showrooms || [],
  };
}

// POST /api/v1/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, "Email and password are required.");

  // Explicitly select password (it's select:false on the model).
  const user = await User.findOne({ email: String(email).toLowerCase() })
    .select("+password")
    .populate("role")
    .populate("showrooms", "name code city");

  if (!user) throw new ApiError(401, "Invalid credentials.");
  if (user.status !== "active") throw new ApiError(403, "Account is not active.");

  const ok = await user.comparePassword(password);
  if (!ok) throw new ApiError(401, "Invalid credentials.");

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken({ sub: String(user._id) });

  res.json({
    success: true,
    token,
    user: serializeAuthUser(user),
  });
});

// GET /api/v1/auth/me
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.user._id)
    .populate("role")
    .populate("showrooms", "name code city")
    .lean();

  if (!user) throw new ApiError(404, "User not found.");
  res.json({ success: true, user: serializeAuthUser(user) });
});

module.exports = { login, me };
