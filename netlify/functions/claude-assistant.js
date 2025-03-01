// This file should be saved to netlify/functions/claude-assistant.js
const axios = require('axios');

// Helper function to strip HTML tags from content
function stripHtml(html) {
  if (!html) return '';
  
  // Replace common block elements with newlines to preserve structure
  let processedHtml = html
    .replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '- '); // Convert list items to bullet points
  
  // Remove all remaining HTML tags
  processedHtml = processedHtml.replace(/<[^>]*>/g, ' ');
  
  // Clean up whitespace
  processedHtml = processedHtml
    .replace(/\n\s+/g, '\n') // Remove leading whitespace after newlines
    .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
    .replace(/\n+/g, '\n\n') // Replace multiple newlines with double newlines
    .trim();
  
  return processedHtml;
}

// Helper function to extract basic document structure
function extractDocumentStructure(html) {
  if (!html) return '';
  
  // Extract headings and paragraph beginnings
  const headingMatch = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi) || [];
  
  // Map headings to a simple structure
  const headings = headingMatch.map(h => {
    const level = h.match(/<h([1-6])/i)[1];
    const text = h.replace(/<[^>]*>/g, '').trim();
    return `${'#'.repeat(level)} ${text}`;
  });
  
  return headings.join('\n');
}

// Helper function to analyze content structure and get tag information
function analyzeContentStructure(html) {
  if (!html) return '';
  
  // Count most common tags
  const tagCounts = {};
  const tagMatches = html.match(/<([a-z][a-z0-9]*)\b[^>]*>/gi) || [];
  
  tagMatches.forEach(tag => {
    const tagName = tag.match(/<([a-z][a-z0-9]*)\b/i)[1].toLowerCase();
    tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
  });
  
  // Get the most common tags
  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => `${tag} (${count})`)
    .join(', ');
  
  return `Document uses these HTML tags: ${sortedTags}`;
}

// Helper function to get content record from Airtable
async function getContentRecord(recordId) {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/apptv25rN4A3SoYn8/Content/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    if (!response.data || !response.data.fields) {
      throw new Error(`Could not retrieve content record ${recordId}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error getting content record:', error.message);
    throw error;
  }
}

// Helper function to fetch assistant configuration from Airtable
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
    
    // Get the linked assistant IDs
    const linkedAssistantIds = contentResponse.data.fields['AI Assistants'] || [];
    
    console.log(`Linked assistant IDs: ${JSON.stringify(linkedAssistantIds)}`);
    
    if (!linkedAssistantIds || linkedAssistantIds.length === 0) {
      throw new Error('No assistants linked to this content');
    }
    
    // Construct a filter formula to find the specific assistant
    const filterFormula = encodeURIComponent(
      `AND(Key="${assistantKey}", Active=TRUE(), OR(${linkedAssistantIds.map(id => `RECORD_ID()='${id}'`).join(',')}))`
    );
    
    console.log(`Fetching assistants with filter: ${filterFormula}`);
    
    // Get the specific assistant by key
    const assistantsResponse = await axios.get(
      `https://api.airtable.com/v0/apptv25rN4A3SoYn8/AI%20Assistants?filterByFormula=${filterFormula}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    if (!assistantsResponse.data || !assistantsResponse.data.records) {
      throw new Error('Failed to retrieve assistants from Airtable');
    }
    
    console.log(`Found ${assistantsResponse.data.records.length} matching assistants`);
    
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
    throw error;
  }
}

exports.handler = async function(event, context) {
  // Enable CORS with more comprehensive headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Successful preflight call' })
    };
  }
  
  try {
    // Robust request body parsing
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid request body',
          details: parseError.message 
        })
      };
    }

    const { prompt, assistantType, recordId, selectedText } = requestBody;
    
    console.log(`Request received for ${assistantType} assistant, record ID: ${recordId}`);
    
    // Validate required parameters
    const missingParams = [];
    if (!prompt) missingParams.push('prompt');
    if (!assistantType) missingParams.push('assistantType');
    if (!recordId) missingParams.push('recordId');
    
    if (missingParams.length > 0) {
      console.log('Missing required parameters:', missingParams);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required parameters',
          details: missingParams 
        })
      };
    }
    
    // Check for API keys
    const missingApiKeys = [];
    if (!process.env.ANTHROPIC_API_KEY) missingApiKeys.push('ANTHROPIC_API_KEY');
    if (!process.env.AIRTABLE_API_KEY) missingApiKeys.push('AIRTABLE_API_KEY');
    
    if (missingApiKeys.length > 0) {
      console.log('Missing API keys:', missingApiKeys);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'API key configuration error',
          details: missingApiKeys 
        })
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
      
      // Get the current content
      const contentRecord = await getContentRecord(recordId);
      const currentContent = contentRecord?.fields?.Content || '';
      
      // Strip HTML from content to focus on text
      const strippedContent = stripHtml(currentContent);
      
      // Extract document structure for context
      const documentStructure = extractDocumentStructure(currentContent);
      
      // Analyze document structure for formatting information
      const contentStructureInfo = analyzeContentStructure(currentContent);
      
      // Prepare user prompt based on whether text is selected or not
      let userPrompt;
      
      if (selectedText) {
        // User has selected specific text
        console.log('Processing request with selected text');
        
        // Strip HTML from the selected text too
        const cleanSelectedText = stripHtml(selectedText);
        
        userPrompt = `I'm working on a document with the following structure:
${documentStructure}

${contentStructureInfo}

The user has selected this specific portion of text:
"""
${cleanSelectedText}
"""

The selected text is part of this larger document:
"""
${strippedContent}
"""

User's request: ${prompt}

When suggesting changes:
1. Focus ONLY on the selected text unless explicitly asked to consider the broader context
2. Provide specific replacements that preserve the original intent AND FORMATTING
3. When providing a suggested replacement, include it within triple backticks (```) 
4. If the original text had formatting like headings, paragraphs, or lists, maintain that formatting in your suggestion
5. For any replacement text, structure it with appropriate HTML tags like <p>, <h1>, <h2>, etc. consistent with the document's existing format
6. If multiple options are suggested, number them clearly
7. NEVER discuss HTML tags or formatting in your explanations - focus only on the content
8. Remember: The most important thing is maintaining the document's formatting while improving the content`;
      } else {
        // No specific text selection, working with the entire document
        userPrompt = `Here's the current content I'm working with:
        
"""
${strippedContent}
"""

Document structure:
${documentStructure}

${contentStructureInfo}

User's request: ${prompt}

IMPORTANT:
1. When providing a suggested replacement, include it within triple backticks (```) 
2. Maintain the document's existing HTML structure using appropriate tags like <p>, <h1>, <h2>, etc.
3. Do NOT discuss HTML tags or formatting in your explanations - focus only on the content
4. If suggesting specific changes, clearly quote the original text and provide the replacement
5. If multiple options are suggested, number them clearly
6. Remember: The most important thing is maintaining the document's formatting while improving the content`;
      }
      
      // Validate the model
      const model = "claude-3-opus-20240229";
      
      console.log('Sending request to Anthropic API with config:', {
        model: model,
        temperature: temperature,
        systemPromptLength: systemPrompt ? systemPrompt.length : 0,
        promptLength: userPrompt ? userPrompt.length : 0
      });
      
      // Create the request payload
      const requestPayload = {
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          { 
            role: "user", 
            content: userPrompt 
          }
        ]
      };
      
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
          message: response.data.content[0].text,
          original: {
            fullContent: currentContent,
            selectedText: selectedText || null
          }
        })
      };
    } catch (apiError) {
      // Detailed error logging
      console.error('Error from API:', apiError.message);
      
      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response data:', JSON.stringify(apiError.response.data));
      }
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Error from API',
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
