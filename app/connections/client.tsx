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
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Social Connections
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
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
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                Connecting to {PLATFORM_LABELS[connectingPlatform]}...
              </p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
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
        <div className="text-center py-12 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-950/30 flex items-center justify-center">
            <LinkIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            No accounts connected
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 max-w-sm mx-auto">
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
        <div className="p-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Connect Account
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            Choose a platform to connect
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {ALL_PLATFORMS.map((platform) => {
              const isConnected = connectedPlatforms.has(platform);
              return (
                <button
                  key={platform}
                  onClick={() => !isConnected && handleConnect(platform)}
                  disabled={isConnected}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                    isConnected
                      ? "opacity-50 cursor-not-allowed border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800"
                      : "hover:border-indigo-300 dark:hover:border-indigo-700 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 cursor-pointer"
                  }`}
                >
                  <PlatformIcon platform={platform} size="lg" />
                  <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                    {PLATFORM_LABELS[platform]}
                  </span>
                  {isConnected && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
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
