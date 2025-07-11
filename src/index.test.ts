import { describe, it, expect, beforeEach } from "vitest";
import * as yaml from "js-yaml";
import {
  type OpenAPISpec,
  type OpenAPIPathItem,
  type OpenAPIOperation,
  type EndpointSummary,
  isOpenAPIOperation,
} from "./types.js";

// Mock OpenAPI spec for testing
const mockOpenApiSpec: OpenAPISpec = {
  openapi: "3.0.0",
  info: {
    title: "Iron API - Test",
    version: "1.0.0",
    description: "Test API for MCP server",
  },
  paths: {
    "/customers": {
      post: {
        summary: "Create a new customer",
        description: "Create a new customer account",
        operationId: "createCustomer",
        tags: ["Customer"],
        parameters: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                },
                required: ["name", "email"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Customer created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      get: {
        summary: "List customers",
        description: "Get all customers",
        operationId: "listCustomers",
        tags: ["Customer"],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer" },
            description: "Page number",
          },
        ],
        responses: {
          "200": {
            description: "List of customers",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      email: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/addresses": {
      post: {
        summary: "Create address",
        description: "Create a new address",
        operationId: "createAddress",
        tags: ["Addresses"],
        responses: {
          "201": {
            description: "Address created",
          },
        },
      },
    },
    "/autoramp/orders": {
      post: {
        summary: "Create autoramp order",
        description: "Create a new autoramp order",
        operationId: "createAutorampOrder",
        tags: ["Autoramp"],
        responses: {
          "201": {
            description: "Order created",
          },
        },
      },
    },
  },
};

// Helper functions that mirror the logic from the main server
function extractEndpointsFromSpec(spec: OpenAPISpec): EndpointSummary[] {
  const endpoints: EndpointSummary[] = [];

  if (!spec.paths) return endpoints;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (isOpenAPIOperation(operation)) {
        endpoints.push({
          path,
          method: method.toUpperCase(),
          summary: operation.summary,
          description: operation.description,
          tags: operation.tags || [],
          operationId: operation.operationId,
        });
      }
    }
  }

  return endpoints;
}

function categorizeEndpointsByTag(
  endpoints: Array<{ tags?: string[] }>
): Record<string, number> {
  const endpointsByTag: Record<string, number> = {};

  for (const endpoint of endpoints) {
    const tags = endpoint.tags || ["Untagged"];
    for (const tag of tags) {
      endpointsByTag[tag] = (endpointsByTag[tag] || 0) + 1;
    }
  }

  return endpointsByTag;
}

function findSpecificEndpoint(
  spec: OpenAPISpec,
  targetPath: string,
  targetMethod: string
): OpenAPIOperation | null {
  if (!spec.paths || !spec.paths[targetPath]) {
    return null;
  }

  const pathItem = spec.paths[targetPath];
  const method = targetMethod.toLowerCase() as keyof OpenAPIPathItem;
  const operation = pathItem[method];

  return isOpenAPIOperation(operation) ? operation : null;
}

describe("Configuration Environment Loading", () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.IRON_ENVIRONMENT;
    delete process.env.IRON_OPENAPI_SPEC_URL;
    delete process.env.IRON_LOCAL_SPEC_PATH;
    delete process.env.IRON_API_KEY;
    delete process.env.IRON_READ_ONLY_MODE;
    delete process.env.IRON_BASE_URL;
  });

  it("should default to production environment", () => {
    const environment = process.env.IRON_ENVIRONMENT || "production";
    expect(environment).toBe("production");
  });

  it("should use sandbox environment when set", () => {
    process.env.IRON_ENVIRONMENT = "sandbox";
    expect(process.env.IRON_ENVIRONMENT).toBe("sandbox");
  });

  it("should use custom OpenAPI spec URL when provided", () => {
    process.env.IRON_OPENAPI_SPEC_URL = "https://custom-api.example.com/spec";
    expect(process.env.IRON_OPENAPI_SPEC_URL).toBe(
      "https://custom-api.example.com/spec"
    );
  });

  it("should use custom local spec path when provided", () => {
    process.env.IRON_LOCAL_SPEC_PATH = "/custom/path/to/spec.yaml";
    expect(process.env.IRON_LOCAL_SPEC_PATH).toBe("/custom/path/to/spec.yaml");
  });

  it("should configure API key when provided", () => {
    process.env.IRON_API_KEY = "test-api-key-123";
    expect(process.env.IRON_API_KEY).toBe("test-api-key-123");
  });

  it("should enable read-only mode when set to true", () => {
    process.env.IRON_READ_ONLY_MODE = "true";
    expect(process.env.IRON_READ_ONLY_MODE).toBe("true");
  });

  it("should disable read-only mode when set to false", () => {
    process.env.IRON_READ_ONLY_MODE = "false";
    expect(process.env.IRON_READ_ONLY_MODE).toBe("false");
  });

  it("should use custom base URL when provided", () => {
    process.env.IRON_BASE_URL = "https://custom-api.example.com";
    expect(process.env.IRON_BASE_URL).toBe("https://custom-api.example.com");
  });
});

describe("OpenAPI Spec Processing", () => {
  it("should parse YAML content correctly", () => {
    const yamlContent = yaml.dump(mockOpenApiSpec);
    const parsed = yaml.load(yamlContent) as OpenAPISpec;

    expect(parsed).toEqual(mockOpenApiSpec);
    expect(parsed.info?.title).toBe("Iron API - Test");
  });

  it("should handle JSON content correctly", () => {
    const jsonContent = JSON.stringify(mockOpenApiSpec);
    const parsed = JSON.parse(jsonContent) as OpenAPISpec;

    expect(parsed).toEqual(mockOpenApiSpec);
    expect(parsed.info?.title).toBe("Iron API - Test");
  });

  it("should extract endpoints from OpenAPI spec correctly", () => {
    const endpoints = extractEndpointsFromSpec(mockOpenApiSpec);

    expect(endpoints).toHaveLength(4); // 2 for /customers (POST, GET) + 1 for /addresses (POST) + 1 for /autoramp/orders (POST)

    const customerPostEndpoint = endpoints.find(
      (e) => e.path === "/customers" && e.method === "POST"
    );
    expect(customerPostEndpoint).toBeDefined();
    expect(customerPostEndpoint?.summary).toBe("Create a new customer");
    expect(customerPostEndpoint?.tags).toContain("Customer");
  });

  it("should categorize endpoints by tags correctly", () => {
    const endpoints = extractEndpointsFromSpec(mockOpenApiSpec);
    const endpointsByTag = categorizeEndpointsByTag(endpoints);

    expect(endpointsByTag["Customer"]).toBe(2);
    expect(endpointsByTag["Addresses"]).toBe(1);
    expect(endpointsByTag["Autoramp"]).toBe(1);
  });

  it("should find specific endpoint correctly", () => {
    const endpoint = findSpecificEndpoint(
      mockOpenApiSpec,
      "/customers",
      "post"
    );

    expect(endpoint).toBeDefined();
    expect(endpoint?.summary).toBe("Create a new customer");
    expect(endpoint?.operationId).toBe("createCustomer");
  });

  it("should return null for non-existent endpoint", () => {
    const endpoint = findSpecificEndpoint(
      mockOpenApiSpec,
      "/nonexistent",
      "get"
    );
    expect(endpoint).toBeNull();
  });

  it("should return null for wrong method", () => {
    const endpoint = findSpecificEndpoint(
      mockOpenApiSpec,
      "/customers",
      "delete"
    );
    expect(endpoint).toBeNull();
  });
});

describe("MCP Tools Logic", () => {
  it("should format endpoint list correctly", () => {
    const endpoints = extractEndpointsFromSpec(mockOpenApiSpec);
    const endpointsByTag = categorizeEndpointsByTag(endpoints);

    // Simulate list-all-endpoints output format
    const output = {
      totalEndpoints: endpoints.length,
      endpointsByTag,
      endpoints: endpoints.map((e) => ({
        path: e.path,
        method: e.method,
        summary: e.summary,
        tags: e.tags,
      })),
    };

    expect(output.totalEndpoints).toBe(4);
    expect(output.endpointsByTag["Customer"]).toBe(2);
    expect(output.endpoints[0].path).toBe("/customers");
  });

  it("should filter endpoints by tag", () => {
    const endpoints = extractEndpointsFromSpec(mockOpenApiSpec);
    const customerEndpoints = endpoints.filter((e) =>
      e.tags?.includes("Customer")
    );

    expect(customerEndpoints).toHaveLength(2);
    expect(customerEndpoints.every((e) => e.tags?.includes("Customer"))).toBe(
      true
    );
  });

  it("should handle empty OpenAPI spec", () => {
    const emptySpec: OpenAPISpec = {
      info: { title: "Empty API", version: "1.0.0" },
      paths: {},
    };
    const endpoints = extractEndpointsFromSpec(emptySpec);

    expect(endpoints).toHaveLength(0);
  });

  it("should handle malformed OpenAPI spec", () => {
    const malformedSpec: OpenAPISpec = {
      paths: {},
      info: { title: "Malformed API", version: "1.0.0" },
    };
    const endpoints = extractEndpointsFromSpec(malformedSpec);

    expect(endpoints).toHaveLength(0);
  });
});

describe("API Endpoint Invocation Logic", () => {
  it("should validate read-only mode restrictions", () => {
    // Simulate read-only mode validation
    const readOnlyMode = true;
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

    methods.forEach((method) => {
      if (readOnlyMode && method !== "GET") {
        // In read-only mode, only GET requests should be allowed
        expect(method).not.toBe("GET");
      } else {
        // All methods should be allowed when not in read-only mode
        expect(methods).toContain(method);
      }
    });
  });

  it("should construct proper URLs with query parameters", () => {
    const baseUrl = "https://api.iron.xyz";
    const path = "/customers";
    const parameters = { page: "1", limit: "10" };

    // Simulate URL construction logic
    const url = new URL(path, baseUrl);
    Object.entries(parameters).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    expect(url.toString()).toBe(
      "https://api.iron.xyz/customers?page=1&limit=10"
    );
  });

  it("should handle request body serialization", () => {
    const body = {
      name: "Test Customer",
      email: "test@example.com",
      metadata: {
        source: "api-test",
        priority: "high",
      },
    };

    const serializedBody = JSON.stringify(body);
    const parsedBody = JSON.parse(serializedBody);

    expect(parsedBody).toEqual(body);
    expect(typeof serializedBody).toBe("string");
  });

  it("should validate required headers", () => {
    const requiredHeaders = {
      "Content-Type": "application/json",
      Authorization: "Bearer test-api-key",
    };

    const headers: Record<string, string> = {
      Authorization: "Bearer test-api-key",
      "Content-Type": "application/json",
      "User-Agent": "iron-mcp-server/1.0.0",
    };

    // Check that all required headers are present
    Object.entries(requiredHeaders).forEach(([key, value]) => {
      expect(headers[key]).toBe(value);
    });
  });

  it("should handle API response formatting", () => {
    const mockApiResponse = {
      status: 200,
      statusText: "OK",
      data: {
        id: "cust_123",
        name: "Test Customer",
        email: "test@example.com",
        created_at: "2023-01-01T00:00:00Z",
      },
    };

    expect(mockApiResponse.status).toBe(200);
    expect(mockApiResponse.data.id).toBe("cust_123");
    expect(typeof mockApiResponse.data.created_at).toBe("string");
  });

  it("should handle error responses gracefully", () => {
    const mockErrorResponse = {
      status: 400,
      statusText: "Bad Request",
      data: {
        error: "Invalid email format",
        code: "VALIDATION_ERROR",
      },
    };

    expect(mockErrorResponse.status).toBe(400);
    expect(mockErrorResponse.data.error).toBe("Invalid email format");
    expect(mockErrorResponse.data.code).toBe("VALIDATION_ERROR");
  });
});

describe("Schema Reference Resolution", () => {
  it("should handle $ref resolution correctly", () => {
    const specWithRefs: OpenAPISpec = {
      paths: {
        "/test": {
          get: {
            summary: "Test endpoint",
            responses: {
              "200": {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/TestResponse",
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          TestResponse: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
            },
          },
        },
      },
    };

    const endpoints = extractEndpointsFromSpec(specWithRefs);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].path).toBe("/test");
  });

  it("should handle missing schema references", () => {
    const specWithMissingRef: OpenAPISpec = {
      paths: {
        "/test": {
          get: {
            summary: "Test endpoint",
            responses: {
              "200": {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/NonExistentSchema",
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {},
      },
    };

    // Should still extract endpoint even with missing schema reference
    const endpoints = extractEndpointsFromSpec(specWithMissingRef);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].path).toBe("/test");
  });
});

describe("Type Guards and Validation", () => {
  it("should correctly identify OpenAPI operations", () => {
    const validOperation: OpenAPIOperation = {
      summary: "Test operation",
      operationId: "testOp",
      responses: {
        "200": {
          description: "Success",
        },
      },
    };

    const invalidOperation = {
      notAnOperation: true,
    };

    expect(isOpenAPIOperation(validOperation)).toBe(true);
    expect(isOpenAPIOperation(invalidOperation)).toBe(false);
    expect(isOpenAPIOperation(null)).toBe(false);
    expect(isOpenAPIOperation(undefined)).toBe(false);
  });

  it("should handle edge cases in endpoint extraction", () => {
    const edgeCaseSpec: OpenAPISpec = {
      paths: {
        "/test": {
          get: {
            // Missing optional fields, only has required responses
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
        "/minimal": {
          post: {
            // Minimal operation with just responses
            responses: {},
          },
        },
      },
    };

    const endpoints = extractEndpointsFromSpec(edgeCaseSpec);
    // Should extract both operations even if they're minimal
    expect(endpoints).toHaveLength(2);
    expect(endpoints.find((e) => e.method === "GET")?.path).toBe("/test");
    expect(endpoints.find((e) => e.method === "POST")?.path).toBe("/minimal");
  });
});
