// Counter - a simple atomic sequence generator used to produce clean, gap-free
// serial numbers per document type (e.g. "invoice", "quotation", "payment").
// Each key holds the last-issued value; nextSeq() atomically increments and returns it.
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // the counter key, e.g. "invoice"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

// Atomically increment the named counter and return the new value. Creates the
// counter starting at 1 on first use (upsert). Safe under concurrent requests.
counterSchema.statics.nextSeq = async function nextSeq(key) {
  const doc = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return doc.seq;
};

module.exports = mongoose.model("Counter", counterSchema);
