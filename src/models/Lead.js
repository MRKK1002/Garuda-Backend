// Lead - a sales opportunity moving through a pipeline. Linked to a customer and an
// interested product, assigned to a salesperson/showroom, with follow-ups and notes.
const mongoose = require("mongoose");

// Follow-up / activity entries logged against the lead.
const noteSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    budget: { type: Number, default: 0, min: 0 },
    requirement: { type: String, trim: true },

    // Lead source.
    source: {
      type: String,
      enum: ["website", "app", "showroom", "phone", "whatsapp", "social", "referral"],
      default: "showroom",
    },

    // Pipeline stage.
    stage: {
      type: String,
      enum: ["new", "contacted", "qualified", "quotation", "negotiation", "won", "lost"],
      default: "new",
    },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom" },

    followUpAt: { type: Date },
    lostReason: { type: String, trim: true },

    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true }
);

// --- Indexes ---
leadSchema.index({ customer: 1 });
leadSchema.index({ stage: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ showroom: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ followUpAt: 1 });

module.exports = mongoose.model("Lead", leadSchema);
