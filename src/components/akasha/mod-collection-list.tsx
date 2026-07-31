import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import {
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Lock as LockIcon,
  Trash as TrashIcon,
} from "pixelarticons/react";
import { useEffect, useState } from "react";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModContext } from "@/context/ModContext";
import { parseModPath } from "@/lib/akasha/services/mod-drive/common";
import { eden } from "@/lib/eden";
import { cn, formatDate, formatSize } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Button, buttonVariants } from "../ui/button";

interface CollectionListProps {
  data: AkashaModData;
}

export function CollectionList(props: CollectionListProps) {
  const { data } = props;
  const router = useRouter();
  const { sig, modId, collectionId, itemId, setItemId, modQuery, setCollectionId } =
    useModContext();

  const own = modQuery?.permission.own || modQuery?.permission.sig;

  const [open, setOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [confirmPrivateCollectionId, setConfirmPrivateCollectionId] = useState("");

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

      const { error } = await eden.akasha.mod.collection({ id }).delete({
        query: { sig },
      });

      if (error) {
        throw new Error(error.value.toString());
      }
    },
  });

  const privMut = useMutation({
    mutationKey: ["akasha", "mod", "collection", "change", "private"],
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      if (!id) return;

      const { data, error } = await eden.akasha.mod.collection({ id }).patch(
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

  return (
    <ScrollArea className="relative h-full min-h-0 rounded-xl bg-black/40 p-3 inset-shadow-2xs">
      {data.collections.length === 0 && (
        <div className="relative z-10 my-3 flex w-full items-center justify-center overflow-hidden p-2">
          <span>컬렉션 없음</span>
        </div>
      )}

      <div className="space-y-1">
        {data.collections.map((collection, idx) => (
          <div key={idx} className="flex h-8 items-center gap-1">
            <Button
              variant={collectionId === collection.id ? "default" : "ghost"}
              className="h-full min-w-0 flex-1 text-center whitespace-normal"
              onClick={() => setCollectionId(collection.id)}
            >
              {collection.name}
            </Button>

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
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
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
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : String(error));
                          }
                        }}
                      >
                        Continue
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
    </ScrollArea>
  );
}
