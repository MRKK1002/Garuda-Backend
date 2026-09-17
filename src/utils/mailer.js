// Nodemailer transporter + HTML email templates for Garuda International.
// Triggers:
//   1. Welcome email  — after customer completes profile (registration)
//   2. Order confirmed — after storefront or CRM order is created
//   3. Order delivered — after order status changes to "delivered"
const nodemailer = require("nodemailer");

// ── Transporter ──────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password (16 chars, no spaces)
  },
});

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

// Base HTML wrapper — Garuda gold branding, works in Gmail/Outlook.
function wrap(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f7f3e7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3e7;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#16130e;padding:28px 36px;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:800;color:#b58a2e;letter-spacing:1px;">GARUDA INTERNATIONAL</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#9a8060;letter-spacing:2px;text-transform:uppercase;">Premium Electronics</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#faf8f2;border-top:1px solid #e8e0cc;padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9a8f73;">
                Garuda International · 104/150, Singapura Main Rd, Bengaluru, Karnataka 560097<br/>
                <a href="mailto:amitparnets@gmail.com" style="color:#b58a2e;text-decoration:none;">amitparnets@gmail.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Gold divider line.
const divider = `<hr style="border:none;border-top:1px solid #e8e0cc;margin:24px 0;"/>`;

// ── Send helper ───────────────────────────────────────────────────────────────

async function sendMail({ to, subject, html }) {
  if (!to) return; // no email address — skip silently
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
    console.log(`[mailer] Sent "${subject}" → ${to}`);
  } catch (err) {
    // Never let email failure crash the request.
    console.error(`[mailer] Failed to send "${subject}" → ${to}:`, err.message);
  }
}

// ── 1. Welcome email ──────────────────────────────────────────────────────────

async function sendWelcomeEmail(customer) {
  const { name, email, mobile } = customer;
  if (!email) return;

  const html = wrap("Welcome to Garuda International", `
    <h2 style="margin:0 0 8px;font-size:22px;color:#16130e;">Welcome, ${name}! 🎉</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#56503f;line-height:1.7;">
      Thank you for joining <strong>Garuda International</strong>. Your account has been created successfully.
    </p>
    ${divider}
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#9a8f73;width:120px;">Mobile</td>
        <td style="padding:8px 0;font-size:14px;color:#16130e;font-weight:600;">+91 ${mobile}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#9a8f73;">Email</td>
        <td style="padding:8px 0;font-size:14px;color:#16130e;font-weight:600;">${email}</td>
      </tr>
    </table>
    ${divider}
    <p style="margin:0 0 20px;font-size:14px;color:#56503f;line-height:1.7;">
      Browse our wide range of premium electronics and home appliances on our website. 
      We're here to help you at every step.
    </p>
    <a href="${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/shop"
       style="display:inline-block;background:#b58a2e;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px;">
      Start Shopping →
    </a>
  `);

  await sendMail({
    to: email,
    subject: "Welcome to Garuda International 🎉",
    html,
  });
}

// ── 2. Order confirmed email ──────────────────────────────────────────────────

async function sendOrderConfirmedEmail(order, customer) {
  const email = customer?.email || order?.customer?.email;
  if (!email) return;

  const name  = customer?.name  || order?.customer?.name  || "Customer";
  const items = order.items || [];

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:10px 0;font-size:14px;color:#16130e;border-bottom:1px solid #f0ead8;">
        ${it.name || it.product?.name || "Product"}
      </td>
      <td style="padding:10px 0;font-size:14px;color:#56503f;text-align:center;border-bottom:1px solid #f0ead8;">
        ${it.quantity}
      </td>
      <td style="padding:10px 0;font-size:14px;color:#16130e;font-weight:600;text-align:right;border-bottom:1px solid #f0ead8;">
        ${formatINR(it.price * it.quantity)}
      </td>
    </tr>
  `).join("");

  const addr = order.deliveryAddress;
  const addrText = addr
    ? [addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")
    : "—";

  const html = wrap("Order Confirmed — Garuda International", `
    <h2 style="margin:0 0 6px;font-size:22px;color:#16130e;">Order Confirmed ✅</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#56503f;line-height:1.7;">
      Hi <strong>${name}</strong>, your order has been placed successfully. We'll keep you updated.
    </p>

    <div style="background:#fff6dc;border:1px solid #e2d8bd;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#9a8060;text-transform:uppercase;letter-spacing:0.08em;">Order Number</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#b58a2e;">${order.number}</p>
    </div>

    <!-- Items table -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th style="text-align:left;font-size:12px;color:#9a8f73;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:2px solid #e8e0cc;">Item</th>
          <th style="text-align:center;font-size:12px;color:#9a8f73;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:2px solid #e8e0cc;">Qty</th>
          <th style="text-align:right;font-size:12px;color:#9a8f73;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:2px solid #e8e0cc;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:14px 0 0;font-size:15px;font-weight:700;color:#16130e;">Total</td>
          <td style="padding:14px 0 0;font-size:18px;font-weight:800;color:#b58a2e;text-align:right;">
            ${formatINR(order.grandTotal)}
          </td>
        </tr>
      </tfoot>
    </table>

    ${divider}

    <p style="margin:0 0 6px;font-size:13px;color:#9a8f73;text-transform:uppercase;letter-spacing:0.06em;">Delivery Address</p>
    <p style="margin:0;font-size:14px;color:#16130e;">${addrText}</p>
  `);

  await sendMail({
    to: email,
    subject: `Order Confirmed: ${order.number} — Garuda International`,
    html,
  });
}

// ── 3. Order delivered email ──────────────────────────────────────────────────

async function sendOrderDeliveredEmail(order, customer) {
  const email = customer?.email || order?.customer?.email;
  if (!email) return;

  const name = customer?.name || order?.customer?.name || "Customer";

  const html = wrap("Your Order Has Been Delivered — Garuda International", `
    <h2 style="margin:0 0 8px;font-size:22px;color:#16130e;">Delivered Successfully 📦</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#56503f;line-height:1.7;">
      Hi <strong>${name}</strong>, great news! Your order has been delivered. We hope you love your new product.
    </p>

    <div style="background:#e6f7ec;border:1px solid #a8d5b5;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#2e7d32;text-transform:uppercase;letter-spacing:0.08em;">Order Number</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#2e7d32;">${order.number}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#9a8f73;width:130px;">Order Total</td>
        <td style="padding:8px 0;font-size:14px;color:#16130e;font-weight:700;">${formatINR(order.grandTotal)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#9a8f73;">Items</td>
        <td style="padding:8px 0;font-size:14px;color:#16130e;">
          ${(order.items || []).map(it => it.name || it.product?.name || "Product").join(", ")}
        </td>
      </tr>
    </table>

    ${divider}

    <p style="margin:0 0 16px;font-size:14px;color:#56503f;line-height:1.7;">
      Enjoying your purchase? We'd love to hear from you. Leave a review or shop again anytime.
    </p>
    <a href="${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/shop"
       style="display:inline-block;background:#b58a2e;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px;">
      Shop Again →
    </a>
  `);

  await sendMail({
    to: email,
    subject: `Your Order ${order.number} Has Been Delivered 📦`,
    html,
  });
}

// ── 4. Quotation email ───────────────────────────────────────────────────────

async function sendQuotationEmail(quotation, customer) {
  const email = customer?.email || quotation?.customer?.email;
  if (!email) return;

  const name = customer?.name || quotation?.customer?.name || "Customer";
  const items = quotation.items || [];

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:10px 0;font-size:14px;color:#16130e;border-bottom:1px solid #f0ead8;">
        ${it.name || it.product?.name || "Product"}
      </td>
      <td style="padding:10px 0;font-size:14px;color:#56503f;text-align:center;border-bottom:1px solid #f0ead8;">
        ${it.quantity}
      </td>
      <td style="padding:10px 0;font-size:14px;color:#16130e;font-weight:600;text-align:right;border-bottom:1px solid #f0ead8;">
        ${formatINR((it.price - (it.discount || 0)) * it.quantity)}
      </td>
    </tr>
  `).join("");

  const html = wrap("Your Price Quotation — Garuda International", `
    <h2 style="margin:0 0 6px;font-size:22px;color:#16130e;">Price Quotation 📄</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#56503f;line-height:1.7;">
      Hi <strong>${name}</strong>, thank you for your enquiry. Here is your customized price quotation from Garuda International.
    </p>

    <div style="background:#fff6dc;border:1px solid #e2d8bd;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#9a8060;text-transform:uppercase;letter-spacing:0.08em;">Quotation Number</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#b58a2e;">${quotation.number}</p>
    </div>

    <!-- Items table -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th style="text-align:left;font-size:12px;color:#9a8f73;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:2px solid #e8e0cc;">Item</th>
          <th style="text-align:center;font-size:12px;color:#9a8f73;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:2px solid #e8e0cc;">Qty</th>
          <th style="text-align:right;font-size:12px;color:#9a8f73;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:2px solid #e8e0cc;">Offer Rate</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:14px 0 0;font-size:15px;font-weight:700;color:#16130e;">Total Offer Price</td>
          <td style="padding:14px 0 0;font-size:18px;font-weight:800;color:#b58a2e;text-align:right;">
            ${formatINR(quotation.grandTotal)}
          </td>
        </tr>
      </tfoot>
    </table>

    ${divider}

    <p style="margin:0 0 8px;font-size:13px;color:#9a8f73;text-transform:uppercase;letter-spacing:0.06em;">Terms & Validity</p>
    <p style="margin:0;font-size:13px;color:#56503f;line-height:1.6;">
      • Prices include all applicable GST.<br/>
      • This quotation is valid for 7 days from issue date.<br/>
      • To confirm your order, reply to this email or visit our showroom.
    </p>
  `);

  await sendMail({
    to: email,
    subject: `Price Quotation ${quotation.number} — Garuda International`,
    html,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendQuotationEmail,
};
