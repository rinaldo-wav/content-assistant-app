// This file should be saved to netlify/functions/claude-assistant.js
const axios = require('axios');

// Enhanced error handling function
function createDetailedError(message, details = {}) {
  console.error('Detailed Error:', { message, details });
  return {
    errorMessage: message,
    errorDetails: JSON.stringify(details)
  };
}

exports.handler = async function(event, context) {
  // Comprehensive logging for debugging
  console.log('Incoming Request:', JSON.stringify({
    method: event.httpMethod,
    headers: event.headers,
    body: event.body ? safeParseJSON(event.body) : 'No body'
  }, null, 2));

  // Safe JSON parsing
  function safeParseJSON(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('JSON Parsing Error:', error);
      return {};
    }
  }

  // CORS headers with more specific configuration
  const headers = {
    'Access-Control-Allow-Origin': '*', // Consider restricting in production
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Successful preflight call.' })
    };
  }
  
  try {
    // Robust request body parsing
    const requestBody = safeParseJSON(event.body);
    const { prompt, assistantType, recordId } = requestBody;
    
    console.log(`Processing request: Assistant Type=${assistantType}, Record ID=${recordId}`);
    
    // Comprehensive parameter validation
    const validationErrors = [];
    if (!prompt) validationErrors.push('Missing prompt');
    if (!assistantType) validationErrors.push('Missing assistant type');
    if (!recordId) validationErrors.push('Missing record ID');
    
    if (validationErrors.length > 0) {
      console.error('Validation Errors:', validationErrors);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid request',
          details: validationErrors
        })
      };
    }
    
    // Critical environment variable check
    const missingEnvVars = [];
    if (!process.env.ANTHROPIC_API_KEY) missingEnvVars.push('ANTHROPIC_API_KEY');
    if (!process.env.AIRTABLE_API_KEY) missingEnvVars.push('AIRTABLE_API_KEY');
    
    if (missingEnvVars.length > 0) {
      console.error('Missing Environment Variables:', missingEnvVars);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Server configuration error',
          details: `Missing environment variables: ${missingEnvVars.join(', ')}`
        })
      };
    }
    
    try {
      // Fetch assistant configuration
      const assistantConfig = await getAssistantConfig(assistantType, recordId);
      
      // Robust configuration with fallbacks
      const systemPrompt = assistantConfig.SystemPrompt || 
        "You are a helpful AI assistant specialized in content writing and editing.";
      
      // Use Claude 3 Opus model
      const model = "claude-3-opus-20240229";
      
      // Safe configuration parsing with defaults
      const temperature = parseFloat(assistantConfig.Temperature) || 0.7;
      const maxTokens = parseInt(assistantConfig.MaxTokens) || 4000;
      
      console.log('AI Request Configuration:', {
        model,
        temperature,
        maxTokens,
        systemPromptLength: systemPrompt.length
      });
      
      // Prepare API request payload
      const requestPayload = {
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [{ 
          role: "user", 
          content: prompt 
        }]
      };
      
      // Make request to Anthropic API with enhanced error handling
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          timeout: 45000 // Increased timeout to 45 seconds
        }
      );
      
      // Validate API response
      if (!response.data?.content?.[0]?.text) {
        throw createDetailedError('Invalid API response format', {
          responseStatus: response.status,
          responseData: JSON.stringify(response.data)
        });
      }
      
      // Successfully process and return the response
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: response.data.content[0].text
        })
      };
    } catch (apiError) {
      // Comprehensive API error handling
      console.error('API Processing Error:', {
        message: apiError.message,
        stack: apiError.stack,
        responseData: apiError.response?.data
      });
      
      return {
        statusCode: apiError.response?.status || 500,
        headers,
        body: JSON.stringify({
          error: 'API processing failed',
          details: apiError.message,
          type: 'APIError'
        })
      };
    }
  } catch (unexpectedError) {
    // Catch any unexpected errors
    console.error('Unexpected Error:', {
      message: unexpectedError.message,
      stack: unexpectedError.stack
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Unexpected server error',
        details: unexpectedError.message,
        type: 'UnexpectedError'
      })
    };
  }
};

// Existing helper functions (getAssistantConfig and related functions remain the same as in previous version)
async function getAssistantConfig(assistantKey, recordId) {
  // ... (keep the existing implementation from the previous artifact)
  // You can copy the entire function from the previous claude-assistant.js artifact
}
