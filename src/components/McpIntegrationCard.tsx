"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bot, Copy, CheckCircle2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/context/ToastContext";

export type ConnectionMode = "remote" | "local";
export type ClientPreset = "claude" | "cursor" | "muse";

export function getMcpRemoteConfig(
  _client: ClientPreset,
  token: string = "YOUR_PERSONAL_MCP_TOKEN",
  hostUrl: string = "https://arthax.vercel.app"
): string {
  const endpoint = `${hostUrl}/api/v1/mcp`;
  const displayToken = token || "YOUR_PERSONAL_MCP_TOKEN";

  return JSON.stringify(
    {
      mcpServers: {
        arthax: {
          url: endpoint,
          headers: {
            Authorization: `Bearer ${displayToken}`,
          },
        },
      },
    },
    null,
    2
  );
}

export function getMcpClientConfig(
  client: ClientPreset,
  userId: string,
  supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co"
): string {
  if (client === "muse" || client === "claude") {
    return JSON.stringify(
      {
        mcpServers: {
          arthax: {
            command: "npx",
            args: ["-y", "tsx", "src/mcp/server.ts"],
            cwd: "${workspaceFolder}",
            env: {
              NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
              SUPABASE_SERVICE_ROLE_KEY: "YOUR_SUPABASE_SERVICE_ROLE_KEY",
              ARTHAX_USER_ID: userId || "YOUR_USER_ID",
            },
          },
        },
      },
      null,
      2
    );
  }

  // Cursor / Antigravity Local
  return JSON.stringify(
    {
      mcpServers: {
        arthax: {
          command: "npx",
          args: ["-y", "tsx", "src/mcp/server.ts"],
          cwd: "${workspaceFolder}",
        },
      },
    },
    null,
    2
  );
}

interface McpIntegrationCardProps {
  userId: string;
}

export const McpIntegrationCard: React.FC<McpIntegrationCardProps> = ({ userId }) => {
  const { showToast } = useToast();
  const [selectedClient, setSelectedClient] = useState<ClientPreset>("claude");
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [personalToken, setPersonalToken] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState<boolean>(false);

  const fetchPersonalToken = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    setLoadingToken(true);
    try {
      const res = await fetch("/api/v1/mcp/token", {
        method: isRefresh ? "POST" : "GET",
      });
      if (!res.ok) throw new Error("Failed to issue personal MCP token");
      const json = await res.json();
      const issued = json?.data?.token || json?.token;
      if (typeof issued === "string" && issued.startsWith("ax_mcp_")) {
        setPersonalToken(issued);
        if (isRefresh) {
          showToast("MCP Token Refreshed", "Your signed personal MCP token has been updated.", "success");
        }
      }
    } catch {
      if (isRefresh) {
        showToast("Token Error", "Could not generate a personal MCP token right now.", "error");
      }
    } finally {
      setLoadingToken(false);
    }
  }, [userId, showToast]);

  useEffect(() => {
    void fetchPersonalToken(false);
  }, [fetchPersonalToken]);

  const hostUrl =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://arthax.vercel.app";

  const currentConfig = getMcpRemoteConfig(
    selectedClient,
    personalToken || "YOUR_PERSONAL_MCP_TOKEN",
    hostUrl
  );

  const handleCopyConfig = async () => {
    if (!personalToken) {
      showToast("Token Pending", "Wait for your personal signed MCP token to finish loading.", "warning");
      return;
    }
    try {
      await navigator.clipboard.writeText(currentConfig);
      setCopiedConfig(true);
      showToast(
        "Config Copied",
        `Signed MCP configuration for ${selectedClient === "claude" ? "Claude Desktop" : selectedClient === "cursor" ? "Cursor" : "Muse"} copied.`,
        "success"
      );
      setTimeout(() => setCopiedConfig(false), 2000);
    } catch {
      showToast("Copy Failed", "Could not copy configuration.", "error");
    }
  };

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">AI Assistant (MCP)</h2>
            <p className="text-xs text-[var(--app-muted)]">
              Connect Claude Desktop, Cursor, or Muse using your signed personal MCP bearer token.
            </p>
          </div>
        </div>
        <Badge variant={personalToken ? "emerald" : "neutral"} dot size="xs">
          {loadingToken ? "Issuing Token..." : personalToken ? "Signed Token Active" : "Sign In Required"}
        </Badge>
      </div>

      {/* Client Selector & 1-Click Copy */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <SegmentedControl<ClientPreset>
          size="sm"
          value={selectedClient}
          onChange={(val) => setSelectedClient(val)}
          options={[
            { value: "claude", label: "Claude Desktop" },
            { value: "cursor", label: "Cursor" },
            { value: "muse", label: "Muse" },
          ]}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchPersonalToken(true)}
            disabled={loadingToken || !userId}
            className="h-8 px-2.5 text-xs gap-1.5"
            title="Regenerate signed personal MCP token"
          >
            <RefreshCw size={12} className={loadingToken ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyConfig}
            disabled={!personalToken}
            className="h-8 px-3 text-xs flex items-center gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
          >
            {copiedConfig ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedConfig ? "Copied!" : "Copy Configuration"}</span>
          </Button>
        </div>
      </div>

      {/* Clean Code Box */}
      <div className="rounded-xl border border-[var(--app-border)] bg-[#0d1117] text-[#e6edf3] p-3.5 font-mono text-xs shadow-inner">
        <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-gray-300">
          {currentConfig}
        </pre>
      </div>

      {/* Helpful 1-line note */}
      <p className="text-[11px] text-[var(--app-muted)]">
        {selectedClient === "claude" && (
          <>
            Paste into your <code className="font-mono text-[10px] text-purple-600 dark:text-purple-300 px-1 py-0.5 rounded bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)]">claude_desktop_config.json</code> file and restart Claude.
          </>
        )}
        {selectedClient === "cursor" && (
          <>
            In Cursor, paste under <strong>Settings &gt; Features &gt; MCP &gt; Add New MCP Server</strong>.
          </>
        )}
        {selectedClient === "muse" && (
          <>
            In Muse, paste this configuration in your MCP settings.
          </>
        )}
      </p>
    </Card>
  );
};
