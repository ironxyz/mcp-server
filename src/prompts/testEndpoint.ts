/**
 * Test Endpoint Prompt Handler
 *
 * This prompt provides step-by-step guidance for testing specific API endpoints
 * with examples, parameter details, and common use cases.
 */

import {
  type TestEndpointPromptArgs,
  type EndpointDetails,
  type OpenAPISpec,
  type OpenAPIParameter,
} from "../types.js";

/**
 * Handle the test-endpoint prompt
 */
export async function handleTestEndpointPrompt(
  args: TestEndpointPromptArgs,
  getEndpointDetails: (
    spec: OpenAPISpec,
    path: string,
    method: string
  ) => EndpointDetails | null,
  loadOpenApiSpec: () => Promise<OpenAPISpec>
): Promise<{
  messages: Array<{
    role: "assistant";
    content: {
      type: "text";
      text: string;
    };
  }>;
}> {
  const { path, method, goal } = args;
  const spec = await loadOpenApiSpec();
  const endpointDetails = getEndpointDetails(spec, path, method);

  if (!endpointDetails) {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# ❌ Endpoint Not Found\n\n**${method.toUpperCase()} ${path}** was not found in the API specification.\n\nPlease check the path and method, or use the \`list-all-endpoints\` tool to see available endpoints.`,
          },
        },
      ],
    };
  }

  let promptText = `# 🧪 Testing Guide: ${method.toUpperCase()} ${path}\n\n`;

  if (goal) {
    promptText += `**Your Goal**: ${goal}\n\n`;
  }

  // Operation Summary
  promptText += `## 📋 Endpoint Overview\n\n`;
  promptText += `- **Operation**: ${
    endpointDetails.summary || "No summary available"
  }\n`;
  if (endpointDetails.operationId) {
    promptText += `- **Operation ID**: \`${endpointDetails.operationId}\`\n`;
  }
  if (endpointDetails.description) {
    promptText += `- **Description**: ${endpointDetails.description}\n`;
  }
  promptText += `\n`;

  // Parameters Section
  if (endpointDetails.parameters && endpointDetails.parameters.length > 0) {
    promptText += `## 🔧 Parameters\n\n`;

    const pathParams = endpointDetails.parameters.filter(
      (p: OpenAPIParameter) => p.in === "path"
    );
    const queryParams = endpointDetails.parameters.filter(
      (p: OpenAPIParameter) => p.in === "query"
    );
    const headerParams = endpointDetails.parameters.filter(
      (p: OpenAPIParameter) => p.in === "header"
    );

    if (pathParams.length > 0) {
      promptText += `### 🛤️ Path Parameters (Required)\n`;
      for (const param of pathParams) {
        promptText += `- **\`${param.name}\`** (${
          param.schema?.type || "string"
        }): ${param.description || "No description"}\n`;
      }
      promptText += `\n`;
    }

    if (queryParams.length > 0) {
      promptText += `### 🔍 Query Parameters\n`;
      for (const param of queryParams) {
        const required = param.required ? " *(required)*" : " *(optional)*";
        promptText += `- **\`${param.name}\`** (${
          param.schema?.type || "string"
        })${required}: ${param.description || "No description"}\n`;
      }
      promptText += `\n`;
    }

    if (headerParams.length > 0) {
      promptText += `### 📋 Header Parameters\n`;
      for (const param of headerParams) {
        const required = param.required ? " *(required)*" : " *(optional)*";
        promptText += `- **\`${param.name}\`** (${
          param.schema?.type || "string"
        })${required}: ${param.description || "No description"}\n`;
      }
      promptText += `\n`;
    }
  }

  // Request Body Section
  if (endpointDetails.requestBody) {
    promptText += `## 📦 Request Body\n\n`;
    if (endpointDetails.requestBody.description) {
      promptText += `${endpointDetails.requestBody.description}\n\n`;
    }

    const content = endpointDetails.requestBody.content;
    if (content) {
      for (const [mediaType, mediaTypeObj] of Object.entries(content)) {
        promptText += `### Content-Type: \`${mediaType}\`\n\n`;
        if (mediaTypeObj.schema) {
          const schema = mediaTypeObj.schema;
          if (schema.type === "object" && schema.properties) {
            promptText += `**Required Fields**:\n`;
            for (const [field, prop] of Object.entries(schema.properties)) {
              const required = schema.required?.includes(field)
                ? " *(required)*"
                : " *(optional)*";
              promptText += `- **\`${field}\`** (${prop.type || "object"}): ${
                prop.description || "No description"
              }${required}\n`;
            }
          }
        }
        promptText += `\n`;
      }
    }
  }

  // Testing Steps
  promptText += `## 🚀 Testing Steps\n\n`;

  // Check if query parameters exist for the example
  const hasQueryParams = endpointDetails.parameters?.some(
    (p: OpenAPIParameter) => p.in === "query"
  );

  promptText += `### 1. **Get Complete Specifications** (if not done already)\n`;
  promptText += `\`\`\`\n`;
  promptText += `get-api-specs(\n`;
  promptText += `  path="${path}",\n`;
  promptText += `  method="${method.toUpperCase()}"\n`;
  promptText += `)\n\`\`\`\n\n`;

  promptText += `### 2. **Make the API Call**\n`;
  promptText += `\`\`\`\n`;
  promptText += `invoke-api-endpoint(\n`;
  promptText += `  path="${path}",\n`;
  promptText += `  method="${method.toUpperCase()}"`;

  if (hasQueryParams) {
    promptText += `,\n  parameters={\n    // Add query parameters here based on specs above\n  }`;
  }

  if (endpointDetails.requestBody) {
    promptText += `,\n  body={\n    // Add request body fields here based on specs above\n  }`;
  }

  promptText += `\n)\n\`\`\`\n\n`;

  // Response Information
  if (endpointDetails.responses) {
    promptText += `## 📄 Expected Responses\n\n`;
    for (const [status, response] of Object.entries(
      endpointDetails.responses
    )) {
      const statusNum = parseInt(status);
      const emoji =
        statusNum >= 200 && statusNum < 300
          ? "✅"
          : statusNum >= 400
          ? "❌"
          : "ℹ️";
      promptText += `### ${emoji} ${status} - ${response.description}\n`;

      if (response.content) {
        for (const [mediaType, content] of Object.entries(response.content)) {
          if (content.example) {
            promptText += `**Example Response** (\`${mediaType}\`):\n`;
            promptText += `\`\`\`json\n${JSON.stringify(
              content.example,
              null,
              2
            )}\n\`\`\`\n`;
          }
        }
      }
      promptText += `\n`;
    }
  }

  // Tips and Best Practices
  promptText += `## 💡 Tips & Best Practices\n\n`;
  if (method.toUpperCase() === "GET") {
    promptText += `- This is a **GET** request, so no request body is needed\n`;
    promptText += `- Focus on query parameters for filtering and pagination\n`;
  } else if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    promptText += `- This endpoint requires a **request body**\n`;
    promptText += `- Make sure to include all required fields\n`;
    promptText += `- Check the Content-Type header (usually \`application/json\`)\n`;
  }

  promptText += `- Always check the response status code\n`;
  promptText += `- Look for rate limiting headers in the response\n`;
  promptText += `- Save important IDs from responses for future API calls\n\n`;

  promptText += `## 🔗 Next Steps\n\n`;
  promptText += `After testing this endpoint:\n\n`;
  promptText += `1. **Analyze the response** using the \`analyze-response\` prompt\n`;
  promptText += `2. **Check related endpoints** using \`list-all-endpoints\`\n`;
  promptText += `3. **Test error scenarios** by providing invalid data\n`;
  promptText += `4. **Document your findings** for future reference\n\n`;

  return {
    messages: [
      {
        role: "assistant",
        content: {
          type: "text",
          text: promptText,
        },
      },
    ],
  };
}
