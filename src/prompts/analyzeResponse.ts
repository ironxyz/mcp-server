/**
 * Analyze Response Prompt Handler
 *
 * This prompt helps users understand and interpret API response data,
 * providing insights about data structure, next steps, and related endpoints.
 */

import { type AnalyzeResponsePromptArgs } from "../types.js";

/**
 * Handle the analyze-response prompt
 */
export async function handleAnalyzeResponsePrompt(
  args: AnalyzeResponsePromptArgs
): Promise<{
  messages: Array<{
    role: "assistant";
    content: {
      type: "text";
      text: string;
    };
  }>;
}> {
  const { response_data, endpoint_path, endpoint_method, goal } = args;

  let promptText = `# 🔍 API Response Analysis\n\n`;

  if (goal) {
    promptText += `**Your Goal**: ${goal}\n\n`;
  }

  promptText += `**Endpoint**: \`${endpoint_method.toUpperCase()} ${endpoint_path}\`\n\n`;

  // Parse the response data
  let parsedData: unknown;
  try {
    parsedData =
      typeof response_data === "string"
        ? JSON.parse(response_data)
        : response_data;
  } catch (parseError) {
    parsedData = response_data;
  }

  // Analyze data structure
  promptText += `## 📊 Data Structure Analysis\n\n`;

  if (Array.isArray(parsedData)) {
    promptText += `**Type**: Array with ${parsedData.length} items\n\n`;

    if (parsedData.length > 0) {
      const firstItem = parsedData[0];
      if (typeof firstItem === "object" && firstItem !== null) {
        const sampleKeys = Object.keys(firstItem);
        promptText += `**Sample Item Structure** (from first item):\n`;
        for (const key of sampleKeys.slice(0, 10)) {
          const value = (firstItem as Record<string, unknown>)[key];
          promptText += `- \`${key}\`: ${typeof value}\n`;
        }
        if (sampleKeys.length > 10) {
          promptText += `- ... and ${sampleKeys.length - 10} more fields\n`;
        }
        promptText += `\n`;
      }
    }

    // Array-specific insights
    if (parsedData.length === 0) {
      promptText += `💡 **Insight**: Empty array - no items found. This could mean:\n`;
      promptText += `- No data exists yet for your query\n`;
      promptText += `- Filters are too restrictive\n`;
      promptText += `- Check query parameters or pagination\n\n`;
    } else {
      promptText += `💡 **Insight**: Found ${parsedData.length} items. Consider:\n`;
      promptText += `- Using pagination if working with large datasets\n`;
      promptText += `- Filtering results with query parameters\n`;
      promptText += `- Processing items individually for detailed operations\n\n`;
    }
  } else if (typeof parsedData === "object" && parsedData !== null) {
    const keys = Object.keys(parsedData);
    promptText += `**Type**: Object with ${keys.length} properties\n\n`;

    promptText += `**Properties**:\n`;
    for (const key of keys.slice(0, 15)) {
      const value = (parsedData as Record<string, unknown>)[key];
      promptText += `- \`${key}\`: ${typeof value}`;
      if (key.toLowerCase().includes("id")) {
        promptText += ` 🆔`;
      }
      if (key.toLowerCase().includes("status")) {
        promptText += ` 📊`;
      }
      if (
        key.toLowerCase().includes("created") ||
        key.toLowerCase().includes("updated")
      ) {
        promptText += ` 🕒`;
      }
      promptText += `\n`;
    }
    if (keys.length > 15) {
      promptText += `- ... and ${keys.length - 15} more properties\n`;
    }
    promptText += `\n`;
  } else {
    promptText += `**Type**: ${typeof parsedData}\n`;
    promptText += `**Value**: \`${String(parsedData)}\`\n\n`;
  }

  // Key insights and patterns
  promptText += `## 💡 Key Insights\n\n`;

  // Look for common patterns
  if (typeof parsedData === "object" && parsedData !== null) {
    const dataObj = parsedData as Record<string, unknown>;

    // Check for ID fields
    const idFields = Object.keys(dataObj).filter(
      (k) => k.toLowerCase().includes("id") || k === "uuid"
    );
    if (idFields.length > 0) {
      promptText += `🆔 **Identifiers Found**: `;
      promptText += idFields.map((f) => `\`${f}\``).join(", ");
      promptText += `\n- Save these IDs for future API calls\n`;
      promptText += `- Use them to fetch detailed information or perform updates\n\n`;
    }

    // Check for status fields
    const statusFields = Object.keys(dataObj).filter(
      (k) =>
        k.toLowerCase().includes("status") || k.toLowerCase().includes("state")
    );
    if (statusFields.length > 0) {
      promptText += `📊 **Status Fields**: `;
      promptText += statusFields
        .map((f) => `\`${f}: ${dataObj[f]}\``)
        .join(", ");
      promptText += `\n- Monitor status changes for workflow progress\n`;
      promptText += `- Different statuses may require different actions\n\n`;
    }

    // Check for timestamp fields
    const timeFields = Object.keys(dataObj).filter(
      (k) =>
        k.toLowerCase().includes("created") ||
        k.toLowerCase().includes("updated") ||
        k.toLowerCase().includes("time") ||
        k.toLowerCase().includes("date")
    );
    if (timeFields.length > 0) {
      promptText += `🕒 **Timestamp Fields**: `;
      promptText += timeFields.map((f) => `\`${f}\``).join(", ");
      promptText += `\n- Track creation and modification times\n`;
      promptText += `- Useful for sorting and filtering by date\n\n`;
    }
  }

  // Suggest next steps
  promptText += `## 🎯 Suggested Next Steps\n\n`;

  if (Array.isArray(parsedData) && parsedData.length > 0) {
    const firstItem = parsedData[0];
    if (
      typeof firstItem === "object" &&
      firstItem !== null &&
      "id" in firstItem
    ) {
      promptText += `### 🔍 Detailed Item Inspection\n`;
      promptText += `Get detailed information about a specific item:\n`;
      promptText += `\`\`\`\n`;
      promptText += `# Use the ID from any item to get full details\n`;
      promptText += `invoke-api-endpoint(\n`;
      promptText += `  path="${endpoint_path}/${String(firstItem.id)}",\n`;
      promptText += `  method="GET"\n`;
      promptText += `)\n\`\`\`\n\n`;
    }

    promptText += `### 📄 Pagination\n`;
    promptText += `If you need more items, check for pagination:\n`;
    promptText += `\`\`\`\n`;
    promptText += `invoke-api-endpoint(\n`;
    promptText += `  path="${endpoint_path}",\n`;
    promptText += `  method="GET",\n`;
    promptText += `  parameters={\n`;
    promptText += `    "page": 2,\n`;
    promptText += `    "page_size": 50\n`;
    promptText += `  }\n`;
    promptText += `)\n\`\`\`\n\n`;
  } else if (
    typeof parsedData === "object" &&
    parsedData !== null &&
    "id" in parsedData
  ) {
    promptText += `### ✏️ Update This Resource\n`;
    promptText += `Modify this resource if needed:\n`;
    promptText += `\`\`\`\n`;
    promptText += `invoke-api-endpoint(\n`;
    promptText += `  path="${endpoint_path}/${String(
      (parsedData as Record<string, unknown>).id
    )}",\n`;
    promptText += `  method="PUT",\n`;
    promptText += `  body={\n`;
    promptText += `    // Add fields you want to update\n`;
    promptText += `  }\n`;
    promptText += `)\n\`\`\`\n\n`;

    promptText += `### 🗑️ Delete This Resource\n`;
    promptText += `Remove this resource if no longer needed:\n`;
    promptText += `\`\`\`\n`;
    promptText += `invoke-api-endpoint(\n`;
    promptText += `  path="${endpoint_path}/${String(
      (parsedData as Record<string, unknown>).id
    )}",\n`;
    promptText += `  method="DELETE"\n`;
    promptText += `)\n\`\`\`\n\n`;
  }

  // Related endpoints suggestions
  promptText += `### 🔗 Explore Related Endpoints\n`;
  promptText += `Discover endpoints related to this data:\n`;
  promptText += `\`\`\`\n`;
  promptText += `list-all-endpoints()\n`;
  promptText += `\`\`\`\n\n`;

  if (goal) {
    promptText += `### 🎯 Goal-Specific Recommendations\n`;
    promptText += `Based on your goal "${goal}":\n\n`;

    if (
      goal.toLowerCase().includes("create") ||
      goal.toLowerCase().includes("add")
    ) {
      promptText += `- ✅ If this was a creation request, save the returned ID for future operations\n`;
      promptText += `- 🔍 Verify the created resource has the expected properties\n`;
      promptText += `- 📋 Check if any additional setup steps are needed\n`;
    } else if (
      goal.toLowerCase().includes("list") ||
      goal.toLowerCase().includes("get")
    ) {
      promptText += `- 🎯 Use filters to narrow down results if needed\n`;
      promptText += `- 📊 Consider the data structure for your application's needs\n`;
      promptText += `- 🔍 Drill down into specific items for detailed operations\n`;
    } else if (
      goal.toLowerCase().includes("update") ||
      goal.toLowerCase().includes("modify")
    ) {
      promptText += `- ✅ Verify the update was successful by checking modified fields\n`;
      promptText += `- 🕒 Note the updated timestamp for tracking changes\n`;
      promptText += `- 🔄 Consider if dependent resources need updates too\n`;
    }
    promptText += `\n`;
  }

  // Data quality and validation
  promptText += `## ✅ Data Quality Check\n\n`;
  if (typeof parsedData === "object" && parsedData !== null) {
    promptText += `### Field Completeness\n`;
    const dataObj = parsedData as Record<string, unknown>;
    const nullFields = Object.entries(dataObj)
      .filter(
        ([, value]) => value === null || value === undefined || value === ""
      )
      .map(([key]) => key);

    if (nullFields.length > 0) {
      promptText += `⚠️ **Empty/null fields**: ${nullFields
        .slice(0, 5)
        .map((f) => `\`${f}\``)
        .join(", ")}`;
      if (nullFields.length > 5) {
        promptText += ` and ${nullFields.length - 5} more`;
      }
      promptText += `\n- Consider if these fields should have values\n`;
      promptText += `- May indicate incomplete data or optional fields\n\n`;
    } else {
      promptText += `✅ All fields appear to have values\n\n`;
    }
  }

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
