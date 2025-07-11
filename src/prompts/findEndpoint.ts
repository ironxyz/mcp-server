/**
 * Find Endpoint Prompt Handler
 *
 * This prompt helps users discover the right API endpoint based on their goals.
 * It guides them through the proper workflow: list-all-endpoints -> get-api-specs -> invoke-api-endpoint
 */

import {
  type EndpointSummary,
  type ApiSummary,
  type FindEndpointPromptArgs,
  type OpenAPISpec,
} from "../types.js";

/**
 * Handle the find-endpoint prompt with enhanced workflow guidance
 */
export async function handleFindEndpointPrompt(
  args: FindEndpointPromptArgs,
  createSummary: (spec: OpenAPISpec) => ApiSummary,
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
  const { goal } = args;
  const spec = await loadOpenApiSpec();
  const summary = createSummary(spec);

  // Create intelligent endpoint suggestions based on the goal
  const goalLower = goal.toLowerCase();

  // Smart matching logic
  const matches: Array<{ category: string; endpoints: EndpointSummary[] }> = [];

  for (const [category, endpoints] of Object.entries(summary.endpointsByTag)) {
    const relevantEndpoints = (endpoints as EndpointSummary[]).filter(
      (endpoint) => {
        const searchText =
          `${endpoint.summary} ${endpoint.description} ${endpoint.path} ${endpoint.operationId}`.toLowerCase();

        // Check for keyword matches
        if (
          goalLower.includes("create") &&
          (searchText.includes("create") || searchText.includes("post"))
        )
          return true;
        if (goalLower.includes("get") && searchText.includes("get"))
          return true;
        if (
          goalLower.includes("list") &&
          (searchText.includes("list") || searchText.includes("get all"))
        )
          return true;
        if (
          goalLower.includes("update") &&
          (searchText.includes("update") || searchText.includes("put"))
        )
          return true;
        if (goalLower.includes("delete") && searchText.includes("delete"))
          return true;
        if (goalLower.includes("customer") && searchText.includes("customer"))
          return true;
        if (
          goalLower.includes("transaction") &&
          searchText.includes("transaction")
        )
          return true;
        if (goalLower.includes("autoramp") && searchText.includes("autoramp"))
          return true;
        if (goalLower.includes("payment") && searchText.includes("payment"))
          return true;
        if (goalLower.includes("address") && searchText.includes("address"))
          return true;
        if (goalLower.includes("webhook") && searchText.includes("webhook"))
          return true;

        return false;
      }
    );

    if (relevantEndpoints.length > 0) {
      matches.push({ category, endpoints: relevantEndpoints });
    }
  }

  let promptText = `# 🎯 Iron API Endpoint Discovery\n\n`;
  promptText += `**Your Goal**: ${goal}\n\n`;

  if (matches.length === 0) {
    promptText += `## 🔍 No Direct Matches Found\n\n`;
    promptText += `I couldn't find endpoints that directly match your goal. Here are some suggestions:\n\n`;
    promptText += `### 📋 All Available Categories:\n`;
    for (const [category, endpoints] of Object.entries(
      summary.endpointsByTag
    )) {
      promptText += `- **${category}** (${
        (endpoints as EndpointSummary[]).length
      } endpoints)\n`;
    }
    promptText += `\n### 💡 Tips:\n`;
    promptText += `- Try being more specific (e.g., "create a customer" instead of "customer")\n`;
    promptText += `- Use terms like: create, get, list, update, delete\n`;
    promptText += `- Mention specific resources: customer, transaction, autoramp, payment\n\n`;

    promptText += `## 🔄 Recommended Workflow\n\n`;
    promptText += `1. **🔍 Explore all endpoints first**:\n`;
    promptText += `   \`\`\`\n   Use: list-all-endpoints tool\n   \`\`\`\n\n`;
    promptText += `2. **📖 Get detailed specs** for promising endpoints:\n`;
    promptText += `   \`\`\`\n   Use: get-api-specs tool with specific path and method\n   \`\`\`\n\n`;
    promptText += `3. **🚀 Make the API call** with complete context:\n`;
    promptText += `   \`\`\`\n   Use: invoke-api-endpoint tool\n   \`\`\`\n\n`;
  } else {
    promptText += `## ✅ Recommended Endpoints\n\n`;

    // Show top matches with detailed workflow
    for (const match of matches.slice(0, 2)) {
      // Limit to top 2 categories
      promptText += `### 📂 ${match.category}\n\n`;

      for (const endpoint of match.endpoints.slice(0, 2)) {
        // Limit to top 2 per category
        promptText += `#### 🎯 \`${endpoint.method} ${endpoint.path}\`\n`;
        promptText += `**${endpoint.summary}**\n\n`;
        if (endpoint.description) {
          const shortDesc =
            endpoint.description.length > 200
              ? endpoint.description.substring(0, 200) + "..."
              : endpoint.description;
          promptText += `${shortDesc}\n\n`;
        }
        promptText += `*Operation ID: \`${endpoint.operationId}\`*\n\n`;
      }
    }

    promptText += `## 🔄 **IMPORTANT: Follow This Workflow**\n\n`;
    promptText += `⚠️ **Before using \`invoke-api-endpoint\`, you MUST follow this sequence:**\n\n`;

    promptText += `### Step 1: 📋 Get Complete Endpoint Details\n`;
    promptText += `For each endpoint you want to use, first get the complete specifications:\n\n`;

    // Generate specific get-api-specs examples for the matched endpoints
    let exampleEndpoint = matches[0]?.endpoints[0];
    if (exampleEndpoint) {
      promptText += `**Example for your goal:**\n`;
      promptText += `\`\`\`\n`;
      promptText += `get-api-specs(\n`;
      promptText += `  path="${exampleEndpoint.path}",\n`;
      promptText += `  method="${exampleEndpoint.method}"\n`;
      promptText += `)\n\`\`\`\n\n`;
    }

    promptText += `### Step 2: 🚀 Make the API Call\n`;
    promptText += `**Only after** you have the complete endpoint specifications from Step 1, then use:\n\n`;
    promptText += `\`\`\`\n`;
    promptText += `invoke-api-endpoint(\n`;
    promptText += `  path="<endpoint-path>",\n`;
    promptText += `  method="<method>",\n`;
    promptText += `  # Add parameters/body based on specs from Step 1\n`;
    promptText += `)\n\`\`\`\n\n`;

    promptText += `### 🎯 **Quick Start for Your Goal**\n\n`;
    if (matches.length > 0) {
      const topEndpoint = matches[0].endpoints[0];
      promptText += `**Recommended first step:**\n`;
      promptText += `\`\`\`\n`;
      promptText += `get-api-specs(path="${topEndpoint.path}", method="${topEndpoint.method}")\n`;
      promptText += `\`\`\`\n\n`;
      promptText += `This will show you exactly what parameters, headers, and request body you need.\n\n`;
    }
  }

  promptText += `## 📚 Additional Resources\n\n`;
  promptText += `- **🔍 Browse all endpoints**: Use \`list-all-endpoints\` to see the complete API catalog\n`;
  promptText += `- **📖 Get detailed specs**: Use \`get-api-specs\` for any endpoint path and method\n`;
  promptText += `- **🧪 Test with guidance**: Use \`test-endpoint\` prompt for step-by-step testing help\n`;
  promptText += `- **🔍 Analyze responses**: Use \`analyze-response\` prompt to understand API results\n\n`;

  promptText += `---\n\n`;
  promptText += `**⚠️ Remember**: Always use \`get-api-specs\` before \`invoke-api-endpoint\` to ensure you have the complete context!\n`;

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
