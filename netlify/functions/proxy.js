// netlify/functions/proxy.js
import fetch from "node-fetch";

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    const resp = await fetch("https://script.google.com/macros/s/AKfycbyXb5zCWvI6wQ2Apggij2J1ilFEydkfByunwYFBiH0SEXtSgFS4jWtwCAjkbqBqsQ30/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await resp.text();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",   // ✅ habilita CORS
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: data
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
