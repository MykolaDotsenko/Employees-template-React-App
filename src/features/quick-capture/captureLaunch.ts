export interface CaptureLaunch {
  kind: "capture" | "share";
  prefill: string;
}

const SHARE_PARAMS = ["share-target", "title", "text", "url", "capture"] as const;

function clean(value: string | null): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function fitSharedText(parts: string[], maxLength = 280): string {
  const joined = parts.filter(Boolean).join(" — ");
  if (joined.length <= maxLength) return joined;

  const last = parts.at(-1) ?? "";
  if (/^https?:\/\//i.test(last) && last.length < maxLength - 24) {
    const room = maxLength - last.length - 3;
    const prefix = parts.slice(0, -1).join(" — ");
    const clipped =
      prefix.length <= room
        ? prefix
        : `${prefix.slice(0, Math.max(1, room - 1)).trimEnd()}…`;
    return [clipped, last].filter(Boolean).join(" — ");
  }

  return `${joined.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function parseCaptureLaunch(search: string): CaptureLaunch | null {
  const params = new URLSearchParams(search);

  if (params.get("capture") === "1") {
    return { kind: "capture", prefill: "" };
  }

  if (params.get("share-target") !== "1") return null;

  const title = clean(params.get("title"));
  const text = clean(params.get("text"));
  const url = clean(params.get("url"));
  const parts: string[] = [];

  if (title) parts.push(title);
  if (text && text !== title) parts.push(text);

  const combined = parts.join(" ");
  if (url && !combined.includes(url)) parts.push(url);

  return {
    kind: "share",
    prefill: fitSharedText(parts.length > 0 ? parts : [url || "Shared item"]),
  };
}

export function stripCaptureLaunchFromUrl(href: string): string {
  const url = new URL(href);

  for (const key of SHARE_PARAMS) {
    url.searchParams.delete(key);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
