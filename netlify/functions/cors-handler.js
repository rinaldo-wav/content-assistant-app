exports.handler = async function(event, context) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      },
      body: JSON.stringify({ message: "CORS OK" })
    };
  };