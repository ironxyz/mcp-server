/**
 * API Response Formatting Functions
 *
 * This module contains functions for formatting API responses and errors
 * into beautiful, readable markdown format for LLM consumption.
 */

import {
  type RequestInfo,
  type EndpointDetails,
  type ApiResponse,
  type ApiError,
} from "../types.js";

/**
 * Format a successful API response into markdown
 */
export function formatApiResponse<T = unknown>(
  response: ApiResponse<T>,
  endpointDetails: EndpointDetails,
  url: string,
  requestInfo: RequestInfo
): string {
  const { status, statusText, data } = response;
  const success = status >= 200 && status < 300;
  const statusEmoji = success
    ? "✅"
    : status >= 400 && status < 500
    ? "⚠️"
    : "❌";

  let markdown = `# API Response: ${requestInfo.method} ${requestInfo.path}\n\n`;

  // Request Summary
  markdown += `## 📋 Request Summary\n`;
  markdown += `- **Endpoint**: \`${requestInfo.method} ${requestInfo.path}\`\n`;
  markdown += `- **Operation**: ${endpointDetails.summary || "N/A"}\n`;
  markdown += `- **URL**: ${url}\n`;
  if (endpointDetails.operationId) {
    markdown += `- **Operation ID**: \`${endpointDetails.operationId}\`\n`;
  }
  markdown += `\n`;

  // Status
  markdown += `## ${statusEmoji} Response Status\n`;
  markdown += `**${status} ${statusText}**\n\n`;

  if (success) {
    markdown += `✅ **Success** - The request completed successfully.\n\n`;
  } else if (status >= 400 && status < 500) {
    markdown += `⚠️ **Client Error** - There was an issue with the request.\n\n`;
  } else {
    markdown += `❌ **Server Error** - The server encountered an error.\n\n`;
  }

  // Response Data - Show complete JSON response
  if (data) {
    markdown += `## 📄 Response Data\n\n`;
    markdown += `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n`;
  }

  return markdown;
}

/**
 * Format an API error into markdown
 */
export function formatApiError(
  error: ApiError,
  requestInfo: RequestInfo,
  url: string
): string {
  let markdown = `# API Error: ${requestInfo.method} ${requestInfo.path}\n\n`;

  markdown += `## ❌ Request Failed\n`;
  markdown += `- **Endpoint**: \`${requestInfo.method} ${requestInfo.path}\`\n`;
  markdown += `- **URL**: ${url}\n`;
  markdown += `- **Error**: ${error.message}\n\n`;

  if (error.response) {
    markdown += `## 📋 Error Details\n`;
    markdown += `- **Status**: ${error.response.status} ${error.response.statusText}\n`;
    if (error.response.data) {
      markdown += `- **Server Response**:\n`;
      markdown += `\`\`\`json\n${JSON.stringify(
        error.response.data,
        null,
        2
      )}\n\`\`\`\n\n`;
    }
  } else if (error.code) {
    markdown += `## 🔧 Technical Details\n`;
    markdown += `- **Error Code**: \`${error.code}\`\n`;
    if (error.code === "ECONNABORTED") {
      markdown += `- **Likely Cause**: Request timeout (30 seconds)\n`;
    } else if (error.code === "ENOTFOUND") {
      markdown += `- **Likely Cause**: Network connectivity issue\n`;
    }
    markdown += `\n`;
  }

  markdown += `## 💡 Troubleshooting\n`;
  markdown += `- Check if the endpoint path is correct\n`;
  markdown += `- Verify required parameters are provided\n`;
  markdown += `- Ensure API key is valid (if required)\n`;
  markdown += `- Check network connectivity\n\n`;

  return markdown;
}
