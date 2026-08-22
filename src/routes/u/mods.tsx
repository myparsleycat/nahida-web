import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Center, ServerCrash } from "@/components/common";
import {
  Actions,
  Description,
  Paid,
  Password,
  Preview,
  Status,
  Tags,
  Title,
  UploadedAt,
} from "@/components/page/Table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { eden } from "@/lib/eden";
import { getRandInt } from "@/lib/utils";

export const Route = createFileRoute("/u/mods")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  const oldQuery = useQuery({
    queryKey: ["u", "mods", "old"],
    queryFn: async () => {
      const { data, error } = await eden.hello.mymods.get();

      if (error) {
        throw new Error("GetMyMods Error");
      }

      return data;
    },
    placeholderData: (prev) => prev,
  });

  const newQuery = useQuery({
    queryKey: ["u", "mods", "new"],
    queryFn: async () => {
      const { data, error } = await eden.akasha.mod.my.get();

      if (error) {
        throw new Error(error.value.toString());
      }

      return data;
    },
    placeholderData: (prev) => prev,
  });

  const [sortBy, setSortBy] = useState<string>("latest");
  const [search, setSearch] = useState<string>("");

  const mods = useMemo(() => {
    const oldMods = oldQuery.data || [];
    const newMods = newQuery.data || [];

    interface Mod {
      vv: "old" | "new";
      id: string;
      title: string;
      tags: string[];
      description: string | null;
      size: number;
      createdAt: Date;
      expiresAt: Date | null;
      password: boolean;
      paidAmount: number | null;
      preview?: {
        default: string;
        mime: string;
      } | null;
      c_status?: {
        is_deleted?: boolean | undefined;
        expires_at: number | null;
        is_active: boolean;
      };
    }

    const r: Mod[] = [];

    for (const mod of oldMods) {
      r.push({
        vv: "old",
        id: mod.uuid,
        title: mod.title,
        tags: mod.tags,
        description: mod.description,
        size: mod.size,
        createdAt: new Date(mod.uploaded_at * 1000),
        expiresAt: mod.expires_at ? new Date(mod.expires_at * 1000) : null,
        password: mod.password,
        paidAmount: null,
        preview: {
          default: mod.preview_url,
          mime: "image/*",
        },
        c_status: mod.c_status,
      });
    }

    for (const mod of newMods) {
      r.push({
        vv: "new",
        id: mod.id,
        title: mod.title,
        tags: mod.tags,
        description: mod.description,
        size: 0,
        createdAt: new Date(mod.createdAt),
        expiresAt: mod.expiresAt ? new Date(mod.expiresAt) : null,
        password: mod.password,
        paidAmount: mod.paidAmount,
        preview: mod.preview && {
          default: mod.preview.default,
          mime: mod.preview.mime,
        },
      });
    }

    const filtered = r.filter((mod) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        mod.title.toLowerCase().includes(s) ||
        mod.description?.toLowerCase().includes(s) ||
        mod.tags.some((t) => t.toLowerCase().includes(s))
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === "latest") {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      if (sortBy === "oldest") {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      if (sortBy === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "title_desc") {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });
  }, [oldQuery, newQuery, sortBy, search]);

  const loading = useMemo(() => {
    return oldQuery.isLoading || newQuery.isLoading;
  }, [oldQuery.isLoading, newQuery.isLoading]);

  if (oldQuery.isError || newQuery.isError)
    return (
      <Center size="page-full">
        <ServerCrash />
      </Center>
    );

  return (
    <div className="flex h-full w-full">
      <div className="flex h-full w-full flex-col p-6">
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full items-center justify-between">
            <h1 className="text-2xl font-bold">{t("u.my_mods")}</h1>
            <div className="mb-4 flex items-center gap-4">
              <Input
                className="w-64"
                placeholder={t("u.mods.search_placeholder")}
                value={search}
                onValueChange={setSearch}
              />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-45">
                  <SelectValue placeholder={t("u.mods.sort.label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">{t("u.mods.sort.latest")}</SelectItem>
                  <SelectItem value="oldest">{t("u.mods.sort.oldest")}</SelectItem>
                  <SelectItem value="title_asc">{t("u.mods.sort.title_asc")}</SelectItem>
                  <SelectItem value="title_desc">{t("u.mods.sort.title_desc")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-25">{t("u.mods.preview")}</TableHead>
                  <TableHead>{t("u.mods.upload_date")}</TableHead>
                  <TableHead>{t("u.mods.status")}</TableHead>
                  <TableHead>{t("u.mods.paid")}</TableHead>
                  <TableHead>{t("u.mods.password")}</TableHead>
                  <TableHead>{t("u.mods.title")}</TableHead>
                  <TableHead>{t("u.mods.description")}</TableHead>
                  <TableHead>{t("u.mods.tags")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading ? (
                  mods.map((mod) => (
                    <TableRow key={mod.id}>
                      <TableCell>
                        <Preview preview={mod.preview} alt={`${mod.title} preview`} />
                      </TableCell>
                      <TableCell>
                        <UploadedAt createdAt={mod.createdAt} />
                      </TableCell>
                      <TableCell>
                        <Status c_status={mod.c_status} expiresAt={mod.expiresAt} />
                      </TableCell>
                      <TableCell>
                        <Paid paidAmount={mod.paidAmount} />
                      </TableCell>
                      <TableCell>
                        <Password password={mod.password} />
                      </TableCell>
                      <TableCell>
                        <Title title={mod.title} />
                      </TableCell>
                      <TableCell>
                        <Description description={mod.description} />
                      </TableCell>
                      <TableCell>
                        <Tags tags={mod.tags} />
                      </TableCell>
                      <TableCell>
                        <Actions id={mod.id} vv={mod.vv} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <Placeholder />
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Placeholder() {
  const rand = getRandInt(1, 8);

  return Array.from({ length: rand }).map((_, idx) => (
    <TableRow key={idx}>
      <TableCell>
        <Skeleton className="size-15" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="size-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="size-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="size-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-48" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-72" />
      </TableCell>
      <TableCell>
        <Skeleton className="size-8" />
      </TableCell>
    </TableRow>
  ));
}
