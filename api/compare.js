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
    const catalog = Array.isArray(body.catalog) ? body.catalog : [];

    if (!selected_model || !selected_model.product_title || !selected_model.specs) {
      return res.status(400).json({
        error: "Missing selected_model or specs"
      });
    }

    const selectedId = selected_model.id || null;
    const alternativesPool = catalog.filter(item => item.id !== selectedId);

    const input = {
      selected_model,
      alternatives_pool: alternativesPool.map(item => ({
        id: item.id,
        product_title: item.product_title,
        our_price: item.our_price,
        specs: item.specs
      })),
      newjaisa_points: [
        "72-point quality check",
        "1-year warranty",
        "14-day return and replacement",
        "lifetime buyback guarantee",
        "Quick Heal security / data protection positioning"
      ]
    };

    const prompt = `
You are generating customer-facing content for a NewJaisa refurbished laptop comparison widget.

The widget compares:
- 1 refurbished laptop from NewJaisa
- 3 similarly priced new laptops with similar or lower specs

Your goal:
- clearly show why the refurbished laptop is a better value buy
- keep the message simple and customer-focused
- emphasize price-to-spec advantage
- avoid unnecessary sections or jargon

Input:
${JSON.stringify(input, null, 2)}

Return valid JSON only in exactly this structure:
{
  "banner_main": "string",
  "banner_sub": "string",
  "price_comparison": {
    "comparison_note": "string"
  },
  "why_buy_from_newjaisa": ["string", "string", "string", "string"],
  "best_for_users": ["string", "string", "string", "string"],
  "advantages": ["string", "string", "string", "string"],
  "refurb_value_score": 9,
  "refurb_verdict": "string",
  "new_value_scores": [6, 6, 5],
  "new_verdicts": ["string", "string", "string"],
  "alternatives": [
    {
      "id": "string",
      "reason": "string"
    }
  ],
  "cta_title": "string",
  "cta_text": "string",
  "cta_button": "string"
}

Rules:
- keep all lines compact
- emphasize that refurb can give better specs at the same budget
- do not invent policies beyond the given input
- do not invent live marketplace prices
- keep value scores realistic
- new laptop verdicts should highlight tradeoffs
`;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing in Vercel environment variables"
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        input: prompt,
        text: {
          format: { type: "json_object" }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "OpenAI request failed",
        raw: data
      });
    }

    if (data?.error) {
      return res.status(500).json({
        error: data.error.message || "OpenAI API error",
        raw: data
      });
    }

    const rawText = data?.output?.[0]?.content?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({
        error: "No text returned from OpenAI",
        raw: data
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      return res.status(500).json({
        error: "OpenAI did not return valid JSON",
        rawText
      });
    }

    let alternatives = (parsed.alternatives || []).map(alt => {
      const match = catalog.find(item => item.id === alt.id);
      if (!match) return null;
      return {
        id: match.id,
        product_title: match.product_title,
        our_price: match.our_price,
        price_text: match.our_price ? `₹${Number(match.our_price).toLocaleString("en-IN")}` : "",
        reason: alt.reason || ""
      };
    }).filter(Boolean);

    if (!alternatives.length) {
      alternatives = alternativesPool.slice(0, 3).map(item => ({
        id: item.id,
        product_title: item.product_title,
        our_price: item.our_price,
        price_text: item.our_price ? `₹${Number(item.our_price).toLocaleString("en-IN")}` : "",
        reason: "A relevant alternative in a nearby budget or usage range."
      }));
    }

    return res.status(200).json({
      selected_model,
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