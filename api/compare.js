export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "compare API reachable"
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const body = req.body || {};
    const selected_model = body.selected_model || null;

    if (!selected_model || !selected_model.product_title || !selected_model.specs) {
      return res.status(400).json({
        error: "Missing selected_model or specs"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing in Vercel environment variables"
      });
    }

    const category = String(selected_model.category || "").toLowerCase();
    const ourPrice = Number(selected_model.our_price || 0);

    // Fetching competitors using OpenAI
    const competitorPrompt = `
      You are a laptop market analyst. Find 6 NEW laptops in India that compete with this refurbished laptop.

      Refurbished laptop details:
      ${JSON.stringify(selected_model, null, 2)}

      Rules:
      - Return only NEW laptops
      - Price must be 90% to 135% of the refurb price
      - Category: If "gaming", return gaming laptops; if "business", return business laptops
      - Only use popular, realistic models available in the market

      Return only this structure:
      {
        "candidates": [
          { "id": "string", "product_title": "string", "category": "string", "price": "number", "specs": { "processor": "string", "ram": "string", "storage": "string", "display": "string", "gpu": "string" } }
        ]
      }
    `;

    const competitorResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        input: competitorPrompt,
        text: { format: { type: "json_object" } }
      })
    });

    const competitorData = await competitorResponse.json();

    if (!competitorResponse.ok || competitorData?.error) {
      return res.status(500).json({
        error: "Failed to generate competitor laptops",
        raw: competitorData
      });
    }

    const competitorRaw = competitorData?.output?.[0]?.content?.[0]?.text;
    if (!competitorRaw) {
      return res.status(500).json({
        error: "No competitor data returned"
      });
    }

    let competitorParsed;
    try {
      competitorParsed = JSON.parse(competitorRaw);
    } catch (err) {
      return res.status(500).json({
        error: "Competitor JSON parse failed",
        rawText: competitorRaw
      });
    }

    let candidates = Array.isArray(competitorParsed.candidates) ? competitorParsed.candidates : [];
    candidates = candidates.filter(item => {
      return item && item.product_title && item.specs && item.price;
    });

    if (ourPrice > 0) {
      candidates = candidates.filter(item => {
        const p = Number(item.price || 0);
        return p >= Math.round(ourPrice * 0.9) && p <= Math.round(ourPrice * 1.35);
      });
    }

    const comparisonCandidates = candidates.slice(0, 3);
    const alternativesPool = candidates.slice(3);

    // Generate reasoning for the widget
    const reasoningPrompt = `
      You are generating customer-facing content for a NewJaisa refurbished laptop comparison widget.

      The widget compares:
      - 1 refurbished laptop from NewJaisa
      - 3 similarly priced NEW laptops in the same category

      Refurbished laptop:
      ${JSON.stringify(selected_model, null, 2)}

      Comparison candidates:
      ${JSON.stringify(comparisonCandidates, null, 2)}

      NewJaisa trust points:
      - 72-point quality check
      - 1-year warranty
      - 14-day return and replacement
      - lifetime buyback guarantee
      - Quick Heal security / data protection

      Return valid JSON only in this structure:
      {
        "banner_main": "string",
        "banner_sub": "string",
        "price_comparison": { "comparison_note": "string" },
        "why_buy_from_newjaisa": ["string", "string", "string"],
        "best_for_users": ["string", "string", "string"],
        "advantages": ["string", "string", "string"],
        "refurb_value_score": 9,
        "new_value_scores": [6, 6, 5],
        "alternatives": [{"id": "string", "reason": "string"}],
        "cta_title": "string",
        "cta_text": "string",
        "cta_button": "string"
      }
    `;

    const reasoningResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-5.4",
        input: reasoningPrompt,
        text: { format: { type: "json_object" } }
      })
    });

    const reasoningData = await reasoningResponse.json();
    const reasoningRaw = reasoningData?.output?.[0]?.content?.[0]?.text;
    let parsed;
    try {
      parsed = JSON.parse(reasoningRaw);
    } catch (err) {
      return res.status(500).json({ error: "Reasoning JSON parse failed", rawText: reasoningRaw });
    }

    const alternatives = (parsed.alternatives || []).map(alt => ({
      id: alt.id,
      product_title: alt.product_title,
      price: alt.price,
      price_text: alt.price ? `₹${Number(alt.price).toLocaleString("en-IN")}` : "",
      condition: alt.condition || "New",
      specs: alt.specs || {},
      reason: alt.reason || ""
    }));

    return res.status(200).json({
      selected_model,
      comparison_candidates: comparisonCandidates,
      ai: parsed,
      alternatives
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error",
      stack: error.stack
    });
  }
}