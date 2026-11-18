"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Same card as Motion Box: Settings → Integrations & Media → Telegram Bot Integration

type TelegramSettings = {
  chat_ids: string[];
  app_url: string;
  notify_payment_add: boolean;
  notify_payment_adjust: boolean;
  has_bot_token: boolean;
  bot_token_masked: string;
};

const QUERY_KEY = ["telegram-settings"];

async function fetchSettings(): Promise<TelegramSettings> {
  const res = await fetch("/api/telegram/settings", { cache: "no-store" });
  const json = (await res.json()) as { success: boolean; data?: TelegramSettings; error?: string };
  if (!json.success || !json.data) throw new Error(json.error || "Failed to load settings.");
  return json.data;
}

const isValidChatId = (id: string) => /^-?\d+$/.test(id) || /^@[A-Za-z0-9_]{5,32}$/.test(id);

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchSettings });

  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatIds, setTelegramChatIds] = useState("");
  const [telegramRedirectDomain, setTelegramRedirectDomain] = useState("");
  const [isSubmittingTelegram, setIsSubmittingTelegram] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTelegramChatIds(settings.chat_ids.join(", "));
    setTelegramRedirectDomain(settings.app_url);
  }, [settings]);

  const handleSaveTelegramSettings = async () => {
    const chatIdsArray = telegramChatIds
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id);
    const invalidChatId = chatIdsArray.find((id) => !isValidChatId(id));
    if (invalidChatId) {
      toast.error("Validation Error", {
        description: `Chat ID "${invalidChatId}" is invalid. Telegram chat IDs must be numbers (e.g., -100123456789 or 987654321).`,
      });
      return;
    }

    setIsSubmittingTelegram(true);
    try {
      const res = await fetch("/api/telegram/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Blank keeps the saved token (it is never sent back to the browser)
          bot_token: telegramBotToken.trim() || undefined,
          chat_ids: chatIdsArray.join("\n"),
          app_url: telegramRedirectDomain.trim(),
          // Like Motion Box: a saved token and chat ID means messages are sent
          is_enabled: true,
          notify_payment_add: settings?.notify_payment_add ?? true,
          notify_payment_adjust: settings?.notify_payment_adjust ?? true,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error || "Could not save Telegram settings.");
      toast.success("Settings Updated", { description: "Telegram settings have been saved." });
      setTelegramBotToken("");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (err) {
      toast.error("Update Failed", {
        description: err instanceof Error ? err.message : "Could not save Telegram settings.",
      });
    }
    setIsSubmittingTelegram(false);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
        <CardHeader className="border-b p-5">
          <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
            <Send className="size-6 text-primary" /> Telegram Bot Integration
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm mt-0.5">
            Configure your Telegram bot to receive real-time payment notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="telegram-token">Bot Token</Label>
            <Input
              id="telegram-token"
              type="password"
              autoComplete="new-password"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              placeholder={
                settings?.has_bot_token
                  ? `${settings.bot_token_masked} (saved, leave blank to keep)`
                  : "Enter your Telegram Bot Token"
              }
              disabled={isSubmittingTelegram || isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telegram-chat-ids">Chat IDs</Label>
            <Textarea
              id="telegram-chat-ids"
              value={telegramChatIds}
              onChange={(e) => setTelegramChatIds(e.target.value)}
              placeholder="Enter one or more Chat IDs, separated by commas"
              disabled={isSubmittingTelegram || isLoading}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              To send to multiple chats, separate each ID with a comma (e.g.,
              -100123...,-100456...).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telegram-redirect-domain">Redirect Domain</Label>
            <Input
              id="telegram-redirect-domain"
              value={telegramRedirectDomain}
              onChange={(e) => setTelegramRedirectDomain(e.target.value)}
              placeholder="e.g., https://crm.yourdomain.com"
              disabled={isSubmittingTelegram || isLoading}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t p-5 flex justify-end">
          <Button
            onClick={() => void handleSaveTelegramSettings()}
            disabled={isSubmittingTelegram || isLoading}
          >
            {isSubmittingTelegram ? "Saving..." : "Save Telegram Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
