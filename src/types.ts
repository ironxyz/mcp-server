/**
 * TypeScript Types for Iron API MCP Server
 *
 * This file contains comprehensive type definitions for OpenAPI specifications,
 * API responses, and internal structures to replace all `any` types with proper typing.
 */

// =============================================================================
// OpenAPI Specification Types
// =============================================================================

export interface OpenAPIInfo {
  title?: string;
  version?: string;
  description?: string;
}

export interface OpenAPIParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: OpenAPISchema;
  explode?: boolean;
}

export interface OpenAPISchema {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object";
  format?: string;
  enum?: unknown[];
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  default?: unknown;
  example?: unknown;
  $ref?: string;
  anyOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  description?: string;
  title?: string;
  additionalProperties?: boolean | OpenAPISchema;
}

export interface OpenAPIRequestBody {
  description?: string;
  content?: Record<
    string,
    {
      schema?: OpenAPISchema;
      example?: unknown;
      examples?: Record<string, { value: unknown }>;
    }
  >;
  required?: boolean;
}

export interface OpenAPIResponse {
  description: string;
  content?: Record<
    string,
    {
      schema?: OpenAPISchema;
      example?: unknown;
      examples?: Record<string, { value: unknown }>;
    }
  >;
  headers?: Record<string, OpenAPIParameter>;
}

export interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  security?: Record<string, string[]>[];
  deprecated?: boolean;
}

export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  head?: OpenAPIOperation;
  options?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  securitySchemes?: Record<
    string,
    {
      type: string;
      scheme?: string;
      bearerFormat?: string;
      in?: string;
      name?: string;
    }
  >;
}

export interface OpenAPISpec {
  openapi?: string;
  info?: OpenAPIInfo;
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  security?: Record<string, string[]>[];
}

// =============================================================================
// Endpoint Summary Types
// =============================================================================

export interface EndpointSummary {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
}

export interface ApiSummary {
  info?: OpenAPIInfo;
  totalEndpoints: number;
  endpointsByTag: Record<string, EndpointSummary[]>;
}

// =============================================================================
// Request/Response Types
// =============================================================================

export interface RequestInfo {
  path: string;
  method: string;
}

export interface EndpointDetails {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  tags?: string[];
}

export interface ApiResponse<T = unknown> {
  status: number;
  statusText: string;
  data: T;
  headers?: Record<string, string>;
}

export interface ApiError {
  message: string;
  code?: string;
  response?: {
    status: number;
    statusText: string;
    data?: unknown;
  };
}

// =============================================================================
// MCP Tool Arguments
// =============================================================================

export interface ListAllEndpointsArgs {
  filterByTag?: string;
}

export interface GetApiSpecsArgs {
  path: string;
  method: string;
}

export interface InvokeApiEndpointArgs {
  path: string;
  method: string;
  parameters?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// =============================================================================
// MCP Prompt Arguments
// =============================================================================

export interface FindEndpointPromptArgs {
  goal: string;
}

export interface TestEndpointPromptArgs {
  path: string;
  method: string;
  goal?: string;
}

export interface AnalyzeResponsePromptArgs {
  response_data: string;
  endpoint_path: string;
  endpoint_method: string;
  goal?: string;
}

// =============================================================================
// Server Configuration
// =============================================================================

export interface ServerConfig {
  environment: "sandbox" | "production";
  openApiSpecUrl?: string;
  localSpecPath?: string;
  apiKey?: string;
  readOnlyMode: boolean;
  baseUrl?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// Type guard functions
export function isOpenAPIOperation(value: unknown): value is OpenAPIOperation {
  return (
    typeof value === "object" &&
    value !== null &&
    // Check for a property that should exist in any valid operation
    // We can't check for operationId since it's optional, so we check for responses
    ("responses" in value ||
      "summary" in value ||
      "description" in value ||
      "operationId" in value)
  );
}

export function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && "message" in error;
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}
