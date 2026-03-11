export default async function handler(req, res) {
  try {
    const body = req.method === "POST" ? req.body : req.query;

    const {
      product_title,
      brand_name = "NewJaisa",
      specs = {}
    } = body;

    if (!product_title || !specs || typeof specs !== "object") {
      return res.status(400).json({
        error: "Missing product_title or specs"
      });
    }

    const structuredInput = {
      product_title,
      brand_name,
      specs
    };

    const prompt = `
You are generating structured ecommerce comparison content for a refurbished laptop website.

You will receive only:
- laptop model
- laptop specifications

Your job is to infer:
- value/price positioning (not exact market price unless given)
- likely use cases
- laptop category/type
- why a buyer may choose this product from the store
- product advantages

Important:
- Do NOT invent exact competitor prices
- Do NOT mention Amazon or Flipkart prices
- Do NOT make fake warranty or certification claims
- Keep everything realistic, practical, and conversion-friendly
- Focus on refurbished laptop buyers in India
- Use the specs to infer practical buyer value

Input:
${JSON.stringify(structuredInput, null, 2)}

Return valid JSON only in exactly this structure:
{
  "headline": "string",
  "price_positioning": {
    "tier": "string",
    "summary": "string",
    "buyer_value": "string"
  },
  "use_cases": ["string", "string", "string", "string"],
  "laptop_types": ["string", "string", "string", "string"],
  "why_buy_from_newjaisa": ["string", "string", "string", "string"],
  "advantages": ["string", "string", "string", "string"],
  "cta_title": "string",
  "cta_text": "string",
  "cta_button": "string"
}

Rules:
- headline under 10 words
- price_positioning.tier under 6 words
- price_positioning.summary under 20 words
- price_positioning.buyer_value under 20 words
- each bullet under 10 words
- keep output practical, concise, and clean
- do not use words like "best", "cheapest", "guaranteed best"
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
          format: {
            type: "json_object"
          }
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
      input: structuredInput,
      ai: parsed
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
