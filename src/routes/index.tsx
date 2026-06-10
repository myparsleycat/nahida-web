import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { round } from "es-toolkit";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Center } from "@/components/common";
import { AliceLoader } from "@/components/common/loaders";
import { MoeCounter } from "@/components/moe-counter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { eden } from "@/lib/eden";
import { cn, formatDate, formatSize } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Component,
});

function Component() {
  const [activeIndex, setActiveIndex] = useState(0);
  const isScrolling = useRef(false);

  const query = useQuery({
    queryKey: ["index"],
    queryFn: async () => {
      const { data, error } = await eden.hello.get();
      if (error) throw error;
      return data;
    },
    placeholderData: (prev) => prev,
  });

  function convertBytesToTB(bytes: number) {
    const TERABYTE_SIZE = 1024 ** 4;
    return round(bytes / TERABYTE_SIZE);
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (isScrolling.current) return;

    if (e.deltaY > 50 && activeIndex === 0) {
      isScrolling.current = true;
      setActiveIndex(1);
      setTimeout(() => {
        isScrolling.current = false;
      }, 800);
    } else if (e.deltaY < -50 && activeIndex === 1) {
      isScrolling.current = true;
      setActiveIndex(0);
      setTimeout(() => {
        isScrolling.current = false;
      }, 800);
    }
  };

  if (query.isLoading) {
    return (
      <Center size="page-full">
        <AliceLoader />
      </Center>
    );
  }

  if (!query.data || query.isError) {
    return (
      <Center size="page-full" className="flex flex-col space-y-2" style={{ fontFamily: "Mix" }}>
        <MoeCounter num={500} />
        <em>Internal Server Error</em>
      </Center>
    );
  }

  const chartData = query.data.lastDaysDailySentSize
    .map((item) => ({
      date: formatDate(item.date, "ko", "MM-dd"),
      size: item.size,
      displaySize: formatSize(item.size),
    }))
    .reverse();

  // const totalTransfer = query.data.lastDaysDailySentSize.reduce((sum, item) => sum + item.size, 0);
  // const avgDailyTransfer = totalTransfer / query.data.lastDaysDailySentSize.length;

  const chartConfig = {
    size: {
      label: "전송량",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center" onWheel={handleWheel}>
      <div
        className="relative my-20 flex h-175 w-full flex-col items-center justify-center overflow-hidden border-y backdrop-blur-sm"
        style={{
          fontFamily: "Mix",
        }}
      >
        <div
          className="absolute inset-0 -z-10 bg-white bg-cover bg-center bg-no-repeat opacity-50 dark:bg-black/80 dark:opacity-100 dark:bg-blend-multiply"
          style={{
            backgroundImage: "url('/img/nahida/texture-lab-1767706866727.png')",
          }}
        />

        <AnimatePresence mode="wait">
          {activeIndex === 0 ? (
            <motion.div
              key="page1"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex w-full flex-col items-center justify-center px-6 py-6 md:py-16"
            >
              <div className="flex flex-col">
                <h1 className="text-6xl drop-shadow-xl">Welcome</h1>
                <p className="mb-20 ml-2 opacity-50">to nahida live</p>
              </div>

              <div className="mb-20 flex flex-wrap justify-center gap-10">
                <span className="flex flex-col space-y-3 text-center text-xl">
                  <em className="opacity-40">serving</em>
                  <MoeCounter num={query.data.mod.total} />
                  <em className="opacity-40">mods</em>
                </span>
                <span className="mt-2 flex flex-col space-y-3 text-center text-xl">
                  <em className="opacity-40">with</em>
                  <MoeCounter num={query.data.mod.dl} />
                  <em className="opacity-40">downloads</em>
                </span>
              </div>

              <div className="flex flex-wrap justify-center gap-10">
                <span className="mt-2 flex flex-col space-y-3 text-center text-xl">
                  <em className="opacity-40">akasha stored</em>
                  <MoeCounter num={convertBytesToTB(query.data.akasha.drive.usage)} />
                  <em className="opacity-40">TB</em>
                </span>
                <span className="flex flex-col space-y-3 text-center text-xl">
                  <em className="opacity-40">and links</em>
                  <MoeCounter num={query.data.akasha.link.dl} />
                  <em className="opacity-40">downloads</em>
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="page2"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex w-full flex-col items-center justify-center px-6 py-6 md:py-16"
            >
              <div className="w-full max-w-3xl">
                <div className="mb-4 grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      최근 {query.data.lastDaysDailySentSize.length}일간 총 전송량
                    </span>
                    <span className="font-mono font-semibold">
                      {formatSize(query.data.lastDaysDailySentSize.reduce((a, b) => a + b.size, 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">일평균 전송량</span>
                    <span className="font-mono font-semibold">
                      {formatSize(
                        query.data.lastDaysDailySentSize.reduce((a, b) => a + b.size, 0) /
                          query.data.lastDaysDailySentSize.length,
                      )}
                    </span>
                  </div>
                </div>

                <ChartContainer config={chartConfig} className="h-75 w-full">
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillSize" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-foreground)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-foreground)" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--color-foreground)"
                      strokeOpacity={0.6}
                      strokeWidth={0.7}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      padding={{ left: 16, right: 16 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => formatSize(value)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => label}
                          formatter={(value) => formatSize(value as number)}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="size"
                      stroke="var(--color-foreground)"
                      fill="url(#fillSize)"
                      strokeWidth={3}
                      fillOpacity={1}
                      activeDot={{
                        r: 6,
                        style: { fill: "var(--color-foreground)", opacity: 1 },
                      }}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute bottom-4 flex space-x-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              activeIndex === 0 ? "bg-primary" : "bg-primary/20",
            )}
          />
          <div
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              activeIndex === 1 ? "bg-primary" : "bg-primary/20",
            )}
          />
        </div>
      </div>
    </div>
  );
}
