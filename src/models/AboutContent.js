// AboutContent — a singleton document holding the editable content for the public
// storefront "About Us" page (hero + our story). Admin edits it; storefront reads it.
const mongoose = require("mongoose");

const aboutContentSchema = new mongoose.Schema(
  {
    // Singleton guard — always the string "about" so only one doc can exist.
    key: { type: String, default: "about", unique: true },

    // About Us section (image left, content right).
    aboutTitle:   { type: String, trim: true, default: "Welcome to Garuda International" },
    aboutBody:    { type: String, trim: true, default: "" }, 
    aboutImage:   { type: String, trim: true, default: "" },
    storyHeading:  { type: String, trim: true, default: "15+ Years of Trust" },
    storyBadge:    { type: String, trim: true, default: "Established 2000" },
    storyBody:     { type: String, trim: true, default: "" },
    storyImage:    { type: String, trim: true, default: "" },
    vision:  { type: String, trim: true, default: "" },
    mission: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AboutContent", aboutContentSchema);
