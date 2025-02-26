// This file would be deployed as a serverless function
// For example: netlify/functions/claude-assistant.js

const axios = require('axios');

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*', // Replace with your Softr domain in production
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { prompt, assistantType } = requestBody;
    
    if (!prompt || !assistantType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }
    
    // Different system prompts for different assistant types
    const systemPrompts = {
      proofreader: `You are a professional proofreader and editor. Your task is to help users improve their writing by checking for grammar, spelling, punctuation, and clarity issues. 
                    If the user asks you to modify content, provide a corrected version.
                    Keep your responses concise and focus on concrete improvements.`,
      
      creative: `You are a creative writing assistant with expertise in creating engaging, original content. 
                Help users enhance their writing style, develop creative ideas, and make their content more compelling.
                If the user asks you to modify content, provide an improved creative version.`,
      
      seo: `You are an SEO specialist with deep knowledge of search engine optimization. 
            Help users optimize their content for search engines by suggesting relevant keywords, 
            improving meta descriptions, and enhancing content structure.
            If the user asks you to modify content, provide an SEO-optimized version.`,
      
      optimizer: `You are a content optimization expert who helps make content more effective and engaging.
                Focus on improving readability, structure, flow, and overall impact.
                If the user asks you to modify content, provide an optimized version that maintains the original message but improves its delivery.`
    };
    
    // Make request to Anthropic API
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-sonnet-20240229", // Or your preferred Claude model
        max_tokens: 1000,
        messages: [
          { 
            role: "system", 
            content: systemPrompts[assistantType] || systemPrompts.proofreader 
          },
          { 
            role: "user", 
            content: prompt 
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    // Process and return the response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: response.data.content[0].text,
        // You could add additional processing here to extract suggested edits
      })
    };
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error processing your request',
        details: error.message 
      })
    };
  }
};
