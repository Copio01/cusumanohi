// functions/index.js

const functions = require("firebase-functions");
const fetch = require("node-fetch");

// It's crucial to enable CORS to allow your website
// to call this function from a different domain.
const cors = require("cors")({ origin: true });

// Store your secret API keys securely using environment variables.
const GEMINI_API_KEY = functions.config().gemini.key;
const MAPS_API_KEY = functions.config().maps.key;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

exports.geminiProxy = functions.https.onRequest((request, response) => {
  // Use the cors middleware to handle CORS headers automatically.
  cors(request, response, async () => {
    // 1. Security Check: Only allow POST requests.
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }

    // 2. Body Validation: Ensure the request has the data we need.
    if (!request.body || !request.body.chatHistory) {
      return response.status(400).send("Bad Request: Missing chatHistory.");
    }

    try {
      // 3. Forward the request to the real Gemini API.
      const geminiResponse = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Pass the chat history from the client to the Gemini API.
        body: JSON.stringify({ contents: request.body.chatHistory }),
      });

      if (!geminiResponse.ok) {
        // If Gemini returns an error, forward it to the client.
        const errorText = await geminiResponse.text();
        console.error("Gemini API Error:", errorText);
        return response.status(geminiResponse.status).send(errorText);
      }

      const geminiResult = await geminiResponse.json();

      // 4. Send the successful response back to your website.
      response.status(200).json(geminiResult);

    } catch (error) {
      console.error("Error in the proxy function:", error);
      response.status(500).send("Internal Server Error");
    }
  });
});

// Google Maps API Proxy Function
exports.mapsProxy = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    // Only allow GET requests for Maps API
    if (request.method !== "GET") {
      return response.status(405).send("Method Not Allowed");
    }

    try {
      // Get the Maps API endpoint from query parameters
      const { service, ...params } = request.query;
      
      if (!service) {
        return response.status(400).send("Bad Request: Missing service parameter");
      }

      // Construct the Maps API URL
      let mapsApiUrl;
      switch (service) {
        case 'geocode':
          mapsApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?key=${MAPS_API_KEY}`;
          break;
        case 'places':
          mapsApiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${MAPS_API_KEY}`;
          break;
        default:
          return response.status(400).send("Bad Request: Unsupported service");
      }

      // Add remaining parameters to URL
      const urlParams = new URLSearchParams(params);
      mapsApiUrl += `&${urlParams.toString()}`;

      const mapsResponse = await fetch(mapsApiUrl);
      
      if (!mapsResponse.ok) {
        const errorText = await mapsResponse.text();
        console.error("Maps API Error:", errorText);
        return response.status(mapsResponse.status).send(errorText);
      }

      const mapsResult = await mapsResponse.json();
      response.status(200).json(mapsResult);

    } catch (error) {
      console.error("Error in the Maps proxy function:", error);
      response.status(500).send("Internal Server Error");
    }
  });
});