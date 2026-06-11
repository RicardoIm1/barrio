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

    const resp = await fetch("https://script.google.com/macros/s/AKfycby0bUzST8Qu32V39LnrYGvO3p_oZK1tinmsxR9T_fAQCFfgKD1l3N9Bo0dbnnc78Oi3/exec", {
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
