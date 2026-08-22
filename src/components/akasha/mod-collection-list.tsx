import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import {
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Lock as LockIcon,
  Trash as TrashIcon,
} from "pixelarticons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { AkashaModData } from "@/lib/akasha/services/drive-types";

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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModContext } from "@/context/ModContext";
import { isArcaChannel } from "@/lib/akasha/services/arca-channel";
import { deleteModCollection } from "@/lib/akasha/services/deletion";
import { parseModPath } from "@/lib/akasha/services/mod-drive/common";
import { parsePointAmountInput } from "@/lib/akasha/services/mod-points";
import { pointAmountRanges, usePointSettings } from "@/lib/akasha/services/point-settings";
import { eden } from "@/lib/eden";
import { cn, formatDate, formatSize } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Button, buttonVariants } from "../ui/button";

interface CollectionListProps {
  data: AkashaModData;
}

export function CollectionList(props: CollectionListProps) {
  const { t } = useTranslation();
  const { data } = props;
  const router = useRouter();
  const { sig, modId, collectionId, itemId, setItemId, modQuery, setCollectionId } =
    useModContext();

  const own = modQuery?.permission.own || modQuery?.permission.sig;

  const [open, setOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [confirmPrivateCollectionId, setConfirmPrivateCollectionId] = useState("");
  const [pointCollectionId, setPointCollectionId] = useState("");
  const [pointAmountDraft, setPointAmountDraft] = useState("");
  const pointCollection = data.collections.find((item) => item.id === pointCollectionId);
  const pointSettings = usePointSettings();
  const modChannel = isArcaChannel(modQuery?.points?.channel) ? modQuery.points.channel : null;
  const pointRange = pointSettings.data && modChannel
    ? pointAmountRanges(pointSettings.data)[modChannel]
    : null;

  const creMut = useMutation({
    mutationKey: ["akasha", "mod", "collection", "create"],
    mutationFn: async () => {
      const { data: rD, error } = await eden.akasha.mod["create-collection"].post({
        modId: data.mod.id,
        sig,
        name: newCollectionName,
      });

      if (error) {
        throw new Error(error.value.toString());
      }

      return rD;
    },
  });

  const delMut = useMutation({
    mutationKey: ["akasha", "mod", "collection", "delete"],
    mutationFn: async ({ id }: { id: string }) => {
      if (!id) return;
      await deleteModCollection(id, sig);
    },
  });

  const privMut = useMutation({
    mutationKey: ["akasha", "mod", "collection", "change", "private"],
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      if (!id) return;

      const { error } = await eden.akasha.mod.collection({ id }).patch(
        {
          private: value,
        },
        {
          query: { sig },
        },
      );

      if (error) {
        throw new Error(error.value.toString());
      }
    },
    onSuccess: async () => {
      await router.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const pointMut = useMutation({
    mutationKey: ["akasha", "mod", "collection", "change", "points"],
    mutationFn: async ({ id, pointAmount }: { id: string; pointAmount: number | null }) => {
      const { error } = await eden.akasha.mod
        .collection({ id })
        .patch({ pointAmount }, { query: { sig } });
      if (error) throw new Error(error.value.toString());
    },
    onSuccess: async () => {
      await router.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const createCollection = async () => {
    try {
      const resp = await creMut.mutateAsync();
      try {
        await router.invalidate();
      } catch (error) {
        console.error("Failed to refresh after collection creation:", error);
      }
      setOpen(false);
      setNewCollectionName("");
      setCollectionId(resp.collectionId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const saveCollectionPoints = () => {
    if (!pointCollectionId) return;
    if (!pointRange) return;
    const parsed = parsePointAmountInput(pointAmountDraft, pointRange);
    if (parsed === "invalid") {
      toast.warning(
        t("akasha.points.amountRange", {
          min: pointRange.min,
          max: pointRange.max,
        }),
      );
      return;
    }
    if (parsed === (pointCollection?.pointAmount ?? null)) {
      setPointCollectionId("");
      return;
    }
    pointMut.mutate(
      { id: pointCollectionId, pointAmount: parsed },
      {
        onSuccess: () => {
          setPointCollectionId("");
          toast.info(t("akasha.points.amountSaved"));
        },
      },
    );
  };

  return (
    <ScrollArea className="relative h-full min-h-0 rounded-xl bg-black/40 p-3 inset-shadow-2xs">
      {data.collections.length === 0 && (
        <div className="relative z-10 my-3 flex w-full items-center justify-center overflow-hidden p-2">
          <span>컬렉션 없음</span>
        </div>
      )}

      <div className="space-y-1">
        {data.collections.map((collection, idx) => (
          <div key={idx} className="flex min-h-8 items-center gap-1">
            <Button
              variant={collectionId === collection.id ? "default" : "ghost"}
              className="h-8 min-w-0 flex-1 text-center whitespace-normal"
              onClick={() => setCollectionId(collection.id)}
            >
              {collection.name}
              {collection.pointAmount != null && data.points?.scope === "collection" && !own && (
                <span className="text-muted-foreground"> ({collection.pointAmount}P)</span>
              )}
            </Button>

            {own && data.points?.scope === "collection" && (
              <Button
                variant="outline"
                className="h-8 shrink-0 px-2"
                onClick={() => {
                  setPointCollectionId(collection.id);
                  setPointAmountDraft(collection.pointAmount?.toString() ?? "");
                }}
              >
                {collection.pointAmount != null
                  ? `${collection.pointAmount}P`
                  : t("akasha.points.free")}
              </Button>
            )}

            {own && (
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (collection.private) {
                      privMut.mutate({
                        id: collection.id,
                        value: false,
                      });
                      return;
                    }

                    setConfirmPrivateCollectionId(collection.id);
                  }}
                >
                  {collection.private ? <EyeOffIcon /> : <EyeIcon />}
                </Button>

                <AlertDialog
                  open={confirmPrivateCollectionId === collection.id}
                  onOpenChange={(nextOpen) => {
                    if (!nextOpen && confirmPrivateCollectionId === collection.id) {
                      setConfirmPrivateCollectionId("");
                    }
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>이 컬렉션을 비공개로 바꿀까요?</AlertDialogTitle>
                      <AlertDialogDescription>
                        비공개 컬렉션은 모드 업로더만 확인할 수 있습니다
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          privMut.mutate({
                            id: collection.id,
                            value: true,
                          });
                          setConfirmPrivateCollectionId("");
                        }}
                      >
                        확인
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    asChild
                  >
                    <Button variant="ghost" size="icon">
                      <TrashIcon width={20} height={20} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("#.itemsDelete.collectionTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("#.itemsDelete.collectionDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("g.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={delMut.isPending}
                        onClick={async () => {
                          try {
                            await delMut.mutateAsync({ id: collection.id });
                            try {
                              await router.invalidate();
                            } catch (error) {
                              console.error("Failed to refresh after collection deletion:", error);
                            }

                            if (collectionId === collection.id) {
                              setCollectionId("");
                            }
                            toast.success(t("#.itemsDelete.collectionSuccess"));
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : String(error));
                          }
                        }}
                      >
                        {t("g.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ))}

        {own && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
              New Collection
            </DialogTrigger>
            <DialogContent
              // className="gap-3"
              aria-describedby={undefined}
            >
              <DialogHeader>
                <DialogTitle>Create New Collection</DialogTitle>
              </DialogHeader>
              <div className="flex gap-3">
                <Input
                  value={newCollectionName}
                  onValueChange={setNewCollectionName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !creMut.isPending && !!newCollectionName) {
                      void createCollection();
                    }
                  }}
                />
                <Button
                  disabled={creMut.isPending || !newCollectionName}
                  onClick={() => void createCollection()}
                >
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {own && data.points?.scope === "collection" && (
        <Dialog
          open={!!pointCollectionId}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setPointCollectionId("");
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("akasha.points.editCollectionTitle", {
                  name: pointCollection?.name ?? "",
                })}
              </DialogTitle>
              <DialogDescription>
                {t("akasha.points.editCollectionDescription", {
                  min: pointRange?.min ?? "",
                  max: pointRange?.max ?? "",
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="collection-point-amount">{t("akasha.points.amount")}</Label>
              <Input
                id="collection-point-amount"
                inputMode="numeric"
                value={pointAmountDraft}
                onValueChange={setPointAmountDraft}
                placeholder={t("akasha.points.free")}
                disabled={!pointRange}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !pointMut.isPending) {
                    saveCollectionPoints();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPointCollectionId("")}>
                {t("g.cancel")}
              </Button>
              <Button disabled={pointMut.isPending || !pointRange} onClick={saveCollectionPoints}>
                {t("akasha.points.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ScrollArea>
  );
}
