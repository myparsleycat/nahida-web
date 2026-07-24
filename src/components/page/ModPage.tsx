import type { Treaty } from "@elysiajs/eden";
import { Turnstile } from "@marsidev/react-turnstile";
import crcv from "color-convert";
import { prominent } from "color.js";
import { format } from "date-fns";
import { saveAs } from "file-saver";
import { motion } from "motion/react";
import {
  DateTime as CalendarClockIcon,
  Download,
  Download as DownloadIcon,
  Archive as FolderArchiveIcon,
  Folder as FolderIcon,
  Repeat as InfinityIcon,
  Loader as LoaderCircleIcon,
  Loader as LoaderIcon,
} from "pixelarticons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { ModData } from "@/types";

import { CircularProgress } from "@/components/effects/CircularProgress";
import { eden } from "@/lib/eden";
import { cn, formatSize } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Dialog, DialogContent } from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Progress } from "../ui/progress";

const ddd = eden.hello({ uuid: "" }).get;
type HelloClientResponse = Treaty.Data<typeof ddd>;

export const Preview = ({ modData }: { modData: HelloClientResponse["mod"] }) => {
  const imageElement = useRef<HTMLImageElement>(undefined!);
  const [imagePosition, setImagePosition] = useState<"center" | "top">("center");

  const [showModal, setShowModal] = useState(false);

  const src =
    modData.expired && modData.tags.some((tag: string) => /유료/i.test(tag))
      ? "/hihida.jpg"
      : modData.preview_url || "";
  const alt = modData.title + " 프리뷰";

  const checkImageRatio = () => {
    if (
      imageElement.current &&
      imageElement.current.naturalHeight > imageElement.current.naturalWidth * 1.2
    ) {
      setImagePosition("top");
    } else {
      setImagePosition("center");
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
        className="h-full"
      >
        <div
          className="flex h-full cursor-pointer flex-col items-center justify-center space-y-4"
          onClick={() => setShowModal(true)}
        >
          <div className="relative h-full w-full overflow-hidden rounded-lg shadow-xs transition-shadow duration-300 hover:shadow-lg">
            <img
              ref={imageElement}
              src={src}
              alt={alt}
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                modData.tags.some((tag: string) => /nsfw|유료/i.test(tag)) ? "blur" : "",
              )}
              style={{ objectPosition: imagePosition }}
              draggable="false"
              onLoad={checkImageRatio}
              onError={() => (imageElement.current.src = "/nongzz.jpg")}
            />
          </div>
        </div>
      </motion.div>

      {showModal && (
        <button
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75"
        >
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] object-contain md:max-h-[70vh] md:max-w-[70vw]"
            draggable="false"
          />
        </button>
      )}
    </>
  );
};

export const VT = ({ modData }: { modData: HelloClientResponse["mod"] }) => {
  const total = useMemo(() => {
    return modData.vt_data
      ? Object.values(modData.vt_data).reduce((sum, value) => sum + value, 0)
      : 0;
  }, [modData.vt_data]);

  const riskCount = useMemo(() => {
    return modData.vt_data ? modData.vt_data.malicious + modData.vt_data.suspicious : 0;
  }, [modData.vt_data]);

  const grayCount = useMemo(() => {
    return modData.vt_data
      ? modData.vt_data.timeout +
          modData.vt_data["confirmed-timeout"] +
          modData.vt_data.failure +
          modData.vt_data["type-unsupported"]
      : 0;
  }, [modData.vt_data]);

  const adjustedTotal = useMemo(() => {
    return total - grayCount;
  }, [modData.vt_data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      className="col-span-2 col-start-4 row-span-3 rounded-lg border shadow-xs transition-shadow duration-300 hover:shadow-lg"
    >
      {modData.vt_data ? (
        <div className="flex h-full items-center justify-center">
          <CircularProgress riskCount={riskCount} grayCount={grayCount} total={adjustedTotal} />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center overflow-hidden p-4">
          <img src="/249953ad70c67c2701c7f00128c3bc-unscreen.gif" alt="hi nahida" />
        </div>
      )}
    </motion.div>
  );
};

export const Expires = ({ modData }: { modData: HelloClientResponse["mod"] }) => {
  const expDate = modData.expires_at ? new Date(modData.expires_at * 1000) : new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: 0.15 }}
      className="col-span-2 col-start-6 row-span-3 rounded-lg border shadow-xs transition-shadow duration-300 hover:shadow-lg"
    >
      <div className="col-span-1 row-span-2 h-full overflow-hidden">
        <div className="flex h-full flex-col items-center justify-evenly p-4">
          <CalendarClockIcon className="h-12 w-12" />
          {modData.expires_at ? (
            <div>
              <p className="text-center text-lg font-bold">
                {!modData.expired && format(expDate, `yyyy-MM-dd`)}
              </p>
              <p className="text-center text-base font-bold">
                {!modData.expired && format(expDate, "hh:mm:ss")}
              </p>
            </div>
          ) : (
            <InfinityIcon className="h-12 w-12" />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const Title = ({ modData }: { modData: HelloClientResponse["mod"] }) => {
  const [error, setError] = useState(false);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    prominent(modData.preview_url, { amount: 5 })
      .then((output: any) => {
        const colStr = output.map(([r, g, b]: [number, number, number]) => {
          const [h, s, l] = crcv.rgb.hsl(r, g, b);
          const adjustedL = Math.min(Math.max(l, 30), 70);
          const [adjustedR, adjustedG, adjustedB] = crcv.hsl.rgb(h, s, adjustedL);
          return `rgb(${adjustedR}, ${adjustedG}, ${adjustedB})`;
        });
        setColors(colStr);
      })
      .catch(() => {
        setError(true);
      });
  }, []);

  const gradientStyle =
    colors.length > 0 && !error
      ? {
          backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }
      : {};

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
      className="relative col-span-4 col-start-4 row-span-3 row-start-4 overflow-hidden rounded-lg border shadow-xs transition-shadow duration-300 hover:shadow-lg"
    >
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-10">
        <p className="inline-block text-3xl font-extrabold drop-shadow-xl" style={gradientStyle}>
          {modData.title}
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          {modData.tags.map((tag, index) => (
            <Badge
              key={index}
              className="shadow"
              variant={/^(r18|nsfw|19)$/i.test(tag) ? "destructive" : "secondary"}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export const Size = ({ modData }: { modData: HelloClientResponse["mod"] }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
      className="col-span-3 col-start-5 row-span-2 row-start-7 rounded-lg border shadow-xs transition-shadow duration-300 hover:shadow-lg"
    >
      <div className="flex h-full flex-row items-center justify-evenly p-4">
        {Boolean(modData.size) && (
          <div className="flex flex-col items-center">
            <FolderArchiveIcon className="h-10 w-10" />
            <p className="text-xl font-bold">{formatSize(modData.size)}</p>
          </div>
        )}

        {Boolean(modData.unzip_size) && (
          <div className="flex flex-col items-center">
            <FolderIcon className="h-10 w-10" />
            <p className="text-xl font-bold">{formatSize(modData.unzip_size)}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const Description = ({
  modData,
  mobile,
}: {
  modData: HelloClientResponse["mod"];
  mobile: boolean;
}) => {
  const images = [
    "/img/nahida/0d2a022106b1fd0ec88eacb6d11d4ce486fc236b4ae591414ab71059218a5254.webp",
    "/img/nahida/6a1de3ff75205feb2ac9c8061dd5fcf76e047aa1cde4806905b0250d010f5650.webp",
    "/img/nahida/7d97d77a4118a58ab8832a7d6e3d027f17392c17c40149b9ccd2d4bfc3c9376b.webp",
  ];

  const selectedImage = useMemo(() => images[Math.floor(Math.random() * images.length)], []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.125 }}
      className={cn(
        "col-span-4 col-start-1 row-span-2 row-start-7 rounded-lg",
        "overflow-hidden border shadow-xs transition-shadow duration-300 hover:shadow-lg",
        modData.uuid === "60507de6-ce1d-4d24-84c5-5142a886cd97" &&
          "bg-[url(/img/598d59544136477e408551551aa11a9b2f41ad167f0f3b636c58fb1f91595527.avif)] bg-cover",
      )}
    >
      {modData.description && modData.description?.length > 0 && modData.description !== "null" ? (
        mobile ? (
          <div className="flex h-full w-full items-center justify-center overflow-auto overflow-y-auto p-4">
            <p style={{ fontSize: "1.1rem" }}>{modData.description}</p>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center overflow-auto overflow-y-auto p-4">
            <p style={{ fontSize: "1.1rem" }}>{modData.description}</p>
          </div>
        )
      ) : (
        <div className="flex h-full w-full items-center justify-end">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="random-nahida"
              className="h-full w-full object-cover"
              sizes="100vw"
            />
          )}
        </div>
      )}
    </motion.div>
  );
};

export const SwapKey = ({ modData }: { modData: HelloClientResponse["mod"] }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
      className="col-span-2 col-start-8 row-span-6 row-start-3 overflow-hidden rounded-lg border shadow-xs transition-shadow duration-300 hover:shadow-lg"
    >
      {modData.merged && modData.swapkey ? (
        <div className="h-full w-full overflow-y-auto break-all">
          <div className="space-y-4 p-5">
            {Object.entries(modData.swapkey).map(([key, value]) => (
              <div key={key}>
                <p className="font-semibold">{key}:</p>
                <div className="ml-4">
                  {Object.entries(value).map(([k, v]) => (
                    <p key={k}>
                      {k}: {v as string}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center overflow-hidden">
          <div className="flex flex-col">
            <img
              src="/465e38784d7da95baa6ec9f6a59e5dc04c32e2451de1bd109af4cd21723db655.jpg"
              alt="w"
            />

            <video
              src="/88ce6c90b66c85bd507e4d2ef27fa0796431c57ebc1ec5e1a3213f0453e519c3.mp4"
              autoPlay
              muted
              loop
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export const Buttons = ({ modData }: { modData: HelloClientResponse["mod"] }) => {
  const { t } = useTranslation();

  const passwordRef = useRef<HTMLInputElement>(null);

  const [canParallelDownload, setCanParallelDownload] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [password, setPassword] = useState("");
  const [tryPass, setTryPass] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [progressState, setProgressState] = useState({ stage: "idle", progress: 0 });
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dMode, setDMode] = useState<"default" | "gmm" | "nd">("default");
  const [nd_fetching, setNd_fetching] = useState(true);
  const [nd_ok, setNd_ok] = useState(false);
  const [verifyTurnstile, setVerifyTurnstile] = useState(false);
  const [cftoken, setCftoken] = useState("");
  const turnstileRef = useRef(null);
  const cftokenResolverRef = useRef<(token: string) => void | null>(null);

  const containerVariants = {
    hidden: { opacity: 0, x: 30, y: -30 },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut", delay: 0.1 },
    },
  };

  useEffect(() => {
    const initializeDownload = async () => {
      const supportsFileSystemAccess =
        "showSaveFilePicker" in window &&
        (() => {
          try {
            return window.self === window.top;
          } catch {
            return false;
          }
        })();

      const supportsFileSystemWritableFileStream =
        typeof window !== "undefined" && "FileSystemWritableFileStream" in window;

      setCanParallelDownload(supportsFileSystemAccess && supportsFileSystemWritableFileStream);

      try {
        const resp = await fetch(
          `http://localhost:${import.meta.env.VITE_NAHIDA_DESKTOP_PORT}/ping`,
        );
        setNd_ok(resp.ok);
      } catch {
        setNd_ok(false);
      } finally {
        setNd_fetching(false);
      }
    };

    initializeDownload();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const close = () => {
    setIsDialogOpen(false);
    setPassword("");
    setHasError(false);
  };

  function getTurnstileToken(): Promise<string> {
    return new Promise((resolve) => {
      cftokenResolverRef.current = resolve;
      setVerifyTurnstile(true);
    });
  }

  const handleDownload = async (mode: "default" | "gmm" | "nd") => {
    if (isExecuting) return;

    if (modData.password && !password) {
      return toast.warning(t("toast.warning.pw_is_required"));
    }

    const cftoken = await getTurnstileToken();

    setIsExecuting(true);
    setTryPass(true);

    try {
      const { data, error } = await eden.gimme({ uuid: modData.uuid }).post({
        type: "zip",
        cftoken,
        ...(password && { password }),
      });

      if (error) {
        switch (error.value) {
          case "cftoken_required":
            toast.warning(t("toast.warning.missing_cftoken"));
            break;
          case "invalid_password":
            toast.warning(t("toast.warning.invalid_password"));
            break;
          case "password_required":
            toast.warning(t("toast.warning.pw_is_required"));
            break;
          case "invalid_cftoken":
            toast.warning(t("toast.warning.failure_turnstile"));
            break;
          case "download_expired":
            toast.warning(t("toast.warning.download_expired"));
            break;
          case "mod_not_ready":
            toast.warning(t("toast.warning.mod_not_ready"));
            break;
          default:
            toast.error(error.value.toString());
        }

        return;
      }

      switch (mode) {
        case "default":
          if (modData.password && !isDialogOpen) setIsDialogOpen(true);
          saveAs(data.presigned_url, data.file_name);
          close();
          break;
        case "gmm":
          let baseUri = "gmm-interop-uri://a.com/?uuid=" + modData.uuid;
          if (modData.password) baseUri += "&pw=" + encodeURIComponent(password);
          window.location.href = baseUri;
          break;
        case "nd":
          if (modData.password && !isDialogOpen) setIsDialogOpen(true);
          try {
            const url = `http://localhost:${import.meta.env.VITE_NAHIDA_DESKTOP_PORT}/live/download`;
            const resp = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: data.presigned_url,
                mod: modData,
              }),
            });
          } catch {}
      }
    } catch (error: any) {
      console.log(error);
      setHasError(true);
      toast.error(error.name, { description: error.toString() });
    } finally {
      setTryPass(false);
      setIsExecuting(false);
      setIsDownloading(false);
      cfReset();
    }
  };

  const cfReset = () => {
    setCftoken("");
    setVerifyTurnstile(false);
    // @ts-ignore
    turnstileRef.current?.reset?.();
  };

  const handleMenuItemClick = async (mode: "default" | "gmm" | "nd") => {
    setDMode(mode);
    if (modData.password) {
      setIsDialogOpen(true);
    } else {
      await handleDownload(mode);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 30, y: -30 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        className="relative col-span-2 col-start-8 row-span-2 row-start-1 rounded-lg border shadow-xs transition-shadow duration-300 hover:shadow-lg"
      >
        <div className="flex h-full flex-row items-center justify-center gap-x-12 p-4">
          <div className="flex">
            <DownloadIcon
              className="h-12 w-12 cursor-pointer"
              onClick={() => setIsDropdownOpen(true)}
            />

            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => handleMenuItemClick("default")}
                  className="cursor-pointer text-base"
                >
                  {t("c.mod_page_Buttons.general_download")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!nd_ok}
                  onClick={() => handleMenuItemClick("nd")}
                  className="cursor-pointer gap-2 text-base"
                >
                  {nd_fetching && <LoaderIcon className="animate-spin-1.5" />}
                  {t("c.mod_page_Buttons.dl_with_nd")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleMenuItemClick("gmm")}
                  className="cursor-pointer text-base"
                >
                  {t("c.mod_page_Buttons.dl_with_mod_manager")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <div className="w-screen overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogContent
              className="w-full max-w-md rounded-xl bg-background p-6 shadow-lg duration-300 ease-out not-dark:border-black/25 data-closed:transform-[scale(95%)] data-closed:opacity-0"
              onInteractOutside={
                !tryPass && !verifyTurnstile ? undefined : (e) => e.preventDefault()
              }
              aria-describedby={undefined}
            >
              <div className="flex flex-col items-center space-y-4">
                {progressState.stage === "idle" && (
                  <div className="flex w-full flex-col justify-center">
                    <div className="flex w-full flex-row items-center justify-center space-x-4">
                      <input
                        ref={passwordRef}
                        className={cn(
                          "block w-full rounded-lg bg-white/5 px-3 py-2.5 text-base placeholder-white/50 transition-all",
                          "text-white focus:outline-2 focus:-outline-offset-2",
                          hasError ? "outline-red-500/75" : "outline-white/75",
                        )}
                        autoFocus={true}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleDownload(dMode);
                          }
                        }}
                      />
                      <button
                        className="rounded-lg px-4 py-2 shadow"
                        disabled={isExecuting || tryPass}
                        onClick={(e) => {
                          e.preventDefault();
                          handleDownload(dMode);
                          passwordRef.current?.focus();
                        }}
                      >
                        {!tryPass ? (
                          <DownloadIcon className="text-white" />
                        ) : (
                          <LoaderCircleIcon className="animate-spin text-white transition-transform" />
                        )}
                      </button>
                    </div>
                    <div>
                      {verifyTurnstile && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center rounded-lg bg-black/50">
                          <div className="rounded-lg shadow-lg">
                            <Turnstile
                              ref={turnstileRef}
                              siteKey="0x4AAAAAAAQ2y1gqLezBfMo4"
                              onSuccess={(token) => {
                                if (cftokenResolverRef.current) {
                                  cftokenResolverRef.current(token);
                                  cftokenResolverRef.current = null;
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(progressState.stage === "downloading" || progressState.stage === "modifying") && (
                  <div className="flex w-full flex-col items-center space-y-4">
                    {progressState.stage === "downloading" ? (
                      <>
                        <Progress value={progressState.progress} className="w-full" />
                        <p className="text-white">
                          다운로드 중... {progressState.progress}% ({downloadSpeed.toFixed(2)} MB/s)
                        </p>
                      </>
                    ) : (
                      <p className="text-white">INI 파일 수정 중...</p>
                    )}
                  </div>
                )}
                {progressState.stage === "complete" && <p className="text-white">다운로드 완료!</p>}
              </div>
            </DialogContent>
          </div>
        </div>
      </Dialog>

      {!modData.password && verifyTurnstile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center rounded-lg bg-black/50">
          <div className="rounded-lg shadow-lg">
            <Turnstile
              siteKey="0x4AAAAAAAQ2y1gqLezBfMo4"
              onSuccess={(token) => {
                if (cftokenResolverRef.current) {
                  cftokenResolverRef.current(token);
                  cftokenResolverRef.current = null;
                }
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
