"use client";

import { useState } from "react";
import { PlatformConnection, PlatformType } from "@/lib/postpeer/types";
import { ConnectionCard } from "@/components/postpeer/ConnectionCard";
import { PlatformIcon } from "@/components/postpeer/PlatformIcon";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";
import {
  disconnectPlatform,
  reconnectPlatform,
  getOAuthUrl,
} from "@/lib/actions/connections";
import { PlusIcon, LinkIcon } from "@/components/ui/Icons";

interface ConnectionsPageClientProps {
  initialConnections: PlatformConnection[];
}

const ALL_PLATFORMS: PlatformType[] = [
  "twitter",
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "bluesky",
  "threads",
];

const PLATFORM_LABELS: Record<PlatformType, string> = {
  twitter: "Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  threads: "Threads",
};

export function ConnectionsPageClient({
  initialConnections,
}: ConnectionsPageClientProps) {
  const [connections, setConnections] = useState<PlatformConnection[]>(initialConnections);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformType | null>(null);

  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  const handleDisconnect = async (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) return;

    const confirmed = window.confirm(
      `Are you sure you want to disconnect your ${PLATFORM_LABELS[connection.platform]} account?`
    );

    if (!confirmed) return;

    const result = await disconnectPlatform(connectionId);

    if (result.success) {
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      toast.success(`${PLATFORM_LABELS[connection.platform]} account disconnected`);
    } else {
      toast.error(result.error || "Failed to disconnect account");
    }
  };

  const handleReconnect = async (connectionId: string, platform: PlatformType) => {
    setIsConnecting(true);
    setConnectingPlatform(platform);

    const result = await reconnectPlatform(connectionId, platform);

    if (result.success && result.url) {
      initiateOAuthFlow(result.url, platform);
    } else {
      toast.error(result.error || "Failed to reconnect account");
      setIsConnecting(false);
      setConnectingPlatform(null);
    }
  };

  const handleConnect = async (platform: PlatformType) => {
    setIsModalOpen(false);
    setIsConnecting(true);
    setConnectingPlatform(platform);

    const result = await getOAuthUrl(platform);

    if (result.success && result.url) {
      initiateOAuthFlow(result.url, platform);
    } else {
      toast.error(result.error || "Failed to connect account");
      setIsConnecting(false);
      setConnectingPlatform(null);
    }
  };

  const initiateOAuthFlow = (oauthUrl: string, platform: PlatformType) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      oauthUrl,
      `${platform}_oauth`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      toast.error("Please allow popups to connect accounts");
      setIsConnecting(false);
      setConnectingPlatform(null);
      return;
    }

    // Poll for OAuth completion
    const pollInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(pollInterval);
          setIsConnecting(false);
          setConnectingPlatform(null);
          // Refresh connections
          window.location.reload();
        }
      } catch (error) {
        // Cross-origin errors are expected during OAuth flow
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (!popup.closed) {
        popup.close();
      }
      setIsConnecting(false);
      setConnectingPlatform(null);
    }, 5 * 60 * 1000);
  };

  const getConnectionHealth = (connection: PlatformConnection) => {
    if (connection.status === "error") {
      return {
        status: "expired",
        label: "Token Expired",
        action: "Reconnect",
      };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">
            Social Connections
          </h1>
          <p className="text-sm text-fg-secondary mt-1">
            Connect your social media accounts to post and schedule content
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<PlusIcon className="w-4 h-4" />}
          disabled={isConnecting}
        >
          Add Account
        </Button>
      </div>

      {/* Loading State */}
      {isConnecting && connectingPlatform && (
        <div className="bg-accent-surface border border-accent rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border border-accent border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-accent-strong">
                Connecting to {PLATFORM_LABELS[connectingPlatform]}...
              </p>
              <p className="text-xs text-accent-strong mt-0.5">
                Complete the authorization in the popup window
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connections Grid */}
      {connections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => {
            const health = getConnectionHealth(connection);
            return (
              <div key={connection.id} className="relative">
                <ConnectionCard
                  connection={connection}
                  onDisconnect={handleDisconnect}
                />
                {health && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      onClick={() => handleReconnect(connection.id, connection.platform)}
                      leftIcon={<LinkIcon className="w-4 h-4" />}
                    >
                      {health.action}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-surface rounded-lg border border-line">
          <div className="w-10 h-10 mx-auto mb-4 rounded-md border border-line bg-subtle flex items-center justify-center">
            <LinkIcon className="w-5 h-5 text-fg-secondary" />
          </div>
          <h3 className="text-base font-semibold text-fg mb-1">
            No accounts connected
          </h3>
          <p className="text-sm text-fg-secondary mb-6 max-w-xs mx-auto">
            Connect your social media accounts to start posting and scheduling content
            across multiple platforms
          </p>
          <Button
            onClick={() => setIsModalOpen(true)}
            leftIcon={<PlusIcon className="w-4 h-4" />}
          >
            Connect Your First Account
          </Button>
        </div>
      )}

      {/* Platform Selector Modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-5">
          <h2 className="text-base font-semibold text-fg mb-1">
            Connect Account
          </h2>
          <p className="text-sm text-fg-secondary mb-4">
            Choose a platform to connect
          </p>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {ALL_PLATFORMS.map((platform) => {
              const isConnected = connectedPlatforms.has(platform);
              return (
                <button
                  key={platform}
                  onClick={() => !isConnected && handleConnect(platform)}
                  disabled={isConnected}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                    isConnected
                      ? "opacity-50 cursor-not-allowed border-line bg-subtle"
                      : "hover:border-fg-muted hover:bg-subtle border-line bg-surface cursor-pointer"
                  }`}
                >
                  <PlatformIcon platform={platform} size="lg" />
                  <span className="text-xs font-medium text-fg">
                    {PLATFORM_LABELS[platform]}
                  </span>
                  {isConnected && (
                    <span className="text-xs text-fg-secondary">
                      Connected
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
