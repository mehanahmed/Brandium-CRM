"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Send,
  Users,
  MessageSquare,
  PhoneCall,
  ListFilter,
  CheckSquare,
  Square,
  Search,
  CheckCircle2,
  Layers,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/components/orders/assign-stage-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  sendSms,
  sendBulkSms,
  calculateSmsInfo,
  prospectsOptionsQuery,
  type SmsRecipientInput,
} from "@/lib/sms";
import { agentOptionsQueryOptions } from "@/lib/won-sales";
import { SmsBulkConfirmModal } from "@/components/sms-bulk-confirm-modal";
import { stagesQuery } from "@/lib/stages";
import { cn } from "@/lib/utils";

const normalizeStage = (value?: string | null) =>
  (value || "").toLowerCase().replace(/[^a-z]/g, "");

type BulkMode = "manual" | "stage" | "agent";

const AUDIENCE_MODES: {
  value: BulkMode;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "manual",
    title: "Select Prospects",
    description: "Pick individual prospects from the list.",
    icon: Users,
  },
  {
    value: "stage",
    title: "By Stage",
    description: "Send to every prospect in a pipeline stage.",
    icon: Layers,
  },
  {
    value: "agent",
    title: "By Agent",
    description: "Send to every prospect assigned to an agent.",
    icon: UserCheck,
  },
];

export default function SendSmsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  const [selectedProspectId, setSelectedProspectId] = useState<string>("");
  const [singlePhone, setSinglePhone] = useState<string>("");
  const [singleProspectName, setSingleProspectName] = useState<string>("");
  const [singleMessage, setSingleMessage] = useState<string>("");

  const [bulkFilterMode, setBulkFilterMode] = useState<BulkMode>("manual");
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [bulkSearch, setBulkSearch] = useState<string>("");
  const [selectedProspectIds, setSelectedProspectIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string>("");
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  const { data: prospectOptions = [] } = useQuery(prospectsOptionsQuery());
  const { data: agentOptions = [] } = useQuery(agentOptionsQueryOptions());
  const { data: stageOptions = [] } = useQuery(stagesQuery());

  const handleSelectSingleProspect = (id: string) => {
    setSelectedProspectId(id);
    const found = prospectOptions.find((p) => p.id === id);
    if (found) {
      setSinglePhone(found.phone || "");
      setSingleProspectName(found.contact_name || "");
    }
  };

  const singleMutation = useMutation({
    mutationFn: async () => {
      return sendSms(
        singlePhone,
        singleMessage,
        selectedProspectId || null,
        singleProspectName || undefined,
        "Single",
        user?.id,
        user?.email || "Agent",
      );
    },
    onSuccess: (res) => {
      toast.success(`SMS dispatched successfully to ${singlePhone}! Log ID: ${res.apiResponseId}`);
      setSingleMessage("");
      void queryClient.invalidateQueries({ queryKey: ["sms-logs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send SMS.");
    },
  });

  const toRecipients = (list: typeof prospectOptions): SmsRecipientInput[] =>
    list
      .filter((p) => Boolean(p.phone))
      .map((p) => ({ prospect_id: p.id, prospect_name: p.contact_name, phone: p.phone! }));

  const stageTarget = stageOptions.find((st) => st.id === selectedStage);
  // prospects.stage_id may hold the id, a legacy slug ("follow_up") or the stage name
  const stageKeys = stageTarget
    ? [normalizeStage(stageTarget.id), normalizeStage(stageTarget.name)]
    : [];
  const recipientsByMode: Record<BulkMode, SmsRecipientInput[]> = {
    manual: toRecipients(prospectOptions.filter((p) => selectedProspectIds.includes(p.id))),
    stage: toRecipients(
      prospectOptions.filter((p) => stageKeys.includes(normalizeStage(p.stage_id))),
    ),
    agent: selectedAgentId
      ? toRecipients(prospectOptions.filter((p) => p.assigned_to === selectedAgentId))
      : [],
  };
  const targetBulkRecipients = recipientsByMode[bulkFilterMode];

  const bulkMutation = useMutation({
    mutationFn: async () => {
      return sendBulkSms(targetBulkRecipients, bulkMessage, user?.id, user?.email || "Agent");
    },
    onSuccess: (res) => {
      toast.success(`Bulk SMS broadcast complete! ${res.successCount} sent successfully.`);
      setConfirmModalOpen(false);
      setBulkMessage("");
      setSelectedProspectIds([]);
      void queryClient.invalidateQueries({ queryKey: ["sms-logs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Bulk SMS dispatch failed.");
    },
  });

  const toggleSelectProspect = (id: string) => {
    if (selectedProspectIds.includes(id)) {
      setSelectedProspectIds(selectedProspectIds.filter((item) => item !== id));
    } else {
      setSelectedProspectIds([...selectedProspectIds, id]);
    }
  };

  const selectAllFilteredProspects = () => {
    const term = bulkSearch.toLowerCase();
    const allIds = prospectOptions
      .filter((p) => Boolean(p.phone) && (!term || p.contact_name.toLowerCase().includes(term)))
      .map((p) => p.id);
    setSelectedProspectIds(allIds);
  };

  const clearProspectSelection = () => {
    setSelectedProspectIds([]);
  };

  const singleSmsInfo = calculateSmsInfo(singleMessage);
  const bulkSmsInfo = calculateSmsInfo(bulkMessage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <MessageSquare className="size-6 text-[#67B239]" />
          Send SMS Gateway
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Dispatch single or bulk SMS broadcasts to prospects and clients.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "single" | "bulk")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 sm:w-80">
          <TabsTrigger value="single" className="gap-1.5 text-xs font-semibold">
            <Send className="size-3.5" />
            Single SMS
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-1.5 text-xs font-semibold">
            <Users className="size-3.5" />
            Bulk SMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4">
          <Card className="bg-white dark:bg-card border-slate-200/80 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="size-4 text-[#67B239]" />
                Single SMS Dispatch Form
              </CardTitle>
              <CardDescription className="text-xs">
                Select a prospect to auto-fill contact details or enter a recipient phone number
                directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="single_prospect" className="text-xs font-semibold">
                    Select Prospect (Auto-fill Phone)
                  </Label>
                  <Select value={selectedProspectId} onValueChange={handleSelectSingleProspect}>
                    <SelectTrigger id="single_prospect" className="text-xs">
                      <SelectValue placeholder="Choose a prospect..." />
                    </SelectTrigger>
                    <SelectContent>
                      {prospectOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.contact_name} {p.business_name ? `(${p.business_name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="recipient_phone" className="text-xs font-semibold">
                    Recipient Phone Number
                  </Label>
                  <div className="relative">
                    <PhoneCall className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="recipient_phone"
                      placeholder="+8801700000000"
                      value={singlePhone}
                      onChange={(e) => setSinglePhone(e.target.value)}
                      className="pl-9 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="single_msg" className="text-xs font-semibold">
                  SMS Message Content
                </Label>
                <Textarea
                  id="single_msg"
                  placeholder="Type your SMS message here..."
                  rows={4}
                  value={singleMessage}
                  onChange={(e) => setSingleMessage(e.target.value)}
                  className="text-xs leading-relaxed"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono bg-white dark:bg-background">
                      {singleSmsInfo.length} chars
                    </Badge>
                    <span>
                      ({singleSmsInfo.parts} SMS Part{singleSmsInfo.parts > 1 ? "s" : ""})
                    </span>
                    <span>· {singleSmsInfo.remaining} chars left in current part</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {singleSmsInfo.isUnicode ? "Unicode (Bangla)" : "GSM-7 (English)"}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-[#67B239] hover:bg-[#5aa030] text-white gap-1.5 px-6"
                  disabled={singleMutation.isPending || !singlePhone || !singleMessage}
                  onClick={() => singleMutation.mutate()}
                >
                  <Send className="size-4" />
                  {singleMutation.isPending ? "Sending SMS..." : "Send Single SMS"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <Card className="bg-white dark:bg-card border-slate-200/80 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4 text-[#67B239]" />
                Bulk SMS Broadcast Form
              </CardTitle>
              <CardDescription className="text-xs">
                Target multiple prospects manually or filter audience by stage or assigned agent.
                Requires mandatory confirmation before broadcast.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <ListFilter className="size-3.5 text-blue-600" />
                  Audience Selection Method
                </Label>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
                  <AudienceCard
                    mode="manual"
                    isActive={bulkFilterMode === "manual"}
                    count={recipientsByMode.manual.length}
                    onActivate={() => setBulkFilterMode("manual")}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1 min-w-0">
                          <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                          <Input
                            aria-label="Search prospects"
                            placeholder="Search prospects..."
                            value={bulkSearch}
                            onChange={(e) => setBulkSearch(e.target.value)}
                            className="pl-8 h-8 text-xs bg-white dark:bg-background"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={selectAllFilteredProspects}
                        >
                          All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={clearProspectSelection}
                        >
                          Clear
                        </Button>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-border/60 rounded-md border bg-white dark:bg-background">
                        {prospectOptions
                          .filter(
                            (p) =>
                              !bulkSearch ||
                              p.contact_name.toLowerCase().includes(bulkSearch.toLowerCase()),
                          )
                          .map((p) => {
                            const isSelected = selectedProspectIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                aria-pressed={isSelected}
                                className="flex w-full items-center justify-between gap-2 p-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-muted/40 cursor-pointer"
                                onClick={() => toggleSelectProspect(p.id)}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  {isSelected ? (
                                    <CheckSquare className="size-4 shrink-0 text-[#67B239]" />
                                  ) : (
                                    <Square className="size-4 shrink-0 text-slate-300" />
                                  )}
                                  <span className="truncate font-semibold text-foreground">
                                    {p.contact_name}
                                  </span>
                                </span>
                                <span className="shrink-0 font-mono text-muted-foreground text-[11px]">
                                  {p.phone || "No phone"}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </AudienceCard>
                  <AudienceCard
                    mode="stage"
                    isActive={bulkFilterMode === "stage"}
                    count={recipientsByMode.stage.length}
                    onActivate={() => setBulkFilterMode("stage")}
                  >
                    <Select value={selectedStage} onValueChange={setSelectedStage}>
                      <SelectTrigger
                        aria-label="Target prospect stage"
                        className="text-xs bg-white dark:bg-background"
                      >
                        <SelectValue placeholder="Select Stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {stageOptions
                          .filter((stg) => stg.is_active)
                          .map((stg) => (
                            <SelectItem key={stg.id} value={stg.id} className="text-xs">
                              {stg.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </AudienceCard>
                  <AudienceCard
                    mode="agent"
                    isActive={bulkFilterMode === "agent"}
                    count={recipientsByMode.agent.length}
                    onActivate={() => setBulkFilterMode("agent")}
                  >
                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                      <SelectTrigger
                        aria-label="Target assigned agent"
                        className="text-xs bg-white dark:bg-background"
                      >
                        <SelectValue placeholder="Select Agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {agentOptions.map((ag) => (
                          <SelectItem key={ag.id} value={ag.id} className="text-xs">
                            <span className="flex items-center gap-2">
                              <Avatar className="size-6">
                                {ag.avatar_url && <AvatarImage src={ag.avatar_url} alt="" />}
                                <AvatarFallback className="bg-[#0a2e5c] text-[10px] font-semibold text-white">
                                  {getInitials(ag.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{ag.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AudienceCard>
                </div>
              </div>

              <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-2.5 text-xs flex items-center justify-between text-blue-900 dark:text-blue-200 font-medium">
                <span>Selected Broadcast Audience:</span>
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                  {targetBulkRecipients.length} Prospects Target
                </Badge>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bulk_msg" className="text-xs font-semibold">
                  Bulk Broadcast Message
                </Label>
                <Textarea
                  id="bulk_msg"
                  placeholder="Type bulk broadcast message content..."
                  rows={4}
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  className="text-xs leading-relaxed"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono bg-white dark:bg-background">
                      {bulkSmsInfo.length} chars
                    </Badge>
                    <span>({bulkSmsInfo.parts} SMS Part per recipient)</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {bulkSmsInfo.isUnicode ? "Unicode (Bangla)" : "GSM-7 (English)"}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-[#67B239] hover:bg-[#5aa030] text-white gap-1.5 px-6"
                  disabled={targetBulkRecipients.length === 0 || !bulkMessage}
                  onClick={() => setConfirmModalOpen(true)}
                >
                  <Send className="size-4" />
                  Review & Broadcast Bulk SMS ({targetBulkRecipients.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SmsBulkConfirmModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        recipients={targetBulkRecipients}
        message={bulkMessage}
        onConfirmSend={() => bulkMutation.mutate()}
        isSending={bulkMutation.isPending}
      />
    </div>
  );
}

/** One audience option; using anything inside it makes it the broadcast audience. */
function AudienceCard({
  mode,
  isActive,
  count,
  onActivate,
  children,
}: {
  mode: BulkMode;
  isActive: boolean;
  count: number;
  onActivate: () => void;
  children: React.ReactNode;
}) {
  const { title, description, icon: Icon } = AUDIENCE_MODES.find((m) => m.value === mode)!;
  return (
    <section
      aria-label={title}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
      className={cn(
        "flex flex-col gap-3 rounded-xl border-2 p-4 transition-all",
        isActive
          ? "border-[#67B239] bg-[#67B239]/5 shadow-sm"
          : "border-slate-200 bg-card hover:border-[#67B239]/50 dark:border-slate-800",
      )}
    >
      <button
        type="button"
        aria-pressed={isActive}
        onClick={onActivate}
        className="flex items-start gap-3 text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B239]/50"
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            isActive
              ? "bg-[#67B239] text-white"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[#0a2e5c] dark:text-slate-100">
            {title}
            {isActive && <CheckCircle2 className="size-4 text-[#67B239]" />}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        </span>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 font-semibold",
            isActive && "border-[#67B239] text-[#55962e] dark:text-[#7ac142]",
          )}
        >
          {count}
        </Badge>
      </button>
      {children}
    </section>
  );
}
