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
      catalog_summary: alternativesPool.map(item => ({
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
You are generating compact customer-facing content for a NewJaisa laptop widget.

Priority order:
1. Price comparison
2. Why buy from NewJaisa
3. Best user fit
4. Profession fit
5. Key advantages
6. Laptop type
7. Alternative options

Use only the input provided.

Alternative options rules:
- Suggest up to 3 alternatives from the provided catalog_summary
- Choose based on price band, user type, laptop category, and practical suitability
- Do not repeat the selected model
- Keep the reasons compact and useful

Input:
${JSON.stringify(input, null, 2)}

Return valid JSON only in exactly this structure:
{
  "headline": "string",
  "price_positioning": {
    "tier": "string",
    "summary": "string",
    "buyer_value": "string"
  },
  "price_comparison": {
    "our_price_text": "string",
    "amazon_price_text": "string",
    "flipkart_price_text": "string",
    "comparison_note": "string"
  },
  "why_buy_from_newjaisa": ["string", "string", "string", "string"],
  "best_for_users": ["string", "string", "string", "string"],
  "profession_fit": ["string", "string", "string", "string"],
  "laptop_types": ["string", "string", "string", "string"],
  "advantages": ["string", "string", "string", "string"],
  "performance_summary": ["string", "string", "string", "string"],
  "alternatives": [
    {
      "id": "string",
      "reason": "string",
      "tags": ["string", "string"]
    }
  ],
  "cta_title": "string",
  "cta_text": "string",
  "cta_button": "string"
}

Rules:
- headline under 9 words
- each bullet under 8 words
- alternative reason under 16 words
- use customer language
- do not invent policies beyond input
- do not invent external live price data
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

    const alternatives = (parsed.alternatives || []).map(alt => {
      const match = catalog.find(item => item.id === alt.id);
      if (!match) return null;
      return {
        id: match.id,
        product_title: match.product_title,
        our_price: match.our_price,
        price_text: match.our_price ? `₹${Number(match.our_price).toLocaleString("en-IN")}` : "",
        tags: Array.isArray(alt.tags) ? alt.tags : [],
        reason: alt.reason || ""
      };
    }).filter(Boolean);

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
