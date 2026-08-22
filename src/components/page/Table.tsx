import { useMutation } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useRouteContext } from "@tanstack/react-router";
import { saveAs } from "file-saver";
import {
  DateTime as CalendarClockIcon,
  Calendar as CalendarXIcon,
  MoreHorizontal as EllipsisIcon,
  Repeat as InfinityIcon,
  Loader as LoaderCircleIcon,
  Lock as LockIcon,
  Trash as TrashIcon,
  Close as XIcon,
} from "pixelarticons/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { eden } from "@/lib/eden";
import { cn } from "@/lib/utils";

import { Button, buttonVariants } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export function Preview({
  preview,
  alt,
}: {
  preview:
    | {
        default: string;
        mime: string;
      }
    | undefined
    | null;
  alt: string;
}) {
  const [showModal, setShowModal] = useState(false);

  function open() {
    setShowModal(true);
  }

  function close() {
    setShowModal(false);
  }

  return (
    <div className="relative size-15 select-none">
      {preview ? (
        <>
          <button className="focus:outline-hidden" onClick={open}>
            {preview.mime.startsWith("image") ? (
              <img
                src={preview.default}
                alt={alt}
                className="aspect-square rounded-md object-cover"
                draggable="false"
                decoding="async"
                loading="lazy"
              />
            ) : (
              <video
                src={preview.default}
                className="aspect-square rounded-md object-cover"
                autoPlay
                muted
                loop
              />
            )}
          </button>

          {showModal && (
            <button
              onClick={close}
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/75"
            >
              {preview.mime.startsWith("image") ? (
                <img
                  src={preview.default}
                  alt={alt}
                  className="max-w-[90vw] object-contain md:max-h-[70vh] md:max-w-[70vw]"
                  draggable="false"
                  decoding="async"
                  loading="lazy"
                />
              ) : (
                <video
                  src={preview.default}
                  className="max-w-[90vw] object-contain md:max-h-[70vh] md:max-w-[70vw]"
                  autoPlay
                  muted
                  loop
                />
              )}
            </button>
          )}
        </>
      ) : (
        <img src="/nongzz.jpg" className="aspect-square rounded-md object-cover" />
      )}
    </div>
  );
}

export function UploadedAt({ createdAt }: { createdAt: Date }) {
  const dateStr = useMemo(
    () =>
      createdAt.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [createdAt],
  );

  const timeStr = useMemo(
    () =>
      createdAt.toLocaleString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [createdAt],
  );

  return (
    <div>
      <p className="text-nowarp whitespace-nowrap">{dateStr}</p>
      <p className="text-nowarp whitespace-nowrap">{timeStr}</p>
    </div>
  );
}

export function Status({
  c_status,
  expiresAt,
}: {
  c_status:
    | {
        expires_at?: number | null;
        is_deleted?: boolean | undefined;
      }
    | undefined;
  expiresAt: Date | null;
}) {
  const now = new Date();

  let expires_at: Date | null;
  if (c_status?.expires_at) {
    expires_at = new Date(c_status.expires_at * 1000);
  } else if (expiresAt) {
    expires_at = expiresAt;
  } else {
    expires_at = null;
  }

  // const active = useMemo(
  //     () => c_status.is_active,
  //     [c_status.is_active]
  // );
  const expires = useMemo(() => (expires_at ? expires_at : null), [expires_at]);
  const expired = useMemo(() => (expires ? now > expires : false), [expires]);
  const daysRemaining = useMemo(
    () =>
      expires_at && expires
        ? Math.floor(
            (new Date(expires).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
              (1000 * 60 * 60 * 24),
          )
        : null,
    [expires_at],
  );

  return (
    <div className="flex">
      {c_status?.is_deleted ? (
        <TrashIcon className="text-red-500" />
      ) : // ) : !active ? (
      //     <XIcon className="text-red-500" />
      !expires ? (
        <InfinityIcon />
      ) : expired ? (
        <CalendarXIcon className="text-yellow-500" />
      ) : (
        <div className="flex flex-col items-center gap-1">
          <CalendarClockIcon />
          <p className="text-nowrap">{daysRemaining}일</p>
        </div>
      )}
    </div>
  );
}

export function Password({ password }: { password: boolean }) {
  if (password) {
    return <LockIcon />;
  }
}

export function Paid({ paidAmount }: { paidAmount: number | null }) {
  if (paidAmount === null) return <span className="text-muted-foreground">-</span>;
  if (paidAmount === 0) return <span className="tabular-nums text-muted-foreground">0 P</span>;
  return <span className="tabular-nums font-medium text-foreground">{paidAmount.toLocaleString()} P</span>;
}

export function Title({ title }: { title: string }) {
  return (
    <Popover>
      <PopoverTrigger className="text-left">
        <p className="line-clamp-2">{title}</p>
      </PopoverTrigger>
      <PopoverContent>{title}</PopoverContent>
    </Popover>
  );
}

export function Description({ description }: { description: string | null }) {
  if (description)
    return (
      <Popover>
        <PopoverTrigger className="line-clamp-2 max-w-sm text-left text-wrap">
          {description}
        </PopoverTrigger>
        <PopoverContent>{description}</PopoverContent>
      </Popover>
    );
}

export function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, idx) => (
        <div
          key={idx}
          className="rounded-lg border bg-background px-2 py-1 text-xs font-semibold text-nowrap"
        >
          {tag}
        </div>
      ))}
    </div>
  );
}

export function Actions({ id, isStaff, vv }: { id: string; isStaff?: boolean; vv: "old" | "new" }) {
  const { t } = useTranslation();
  const location = useLocation();
  const session = useSession();
  // const navi = useNavigate();
  const { queryClient } = useRouteContext({ from: "__root__" });

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isForceDeleteDialogOpen, setForceDeleteDialogOpen] = useState(false);

  const handleDownload = () => {
    void eden
      .gimme({ uuid: id })
      .post()
      .then(({ data, error }) => {
        if (error) {
          toast.warning(t("toast.error.internal_server_error"));
          return;
        }

        saveAs(data.presigned_url, data.file_name);
      })
      .catch(() => {
        toast.warning(t("toast.error.internal_server_error"));
      });
  };

  // const deactivate = () => {
  //     hc.hello[":uuid"]
  //         .$patch({
  //             param: { uuid: id },
  //             json: ({ is_active: !is_active })
  //         })
  //         .then(async (resp) => {
  //             if (!resp.ok) {
  //                 const text = await resp.text();
  //                 toast.error(text);
  //                 return;
  //             }

  //             const data = await resp.json();

  //             queryClient.refetchQueries({
  //                 queryKey: ['u', 'mods']
  //             });

  //             if (data.change_to.is_active) {
  //                 toast.success(t("toast.success.mod_activated"));
  //             } else {
  //                 toast.success(t("toast.success.mod_deactivated"));
  //             }
  //         });
  // };

  const delMut = useMutation({
    mutationKey: ["mod", "del", id],
    mutationFn: async () => {
      let resp: Response | undefined = undefined;
      if (vv === "old") {
        resp = (await eden.hello({ uuid: id }).delete()).response;
      } else {
        resp = (await eden.akasha.mod({ modId: id }).delete()).response;
      }

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text);
      }
    },
  });

  const forceDelMut = useMutation({
    mutationKey: ["mod", "force-del", id],
    mutationFn: async () => {
      const { data, error } = await eden.hello.force({ uuid: id }).delete();

      if (error) {
        throw new Error(error.value.toString());
      }

      return data;
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative h-8 w-8 p-0")}
        >
          <span className="sr-only">Open menu</span>
          <EllipsisIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem className="text-base">
            {vv === "old" ? (
              <Link to="/mods/$modId" params={{ modId: id }} className="w-full">
                {t("c.data-table-actions.goto_mod")}
              </Link>
            ) : (
              <Link to="/akasha/mod/$modId" params={{ modId: id }} className="w-full">
                {t("c.data-table-actions.goto_mod")}
              </Link>
            )}
          </DropdownMenuItem>
          {vv === "old" && (
            <>
              <DropdownMenuItem className="text-base">
                <Link
                  className="w-full"
                  to="/mods/$modId/edit"
                  params={{ modId: id }}
                  search={{ redirect: location.href }}
                >
                  {t("c.data-table-actions.edit")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-base" onClick={handleDownload}>
                {t("c.data-table-actions.download")}
              </DropdownMenuItem>
            </>
          )}
          {/* <DropdownMenuItem className="text-base cursor-pointer" onClick={deactivate}>
                        {is_active ? (
                            t("c.data-table-actions.deactivate")
                        ) : (
                            t("c.data-table-actions.activate")
                        )}
                    </DropdownMenuItem> */}
          <DropdownMenuItem
            className="cursor-pointer text-base"
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t("c.data-table-actions.delete")}
          </DropdownMenuItem>

          {isStaff && (
            <DropdownMenuItem
              className="cursor-pointer text-base"
              onClick={() => setForceDeleteDialogOpen(true)}
            >
              {t("c.data-table-actions.force_delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("c.data-table-actions.dialog.d0.m0")}</DialogTitle>
            <DialogDescription>
              {session.data?.user.role !== "staff" && t("c.data-table-actions.dialog.d0.m1")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4"></div>
          <DialogFooter>
            <Button
              className="gap-2"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={async () => {
                try {
                  await delMut.mutateAsync();
                  await queryClient.refetchQueries({
                    queryKey: ["u", "mods"],
                  });
                  toast.success(t("toast.success.mod_deleted"));
                } catch (err) {
                  toast.error("Delete Error", {
                    description: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              {delMut.isPending ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin transition-transform"
                />
              ) : (
                t("g.delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isForceDeleteDialogOpen} onOpenChange={setForceDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("c.data-table-actions.dialog.force.m0")}</DialogTitle>
            <DialogDescription>{t("c.data-table-actions.dialog.force.m1")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4"></div>
          <DialogFooter>
            <Button
              className="gap-2"
              variant="destructive"
              disabled={forceDelMut.isPending}
              onClick={async () => {
                try {
                  await forceDelMut.mutateAsync();
                  await queryClient.refetchQueries({
                    queryKey: ["u", "mods"],
                  });
                  toast.success(t("toast.success.mod_deleted"));
                } catch (err) {
                  toast.error("Delete Error", {
                    description: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
            >
              {forceDelMut.isPending ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin transition-transform"
                />
              ) : (
                t("g.delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
