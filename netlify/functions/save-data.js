exports.handler = async (event, context) => {
  try {
    // Parse the request body
    const data = JSON.parse(event.body);

    // TODO: Implement your data saving logic here
    // Example: Save to a database, file system, or external service
    console.log('Received data:', data);

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Data saved successfully',
        data: data,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    console.error('Error saving data:', error);

    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Failed to save data',
        message: error.message,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};
