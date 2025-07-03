// Simple test function without IAM policy requirements
const functions = require("firebase-functions");

exports.helloWorld = functions.https.onRequest((request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (request.method === 'OPTIONS') {
    response.end();
    return;
  }
  
  response.json({message: "Hello from Firebase!"});
});
