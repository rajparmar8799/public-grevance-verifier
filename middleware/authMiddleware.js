const User = require("../models/User");

const ROLE_DASHBOARD_MAP = {
  citizen: "/citizen",
  field_officer: "/officer/dashboard",
  department_officer: "/department",
  collector: "/collector/dashboard",
};

function getDashboardPathByRole(role) {
  return ROLE_DASHBOARD_MAP[role] || "/";
}

async function hydrateSessionUser(req, res, next) {
  try {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser._id) {
      res.locals.currentUser = null;

      return next();
    }

    const dbUser = await User.findById(sessionUser._id).select("-password");
    if (!dbUser) {
      req.session.destroy(() => {});
      res.locals.currentUser = null;
      return next();
    }

    req.user = dbUser;
    req.session.user = {
      _id: dbUser._id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
      district: dbUser.district,
      department: dbUser.department,
      token: sessionUser.token,
    };
    res.locals.currentUser = req.session.user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect("/auth/login?error=Please login to continue");
  }
  return next();
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    const role = req.session && req.session.user && req.session.user.role;

    if (!role || !allowedRoles.includes(role)) {
      const acceptHeader = (req.headers.accept || "").toLowerCase();
      const isBrowserPageRequest =
        req.method === "GET" && acceptHeader.includes("text/html");

      if (isBrowserPageRequest) {
        return res.redirect(
          "/auth/login?error=Role access denied. Please login with the correct role",
        );
      }

      return res.status(403).send("Forbidden: role access denied");
    }
    return next();
  };
}

function requireApproved(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) {
    return res.redirect("/auth/login?error=Please login to continue");
  }

  if (user.status !== "APPROVED") {
    return res.redirect("/auth/login?error=Account is not approved yet");
  }

  return next();
}

function requireRoleAndApproved(allowedRoles = []) {
  return [requireAuth, requireRole(allowedRoles), requireApproved];
}

function canReviewTargetRole(reviewerRole, targetRole) {
  if (reviewerRole === "collector") {
    return ["field_officer", "department_officer"].includes(targetRole);
  }

  if (reviewerRole === "department_officer") {
    return targetRole === "field_officer";
  }

  return false;
}

module.exports = {
  hydrateSessionUser,
  requireAuth,
  requireRole,
  requireApproved,
  requireRoleAndApproved,
  getDashboardPathByRole,
  canReviewTargetRole,
};
