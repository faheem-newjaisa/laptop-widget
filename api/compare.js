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
        "14-day return and replacement",
        "lifetime buyback guarantee",
        "Quick Heal security / data protection positioning"
      ]
    };

    const prompt = `
You are generating content for a compact customer-facing widget on NewJaisa.

Priority order:
1. Price comparison
2. Why buy from NewJaisa
3. Best user fit
4. Profession fit
5. Key advantages
6. Laptop type

Use only the input provided.

Important:
- Prioritize practical customer benefits over technical jargon
- Make NewJaisa reasons stronger than generic laptop descriptions
- If compare prices are provided, mention value clearly
- If compare prices are missing, do not invent them
- If specs indicate gaming suitability, mention gamers and creators where relevant
- Keep every section compact and useful

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
- headline under 9 words
- each bullet under 8 words
- use customer language, not engineering language
- no unsupported superlatives
- no fake policies
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`
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
