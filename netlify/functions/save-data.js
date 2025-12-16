const { Octokit } = require("@octokit/rest");

/**
 * Netlify Function: Save Data to GitHub Repository
 * Integrates with GitHub API using Octokit to store data files
 */

// Initialize Octokit with GitHub token from environment variables
const getOctokit = () => {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  
  return new Octokit({
    auth: token,
    // Add request timeout for reliability
    request: {
      timeout: 30000,
    },
  });
};

/**
 * Encode content to base64 for GitHub API
 * @param {string|object} content - Content to encode
 * @returns {string} Base64 encoded content
 */
const encodeContentToBase64 = (content) => {
  try {
    const contentString = typeof content === "string" ? content : JSON.stringify(content);
    return Buffer.from(contentString).toString("base64");
  } catch (error) {
    throw new Error(`Failed to encode content to base64: ${error.message}`);
  }
};

/**
 * Decode base64 content
 * @param {string} base64Content - Base64 encoded content
 * @returns {string} Decoded content
 */
const decodeBase64Content = (base64Content) => {
  try {
    return Buffer.from(base64Content, "base64").toString("utf-8");
  } catch (error) {
    throw new Error(`Failed to decode base64 content: ${error.message}`);
  }
};

/**
 * Get file SHA from GitHub repository
 * @param {object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @returns {promise<string|null>} File SHA or null if file doesn't exist
 */
const getFileSha = async (octokit, owner, repo, path) => {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });
    return response.data.sha;
  } catch (error) {
    if (error.status === 404) {
      // File doesn't exist yet, which is fine for creating
      return null;
    }
    throw new Error(`Failed to get file SHA: ${error.message}`);
  }
};

/**
 * Save or update file in GitHub repository
 * @param {object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string|object} content - File content
 * @param {string} message - Commit message
 * @param {string} branch - Branch name (defaults to main)
 * @returns {promise<object>} Response from GitHub API
 */
const saveFileToGithub = async (octokit, owner, repo, path, content, message, branch = "main") => {
  try {
    // Encode content to base64
    const base64Content = encodeContentToBase64(content);
    
    // Get existing file SHA if it exists
    const sha = await getFileSha(octokit, owner, repo, path);
    
    // Prepare commit parameters
    const params = {
      owner,
      repo,
      path,
      message,
      content: base64Content,
      branch,
    };
    
    // Add SHA if file exists (for updating)
    if (sha) {
      params.sha = sha;
    }
    
    // Create or update file
    const response = await octokit.repos.createOrUpdateFileContents(params);
    
    return {
      success: true,
      commit: response.data.commit.sha,
      path: response.data.content.path,
      message: `File ${sha ? "updated" : "created"} successfully at ${response.data.content.path}`,
    };
  } catch (error) {
    throw new Error(`Failed to save file to GitHub: ${error.message}`);
  }
};

/**
 * Read file from GitHub repository
 * @param {object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} branch - Branch name (defaults to main)
 * @returns {promise<string>} File content
 */
const readFileFromGithub = async (octokit, owner, repo, path, branch = "main") => {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    
    // Decode base64 content
    const content = decodeBase64Content(response.data.content);
    
    return content;
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`File not found at path: ${path}`);
    }
    throw new Error(`Failed to read file from GitHub: ${error.message}`);
  }
};

/**
 * Main Netlify function handler
 * @param {object} event - Netlify event object
 * @param {object} context - Netlify context object
 * @returns {promise<object>} Response object
 */
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };
  
  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight OK" }),
    };
  }
  
  try {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Method not allowed. Use POST." }),
      };
    }
    
    // Parse request body
    let requestBody;
    try {
      requestBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }
    
    // Validate required fields
    const { action, owner, repo, path, content, message, branch = "main" } = requestBody;
    
    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required field: action (save or read)" }),
      };
    }
    
    if (!owner || !repo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields: owner and repo" }),
      };
    }
    
    if (!path) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required field: path" }),
      };
    }
    
    // Initialize Octokit
    const octokit = getOctokit();
    
    // Handle different actions
    if (action === "save") {
      if (!content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing required field for save action: content" }),
        };
      }
      
      if (!message) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing required field for save action: message" }),
        };
      }
      
      const result = await saveFileToGithub(octokit, owner, repo, path, content, message, branch);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result),
      };
    } else if (action === "read") {
      const content = await readFileFromGithub(octokit, owner, repo, path, branch);
      
      // Attempt to parse as JSON if possible
      let parsedContent = content;
      try {
        parsedContent = JSON.parse(content);
      } catch {
        // Keep as string if not valid JSON
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          path,
          content: parsedContent,
          raw: content,
        }),
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid action. Use 'save' or 'read'." }),
      };
    }
  } catch (error) {
    console.error("Error in save-data function:", error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
