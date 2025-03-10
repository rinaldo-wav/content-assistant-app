const axios = require('axios');

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://portal.wearevery.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };
  
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { operation, recordId, filterFormula } = requestBody;
    
    if (!operation) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing operation parameter' })
      };
    }
    
    // Different operations we support
    switch (operation) {
  case 'test':
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Connection test successful' })
    };
        
      case 'getAssistants':
        return await getAssistants(recordId, headers);
      
      case 'getContentRecord':
        return await getContentRecord(recordId, headers);
        
      case 'getAssistantsByFilter':
        return await getAssistantsByFilter(filterFormula, headers);

      case 'updateContent':
        return await updateContent(requestBody.recordId, requestBody.fields, headers);
        
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unsupported operation: ${operation}` })
        };
    }
  } catch (error) {
    console.error('Error in Airtable proxy:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error processing your request',
        message: error.message
      })
    };
  }
};

// Function to get assistants for a content record
async function getAssistants(recordId, headers) {
  try {
    // First get the content record
    const contentResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Content/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    // Get the linked assistant IDs
    const linkedAssistantIds = contentResponse.data?.fields['AI Assistants'] || [];
    
    if (linkedAssistantIds.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ records: [] })
      };
    }
    
    // Format the filter formula
    const filterFormula = `AND(Active=TRUE(),OR(${linkedAssistantIds.map(id => `RECORD_ID()='${id}'`).join(',')}))`;
    
    // Get the assistants
    const assistantsResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/AI%20Assistants?filterByFormula=${encodeURIComponent(filterFormula)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(assistantsResponse.data)
    };
  } catch (error) {
    console.error('Error fetching assistants:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error fetching assistants',
        message: error.message
      })
    };
  }
}

// Function to get a specific content record
async function getContentRecord(recordId, headers) {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Content/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('Error fetching content record:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error fetching content record',
        message: error.message
      })
    };
  }
}

// Function to get assistants by a custom filter
async function getAssistantsByFilter(filterFormula, headers) {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/AI%20Assistants?filterByFormula=${encodeURIComponent(filterFormula)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('Error fetching assistants by filter:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error fetching assistants by filter',
        message: error.message
      })
    };
  }
}

// Function to update content in Airtable
async function updateContent(recordId, fields, headers) {
  try {
    const response = await axios.patch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Content/${recordId}`,
      {
        fields: fields
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('Error updating content:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error updating content',
        message: error.message
      })
    };
  }
}
