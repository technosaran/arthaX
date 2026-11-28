import { createApiRoute } from "@/lib/backend/routeHandler";
import { createPersonalMcpToken } from "@/utils/mcpAuth";
import { apiSuccess } from "@/utils/apiResponse";

const TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

async function issueTokenResponse(userId: string, req: Parameters<typeof apiSuccess>[3]) {
  const token = createPersonalMcpToken(userId, TOKEN_TTL_SECONDS);
  return apiSuccess(
    {
      token,
      tokenType: "Bearer",
      expiresInSeconds: TOKEN_TTL_SECONDS,
      endpoint: "/api/v1/mcp",
    },
    undefined,
    200,
    req
  );
}

export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 30, windowSeconds: 60 },
  handler: async ({ userId, req }) => issueTokenResponse(userId!, req),
});

export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 15, windowSeconds: 60 },
  handler: async ({ userId, req }) => issueTokenResponse(userId!, req),
});
