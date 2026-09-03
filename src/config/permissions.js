// Master catalog of permissions, grouped by module. Each key is "<module>.<action>".
// Roles store a subset of these keys. Both backend authorization and the frontend
// permission matrix are built from this catalog, so there are no hardcoded checks.

const PERMISSION_CATALOG = [
  {
    module: "showrooms",
    label: "Showrooms",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "users",
    label: "Users",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "roles",
    label: "Roles & Permissions",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "categories",
    label: "Categories",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "brands",
    label: "Brands",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "products",
    label: "Products",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "inventory",
    label: "Inventory",
    actions: ["view", "adjust", "transfer", "inward"],
  },
  {
    module: "customers",
    label: "Customers",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "leads",
    label: "Leads",
    actions: ["view", "create", "edit", "assign", "delete"],
  },
  {
    module: "quotations",
    label: "Quotations",
    actions: ["view", "create", "edit", "approve"],
  },
  {
    module: "orders",
    label: "Orders",
    actions: ["view", "create", "edit", "cancel"],
  },
  {
    module: "payments",
    label: "Payments",
    actions: ["view", "create", "refund"],
  },
  {
    module: "deliveries",
    label: "Deliveries",
    actions: ["view", "create", "edit"],
  },
  {
    module: "reports",
    label: "Reports",
    actions: ["view", "export"],
  },
  {
    module: "notifications",
    label: "Notifications",
    actions: ["view", "create", "send"],
  },
  {
    module: "audit-logs",
    label: "Audit Logs",
    actions: ["view"],
  },
];

// Flattened list of all permission keys, e.g. ["showrooms.view", "showrooms.create", ...].
function allPermissionKeys() {
  return PERMISSION_CATALOG.flatMap((group) =>
    group.actions.map((action) => `${group.module}.${action}`)
  );
}

module.exports = { PERMISSION_CATALOG, allPermissionKeys };
