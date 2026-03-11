export default async function handler(req, res) {
  try {
    const { product_title, our_price, amazon_price, flipkart_price, brand_name } =
      req.method === "POST" ? req.body : req.query;

    const ourPrice = Number(our_price);
    const amazonPrice = Number(amazon_price);
    const flipkartPrice = Number(flipkart_price);

    const competitorPrices = [amazonPrice, flipkartPrice].filter(
      (p) => !isNaN(p) && p > 0
    );

    if (!product_title || isNaN(ourPrice) || competitorPrices.length === 0) {
      return res.status(400).json({
        error: "Missing or invalid input",
      });
    }

    const lowestCompetitor = Math.min(...competitorPrices);
    const highestCompetitor = Math.max(...competitorPrices);
    const avgCompetitor =
      competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;

    const savingsVsLowest = Math.max(0, lowestCompetitor - ourPrice);
    const savingsVsAvg = Math.max(0, Math.round(avgCompetitor - ourPrice));
    const savingsPercent =
      avgCompetitor > 0
        ? Math.max(0, Math.round(((avgCompetitor - ourPrice) / avgCompetitor) * 100))
        : 0;

    const facts = {
      product_title,
      brand_name: brand_name || "our store",
      our_price: ourPrice,
      amazon_price: !isNaN(amazonPrice) ? amazonPrice : null,
      flipkart_price: !isNaN(flipkartPrice) ? flipkartPrice : null,
      lowest_competitor_price: lowestCompetitor,
      highest_competitor_price: highestCompetitor,
      average_competitor_price: Math.round(avgCompetitor),
      savings_vs_lowest: savingsVsLowest,
      savings_vs_average: savingsVsAvg,
      savings_percent_vs_average: savingsPercent,
    };

    const prompt = `
You are writing ecommerce widget copy for a refurbished laptop website.

Use ONLY the facts below. Do not invent any pricing or competitor claims.

Facts:
${JSON.stringify(facts, null, 2)}

Return valid JSON only in this exact structure:
{
  "headline": "string",
  "price_line": "string",
  "savings_line": "string",
  "reasons": ["string", "string", "string", "string"],
  "cta": "string"
}

Rules:
- Keep it short and trustworthy
- Do not mention fake seller names beyond Amazon and Flipkart if present
- Do not claim 'best' or 'cheapest'
- If savings_vs_average is 0, avoid saying the user saves money
- Focus on value, testing, warranty, and trust
- Each reason must be under 8 words
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        input: prompt,
      }),
    });

    const data = await response.json();

    const rawText = data?.output?.[0]?.content?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({
        error: "No text returned from OpenAI",
        raw: data,
      });
    }

    let aiJson;
    try {
      aiJson = JSON.parse(rawText);
    } catch (e) {
      return res.status(500).json({
        error: "OpenAI did not return valid JSON",
        rawText,
      });
    }

    return res.status(200).json({
      facts,
      ai: aiJson,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
