"use client";

/* eslint-disable @next/next/no-img-element -- signed Supabase URLs are shown as-is */
import { ChevronLeft, ChevronRight, Download, FileText, Film, Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAttachment, downloadUrl, updateCaption } from "@/actions/records";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AttachmentView } from "@/lib/data";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Permissions = { userId: string; canEdit: boolean; canManage: boolean };

export function Gallery({
  items,
  permissions,
  emptyText = "No files yet.",
  size = "md",
  landholderNames = {},
}: {
  items: AttachmentView[];
  permissions: Permissions;
  emptyText?: string;
  size?: "sm" | "md";
  landholderNames?: Record<string, string>;
}) {
  const [index, setIndex] = useState<number | null>(null);

  if (items.length === 0) return <p className="text-sm text-muted-fg">{emptyText}</p>;

  return (
    <>
      <ul
        className={cn(
          "grid gap-2",
          size === "sm" ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
        )}
      >
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group relative block aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              title={item.caption ?? item.file_name}
            >
              <Thumb item={item} small={size === "sm"} />
            </button>
          </li>
        ))}
      </ul>
      {index !== null && items[index] && (
        <Lightbox
          items={items}
          index={index}
          onIndex={setIndex}
          onClose={() => setIndex(null)}
          permissions={permissions}
          landholderNames={landholderNames}
        />
      )}
    </>
  );
}

function Thumb({ item, small }: { item: AttachmentView; small: boolean }) {
  if (item.kind === "photo" && item.previewUrl) {
    return (
      <img
        src={item.previewUrl}
        alt={item.caption ?? item.file_name}
        loading="lazy"
        className="size-full object-cover transition-transform group-hover:scale-105"
      />
    );
  }
  const Icon = item.kind === "video" ? Film : FileText;
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-muted-fg">
      <Icon className={small ? "size-5" : "size-8"} aria-hidden />
      {!small && <span className="line-clamp-2 text-center text-xs break-all">{item.file_name}</span>}
    </span>
  );
}

function Lightbox({
  items,
  index,
  onIndex,
  onClose,
  permissions,
  landholderNames,
}: {
  items: AttachmentView[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  permissions: Permissions;
  landholderNames: Record<string, string>;
}) {
  const router = useRouter();
  const item = items[index];
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(item.caption ?? "");
  const canDelete = permissions.canManage || (permissions.canEdit && item.uploaded_by === permissions.userId);

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + items.length) % items.length;
      setEditing(false);
      setCaption(items[next].caption ?? "");
      onIndex(next);
    },
    [index, items, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  function download() {
    startTransition(async () => {
      const res = await downloadUrl(item.id);
      if (res.url) window.location.href = res.url;
      else toast.error(res.error ?? "Download failed");
    });
  }

  function remove() {
    if (!confirm(`Delete ${item.file_name}? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteAttachment(item.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      onClose();
      router.refresh();
    });
  }

  function saveCaption() {
    startTransition(async () => {
      const res = await updateCaption(item.id, caption);
      if (!res.ok) return void toast.error(res.error);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.file_name}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{item.file_name}</p>
          <p className="text-xs text-white/60">
            {index + 1} of {items.length} · {formatBytes(item.size_bytes)} · {formatDateTime(item.created_at)}
            {item.landholder_id && landholderNames[item.landholder_id] && ` · ${landholderNames[item.landholder_id]}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Download" onClick={download} disabled={pending}>
            <Download />
          </IconButton>
          {permissions.canEdit && (
            <IconButton label="Edit caption" onClick={() => setEditing((e) => !e)}>
              <Pencil />
            </IconButton>
          )}
          {canDelete && (
            <IconButton label="Delete" onClick={remove} disabled={pending}>
              <Trash2 />
            </IconButton>
          )}
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {item.kind === "photo" && item.url ? (
          <img src={item.url} alt={item.caption ?? item.file_name} className="max-h-full max-w-full object-contain" />
        ) : item.kind === "video" && item.url ? (
          <video src={item.url} controls playsInline className="max-h-full max-w-full" />
        ) : item.mime_type === "application/pdf" && item.url ? (
          <iframe src={item.url} title={item.file_name} className="h-full w-full max-w-4xl rounded bg-white" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <FileText className="size-12 text-white/70" />
            <p>{item.file_name}</p>
            <Button variant="secondary" onClick={download}>
              <Download /> Download
            </Button>
          </div>
        )}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 rounded-full bg-black/50 p-2 hover:bg-black/70"
              aria-label="Previous"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 rounded-full bg-black/50 p-2 hover:bg-black/70"
              aria-label="Next"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      <div className="px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm">
        {editing ? (
          <form
            className="mx-auto flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveCaption();
            }}
          >
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe what this shows"
              maxLength={500}
              autoFocus
              className="text-fg"
            />
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </form>
        ) : (
          <p className="text-center text-white/80">{item.caption || <span className="text-white/40">No caption</span>}</p>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40 [&_svg]:size-5"
      {...props}
    >
      {children}
    </button>
  );
}
