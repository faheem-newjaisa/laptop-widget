export default async function handler(req, res) {
  try {
    const body = req.method === "POST" ? req.body : req.query;

    const {
      product_title,
      brand_name = "NewJaisa",
      our_price = null,
      compare_price_amazon = null,
      compare_price_flipkart = null,
      specs = {}
    } = body;

    if (!product_title || !specs || typeof specs !== "object") {
      return res.status(400).json({
        error: "Missing product_title or specs"
      });
    }

    const input = {
      product_title,
      brand_name,
      our_price,
      compare_price_amazon,
      compare_price_flipkart,
      specs,
      newjaisa_points: [
        "72-point quality check",
        "1-year warranty",
        "14-day return and replacement policy",
        "lifetime buyback guarantee",
        "refurbished laptops for work, study, and gaming"
      ]
    };

    const prompt = `
You are generating structured content for a compact laptop comparison widget for NewJaisa.

Use only the input provided.

Goals:
- explain why this laptop is worth buying from NewJaisa
- identify the type of user
- identify profession fit
- identify if it suits gaming, students, office users, creators, etc.
- summarize value / price positioning
- compare price only if compare prices are provided
- if no compare prices are provided, do NOT invent market prices; instead describe value positioning

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
  "cta_title": "string",
  "cta_text": "string",
  "cta_button": "string"
}

Rules:
- headline under 10 words
- each bullet under 9 words
- keep it compact and conversion-friendly
- prioritize why NewJaisa over generic specs
- if the GPU/specs indicate gaming, mention gaming fit
- do not invent certifications or policies beyond the input
- do not invent exact competitor prices
- if compare prices are missing, say comparison currently unavailable and focus on value
- do not use "best" or "cheapest"
`;

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

    return res.status(200).json({
      input,
      ai: parsed
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
