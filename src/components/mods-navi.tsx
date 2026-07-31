import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface SearchProps {
  s?: string;
  st?: string;
}

export function ModsSearch({ s }: SearchProps) {
  const navi = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const search = formData.get("s")?.toString();

    void navi({
      to: "/admin/mods",
      search: {
        s: search,
        st: "title",
      },
    }).catch((error) => {
      console.error("Failed to navigate to mods:", error);
    });
  };

  return (
    <form className="flex items-center justify-center space-x-2 p-2" onSubmit={handleSubmit}>
      <Input defaultValue={s} name="s" />
      <Button type="submit">검색</Button>
    </form>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function ModsPagination(props: PaginationProps) {
  const { currentPage, totalPages } = props;
  const search = useSearch({ from: "/admin/mods" });

  const pageNumbers: (number | "ellipsis")[] = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    pageNumbers.push(1);
    if (startPage > 2) {
      pageNumbers.push("ellipsis");
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pageNumbers.push("ellipsis");
    }
    pageNumbers.push(totalPages);
  }

  const prevPageTarget = Math.max(1, startPage - 1);
  const nextPageTarget = Math.min(totalPages, endPage + 1);

  const isPrevDisabled = startPage <= 1;
  const isNextDisabled = endPage >= totalPages;

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Link
            to="/admin/mods"
            search={{
              p: prevPageTarget,
              s: search?.s,
              st: search?.st,
            }}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
              isPrevDisabled && "pointer-events-none opacity-50",
            )}
            disabled={isPrevDisabled}
          >
            <PaginationPrevious />
          </Link>
        </PaginationItem>
        {pageNumbers.map((page, index) => (
          <PaginationItem key={index}>
            {page === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <Link
                to="/admin/mods"
                search={{
                  p: page,
                  s: search?.s,
                  st: search?.st,
                }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  {
                    "bg-accent text-accent-foreground": page === currentPage,
                  },
                )}
              >
                {page}
              </Link>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <Link
            to="/admin/mods"
            search={{
              p: nextPageTarget,
              s: search?.s,
              st: search?.st,
            }}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
              isNextDisabled && "pointer-events-none opacity-50",
            )}
            disabled={isNextDisabled}
          >
            <PaginationNext />
          </Link>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
