// netlify/functions/ai-assistant.js
const axios = require('axios');

// Helper function to strip HTML tags from content (unchanged)
function stripHtml(html) { /* Existing implementation */ }

// Helper function to extract document structure (unchanged)
function extractDocumentStructure(html) { /* Existing implementation */ }

// Near the top of your ai-assistant.js file
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'apptv25rN4A3SoYn8';
console.log('Using Airtable Base ID:', AIRTABLE_BASE_ID);

// Then use AIRTABLE_BASE_ID instead of process.env.AIRTABLE_BASE_ID throughout

/**
 * Model Provider Service Factory
 * Creates the appropriate service for the selected AI model
 */
class ModelProviderFactory {
  static createProvider(modelConfig, params = {}) {
    const type = modelConfig.Type?.toLowerCase();
    
    switch (type) {
      case 'claude':
        return new AnthropicModelProvider(modelConfig, params);
      case 'openai':
        return new OpenAIModelProvider(modelConfig, params);
      case 'mistral':
        return new MistralModelProvider(modelConfig, params);
      case 'deepseek':
        return new DeepSeekModelProvider(modelConfig, params);
      case 'llama':
        return new LlamaModelProvider(modelConfig, params);
      default:
        // Default to Claude if type is unknown
        return new AnthropicModelProvider(modelConfig, params);
    }
  }
}

/**
 * Base Model Provider class that all providers extend
 */
class BaseModelProvider {
  constructor(modelConfig, params = {}) {
    this.modelConfig = modelConfig;
    this.params = params;
    this.maxTokens = modelConfig.MaxTokens || 4000;
    this.temperature = parseFloat(modelConfig.Temperature || 0.7);
  }
  
  validateConfig() {
    if (!this.modelConfig.API_Key) {
      throw new Error(`API key not found for ${this.modelConfig.Name} model`);
    }
    
    // Validate temperature range
    if (this.temperature < 0 || this.temperature > 1 || isNaN(this.temperature)) {
      this.temperature = 0.7; // Reset to default if invalid
      console.log(`Invalid temperature value: ${this.modelConfig.Temperature}, using default 0.7`);
    }
    
    // Validate max tokens
    if (this.maxTokens <= 0 || isNaN(this.maxTokens)) {
      this.maxTokens = 4000; // Reset to default if invalid
      console.log(`Invalid max tokens value: ${this.modelConfig.MaxTokens}, using default 4000`);
    }
  }
  
  async generateResponse(prompt, systemPrompt) {
    throw new Error('Method not implemented');
  }
}

/**
 * Anthropic Claude API Provider
 */
class AnthropicModelProvider extends BaseModelProvider {
  async generateResponse(prompt, systemPrompt) {
    this.validateConfig();
    
    const requestPayload = {
      model: this.modelConfig.ModelName || "claude-3-7-sonnet-20250219",
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemPrompt,
      messages: [
        { 
          role: "user", 
          content: prompt 
        }
      ]
    };
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.modelConfig.API_Key,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    if (!response.data.content || !response.data.content[0] || !response.data.content[0].text) {
      throw new Error('Anthropic API returned an unexpected response format');
    }
    
    return response.data.content[0].text;
  }
}

/**
 * OpenAI API Provider
 */
class OpenAIModelProvider extends BaseModelProvider {
  async generateResponse(prompt, systemPrompt) {
    this.validateConfig();
    
    const requestPayload = {
      model: this.modelConfig.ModelName || "gpt-4",
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ]
    };
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.modelConfig.API_Key}`
        }
      }
    );
    
    if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error('OpenAI API returned an unexpected response format');
    }
    
    return response.data.choices[0].message.content;
  }
}

/**
 * Mistral AI API Provider
 */
class MistralModelProvider extends BaseModelProvider {
  async generateResponse(prompt, systemPrompt) {
    this.validateConfig();
    
    const requestPayload = {
      model: this.modelConfig.ModelName || "mistral-large-latest",
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ]
    };
    
    const response = await axios.post(
      this.modelConfig.API_Endpoint || 'https://api.mistral.ai/v1/chat/completions',
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.modelConfig.API_Key}`
        }
      }
    );
    
    if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error('Mistral API returned an unexpected response format');
    }
    
    return response.data.choices[0].message.content;
  }
}

/**
 * DeepSeek API Provider
 */
class DeepSeekModelProvider extends BaseModelProvider {
  async generateResponse(prompt, systemPrompt) {
    this.validateConfig();
    
    const requestPayload = {
      model: this.modelConfig.ModelName || "deepseek-chat",
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ]
    };
    
    const response = await axios.post(
      this.modelConfig.API_Endpoint || 'https://api.deepseek.com/v1/chat/completions',
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.modelConfig.API_Key}`
        }
      }
    );
    
    if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error('DeepSeek API returned an unexpected response format');
    }
    
    return response.data.choices[0].message.content;
  }
}

/**
 * Llama API Provider (via various hosting services)
 */
class LlamaModelProvider extends BaseModelProvider {
  async generateResponse(prompt, systemPrompt) {
    this.validateConfig();
    
    // Llama's API might vary depending on hosting provider
    const requestPayload = {
      model: this.modelConfig.ModelName || "llama-3",
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ]
    };
    
    const response = await axios.post(
      this.modelConfig.API_Endpoint || 'https://api.example.com/llama',
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.modelConfig.API_Key}`
        }
      }
    );
    
    // Extract the response based on the format provided by your Llama API provider
    return response.data.choices[0].message.content;
  }
}

// Helper function to prepare prompt (unchanged)
function preparePromptForContentMode(basePrompt, selectedText, requestType) {
  /* Existing implementation */
}

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://portal.wearevery.com',
    'Access-Control-Allow-Headers': 'Content-Type, Origin, X-Requested-With',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
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
    // Parse request body with more error handling
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
      console.log('Received request with parameters:', {
        assistantType: requestBody.assistantType,
        recordId: requestBody.recordId
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { prompt, assistantType, recordId, selectedText, interactionMode, conversationHistory, isLargeContent, selectionRange, quickAction } = requestBody;
    
    // More detailed validation
    if (!assistantType) {
      console.error('Missing assistantType parameter');
    }
    
    if (!recordId) {
      console.error('Missing recordId parameter');
    }
    
    if (!assistantType || !recordId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters (assistantType or recordId)' })
      };
    }
    
    try {
      // Fetch assistant and model configurations from Airtable
      const assistantConfig = await getAssistantConfig(assistantType, recordId);
// Add fallback for when ModelID doesn't exist
let modelConfig;
if (assistantConfig.ModelID && assistantConfig.ModelID.length > 0) {
  modelConfig = await getModelConfig(assistantConfig.ModelID[0]);
} else {
  console.log('No model ID provided for assistant, using default model');
  modelConfig = await getModelConfig(null); // This will use the default model
}
      
      // Get content record for context
      const contentRecord = await getContentRecord(recordId);
      const currentContent = contentRecord?.fields?.Content || '';
      const strippedContent = stripHtml(currentContent);
      const documentStructure = extractDocumentStructure(currentContent);
      
      // Process conversation history for context
      let historyText = '';
      if (conversationHistory && conversationHistory.length > 0) {
        /* Process history as before */
      }
      
      // Determine if we're using a quick action
      let userPrompt;
      
      if (quickAction && assistantConfig.QuickActions) {
        // Find the matching quick action
        const actionConfig = JSON.parse(assistantConfig.QuickActions || '{}')[quickAction];
        
        if (actionConfig && actionConfig.prompt) {
          // Use the predefined prompt from the quick action
          userPrompt = actionConfig.prompt;
          
          // If the quick action has a special system prompt override, use it
          if (actionConfig.systemPrompt) {
            assistantConfig.SystemPrompt = actionConfig.systemPrompt;
          }
        } else {
          // Fall back to regular prompt if quick action not found
          userPrompt = prepareUserPrompt(prompt, assistantConfig, selectedText, strippedContent, documentStructure, historyText, interactionMode);
        }
      } else {
        // Standard prompt generation
        userPrompt = prepareUserPrompt(prompt, assistantConfig, selectedText, strippedContent, documentStructure, historyText, interactionMode);
      }
      
      // Create the appropriate model provider
      const modelProvider = ModelProviderFactory.createProvider(modelConfig, {
        recordId,
        assistantType,
        interactionMode
      });
      
      // Generate response using the selected model
      const responseText = await modelProvider.generateResponse(userPrompt, assistantConfig.SystemPrompt);
      
      // Return the response
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: responseText,
          original: {
            fullContent: currentContent,
            selectedText: selectedText || null,
            selectionRange: selectionRange || null
          }
        })
      };
      
    } catch (apiError) {
      // Error handling logic
      console.error('Error from API:', apiError.message);
      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response data:', JSON.stringify(apiError.response.data));
      }
      
      // Handle different error types and return appropriate messages
      /* Error handling logic as before */
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

/**
 * Helper function to prepare user prompt based on context
 */
function prepareUserPrompt(prompt, assistantConfig, selectedText, strippedContent, documentStructure, historyText, interactionMode) {
  // Content mode - focused on generating suggestions
  if (!interactionMode || interactionMode === 'content') {
    // Base prompt with document structure
    let basePrompt = `I'm working on a document with the following detailed structure:
${documentStructure}

When making improvements:
1. Pay close attention to the document's existing structure and formatting
2. Maintain header levels (h1, h2, h3) as they currently exist
3. Preserve the document flow and section organization
4. When replacing text, match the exact HTML structure of the original`;

    // Add selected text context if available
    if (selectedText) {
      basePrompt += `\n\nThe user has selected this specific portion of text:
"""
${stripHtml(selectedText)}
"""

Your task is to IMMEDIATELY improve this text without asking questions.
CRITICAL: When replacing text, MAINTAIN THE EXACT SAME HTML STRUCTURE as the original.
If the selection is a heading, return a heading. If it's a paragraph, return a paragraph.
If it's just a phrase, do not wrap it in any tags.

The selected text is part of this larger document:
"""
${strippedContent.substring(0, 1000)}${strippedContent.length > 1000 ? '...' : ''}
"""`;
    } else {
      basePrompt += `\n\nHere's the current content I'm working with:
        
"""
${strippedContent.substring(0, 1000)}${strippedContent.length > 1000 ? '...' : ''}
"""

Your task is to IMMEDIATELY improve this content without asking questions.`;
    }
    
    // Add previous conversation context
    if (historyText) {
      basePrompt += `\n\nOur previous conversation about this content:\n${historyText}\n`;
    }
    
    // Add the user's request
    basePrompt += `\n\nUser's request: ${prompt}`;
    
    // Add HTML formatting instructions
    basePrompt += `\n\nIMPORTANT HTML FORMATTING INSTRUCTIONS:
1. Return CLEAN, VALID HTML with NO extra whitespace, line breaks, or empty elements
2. Format your HTML exactly like this: <h1>Headline</h1><p>First paragraph</p><p>Second paragraph</p>
3. DO NOT include any <br> tags, especially not inside heading tags
4. DO NOT create empty elements like <h1></h1> or <p></p>
5. DO NOT duplicate HTML tags (e.g., never output "</p></p>" or "</h1></h1>")
6. Use only these HTML tags:
   - <h1>, <h2>, <h3> for headings (NEVER NESTED inside other tags)
   - <p> for paragraphs
   - <ul> and <li> for unordered lists
   - <ol> and <li> for ordered lists
   - <strong> for bold text
   - <em> for italicized text
   - <a href="..."> for links
7. NEVER put headings inside paragraph tags
8. DO NOT add any inline styling or classes
9. DO NOT add HTML comments
10. Keep the HTML structure simple and linear`;

    // Add response format instructions
    return preparePromptForContentMode(basePrompt, selectedText, prompt);
  } else {
    // Conversation mode with history awareness
    return `You are having an ongoing conversation with the user about their content.

${historyText || ''}
Here's the context:
- The document they're working on: "${strippedContent.substring(0, 200)}${strippedContent.length > 200 ? '...' : ''}"
- Their current question/message: "${prompt}"

Respond conversationally as a helpful writing assistant, remembering the context of your previous conversation. Only provide specific content suggestions if directly asked.`;
  }
}

/**
 * Get model configuration from Airtable
 */
async function getModelConfig(modelId) {
  console.log('Received modelId:', modelId);

  // Provide a comprehensive default configuration
  const defaultModelConfig = {
    Type: 'claude',
    API_Key: process.env.ANTHROPIC_API_KEY,
    ModelName: 'claude-3-7-sonnet-20250219',
    Temperature: 0.7,
    MaxTokens: 4000,
    Name: 'Default Claude Model'
  };

  // If no modelId is provided, return the default
  if (!modelId) {
    console.log('No model ID provided, using default model configuration');
    return defaultModelConfig;
  }

  try {
    // Log the full Airtable request details
    console.log('Attempting to fetch model from Airtable', {
      baseId: process.env.AIRTABLE_BASE_ID,
      modelId: modelId,
      apiKeyPresent: !!process.env.AIRTABLE_API_KEY
    });

    const response = await axios.get(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Models/${modelId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );

    // Extensive logging of the response
    console.log('Airtable Model Response:', JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.fields) {
      console.warn(`Could not retrieve model record ${modelId}, using default`);
      return defaultModelConfig;
    }

    // Get the appropriate API key
    const modelType = response.data.fields.Type;
    let apiKey;
    
    switch (modelType?.toLowerCase()) {
      case 'claude':
        apiKey = process.env.ANTHROPIC_API_KEY;
        break;
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case 'mistral':
        apiKey = process.env.MISTRAL_API_KEY;
        break;
      default:
        apiKey = process.env.ANTHROPIC_API_KEY;
    }

    // Merge Airtable configuration with default configuration
    return {
      ...defaultModelConfig,
      ...response.data.fields,
      API_Key: apiKey
    };

  } catch (error) {
    console.error('Error fetching model configuration:', {
      message: error.message,
      response: error.response ? error.response.data : 'No response',
      stack: error.stack
    });

    // Return default configuration if fetch fails
    return defaultModelConfig;
  }
}

// Function to get content record from Airtable
async function getContentRecord(recordId) {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Content/${recordId}`,
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

// Function to fetch assistant configuration from Airtable
async function getAssistantConfig(assistantKey, recordId) {
  try {
    // First get the content record to find linked assistants
    console.log(`Fetching content record: ${recordId}`);
    const contentResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Content/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    if (!contentResponse.data || !contentResponse.data.fields) {
      throw new Error(`Content record ${recordId} not found or has no fields`);
    }
    
    // Get the linked assistant IDs
    const linkedAssistantIds = contentResponse.data.fields['AI Assistants'] || [];
    console.log(`Content has ${linkedAssistantIds.length} linked assistants`);
    
    if (linkedAssistantIds.length === 0) {
      return { SystemPrompt: "You are a helpful AI assistant." }; // Default config
    }
    
    // Format the filter formula to find the requested assistant
    const filterFormula = `Key="${assistantKey}"`;
    
    // Get the requested assistant by Key
    const assistantsResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/AI%20Assistants?filterByFormula=${encodeURIComponent(filterFormula)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    if (!assistantsResponse.data || !assistantsResponse.data.records || assistantsResponse.data.records.length === 0) {
      console.warn(`Assistant with key "${assistantKey}" not found, using default`);
      return { SystemPrompt: "You are a helpful AI assistant." }; // Default config
    }
    
    return assistantsResponse.data.records[0].fields;
    
  } catch (error) {
    console.error('Error getting assistant config:', error.message);
    throw error;
  }
}
