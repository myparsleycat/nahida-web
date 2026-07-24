import { ScrollArea } from "@radix-ui/react-scroll-area";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  ActivityIcon,
  ChartLineIcon,
  DeleteIcon,
  DownloadIcon,
  EyeIcon,
  GlobeIcon,
  InfoIcon,
  SaveIcon,
  ShareIcon,
  SquarePenIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { toast } from "sonner";

import type { AkashaModData } from "@/lib/akasha/services/drive-types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useModContext, type AkashaMod } from "@/context/ModContext";
import { modStorage } from "@/lib/akasha/services/mod-drive/localstorage";
import { useSession } from "@/lib/auth-client";
import { eden } from "@/lib/eden";
import { cn, formatDate, formatSize } from "@/lib/utils";

import { DatePicker } from "../DatePicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Snippet } from "../ui/snippet";
import { Spinner } from "../ui/spinner";
import TagsInput from "../ui/tags-input";
import { Textarea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { CollectionList } from "./mod-collection-list";

interface AkashaModInfoProps {
  className?: string;
  data: AkashaModData;
}

export function AkashaModInfo(props: AkashaModInfoProps) {
  const { data, className } = props;

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col overflow-hidden px-4 **:select-text", className)}
    >
      <div className="flex min-h-0 flex-1 flex-col pt-4 pb-4">
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
          <div>
            <TopButtons />
          </div>

          <div>
            <h4 className="mb-2 text-base font-medium">Mod</h4>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-current/65">Title</span>
                <span className="relative min-w-0 flex-1 shrink">
                  <span className="absolute inset-0">
                    <span className="text-text block min-w-0 truncate text-right">
                      {data.mod.title}
                    </span>
                  </span>
                </span>
              </div>

              {data.mod.description && (
                <div className="flex justify-between gap-4 text-sm">
                  <span className="shrink-0 text-current/65">Description</span>
                  <span className="relative min-w-0 flex-1 shrink">
                    <span className="absolute inset-0">
                      <Dialog>
                        <DialogTrigger className="w-full">
                          <span className="text-text block min-w-0 truncate text-right">
                            {data.mod.description}
                          </span>
                        </DialogTrigger>
                        <DialogContent
                          className="max-h-[70vh] overflow-y-auto wrap-break-word whitespace-pre-wrap"
                          showCloseButton={false}
                        >
                          {data.mod.description}
                        </DialogContent>
                      </Dialog>
                    </span>
                  </span>
                </div>
              )}

              <OneRow
                title="Created At"
                description={formatDate(data.mod.createdAt, navigator.language)}
              />

              {data.mod.expiresAt && (
                <OneRow
                  title="Expires At"
                  description={formatDate(data.mod.expiresAt, navigator.language)}
                />
              )}

              {/* <div className="flex justify-between gap-4 text-sm">
                  <span className="text-current/65 shrink-0">AI Generated</span>
                  <span className="relative min-w-0 flex-1 shrink">
                    <span className="absolute inset-0">
                      <span className="block truncate text-text min-w-0 text-right">
                        {data!.aiGen === true ? "Yes" : "No"}
                      </span>
                    </span>
                  </span>
                </div> */}

              <div>
                <h4 className="mb-2 text-sm font-medium text-current/65">Tags</h4>
                <div className="flex w-full flex-wrap gap-1.5">
                  {data.mod.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-sm bg-muted px-2 py-1 text-xs whitespace-nowrap"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <h4 className="mb-2 text-base font-medium">Collections</h4>

            <div className="min-h-0 flex-1">
              <CollectionList data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OneRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="shrink-0 text-current/65">{title}</span>
      <span className="relative min-w-0 flex-1 shrink">
        <span className="absolute inset-0">
          <span className="text-text block min-w-0 truncate text-right">{description}</span>
        </span>
      </span>
    </div>
  );
}

export function Bottom() {
  const imgs = [
    "/img/1619/1619-miyabi.gif",
    "/img/1619/1619-miyabi_2.gif",
    "/img/1619/1619-miyabi_3.gif",
  ];

  const [src, setSrc] = useState("");

  useEffect(() => {
    const initialImg = imgs[Math.floor(Math.random() * imgs.length)];
    setSrc(initialImg);
  }, []);

  const handleClick = () => {
    const remainingImgs = imgs.filter((img) => img !== src);

    if (remainingImgs.length > 0) {
      const newImg = remainingImgs[Math.floor(Math.random() * remainingImgs.length)];
      setSrc(newImg);
    }
  };

  if (src)
    return (
      <button onClick={handleClick}>
        <img src={src} alt="Animated GIF" />
      </button>
    );
}

function TopButtonsRow({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full space-x-4">{children}</div>;
}

function ShareDialog() {
  return (
    <Tooltip>
      <Dialog>
        <DialogTrigger asChild>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <ShareIcon />
            </Button>
          </TooltipTrigger>
        </DialogTrigger>
        <DialogContent showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()}>
          <Snippet className="w-full overflow-hidden" text={window.location.href} />
        </DialogContent>
      </Dialog>
      <TooltipContent>
        <p>공유</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface EditDialogProps {
  modId?: string;
  modQuery?: AkashaMod | null;
  sig?: string;
}

function EditDialog(props: EditDialogProps) {
  const { modId, modQuery, sig } = props;
  const { t } = useTranslation();
  const router = useRouter();

  const refetch = async () => {
    router.invalidate();
  };

  const passwordRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon">
            <SquarePenIcon />
          </Button>
        </TooltipTrigger>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle></DialogTitle>
          </DialogHeader>
        </VisuallyHidden>
        <div className="flex w-full flex-col space-y-4 text-nowrap">
          <TopButtonsRow>
            <Label>{t("upload.title")}</Label>
            <Input
              type="text"
              defaultValue={modQuery?.mod.title}
              onBlur={async (c) => {
                const value = c.currentTarget.value;

                if (!modId) {
                  return;
                } else if (!value) {
                  toast.warning("제목은 비워둘 수 없습니다");
                  return;
                }

                eden.akasha.mod
                  .edit({ modId })
                  .post(
                    {
                      title: value,
                    },
                    {
                      headers: { "x-sig": sig },
                    },
                  )
                  .then(refetch)
                  .then(() => toast.info("제목이 변경되었습니다"))
                  .catch(() => toast.error("서버 오류 발생"));
              }}
            />
          </TopButtonsRow>

          <Separator />

          <TopButtonsRow>
            <Label>{t("upload.description")}</Label>
            <Textarea
              defaultValue={modQuery?.mod.description || ""}
              onBlur={async (c) => {
                const value = c.currentTarget.value;

                if (!modId) {
                  return;
                }

                eden.akasha.mod
                  .edit({ modId })
                  .post(
                    {
                      description: value,
                    },
                    {
                      headers: { "x-sig": sig },
                    },
                  )
                  .then(refetch)
                  .then(() => toast.info("설명이 변경되었습니다"))
                  .catch(() => toast.error("서버 오류 발생"));
              }}
            />
          </TopButtonsRow>

          <Separator />

          <TopButtonsRow>
            <Label>{t("upload.tags")}</Label>
            <TagsInput
              value={modQuery?.mod.tags}
              onValueChange={async (tags) => {
                if (!modId) {
                  return;
                } else if (tags.length < 1) {
                  toast.warning("최소 1개 이상의 태그가 필요합니다");
                  return;
                }

                eden.akasha.mod
                  .edit({ modId })
                  .post(
                    {
                      tags,
                    },
                    {
                      headers: { "x-sig": sig },
                    },
                  )
                  .then(refetch)
                  .then(() => toast.info("태그가 변경되었습니다"))
                  .catch(() => toast.error("서버 오류 발생"));
              }}
            />
          </TopButtonsRow>

          <Separator />

          <TopButtonsRow>
            <Label>{t("upload.expiration_date")}</Label>
            <DatePicker
              value={modQuery?.mod.expiresAt ? new Date(modQuery.mod.expiresAt) : undefined}
              onChange={(date) => {
                if (!modId) {
                  return;
                }

                const expiresAt = date ? date : null;

                eden.akasha.mod
                  .edit({ modId })
                  .post(
                    {
                      expiresAt,
                    },
                    {
                      headers: { "x-sig": sig },
                    },
                  )
                  .then(refetch)
                  .then(() => {
                    if (!modQuery?.mod.expiresAt && expiresAt) {
                      toast.info("만료일이 설정되었습니다");
                    } else if (modQuery?.mod.expiresAt && expiresAt) {
                      toast.info("만료일이 변경되었습니다");
                    } else if (modQuery?.mod.expiresAt && !expiresAt) {
                      toast.info("만료일이 해제되었습니다");
                    }
                  })
                  .catch(() => toast.error("서버 오류 발생"));
              }}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const sevenDaysLater = new Date(today);
                sevenDaysLater.setDate(today.getDate() + 7);

                return date < sevenDaysLater;
              }}
            />
          </TopButtonsRow>

          <Separator />

          <TopButtonsRow>
            <Label>{t("g.password")}</Label>
            <Input
              ref={passwordRef}
              type="text"
              defaultValue={modQuery?.mod.password ? "********" : ""}
              disabled={modQuery?.mod.password}
            />
            {modQuery?.mod.password ? (
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  if (!modId) {
                    return;
                  }

                  eden.akasha.mod
                    .edit({ modId })
                    .post(
                      {
                        password: {
                          enabled: false,
                        },
                      },
                      {
                        headers: { "x-sig": sig },
                      },
                    )
                    .then(async ({ error }) => {
                      if (!error) {
                        await refetch();
                        if (passwordRef.current) {
                          passwordRef.current.value = "";
                        }
                        toast.info("비밀번호가 해제되었습니다");
                      } else {
                        toast.error("서버 오류 발생", {
                          description: error.value.toString(),
                        });
                      }
                    });
                }}
              >
                <DeleteIcon />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  const value = passwordRef.current?.value;

                  if (!modId) {
                    return;
                  } else if (!value) {
                    toast.warning("빈 문자열을 비밀번호로 사용할 수 없습니다");
                    return;
                  }

                  eden.akasha.mod
                    .edit({ modId })
                    .post(
                      {
                        password: {
                          enabled: true,
                          value,
                        },
                      },
                      {
                        headers: { "x-sig": sig },
                      },
                    )
                    .then(async ({ error }) => {
                      if (!error) {
                        await refetch();
                        if (passwordRef.current) {
                          passwordRef.current.value = "********";
                        }
                        toast.info("비밀번호가 설정되었습니다");
                      } else {
                        toast.error("서버 오류 발생", {
                          description: error.value.toString(),
                        });
                      }
                    });
                }}
              >
                <SaveIcon />
              </Button>
            )}
          </TopButtonsRow>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  className?: string;
}

function StatCard({ title, value, icon: Icon, description, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}>
      <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="p-6 pt-0">
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

interface AnalyticsDialogProps {
  modId?: string;
}

function AnalyticsDialog(props: AnalyticsDialogProps) {
  const { modId } = props;

  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["mod", "analytics", modId],
    enabled: !!modId && open,
    queryFn: async () => {
      if (!modId) return;

      const modStorageData = modStorage.getMod(modId);

      const { data, error } = await eden.akasha.mod.analytics({ modId }).get({
        query: {
          sig: modStorageData?.sig,
        },
      });

      if (error) {
        throw new Error(error.value.toString());
      }

      return data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon">
            <ChartLineIcon />
          </Button>
        </TooltipTrigger>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[80vh] w-full max-w-[90vw] min-w-xl flex-1 overflow-auto"
      >
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle></DialogTitle>
          </DialogHeader>
        </VisuallyHidden>
        <div className="flex h-full w-full items-center justify-center">
          {query.isLoading ? (
            <Spinner />
          ) : query.data?.summary && query.data.trends && query.data.demographics ? (
            <div className="mx-auto flex w-full flex-col gap-4 md:gap-8">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* <StatCard
                  title="총 조회수"
                  value={query.data.summary.totalViews.toLocaleString()}
                  icon={EyeIcon}
                /> */}
                <StatCard
                  title="총 다운로드"
                  value={query.data.summary.totalDownloads.toLocaleString()}
                  icon={DownloadIcon}
                />
                <StatCard
                  title="고유 다운로더"
                  value={query.data.summary.uniqueDownloads.toLocaleString()}
                  icon={UsersIcon}
                  description="중복 제외 실제 유저 수"
                />
                {/* <StatCard
                  title="전환율"
                  value={query.data.summary.conversionRate}
                  icon={ActivityIcon}
                  description="조회 대비 다운로드 비율"
                /> */}
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                  <div className="flex flex-col space-y-1.5 p-6">
                    <h3 className="leading-none font-semibold tracking-tight">
                      월별 다운로드 추이
                    </h3>
                    <p className="text-sm text-muted-foreground">지난 기간 동안의 다운로드 변화</p>
                  </div>
                  <div className="p-6 pl-0">
                    <div className="h-75 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={query.data.trends.monthly}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            tick={{ fontSize: 12, fill: "#6B7280" }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            tick={{ fontSize: 12, fill: "#6B7280" }}
                          />
                          <RTooltip
                            contentStyle={{
                              backgroundColor: "var(--background)",
                              borderStyle: "var(--tw-border-style)",
                              borderRadius: "8px",
                            }}
                            cursor={{ stroke: "#9CA3AF", strokeWidth: 1 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#8884d8"
                            fillOpacity={1}
                            fill="url(#colorCount)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                  <div className="flex flex-col space-y-1.5 p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="leading-none font-semibold tracking-tight">국가별 순위</h3>
                      <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">다운로드가 가장 많은 상위 5개국</p>
                  </div>
                  <div className="p-6 pt-0">
                    <div className="h-75 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={query.data.demographics.countries.slice(0, 5)}
                          margin={{ left: 0, right: 30 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={false}
                            stroke="#E5E7EB"
                          />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="country"
                            type="category"
                            width={100}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: "#374151", fontWeight: 500 }}
                          />
                          <RTooltip
                            cursor={{ fill: "transparent" }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="rounded-lg border bg-background p-2 text-xs shadow-sm">
                                    <div className="font-bold">{data.country}</div>
                                    <div>
                                      {data.count} 다운로드 ({data.percentage}%)
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                            {query.data.demographics.countries.slice(0, 5).map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={index === 0 ? "#3b82f6" : "#94a3b8"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <p className="text-muted-foreground">
                  2025년 12월 07일 이전 모드는 집계가 정확하지 않을 수 있음
                </p>
              </div>
            </div>
          ) : (
            <></>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TopButtons() {
  const { modId, modQuery, sig } = useModContext();
  const session = useSession();
  const navi = useNavigate();

  const own = useMemo(() => {
    return modQuery?.permission.own || modQuery?.permission.sig;
  }, [modQuery]);

  const deleteMutation = useMutation({
    mutationKey: ["mod", "del", modId],
    mutationFn: async () => {
      if (!modId) return;

      const { error } = await eden.akasha.mod({ modId }).delete();

      if (error) {
        throw error.value.toString();
      }
    },
    onSuccess: () => {
      toast.success("모드가 삭제되었어요");
      navi({ to: "/u/mods" });
    },
    onError: (error) => {
      toast.error("모드를 삭제하지 못했어요", {
        description: error.message,
      });
    },
  });

  return (
    <div className="flex w-full items-center justify-end">
      <ShareDialog />

      {(own || session.data?.user.role === "staff") && (
        <>
          <AlertDialog>
            <AlertDialogTrigger>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="ghost" size="icon">
                    <TrashIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>삭제</p>
                </TooltipContent>
              </Tooltip>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>모드를 완전히 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  이 작업은 되돌릴 수 없어요. 정말로 이 모드를 삭제할까요?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* <Tooltip>
            <DeleteDialog
              modId={modId}
              modQuery={modQuery}
              sig={sig}
            />
            <TooltipContent>
              <p>수정</p>
            </TooltipContent>
          </Tooltip> */}

          <Tooltip>
            <EditDialog modId={modId} modQuery={modQuery} sig={sig} />
            <TooltipContent>
              <p>수정</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <AnalyticsDialog modId={modId} />
            <TooltipContent>
              <p>통계</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
