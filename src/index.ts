#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createRequire } from "module";

import { formatApiResponse, formatApiError } from "./formatters/apiResponse.js";
import { handleFindEndpointPrompt } from "./prompts/findEndpoint.js";
import { handleTestEndpointPrompt } from "./prompts/testEndpoint.js";
import { handleAnalyzeResponsePrompt } from "./prompts/analyzeResponse.js";
import {
  type OpenAPISpec,
  type OpenAPIOperation,
  type OpenAPIPathItem,
  type EndpointSummary,
  type ApiSummary,
  type ServerConfig,
  type RequestInfo,
  type EndpointDetails,
  type ApiResponse,
  type ApiError,
  type ListAllEndpointsArgs,
  type GetApiSpecsArgs,
  type InvokeApiEndpointArgs,
  type HttpMethod,
  type JsonValue,
  isOpenAPIOperation,
  isJsonValue,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get version from package.json
const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const VERSION = packageJson.version;

class IronXyzMcpServer {
  private server: McpServer;
  private openApiSpec: OpenAPISpec | null = null;
  private config: ServerConfig;

  constructor() {
    this.server = new McpServer(
      { name: "@ironxyz/mcp-server", version: VERSION },
      { instructions: "Always call get-api-specs before invoke-api-endpoint — you need the full endpoint schema to construct a correct request. Use list-all-endpoints to discover available endpoints first." },
    );

    this.config = this.loadConfig();
    this.setupToolHandlers();
    this.setupPromptHandlers();
  }

  private loadConfig(): ServerConfig {
    const environment =
      (process.env.IRON_ENVIRONMENT as "sandbox" | "production") ||
      "production";

    // Default OpenAPI spec URLs for different environments
    const defaultSpecUrls = {
      sandbox: "https://api.sandbox.iron.xyz/spec",
      production: "https://api.iron.xyz/spec",
    };

    // Default base URLs for different environments
    const defaultBaseUrls = {
      sandbox: "https://api.sandbox.iron.xyz/api",
      production: "https://api.iron.xyz/api",
    };

    return {
      environment,
      openApiSpecUrl:
        process.env.IRON_OPENAPI_SPEC_URL || defaultSpecUrls[environment],
      localSpecPath:
        process.env.IRON_LOCAL_SPEC_PATH ||
        path.join(__dirname, "..", "ironxyz-openapi-spec.yaml"),
      apiKey: process.env.IRON_API_KEY,
      readOnlyMode: process.env.IRON_READ_ONLY_MODE === "true",
      baseUrl: process.env.IRON_BASE_URL || defaultBaseUrls[environment],
    };
  }

  private async loadOpenApiSpec(): Promise<OpenAPISpec> {
    if (this.openApiSpec) {
      return this.openApiSpec;
    }

    try {
      let specContent: string;

      // Try to fetch from URL first (if configured), then fall back to local file
      if (this.config.openApiSpecUrl) {
        try {
          console.error(
            `Loading OpenAPI spec from: ${this.config.openApiSpecUrl}`
          );
          const response = await axios.get(this.config.openApiSpecUrl, {
            timeout: 10000,
            headers: {
              Accept:
                "application/yaml, application/json, text/yaml, text/plain",
            },
          });
          specContent =
            typeof response.data === "string"
              ? response.data
              : JSON.stringify(response.data);
        } catch (fetchError) {
          console.error(`Failed to fetch OpenAPI spec from URL: ${fetchError}`);
          console.error(
            `Falling back to local spec file: ${this.config.localSpecPath}`
          );
          specContent = fs.readFileSync(this.config.localSpecPath!, "utf8");
        }
      } else {
        specContent = fs.readFileSync(this.config.localSpecPath!, "utf8");
      }

      // Parse YAML or JSON
      try {
        this.openApiSpec = yaml.load(specContent) as OpenAPISpec;
      } catch (yamlError) {
        // Try parsing as JSON if YAML fails
        this.openApiSpec = JSON.parse(specContent) as OpenAPISpec;
      }

      console.error(
        `Successfully loaded OpenAPI spec for ${this.config.environment} environment`
      );
      return this.openApiSpec;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to load OpenAPI spec: ${error}`
      );
    }
  }

  private extractEndpointSummaries(spec: OpenAPISpec): EndpointSummary[] {
    const summaries: EndpointSummary[] = [];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (isOpenAPIOperation(operation)) {
          summaries.push({
            path,
            method: method.toUpperCase(),
            summary: operation.summary,
            description: operation.description,
            operationId: operation.operationId,
            tags: operation.tags,
          });
        }
      }
    }

    return summaries;
  }

  private createSummary(spec: OpenAPISpec): ApiSummary {
    const endpoints = this.extractEndpointSummaries(spec);
    const groupedByTag: Record<string, EndpointSummary[]> = {};

    endpoints.forEach((endpoint) => {
      const tag = endpoint.tags?.[0] || "default";
      if (!groupedByTag[tag]) {
        groupedByTag[tag] = [];
      }
      groupedByTag[tag].push(endpoint);
    });

    return {
      info: spec.info,
      totalEndpoints: endpoints.length,
      endpointsByTag: groupedByTag,
    };
  }

  private resolveSchemaReferences(
    obj: JsonValue,
    spec: OpenAPISpec,
    visited: Set<string> = new Set()
  ): JsonValue {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) =>
        this.resolveSchemaReferences(item, spec, visited)
      );
    }

    // Handle $ref
    if (typeof obj === "object" && "$ref" in obj) {
      const ref = obj.$ref as string;
      if (visited.has(ref)) {
        return { $ref: ref }; // Prevent infinite recursion
      }
      visited.add(ref);

      // Parse the reference path
      const parts = ref.split("/");
      if (
        parts[0] === "#" &&
        parts[1] === "components" &&
        parts[2] === "schemas"
      ) {
        const schemaName = parts[3];
        const referencedSchema = spec.components?.schemas?.[schemaName];
        if (referencedSchema) {
          return this.resolveSchemaReferences(
            referencedSchema as JsonValue,
            spec,
            visited
          );
        }
      }
      return obj; // Return original if can't resolve
    }

    // Recursively resolve references in object properties
    const resolved: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isJsonValue(value)) {
        resolved[key] = this.resolveSchemaReferences(value, spec, visited);
      }
    }

    return resolved;
  }

  /**
   * Match a concrete path (e.g. "/identifications/abc123") against OpenAPI
   * path templates (e.g. "/identifications/{id}"). Returns the matching
   * template key or null.
   */
  private findMatchingPathTemplate(
    spec: OpenAPISpec,
    path: string
  ): string | null {
    // Exact match first
    if (spec.paths[path]) return path;

    // Try matching against templates
    for (const template of Object.keys(spec.paths)) {
      const regex = new RegExp(
        "^" + template.replace(/\{[^}]+\}/g, "([^/]+)") + "$"
      );
      if (regex.test(path)) return template;
    }

    return null;
  }

  private getEndpointDetails(
    spec: OpenAPISpec,
    path: string,
    method: string
  ): EndpointDetails | null {
    const template = this.findMatchingPathTemplate(spec, path);
    if (!template) return null;

    const pathItem = spec.paths[template];
    if (!pathItem) return null;

    const operation = pathItem[
      method.toLowerCase() as keyof OpenAPIPathItem
    ] as OpenAPIOperation | undefined;
    if (!operation) return null;

    return {
      summary: operation.summary,
      description: operation.description,
      operationId: operation.operationId,
      parameters: operation.parameters,
      requestBody: operation.requestBody,
      responses: operation.responses,
      tags: operation.tags,
    };
  }

  private setupToolHandlers() {
    this.server.registerTool("list-all-endpoints", {
      description:
        "Get a comprehensive overview of all available API endpoints organized by category/tag. Use this to explore the API structure and find endpoints related to your goal.",
      inputSchema: {
        filterByTag: z.string().optional().describe("Filter endpoints by tag (e.g., 'Customer', 'Autoramp')"),
      },
      annotations: { readOnlyHint: true },
    }, async ({ filterByTag }) => {
      return await this.handleListAllEndpoints({ filterByTag });
    });

    this.server.registerTool("get-api-specs", {
      description:
        "Get detailed specifications for a specific API endpoint including parameters, request/response schemas, and examples. Should be used to get a deeper understanding of an API endpoint you will use for code generation or for real API invoking. In case you intend to use the invoke-api-endpoint MCP tool, ALWAYS use this before, so you understand the full context of an API.",
      inputSchema: {
        path: z.string().describe("The API endpoint path — use the template form from list-all-endpoints (e.g., '/customers', '/identifications/{id}') or a resolved path (e.g., '/identifications/abc123')"),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
      },
      annotations: { readOnlyHint: true },
    }, async ({ path, method }) => {
      return await this.handleGetApiSpecs({ path, method });
    });

    this.server.registerTool("invoke-api-endpoint", {
      description:
        "Make an actual API call to the Iron API. Use this ONLY after getting complete endpoint specifications with the get-api-specs MCP tool. This tool requires proper authentication and can be in read-only mode if configured.",
      inputSchema: {
        path: z.string().describe("The API endpoint path — either a template (e.g., '/identifications/{id}') with path params in parameters, or an already-resolved path (e.g., '/identifications/abc123')"),
        method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).describe("HTTP method"),
        parameters: z.record(z.unknown()).optional().describe("Path and query parameters as key-value pairs. Path parameters (e.g., {id}) are substituted into the path template; remaining parameters are appended as query string"),
        body: z.record(z.unknown()).optional().describe("Request body for POST/PUT/PATCH requests"),
        headers: z.record(z.string()).optional().describe("Additional headers as key-value pairs"),
      },
      annotations: { openWorldHint: true },
    }, async ({ path, method, parameters, body, headers }) => {
      return await this.handleInvokeApiEndpoint({ path, method, parameters, body, headers });
    });
  }

  private setupPromptHandlers() {
    this.server.registerPrompt("find-endpoint", {
      description:
        "Discover the right API endpoint for your goal. This prompt provides intelligent suggestions and guides you through the proper workflow: list-all-endpoints -> get-api-specs -> invoke-api-endpoint",
      argsSchema: {
        goal: z.string().describe("Describe what you want to accomplish (e.g., 'create a customer', 'list transactions', 'get autoramp details')"),
      },
    }, async ({ goal }) => {
      return await handleFindEndpointPrompt(
        { goal },
        (spec: OpenAPISpec) => this.createSummary(spec),
        () => this.loadOpenApiSpec()
      );
    });

    this.server.registerPrompt("test-endpoint", {
      description:
        "Get step-by-step guidance for testing a specific API endpoint. Provides parameter examples, common use cases, and testing strategies.",
      argsSchema: {
        path: z.string().describe("The API endpoint path (e.g., '/customers')"),
        method: z.string().describe("HTTP method (GET, POST, PUT, DELETE)"),
        goal: z.string().optional().describe("What you want to accomplish with this endpoint"),
      },
    }, async ({ path, method, goal }) => {
      return await handleTestEndpointPrompt(
        { path, method, goal },
        (spec: OpenAPISpec, p: string, m: string) => this.getEndpointDetails(spec, p, m),
        () => this.loadOpenApiSpec()
      );
    });

    this.server.registerPrompt("analyze-response", {
      description:
        "Analyze and understand API response data. Get insights about data structure, next steps, and related endpoints you might need.",
      argsSchema: {
        response_data: z.string().describe("The API response data (JSON string or formatted data)"),
        endpoint_path: z.string().describe("The endpoint path that returned this data"),
        endpoint_method: z.string().describe("The HTTP method used"),
        goal: z.string().optional().describe("Your overall goal to get more targeted analysis"),
      },
    }, async ({ response_data, endpoint_path, endpoint_method, goal }) => {
      return await handleAnalyzeResponsePrompt({
        response_data, endpoint_path, endpoint_method, goal,
      });
    });
  }

  private async handleListAllEndpoints(args: ListAllEndpointsArgs) {
    const spec = await this.loadOpenApiSpec();
    const result = this.createSummary(spec);

    // Filter by tag if specified
    if (args.filterByTag) {
      const filteredEndpoints = result.endpointsByTag[args.filterByTag];
      if (filteredEndpoints) {
        result.endpointsByTag = { [args.filterByTag]: filteredEndpoints };
        result.totalEndpoints = filteredEndpoints.length;
      } else {
        result.endpointsByTag = {};
        result.totalEndpoints = 0;
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleGetApiSpecs(args: GetApiSpecsArgs) {
    const spec = await this.loadOpenApiSpec();
    const endpointDetails = this.getEndpointDetails(
      spec,
      args.path,
      args.method
    );

    if (!endpointDetails) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Endpoint not found: ${args.method} ${args.path}`
      );
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(endpointDetails, null, 2),
        },
      ],
    };
  }

  private async handleInvokeApiEndpoint(args: InvokeApiEndpointArgs) {
    if (this.config.readOnlyMode) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "API calls are disabled in read-only mode. Use environment variable IRON_READ_ONLY_MODE=false to enable."
      );
    }

    if (!this.config.apiKey) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "API key is required. Set the IRON_API_KEY environment variable."
      );
    }

    const spec = await this.loadOpenApiSpec();
    const endpointDetails = this.getEndpointDetails(
      spec,
      args.path,
      args.method
    );

    if (!endpointDetails) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Endpoint not found: ${args.method} ${args.path}`
      );
    }

    try {
      const { method, parameters, body, headers } = args;
      let { path } = args;

      // Substitute path parameters (e.g., /identifications/{id} -> /identifications/abc123)
      const remainingParams: Record<string, unknown> = { ...parameters };
      if (parameters) {
        const templateParams = path.match(/\{([^}]+)\}/g);
        if (templateParams) {
          for (const tpl of templateParams) {
            const paramName = tpl.slice(1, -1);
            if (paramName in remainingParams) {
              path = path.replace(tpl, encodeURIComponent(String(remainingParams[paramName])));
              delete remainingParams[paramName];
            }
          }
        }
      }

      // Build the full URL
      let url = `${this.config.baseUrl}${path}`;

      // Add remaining parameters as query string
      if (Object.keys(remainingParams).length > 0) {
        const urlParams = new URLSearchParams();
        Object.entries(remainingParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            urlParams.append(key, String(value));
          }
        });
        const queryString = urlParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Prepare headers
      const requestHeaders: Record<string, string> = {
        "X-API-key": this.config.apiKey,
        "Content-Type": "application/json",
        ...headers,
      };

      // Make the request
      const requestConfig = {
        method: method as HttpMethod,
        url,
        headers: requestHeaders,
        data: body ?? undefined,
        timeout: 30000,
      };

      const response = await axios(requestConfig);

      // Convert Axios response to our ApiResponse type
      const apiResponse: ApiResponse = {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        // Convert complex Axios headers to simple Record<string, string>
        headers: Object.entries(response.headers || {}).reduce(
          (acc, [key, value]) => {
            if (typeof value === "string") {
              acc[key] = value;
            } else if (value != null) {
              acc[key] = String(value);
            }
            return acc;
          },
          {} as Record<string, string>
        ),
      };

      const requestInfo: RequestInfo = { path, method };
      const formattedResponse = formatApiResponse(
        apiResponse,
        endpointDetails,
        url,
        requestInfo
      );

      return {
        content: [
          {
            type: "text" as const,
            text: formattedResponse,
          },
        ],
      };
    } catch (error: unknown) {
      const requestInfo: RequestInfo = { path: args.path, method: args.method };
      const url = `${this.config.baseUrl}${args.path}`;

      if (axios.isAxiosError(error)) {
        const apiError: ApiError = {
          message: error.message,
          code: error.code,
          response: error.response
            ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
              }
            : undefined,
        };

        const formattedError = formatApiError(apiError, requestInfo, url);
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: formattedError,
            },
          ],
        };
      } else {
        const genericError: ApiError = {
          message: error instanceof Error ? error.message : String(error),
        };

        const formattedError = formatApiError(genericError, requestInfo, url);
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: formattedError,
            },
          ],
        };
      }
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Iron.xyz MCP Server running...");
  }
}

const server = new IronXyzMcpServer();
server.run().catch(console.error);
