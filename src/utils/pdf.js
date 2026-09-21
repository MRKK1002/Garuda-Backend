// PDF generation via Puppeteer. Renders an HTML template to a PDF buffer. Used for
// sharing a quotation as a proper document (not raw text).
const puppeteer = require("puppeteer");
const env = require("../config/env");

const rupee = (n) =>
  "\u20B9 " +
  (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Resolve an uploaded file path to an absolute URL the headless browser can load.
function absUrl(p) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const base = `http://localhost:${env.port}`;
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}

// Build the quotation HTML — mirrors the on-screen QUOTATION document (Garuda header
// from company settings, BILL TO customer, item rows, CGST/SGST, totals).
function quotationHtml(q, company) {
  const c = company || {};
  const cust = q.customer || {};
  const items = q.items || [];

  const rows = items.map((it) => {
    const qty = it.quantity || 1;
    const gross = (it.price || 0) * qty;
    const disc = it.discount || 0;
    const net = Math.max(gross - disc, 0);
    const rate = it.gst || it.product?.gst || 0;
    const taxable = rate > 0 ? net / (1 + rate / 100) : net;
    const taxAmt = net - taxable;
    return {
      name: it.name || it.product?.name || "Item",
      hsn: it.hsn || it.product?.hsn || "-",
      unit: it.unit || it.product?.unit || "PCS",
      qty,
      rate: it.price || 0,
      amount: net,
      taxable,
      taxAmt,
      gstRate: rate,
    };
  });

  const totalTax = rows.reduce((s, r) => s + r.taxAmt, 0);
  const totalTaxable = rows.reduce((s, r) => s + r.taxable, 0);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  const seller = {
    name: c.businessName || "Company",
    address: c.billingAddress || "",
    cityLine: [c.city, c.state, c.pincode].filter(Boolean).join(", "),
    gstin: c.gstin || "",
    pan: c.pan || "",
    phone: c.phone || "",
    logo: absUrl(c.logo),
  };

  const custAddr = [cust.address, cust.city, cust.state, cust.pincode].filter(Boolean).join(", ");
  const dateStr = new Date(q.createdAt).toLocaleDateString("en-GB");

  const itemRows = rows
    .map(
      (r, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${r.name}</td>
        <td class="c">${r.hsn}</td>
        <td class="c">${r.qty} ${r.unit}</td>
        <td class="r">${rupee(r.rate)}</td>
        <td class="r">${rupee(r.amount)}</td>
      </tr>`
    )
    .join("");

  // Payment QR: use the uploaded custom QR if set, else generate a UPI QR from the
  // UPI id (same as the on-screen document).
  const qrSrc = c.customQrImage
    ? absUrl(c.customQrImage)
    : c.upiId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
          `upi://pay?pa=${c.upiId}&pn=${c.businessName || ""}&am=${q.grandTotal || 0}&cu=INR`
        )}`
      : "";

  const bankRows =
    c.bankName || c.accountNumber || c.upiId
      ? `<div class="bank">
           <table style="border:none; width:100%;">
             <tr>
               <td style="border:none; vertical-align:top; padding:0; width:62%;">
                 <div class="bank-h">Bank Details</div>
                 <div><b>Name:</b> ${c.accountHolder || seller.name}</div>
                 <div><b>Bank:</b> ${[c.bankName, c.branch].filter(Boolean).join(", ") || "-"}</div>
                 <div><b>A/C No:</b> ${c.accountNumber || "-"}</div>
                 <div><b>IFSC:</b> ${c.ifsc || "-"}</div>
                 ${c.upiId ? `<div><b>UPI ID:</b> ${c.upiId}</div>` : ""}
               </td>
               <td style="border:none; vertical-align:top; padding:0; text-align:right;">
                 ${
                   qrSrc
                     ? `<div class="bank-h">Payment QR Code</div>
                        <img src="${qrSrc}" style="height:110px; width:110px; object-fit:contain;" />
                        <div class="muted" style="font-size:10px;">Scan &amp; pay using PhonePe, GPay, Paytm, BHIM</div>`
                     : ""
                 }
               </td>
             </tr>
           </table>
         </div>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color:#111; font-size:12px; margin:0; padding:24px; }
    .title { font-weight:800; font-size:14px; margin-bottom:8px; }
    table { width:100%; border-collapse:collapse; }
    td, th { border:1px solid #333; padding:5px 8px; font-size:11px; }
    .c { text-align:center; } .r { text-align:right; }
    .head td { vertical-align:top; }
    .logo { height:46px; object-fit:contain; }
    .muted { color:#555; }
    thead td { background:#f0f0f0; font-weight:700; }
    .totals td { font-weight:700; background:#f7f7f7; }
    .bank { border:1px solid #333; border-top:none; padding:8px; font-size:11px; }
    .bank-h { font-weight:700; margin-bottom:4px; }
  </style></head><body>
    <div class="title">QUOTATION</div>
    <table>
      <tr class="head">
        <td style="width:58%">
          <div style="display:flex; gap:10px;">
            ${seller.logo ? `<img class="logo" src="${seller.logo}" />` : ""}
            <div>
              <div style="font-weight:800; font-size:13px;">${seller.name}</div>
              ${seller.address ? `<div>${seller.address}</div>` : ""}
              ${seller.cityLine ? `<div>${seller.cityLine}</div>` : ""}
              ${seller.gstin ? `<div><b>GSTIN:</b> ${seller.gstin}</div>` : ""}
              ${seller.pan ? `<div><b>PAN:</b> ${seller.pan}</div>` : ""}
              ${seller.phone ? `<div><b>Mobile:</b> ${seller.phone}</div>` : ""}
            </div>
          </div>
        </td>
        <td>
          <div class="muted">Quotation No.</div>
          <div style="font-weight:700;">${q.number}</div>
          <div class="muted" style="margin-top:6px;">Date</div>
          <div style="font-weight:700;">${dateStr}</div>
        </td>
      </tr>
    </table>
    <table>
      <tr class="head">
        <td style="width:50%">
          <div style="font-weight:700;">BILL TO</div>
          <div style="font-weight:700;">${cust.name || "Customer"}</div>
          ${custAddr ? `<div><b>Address:</b> ${custAddr}</div>` : ""}
          ${cust.gstin ? `<div><b>GSTIN:</b> ${cust.gstin}</div>` : ""}
          ${cust.mobile ? `<div><b>Mobile:</b> ${cust.mobile}</div>` : ""}
        </td>
        <td>
          <div style="font-weight:700;">Validity</div>
          <div>7 days from date of issue</div>
        </td>
      </tr>
    </table>
    <table>
      <thead>
        <tr>
          <td class="c">S.NO.</td><td>ITEMS</td><td class="c">HSN</td>
          <td class="c">QTY.</td><td class="r">RATE</td><td class="r">AMOUNT</td>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr><td></td><td class="r" colspan="4"><i>CGST</i></td><td class="r">${rupee(cgst)}</td></tr>
        <tr><td></td><td class="r" colspan="4"><i>SGST</i></td><td class="r">${rupee(sgst)}</td></tr>
        <tr class="totals"><td></td><td class="r" colspan="2">TOTAL</td><td class="c">${totalQty}</td><td></td><td class="r">${rupee(q.grandTotal)}</td></tr>
      </tbody>
    </table>
    ${bankRows}
    <div style="margin-top:10px; font-size:11px;" class="muted">
      All prices are GST inclusive. Thank you for choosing ${seller.name}.
    </div>
  </body></html>`;
}

// Render HTML to a PDF buffer.
async function htmlToPdf(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

async function quotationPdf(q, company) {
  return htmlToPdf(quotationHtml(q, company));
}

module.exports = { quotationPdf, htmlToPdf };
