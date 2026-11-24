"use client";

import React, { useState } from "react";
import { Bot, Copy, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/context/ToastContext";

export type ConnectionMode = "remote" | "local";
export type ClientPreset = "claude" | "cursor" | "muse";

export function getMcpRemoteConfig(
  client: ClientPreset,
  token: string = "arthax_mcp_live_token",
  hostUrl: string = "https://arthax.vercel.app"
): string {
  const endpoint = `${hostUrl}/api/v1/mcp`;
  const displayToken = token || "arthax_mcp_live_token";

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

export const McpIntegrationCard: React.FC<McpIntegrationCardProps> = ({ userId: _userId }) => {
  const { showToast } = useToast();
  const [selectedClient, setSelectedClient] = useState<ClientPreset>("claude");
  const [copiedConfig, setCopiedConfig] = useState(false);

  const hostUrl =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://arthax.vercel.app";

  const currentConfig = getMcpRemoteConfig(selectedClient, "arthax_mcp_live_token", hostUrl);

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(currentConfig);
      setCopiedConfig(true);
      showToast(
        "Config Copied",
        `Configuration for ${selectedClient === "claude" ? "Claude Desktop" : selectedClient === "cursor" ? "Cursor" : "Muse"} copied.`,
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
              Connect Claude Desktop, Cursor, or Muse to query your finances.
            </p>
          </div>
        </div>
        <Badge variant="emerald" dot size="xs">
          Ready
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyConfig}
          className="h-8 px-3 text-xs flex items-center gap-1.5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
        >
          {copiedConfig ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span>{copiedConfig ? "Copied!" : "Copy Configuration"}</span>
        </Button>
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
            Paste into your <code className="font-mono text-[10px] text-purple-300 px-1 py-0.5 rounded bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)]">claude_desktop_config.json</code> file and restart Claude.
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
