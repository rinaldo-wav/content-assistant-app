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
      const systemPrompt = assistantConfig.SystemPrompt || "You are a helpful assistant.";
      const temperature = parseFloat(assistantConfig.Temperature) || 0.7;
      const maxTokens = parseInt(assistantConfig.MaxTokens) || 4000;
      
      console.log(`Using assistant config: ${assistantConfig.Name}`);
      console.log(`Temperature: ${temperature}, Max Tokens: ${maxTokens}`);
      console.log(`System prompt length: ${systemPrompt.length} characters`);
      
      console.log('Sending request to Anthropic API');
      // Make request to Anthropic API with the fetched configuration
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: "claude-3-7-sonnet-20250219",
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemPrompt,
          messages: [
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
      
      console.log('Response received from Anthropic API');
      
      // Process and return the response
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: response.data.content[0].text
        })
      };
    } catch (apiError) {
      console.error('Error from API:', apiError.message);
      
      // Enhanced error logging
      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response data:', JSON.stringify(apiError.response.data));
        if (apiError.response.config && apiError.response.config.data) {
          try {
            const requestData = JSON.parse(apiError.response.config.data);
            console.error('Request data (partial):', {
              model: requestData.model,
              max_tokens: requestData.max_tokens,
              temperature: requestData.temperature,
              system_length: requestData.system ? requestData.system.length : 'undefined',
              messages_count: requestData.messages ? requestData.messages.length : 'undefined'
            });
          } catch (e) {
            console.error('Error parsing request data:', e.message);
          }
        }
      }
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Error from API',
          details: apiError.response ? apiError.response.data : apiError.message
        })
      };
    }
  } catch (error) {
    console.error('General error in function:', error.message);
    
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
    
    // Get the linked assistant IDs - USING CORRECT FIELD NAME WITH SPACES
    const linkedAssistantIds = contentResponse.data.fields['AI Assistants'] || [];
    
    console.log(`Linked assistant IDs: ${linkedAssistantIds.join(', ')}`);
    
    if (linkedAssistantIds.length === 0) {
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
    
    console.log(`Found ${assistantsResponse.data.records.length} matching assistants`);
    
    // Check if the assistant exists in the linked assistants
    const matchingAssistants = assistantsResponse.data.records.filter(assistant => 
      linkedAssistantIds.includes(assistant.id)
    );
    
    if (matchingAssistants.length === 0) {
      throw new Error(`Assistant ${assistantKey} not found or not linked to this content`);
    }
    
    const selectedAssistant = matchingAssistants[0];
    console.log(`Selected assistant: ${selectedAssistant.fields.Name} (${selectedAssistant.fields.Key})`);
    
    // Return the first matching assistant's fields
    return selectedAssistant.fields;
  } catch (error) {
    console.error('Error fetching assistant config:', error);
    throw error;
  }
}
