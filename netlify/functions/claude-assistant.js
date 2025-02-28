// This file should be saved to netlify/functions/claude-assistant.js
const axios = require('axios');

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',  // In production, change to your domain
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
    const { prompt, assistantType, recordId } = requestBody;
    
    console.log(`Request received for ${assistantType} assistant, record ID: ${recordId}`);
    
    if (!prompt || !assistantType || !recordId) {
      console.log('Missing required parameters');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters (prompt, assistantType, or recordId)' })
      };
    }
    
    // Check for API keys
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('ANTHROPIC_API_KEY is not set in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key configuration error' })
      };
    }
    
    if (!process.env.AIRTABLE_API_KEY) {
      console.log('AIRTABLE_API_KEY is not set in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Airtable API key configuration error' })
      };
    }
    
    try {
      // Fetch assistant configuration from Airtable
      console.log(`Fetching assistant config for ${assistantType}`);
      const assistantConfig = await getAssistantConfig(assistantType, recordId);
      
      // Extract configuration values with defaults
      const systemPrompt = assistantConfig.SystemPrompt || "You are a helpful AI assistant.";
      
      // Ensure temperature is a number between 0 and 1
      let temperature = 0.7;
      if (assistantConfig.Temperature !== undefined && assistantConfig.Temperature !== null) {
        temperature = parseFloat(assistantConfig.Temperature);
        // Validate temperature range
        if (isNaN(temperature) || temperature < 0 || temperature > 1) {
          temperature = 0.7; // Reset to default if invalid
          console.log(`Invalid temperature value: ${assistantConfig.Temperature}, using default 0.7`);
        }
      }
      
      // Ensure max_tokens is a positive integer
      let maxTokens = 4000;
      if (assistantConfig.MaxTokens !== undefined && assistantConfig.MaxTokens !== null) {
        maxTokens = parseInt(assistantConfig.MaxTokens, 10);
        // Validate max tokens
        if (isNaN(maxTokens) || maxTokens <= 0) {
          maxTokens = 4000; // Reset to default if invalid
          console.log(`Invalid max tokens value: ${assistantConfig.MaxTokens}, using default 4000`);
        }
      }
      
      console.log(`Using assistant config: ${assistantConfig.Name}`);
      console.log(`Config values: temp=${temperature}, maxTokens=${maxTokens}`);
      
      // Validate the model
      const model = "claude-3-7-sonnet-20250219";
      
      console.log('Sending request to Anthropic API with config:', {
        model: model,
        temperature: temperature,
        systemPromptLength: systemPrompt ? systemPrompt.length : 0,
        promptLength: prompt ? prompt.length : 0
      });
      
      // Log beginning of the system prompt (for debugging)
      if (systemPrompt) {
        console.log('System prompt start:', systemPrompt.substring(0, 100) + '...');
      }
      
      // Create the request payload
      const requestPayload = {
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          { 
            role: "user", 
            content: prompt 
          }
        ]
      };
      
      console.log('Request payload:', JSON.stringify(requestPayload).substring(0, 200) + '...');
      
      // Make request to Anthropic API with the fetched configuration
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      console.log('Response received from Anthropic API');
      console.log('Response status:', response.status);
      console.log('Response contains content:', !!response.data.content);
      
      if (!response.data.content || !response.data.content[0] || !response.data.content[0].text) {
        throw new Error('Anthropic API returned an unexpected response format');
      }
      
      // Process and return the response
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: response.data.content[0].text
        })
      };
    } catch (apiError) {
      // Detailed error logging
      console.error('Error from API:', apiError.message);
      
      // Log the full error object for better debugging
      console.error('Full error object:', JSON.stringify(apiError).substring(0, 500) + '...');
      
      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response data:', JSON.stringify(apiError.response.data));
        
        // Log request details
        if (apiError.response.config) {
          console.error('Request URL:', apiError.response.config.url);
          console.error('Request method:', apiError.response.config.method);
          
          // Log request headers without sensitive info
          const safeHeaders = {...apiError.response.config.headers};
          if (safeHeaders['x-api-key']) safeHeaders['x-api-key'] = '[REDACTED]';
          if (safeHeaders['Authorization']) safeHeaders['Authorization'] = '[REDACTED]';
          console.error('Request headers:', JSON.stringify(safeHeaders));
          
          // Log data sample
          if (apiError.response.config.data) {
            console.error('Request data sample:', apiError.response.config.data.substring(0, 200) + '...');
          }
        }
      }
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Error from Anthropic API',
          message: apiError.message,
          details: apiError.response ? apiError.response.data : 'No additional details available'
        })
      };
    }
  } catch (error) {
    console.error('General error in function:', error.message);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error processing your request',
        message: error.message,
        details: error.stack
      })
    };
  }
};

// Function to fetch assistant configuration from Airtable
async function getAssistantConfig(assistantKey, recordId) {
  try {
    // First get the content record to find linked assistants
    console.log(`Fetching content record: ${recordId}`);
    const contentResponse = await axios.get(
      `https://api.airtable.com/v0/apptv25rN4A3SoYn8/Content/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    // Check if we got a valid response
    if (!contentResponse.data || !contentResponse.data.fields) {
      throw new Error(`Could not retrieve content record ${recordId}`);
    }
    
    // Debug: Log all field names to help identify the correct field
    console.log('Available fields in content record:', Object.keys(contentResponse.data.fields));
    
    // Get the linked assistant IDs - CORRECTED FIELD NAME WITH FALLBACKS
    const linkedAssistantIds = contentResponse.data.fields['AI Assistants'] || 
                              contentResponse.data.fields['AI_Assistants'] ||
                              [];
    
    console.log(`Linked assistant IDs: ${JSON.stringify(linkedAssistantIds)}`);
    
    if (!linkedAssistantIds || linkedAssistantIds.length === 0) {
      throw new Error('No assistants linked to this content');
    }
    
    // Construct a filter formula to find the specific assistant
    // This gets an active assistant with matching key that's linked to the content
    const filterFormula = `AND(Key="${assistantKey}", Active=TRUE)`;
    
    console.log(`Fetching assistants with filter: ${filterFormula}`);
    
    // Get the specific assistant by key
    const assistantsResponse = await axios.get(
      'https://api.airtable.com/v0/apptv25rN4A3SoYn8/AI%20Assistants',
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        },
        params: {
          filterByFormula: filterFormula
        }
      }
    );
    
    if (!assistantsResponse.data || !assistantsResponse.data.records) {
      throw new Error('Failed to retrieve assistants from Airtable');
    }
    
    console.log(`Found ${assistantsResponse.data.records.length} matching assistants`);
    
    // Debug: Log the first assistant if available
    if (assistantsResponse.data.records.length > 0) {
      console.log('First matching assistant:', JSON.stringify({
        id: assistantsResponse.data.records[0].id,
        key: assistantsResponse.data.records[0].fields.Key,
        name: assistantsResponse.data.records[0].fields.Name
      }));
    }
    
    // Check if the assistant exists in the linked assistants
    const matchingAssistants = assistantsResponse.data.records.filter(assistant => 
      linkedAssistantIds.includes(assistant.id)
    );
    
    console.log(`Found ${matchingAssistants.length} assistants linked to content`);
    
    if (matchingAssistants.length === 0) {
      throw new Error(`Assistant ${assistantKey} not found or not linked to this content`);
    }
    
    // Return the first matching assistant's fields
    return matchingAssistants[0].fields;
  } catch (error) {
    console.error('Error fetching assistant config:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
}
