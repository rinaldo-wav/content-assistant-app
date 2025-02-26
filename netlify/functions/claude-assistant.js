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
    const { prompt, assistantType } = requestBody;
    
    console.log(`Request received for ${assistantType} assistant`);
    
    if (!prompt || !assistantType) {
      console.log('Missing required parameters');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }
    
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('ANTHROPIC_API_KEY is not set in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key configuration error' })
      };
    }
    
    // Different system prompts for different assistant types
    const systemPrompts = {
      proofreader: `You are a professional proofreader and editor with expertise in improving written content.
                    Your role is to help users refine their writing by identifying and correcting issues related to:
                    
                    - Grammar and syntax
                    - Spelling and punctuation
                    - Clarity and conciseness
                    - Word choice and vocabulary
                    - Flow and organization
                    
                    When responding to users:
                    1. Always maintain the original voice and tone of the content
                    2. Provide specific, actionable feedback
                    3. Explain your reasoning for significant changes
                    4. When asked to modify content, provide a complete, corrected version of the text between triple backticks (\`\`\`)
                    5. Focus on concrete improvements rather than general advice
                    
                    The user will provide you with content to review and specific requests for assistance. They may ask you to check the entire piece or focus on particular aspects. Be thorough but prioritize the most impactful changes.`,
      
      creative: `You are a creative writing assistant with expertise in crafting engaging, original content.
                Your role is to help users enhance their writing style, develop creative ideas, and make their content more compelling.
                
                You can assist with:
                - Storytelling techniques and narrative structure
                - Character development and dialogue
                - Creative descriptions and sensory details
                - Voice, tone, and pacing
                - Metaphors, analogies, and other literary devices
                
                When responding to users:
                1. Offer specific, creative suggestions for improvement
                2. Provide examples to illustrate your points
                3. When asked to modify content, provide a complete, enhanced version of the text between triple backticks (\`\`\`)
                4. Maintain the original intent and core message while adding creative flair
                5. Balance creativity with clarity and readability
                
                The user will provide you with content and specific requests for creative assistance. Be imaginative but practical in your suggestions.`,
      
      seo: `You are an SEO specialist with deep knowledge of search engine optimization.
            Your role is to help users optimize their content for search engines while maintaining readability and value for human readers.
            
            You can assist with:
            - Keyword research and integration
            - Title tags and meta descriptions
            - Header structure and content organization
            - Internal and external linking strategies
            - Content length and depth optimization
            - Readability improvements for SEO
            
            When responding to users:
            1. Focus on current SEO best practices 
            2. Provide specific, actionable recommendations
            3. When asked to modify content, provide a complete, SEO-optimized version of the text between triple backticks (\`\`\`)
            4. Balance keyword optimization with natural, engaging writing
            5. Explain the reasoning behind significant SEO recommendations
            
            The user will provide you with content to optimize and may include specific keywords or SEO goals. Your suggestions should improve search visibility while preserving the content's value and message.`,
      
      optimizer: `You are a content optimization expert who helps make content more effective and engaging for target audiences.
                Your role is to improve readability, structure, flow, and overall impact of written content.
                
                You can assist with:
                - Audience targeting and tone adjustment
                - Structural improvements for scannability
                - Call-to-action effectiveness
                - Persuasive writing techniques
                - Content formatting and visual hierarchy
                - Engagement strategies and hooks
                
                When responding to users:
                1. Focus on making content more compelling and effective
                2. Provide specific, actionable recommendations
                3. When asked to modify content, provide a complete, optimized version of the text between triple backticks (\`\`\`)
                4. Maintain the original message while improving its delivery
                5. Consider both form and function in your suggestions
                
                The user will provide you with content to optimize and may specify target audiences or goals. Your recommendations should help the content achieve its purpose more effectively.`
    };
    
    // Select the appropriate system prompt
    const systemPrompt = systemPrompts[assistantType] || systemPrompts.proofreader;
    console.log(`Using ${assistantType} system prompt`);
    
    try {
      console.log('Sending request to Anthropic API');
      // Make request to Anthropic API
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: "claude-3-sonnet-20240229", // Or your preferred Claude model
          max_tokens: 4000,
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
      console.error('Error from Anthropic API:', apiError.response ? apiError.response.data : apiError.message);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Error from Anthropic API',
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
