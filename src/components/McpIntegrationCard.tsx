"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  Copy,
  CheckCircle2,
  Sparkles,
  Terminal,
  ShieldCheck,
  Globe,
  Key,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/context/ToastContext";
import { createClient } from "@/utils/supabase/client";

export type ConnectionMode = "remote" | "local";
export type ClientPreset = "muse" | "claude" | "cursor";

export function getMcpRemoteConfig(
  client: ClientPreset,
  token: string,
  hostUrl: string = "https://arthax.vercel.app"
): string {
  const endpoint = `${hostUrl}/api/v1/mcp`;
  const displayToken = token || "<YOUR_ARTHAX_SESSION_TOKEN>";

  if (client === "muse") {
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

  // Claude / Cursor Remote HTTP
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
  supabaseUrl: string = "https://fvpfzbuoizzjwgekuhot.supabase.co"
): string {
  if (client === "muse" || client === "claude") {
    return JSON.stringify(
      {
        mcpServers: {
          arthax: {
            command: "npx",
            args: ["-y", "tsx", "src/mcp/server.ts"],
            cwd: "C:/Users/saran/Desktop/arthaX",
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
          cwd: "C:/Users/saran/Desktop/arthaX",
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
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("remote");
  const [selectedClient, setSelectedClient] = useState<ClientPreset>("muse");
  const [userToken, setUserToken] = useState<string>("");
  const [copiedId, setCopiedId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fvpfzbuoizzjwgekuhot.supabase.co";

  const hostUrl =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://arthax.vercel.app";

  useEffect(() => {
    const fetchSessionToken = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          setUserToken(data.session.access_token);
        }
      } catch {
        // safe fallback
      }
    };
    fetchSessionToken();
  }, []);

  const handleCopyUserId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedId(true);
      showToast("User ID Copied", "Your unique arthaX User ID has been copied to clipboard.", "success");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      showToast("Copy Failed", "Could not copy to clipboard. Please copy manually.", "error");
    }
  };

  const handleCopyToken = async () => {
    if (!userToken) return;
    try {
      await navigator.clipboard.writeText(userToken);
      setCopiedToken(true);
      showToast("Token Copied", "Personal MCP Bearer token copied to clipboard.", "success");
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      showToast("Copy Failed", "Could not copy token.", "error");
    }
  };

  const currentConfig =
    connectionMode === "remote"
      ? getMcpRemoteConfig(selectedClient, userToken, hostUrl)
      : getMcpClientConfig(selectedClient, userId, supabaseUrl);

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(currentConfig);
      setCopiedConfig(true);
      showToast(
        "MCP Config Copied",
        `Configuration for ${selectedClient.toUpperCase()} (${connectionMode.toUpperCase()}) copied.`,
        "success"
      );
      setTimeout(() => setCopiedConfig(false), 2000);
    } catch {
      showToast("Copy Failed", "Could not copy configuration.", "error");
    }
  };

  return (
    <Card className="p-6 sm:p-7 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--app-border-subtle)] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/25 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Bot size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold tracking-tight">Model Context Protocol (MCP) & AI Agents</h2>
              <Badge variant="violet" size="xs">
                <Sparkles size={10} className="mr-1" />
                Remote & Local
              </Badge>
            </div>
            <p className="text-xs opacity-60">
              Connect Muse, Claude Desktop, Cursor, or Antigravity directly to your personal wealth intelligence
            </p>
          </div>
        </div>

        <div>
          <Badge variant="emerald" dot>
            Ready for Connection
          </Badge>
        </div>
      </div>

      {/* Mode Selector: Remote (Users) vs Local (Developer) */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)]">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-[var(--app-fg)] flex items-center gap-1.5">
            {connectionMode === "remote" ? (
              <Globe size={14} className="text-emerald-400" />
            ) : (
              <Terminal size={14} className="text-purple-400" />
            )}
            <span>Connection Mode</span>
          </div>
          <p className="text-[11px] text-[var(--app-muted)]">
            {connectionMode === "remote"
              ? "Recommended: Connect over secure HTTPS with your login token (Zero database keys needed)."
              : "Advanced: Run local stdio server on this computer (For local development only)."}
          </p>
        </div>

        <SegmentedControl<ConnectionMode>
          size="sm"
          value={connectionMode}
          onChange={(val) => setConnectionMode(val)}
          options={[
            { value: "remote", label: "Remote (For Users)" },
            { value: "local", label: "Local Stdio (Dev)" },
          ]}
        />
      </div>

      {/* User Multi-Tenancy Scope Banner */}
      <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-purple-400" />
              <span>Multi-Tenant Scoped User Identity</span>
            </div>
            <p className="text-[11px] opacity-75 leading-relaxed">
              When your AI agent connects, it queries and modifies only your personal data using this ID:
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <code className="text-xs font-mono px-2.5 py-1 rounded-md bg-[var(--app-card)] border border-[var(--app-border)] select-all">
                {userId || "Not authenticated"}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUserId}
                className="h-7 px-2.5 text-xs flex items-center gap-1"
              >
                {copiedId ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedId ? "Copied" : "Copy ID"}</span>
              </Button>
              {userToken && connectionMode === "remote" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToken}
                  className="h-7 px-2.5 text-xs flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  {copiedToken ? <CheckCircle2 size={12} /> : <Key size={12} />}
                  <span>{copiedToken ? "Token Copied" : "Copy Personal Token"}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client Presets Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-semibold text-[var(--app-fg)] flex items-center gap-1.5">
            <Terminal size={14} className="text-purple-400" />
            <span>Select AI Client Configuration</span>
          </label>
          <SegmentedControl<ClientPreset>
            size="sm"
            value={selectedClient}
            onChange={(val) => setSelectedClient(val)}
            options={[
              { value: "muse", label: "Muse" },
              { value: "claude", label: "Claude Desktop" },
              { value: "cursor", label: "Cursor / Antigravity" },
            ]}
          />
        </div>

        {/* Step-by-Step Instructions */}
        <div className="text-[11px] text-[var(--app-muted)] p-3 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] space-y-1">
          {connectionMode === "remote" ? (
            <p>
              🌐 <strong>Remote setup:</strong> In {selectedClient === "muse" ? "Muse" : selectedClient === "claude" ? "Claude" : "Cursor"}, add an MCP Server with URL <code className="font-mono text-[10px] text-purple-300">{hostUrl}/api/v1/mcp</code> and your personal Bearer token.
            </p>
          ) : (
            <p>
              💻 <strong>Local setup:</strong> Run the MCP stdio server on your local machine. It reads <code className="font-mono text-[10px]">.env.local</code> directly.
            </p>
          )}
        </div>

        {/* Code Snippet Box */}
        <div className="relative rounded-xl border border-[var(--app-border)] bg-[#0d1117] text-[#e6edf3] p-4 font-mono text-xs overflow-x-auto shadow-inner">
          <button
            type="button"
            onClick={handleCopyConfig}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-all cursor-pointer backdrop-blur-sm"
          >
            {copiedConfig ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copiedConfig ? "Copied" : "Copy Config"}</span>
          </button>
          <pre className="pr-16">{currentConfig}</pre>
        </div>
      </div>

      {/* Available Tools Grid */}
      <div className="pt-2 border-t border-[var(--app-border-subtle)] space-y-2">
        <span className="text-[11px] font-semibold text-[var(--app-muted)] uppercase tracking-wider">
          9 Exposed Financial Tools Available to Your Agent
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-emerald-400 font-mono text-[11px]">get_net_worth</div>
            <div className="text-[10px] text-[var(--app-muted)]">Precision multi-asset valuation</div>
          </div>
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-sky-400 font-mono text-[11px]">list_accounts</div>
            <div className="text-[10px] text-[var(--app-muted)]">Bank balances & card ledgers</div>
          </div>
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-indigo-400 font-mono text-[11px]">get_portfolio_holdings</div>
            <div className="text-[10px] text-[var(--app-muted)]">Stocks, mutual funds, gold, crypto</div>
          </div>
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-amber-400 font-mono text-[11px]">get_budget_status</div>
            <div className="text-[10px] text-[var(--app-muted)]">Monthly spending vs limits</div>
          </div>
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-purple-400 font-mono text-[11px]">get_cash_flow_forecast</div>
            <div className="text-[10px] text-[var(--app-muted)]">Burn rate & runway projection</div>
          </div>
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-cyan-400 font-mono text-[11px]">query_transactions</div>
            <div className="text-[10px] text-[var(--app-muted)]">Filtered ledger search</div>
          </div>
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-rose-400 font-mono text-[11px]">record_expense</div>
            <div className="text-[10px] text-[var(--app-muted)]">Atomic balance-safe expense log</div>
          </div>
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-emerald-400 font-mono text-[11px]">record_income</div>
            <div className="text-[10px] text-[var(--app-muted)]">Atomic balance-safe income log</div>
          </div>
          <div className="p-2.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-0.5">
            <div className="font-semibold text-violet-400 font-mono text-[11px]">record_transfer</div>
            <div className="text-[10px] text-[var(--app-muted)]">Atomic twin-account transfer</div>
          </div>
        </div>
      </div>
    </Card>
  );
};
