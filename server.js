import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is missing. Set it in .env locally or in your hosting dashboard.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser requests such as local curl health checks.
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "10kb" }));

const products = [
  { name: "AeroRun Pro", category: "Running", price: 12999, rating: 4.8, details: "Running shoe; current StrideX listing." },
  { name: "Urban Classic", category: "Casual", price: 8499, rating: 4.6, details: "Casual everyday wear." },
  { name: "Velocity Sprint", category: "Sports", price: 14999, rating: 4.9, details: "Sports shoe." },
  { name: "Little Stepper", category: "Kids", price: 4999, rating: 4.7, details: "Kids shoe." },
  { name: "Cloud Walker", category: "Casual", price: 9999, rating: 4.5, details: "Casual everyday wear." },
  { name: "Trail Blazer", category: "Running", price: 13499, rating: 4.8, details: "Running / trail-style shoe." },
  { name: "Court King", category: "Sports", price: 11999, rating: 4.4, details: "Sports / court-style shoe." },
  { name: "Mini Racer", category: "Kids", price: 5499, rating: 4.6, details: "Kids shoe." }
];

app.get("/", (_req, res) => {
  res.json({ service: "StrideX AI Sneaker Stylist API", status: "ok" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/recommend", async (req, res) => {
  try {
    const { purpose, budget, color, preference = "" } = req.body || {};
    const allowedPurposes = ["Running", "Casual", "Sports", "Kids"];
    const allowedColors = ["Any", "Black", "White", "Red", "Blue", "Neutral"];

    if (!allowedPurposes.includes(purpose)) {
      return res.status(400).json({ error: "Please choose a valid shoe purpose." });
    }

    const numericBudget = Number(budget);
    if (!Number.isFinite(numericBudget) || numericBudget < 1000 || numericBudget > 1000000) {
      return res.status(400).json({ error: "Budget must be between Rs. 1,000 and Rs. 1,000,000." });
    }

    if (!allowedColors.includes(color)) {
      return res.status(400).json({ error: "Please choose a valid colour preference." });
    }

    const safePreference = typeof preference === "string" ? preference.slice(0, 180) : "";
    const matchingProducts = products.filter(
      (product) => product.category === purpose && product.price <= numericBudget
    );

    if (matchingProducts.length === 0) {
      return res.json({
        recommendation: `Aapke selected purpose (${purpose}) aur Rs. ${numericBudget.toLocaleString("en-PK")} budget ke liye hamari current catalog mein exact match nahi mila. Budget increase karein ya doosra purpose select karein.`
      });
    }

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      instructions: [
        "You are StrideX AI Sneaker Stylist for an ecommerce store in Pakistan.",
        "Recommend only products included in the supplied catalog. Never invent product names, prices, availability, colours, features, discounts, or stock.",
        "The catalog does not contain verified colour data. Do not claim a product is available in the requested colour; say colour availability must be confirmed with the store.",
        "Use friendly, concise Roman Urdu. Explain why the best one or two listed options fit the customer's purpose and budget.",
        "Prices are in Pakistani rupees. If no product matches, clearly say so and do not recommend products above the budget.",
        "This is shopping guidance, not a medical or professional running assessment."
      ].join(" "),
      input: JSON.stringify({
        customer: {
          purpose,
          maximumBudgetPKR: numericBudget,
          preferredColor: color,
          extraPreference: safePreference
        },
        eligibleCatalogProducts: matchingProducts
      })
    });

    return res.json({ recommendation: response.output_text });
  } catch (error) {
    console.error("Recommendation error:", error?.status || error?.message || "unknown error");
    if (error?.status === 401) {
      return res.status(500).json({ error: "AI API key invalid hai. Backend environment settings check karein." });
    }
    return res.status(502).json({ error: "AI recommendation service abhi available nahi. Thori dair baad dobara try karein." });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`StrideX API listening on port ${port}`);
});
