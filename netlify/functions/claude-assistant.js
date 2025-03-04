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
  
  // Parse the HTML string using a regex-based approach
  // Get headings with their content
  const headings = [];
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  let headingMatch;
  
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const level = headingMatch[1];
    const text = headingMatch[2].replace(/<[^>]*>/g, '').trim();
    headings.push({
      level: parseInt(level),
      text: text,
      indentation: '#'.repeat(parseInt(level))
    });
  }
  
  // Count paragraphs and their approximate length
  const paragraphs = html.match(/<p[^>]*>.*?<\/p>/gi) || [];
  const paragraphCount = paragraphs.length;
  
  // Detect lists
  const lists = {
    ordered: (html.match(/<ol[^>]*>.*?<\/ol>/gis) || []).length,
    unordered: (html.match(/<ul[^>]*>.*?<\/ul>/gis) || []).length
  };
  
  // Count links
  const links = (html.match(/<a[^>]*>.*?<\/a>/gi) || []).length;
  
  // Create a structural outline
  let structure = "Document Structure:\n";
  
  // Add heading hierarchy
  if (headings.length > 0) {
    structure += "\nHeading Hierarchy:\n";
    headings.forEach(h => {
      structure += `${h.indentation} ${h.text}\n`;
    });
  }
  
  // Add statistics
  structure += "\nContent Statistics:\n";
  structure += `- ${paragraphCount} paragraphs\n`;
  structure += `- ${lists.ordered} ordered lists\n`;
  structure += `- ${lists.unordered} unordered lists\n`;
  structure += `- ${links} links\n`;
  
  // Analyze document sections
  structure += "\nDocument Flow:\n";
  
  // Simplified section analysis
  let currentSection = null;
  let sectionContent = [];
  
  for (const heading of headings) {
    if (heading.level === 1 || heading.level === 2) {
      if (currentSection) {
        structure += `- ${currentSection}: ${sectionContent.length} content blocks\n`;
      }
      currentSection = heading.text;
      sectionContent = [];
    } else {
      sectionContent.push(heading.text);
    }
  }
  
  // Add the last section
  if (currentSection) {
    structure += `- ${currentSection}: ${sectionContent.length} content blocks\n`;
  }
  
  return structure;
}

// Helper function to estimate token count
function estimateTokenCount(text) {
  if (!text) return 0;
  // A rough estimate: Claude tokens are roughly 4 characters per token on average
  return Math.ceil(text.length / 4);
}

// Helper function to detect if content is likely to exceed token limits
function willExceedTokenLimit(content, prompt, maxTokens = 100000) {
  const contentTokens = estimateTokenCount(content);
  const promptTokens = estimateTokenCount(prompt);
  const totalEstimatedTokens = contentTokens + promptTokens;
  
  console.log(`Estimated tokens - Content: ${contentTokens}, Prompt: ${promptTokens}, Total: ${totalEstimatedTokens}`);
  
  return totalEstimatedTokens > maxTokens;
}

// Function to split large content into manageable chunks
function splitContent(content, maxChunkSize = 8000) {
  if (!content) return [''];
  
  // If content is already small enough, return as is
  if (estimateTokenCount(content) <= maxChunkSize) {
    return [content];
  }
  
  // For plain text splitting (assumes your content is already plaintext after stripHtml)
  const chunks = [];
  const sentences = content.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (let sentence of sentences) {
    const potentialChunk = currentChunk + sentence + ' ';
    if (estimateTokenCount(potentialChunk) <= maxChunkSize) {
      currentChunk = potentialChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      // If a single sentence is too long, we need to split it further
      if (estimateTokenCount(sentence) > maxChunkSize) {
        const words = sentence.split(' ');
        let wordChunk = '';
        for (let word of words) {
          const potentialWordChunk = wordChunk + word + ' ';
          if (estimateTokenCount(potentialWordChunk) <= maxChunkSize) {
            wordChunk = potentialWordChunk;
          } else {
            if (wordChunk) {
              chunks.push(wordChunk.trim());
            }
            wordChunk = word + ' ';
          }
        }
        if (wordChunk) {
          currentChunk = wordChunk;
        } else {
          currentChunk = '';
        }
      } else {
        currentChunk = sentence + ' ';
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

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
    const { prompt, assistantType, recordId, selectedText, interactionMode, conversationHistory, isLargeContent } = requestBody;
    
    console.log(`Request received for ${assistantType} assistant, record ID: ${recordId}, mode: ${interactionMode || 'content'}`);
    
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
      
      // Get the current content
      const contentRecord = await getContentRecord(recordId);
      const currentContent = contentRecord?.fields?.Content || '';
      
      // Strip HTML from content to focus on text
      const strippedContent = stripHtml(currentContent);
      
      // Extract document structure for context
      const documentStructure = extractDocumentStructure(currentContent);
      
      // Process conversation history for context
      let historyText = '';
      if (conversationHistory && conversationHistory.length > 0) {
        historyText = 'Previous conversation:\n';
        // Only include the last few messages to avoid token limits
        const recentHistory = conversationHistory.slice(Math.max(0, conversationHistory.length - 6));
        recentHistory.forEach(entry => {
          historyText += `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content.substring(0, 300)}${entry.content.length > 300 ? '...' : ''}\n`;
        });
        historyText += '\n';
      }
      
      // Determine the user prompt based on interaction mode
      let userPrompt;
      
      if (!interactionMode || interactionMode === 'content') {
        // Content mode - focused on generating suggestions
        console.log('Using content mode prompt');
        
        userPrompt = `I'm working on a document with the following detailed structure:
${documentStructure}

When making improvements:
1. Pay close attention to the document's existing structure and formatting
2. Maintain header levels (h1, h2, h3) as they currently exist
3. Preserve the document flow and section organization
4. When replacing text, match the exact HTML structure of the original

${selectedText ? `The user has selected this specific portion of text:
"""
${stripHtml(selectedText)}
"""

Your task is to IMMEDIATELY improve this text without asking questions.
The selected text is part of this larger document:
"""
${strippedContent}
"""` : `Here's the current content I'm working with:
        
"""
${strippedContent}
"""

Your task is to IMMEDIATELY improve this content without asking questions.`}

${historyText ? `Our previous conversation about this content:\n${historyText}\n` : ''}

User's request: ${prompt}

IMPORTANT HTML FORMATTING INSTRUCTIONS:
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
10. Keep the HTML structure simple and linear

When suggesting improvements:
1. For headline replacements, output JUST <h1>New Headline</h1> with NO extra tags
2. For paragraph replacements, use proper <p>New paragraph content</p> tags
3. Format each option clearly with "Option 1:", "Option 2:", etc.
4. When providing multiple options, ensure each option is complete, valid HTML
5. For word or phrase replacements, do not wrap with unnecessary tags

CRITICAL: Test your HTML output to ensure there are no repeated phrases, fragments or duplicate tag closures.`;
      } else {
        // Conversation mode with history awareness
        console.log('Using conversation mode prompt');
        
        userPrompt = `You are having an ongoing conversation with the user about their content.

${historyText}
Here's the context:
- The document they're working on: "${strippedContent.substring(0, 200)}${strippedContent.length > 200 ? '...' : ''}"
- Their current question/message: "${prompt}"

Respond conversationally as a helpful writing assistant, remembering the context of your previous conversation. Only provide specific content suggestions if directly asked.`;
      }
      
      // Token checking and content size validation
      const selectedTextContent = selectedText ? stripHtml(selectedText) : '';
      const contentToProcess = selectedText ? selectedTextContent : strippedContent;

      if (isLargeContent || estimateTokenCount(contentToProcess) > 4000) {
        console.log('Large content detected, checking token limits');
        
        // If we're likely to exceed token limits
        if (willExceedTokenLimit(contentToProcess, prompt, 10000)) {
          console.log('Content likely exceeds token limits, using chunking strategy');
          
          // For selected text operations, just warn if it's too big
          if (selectedText && estimateTokenCount(selectedTextContent) > 8000) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                error: 'Selected text too large',
                message: 'The selected text is too large for AI processing. Please select a smaller portion of text.'
              })
            };
          }
          
          // For whole document operations on large content
          if (!selectedText && estimateTokenCount(strippedContent) > 8000) {
            // Split content into chunks and process differently
            const chunks = splitContent(strippedContent);
            
            // If we have multiple chunks, inform the user
            if (chunks.length > 1) {
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                  error: 'Content too large',
                  message: 'The document is too large to process all at once. Please select a specific section you want to work with.'
                })
              };
            }
          }
        }
      }
      
      // Validate the model
      const model = "claude-3-7-sonnet-20250219";
      
      console.log('Sending request to Anthropic API');
      
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
      
      // Check for specific error types
      let errorMessage = apiError.message;
      let statusCode = 500;
      
      // Check for token limits
      if (apiError.message && (
        apiError.message.includes('token limit') || 
        apiError.message.includes('max tokens') ||
        apiError.message.includes('too many tokens')
      )) {
        errorMessage = 'The content is too large for AI processing. Please select a smaller portion of text.';
        statusCode = 400;
      }
      
      // Check for timeout
      if (apiError.message && (
        apiError.message.includes('timeout') || 
        apiError.message.includes('ETIMEDOUT') ||
        apiError.message.includes('504')
      )) {
        errorMessage = 'The request timed out. This usually happens when processing very large content.';
        statusCode = 408;
      }
      
      // Check for rate limits
      if (apiError.response && apiError.response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
        statusCode = 429;
      }
      
      return {
        statusCode: statusCode,
        headers,
        body: JSON.stringify({ 
          error: 'Error from API',
          message: errorMessage,
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

// Function to get content record from Airtable
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
    // Properly format the filter formula for Airtable
    const filterFormula = encodeURIComponent(`AND({Key}="${assistantKey}", {Active}=TRUE())`);
    
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
    
    // Debug: Log the first assistant if available
    if (assistantsResponse.data.records.length > 0) {
      console.log('First matching assistant:', JSON.stringify({
        id: assistantsResponse.data.records[0].id,
        key: assistantsResponse.data.records[0].fields.Key,
        name: assistantsResponse.data.records[0].fields.Name
      }));
    } else {
      // If no assistants were found, log additional information
      console.log(`No assistants found with key: ${assistantKey} and Active=TRUE`);
      
      // Try without the Active filter to see if any assistants exist with this key
      const simpleFilter = encodeURIComponent(`{Key}="${assistantKey}"`);
      console.log(`Trying simpler filter: ${simpleFilter}`);
      
      const checkResponse = await axios.get(
        `https://api.airtable.com/v0/apptv25rN4A3SoYn8/AI%20Assistants?filterByFormula=${simpleFilter}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
          }
        }
      );
      
      if (checkResponse.data && checkResponse.data.records && checkResponse.data.records.length > 0) {
        console.log(`Found ${checkResponse.data.records.length} assistants with key "${assistantKey}" but they may not be active`);
      } else {
        console.log(`No assistants found with key: ${assistantKey} at all`);
      }
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
    
    if (error.response) {
      console.error('Error response details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: JSON.stringify(error.response.data).substring(0, 500) // Log first 500 chars
      });
    }
    
    console.error('Error stack:', error.stack);
    throw error;
  }
}
