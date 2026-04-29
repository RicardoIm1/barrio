      // netlify/functions/proxy.js
import fetch from "node-fetch";

export async function handler(event) {
  // Manejar preflight (OPTIONS)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: "Preflight OK"
    };
  }

  try {
    const body = JSON.parse(event.body);

    const resp = await fetch("https://script.google.com/macros/s/AKfycbykkuDoLMTPCctLAEQ1_14Z6mOmx3h8ig52_VaXSPNaUMaRaMatxq1_quceW05_9UEt/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await resp.text();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: data
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ error: err.message })
    };
  }
}
