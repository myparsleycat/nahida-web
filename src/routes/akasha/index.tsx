import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { TextAnimate } from "@/components/magicui/text-animate";

export const Route = createFileRoute("/akasha/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-center py-12">
        <div className="font-display text-center text-4xl font-bold -tracking-widest text-black md:text-6xl md:leading-20 dark:text-white">
          Nahida Drive
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-12 text-black dark:text-gray-200">
        <section>
          <h2 className="mb-4 text-2xl font-bold">What is Nahida Drive?</h2>
          <p className="leading-relaxed">
            Launched in February 2025, Nahida Drive is a dedicated cloud storage service for backing
            up 3dmigoto-based mods for free and without limitations.
          </p>
          <p className="mt-4 leading-relaxed">
            There are no additional costs involved. No fees for storage space, retention periods, or
            data transfer. Furthermore, when sharing uploaded mods, recipients can also download
            them at maximum speed without any extra charges.
          </p>
          <p className="mt-6 font-medium">
            Log in to Nahida Live and click the cloud icon on the left to get started with Nahida
            Drive!
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold">Can I upload files other than mods?</h2>
          <p className="leading-relaxed">
            No. Supported file types are restricted to mod files (ini, dds, vb, ib, fmt, buf, etc.),
            preview images (png, jpg, jpeg, webp, avif), preview videos (mp4, webm), and
            specifically allowed files (hlsl, blend, etc.)
          </p>
          <div className="mt-4 rounded-lg bg-gray-100 p-4 dark:bg-zinc-900">
            <h3 className="mb-2 text-sm font-semibold uppercase opacity-70">
              Maximum File Size Limits
            </h3>
            <ul className="list-inside list-disc space-y-1">
              <li>DDS files: Up to 300MB</li>
              <li>Images & Videos: Up to 20MB</li>
              <li>Other files: Up to 150MB</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold">Is the uploaded data encrypted?</h2>
          <p className="leading-relaxed">
            No. To optimize bandwidth and server costs, Nahida Drive performs client-side hashing to
            identify duplicates and compresses files before uploading. Since the service is intended
            for public mod files, end-to-end encryption is not implemented.
          </p>
          <p className="mt-4 text-sm leading-relaxed italic opacity-80">
            If you accidentally upload sensitive personal information, simply delete the file and
            empty the trash. Nahida Drive hosts hundreds of millions of files; manual monitoring of
            individual uploads is neither practiced nor feasible. Orphaned files not associated with
            any user drive are periodically purged from the server.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold">Is there a desktop client?</h2>
          <p className="leading-relaxed">
            Yes. By using <strong>Nahida Desktop</strong>, you can bypass browser performance
            limitations and achieve maximum upload/download speeds. It also provides advanced
            features such as pausing, resuming, and retrying transfers that are not available in the
            web version.
          </p>
        </section>
      </div>
    </div>
  );
}
