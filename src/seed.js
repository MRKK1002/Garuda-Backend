// Seed script: creates the base organization, the role hierarchy from the SOW
// (Super Admin -> Corporate -> Manager -> Executive) and the initial super admin user.
// Idempotent: safe to run multiple times.
//
// Run with: npm run seed
const mongoose = require("mongoose");
const env = require("./config/env");
const { connectDB } = require("./config/db");
const { allPermissionKeys } = require("./config/permissions");
const Organization = require("./models/Organization");
const Role = require("./models/Role");
const User = require("./models/User");

// Sensible default permission sets for the non-super roles.
function permsFor(keys, modules) {
  return keys.filter((k) => modules.some((m) => k.startsWith(`${m}.`)));
}

async function seed() {
  await connectDB();
  const all = allPermissionKeys();

  // --- Organization ---
  let org = await Organization.findOne({ name: "AR Venture" });
  if (!org) {
    org = await Organization.create({ name: "AR Venture", isActive: true });
    console.log("Created organization: AR Venture");
  }

  // --- Roles ---
  // Super Admin: full access via isSuperAdmin flag (also gets all keys for clarity).
  let superRole = await Role.findOne({ isSuperAdmin: true });
  if (!superRole) {
    superRole = await Role.create({
      name: "Super Admin",
      description: "Full system access",
      permissions: all,
      isSuperAdmin: true,
      isSystem: true,
    });
    console.log("Created role: Super Admin");
  }

  // Corporate: everything except deleting/managing roles+users is allowed; broad view.
  if (!(await Role.findOne({ name: "Corporate" }))) {
    await Role.create({
      name: "Corporate",
      description: "Corporate-level oversight across all showrooms",
      permissions: all.filter((k) => !k.startsWith("roles.") && !k.endsWith(".delete")),
      isSystem: true,
    });
    console.log("Created role: Corporate");
  }

  // Manager: showroom operations - CRM, sales, inventory (view/transfer), catalogue view.
  if (!(await Role.findOne({ name: "Manager" }))) {
    const managerPerms = [
      ...permsFor(all, ["customers", "leads", "quotations", "orders", "payments", "deliveries"]),
      "products.view",
      "categories.view",
      "brands.view",
      "inventory.view",
      "inventory.transfer",
      "showrooms.view",
      "reports.view",
    ];
    await Role.create({
      name: "Manager",
      description: "Manages showroom operations",
      permissions: managerPerms,
      isSystem: true,
    });
    console.log("Created role: Manager");
  }

  // Sales Executive: customers, leads, quotations, view orders/products.
  if (!(await Role.findOne({ name: "Sales Executive" }))) {
    const execPerms = [
      "customers.view",
      "customers.create",
      "customers.edit",
      "leads.view",
      "leads.create",
      "leads.edit",
      "quotations.view",
      "quotations.create",
      "orders.view",
      "orders.create",
      "products.view",
      "inventory.view",
    ];
    await Role.create({
      name: "Sales Executive",
      description: "Handles assigned customers, leads and quotations",
      permissions: execPerms,
      isSystem: true,
    });
    console.log("Created role: Sales Executive");
  }

  // --- Super Admin user ---
  const existingAdmin = await User.findOne({ email: env.seed.adminEmail });
  if (!existingAdmin) {
    await User.create({
      organization: org._id,
      name: env.seed.adminName,
      email: env.seed.adminEmail,
      password: env.seed.adminPassword, // hashed by the pre-save hook
      role: superRole._id,
      showrooms: [], // empty = org-wide access
      status: "active",
    });
    console.log(`Created super admin: ${env.seed.adminEmail} / ${env.seed.adminPassword}`);
  } else {
    console.log("Super admin already exists, skipping.");
  }

  await mongoose.connection.close();
  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
