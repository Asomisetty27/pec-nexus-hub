import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Download, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://pec-nexus-hub.lovable.app";

// Every physical surface gets its own src tag so a scan is attributable in
// the CRM: leads arrive as source "intake_form:<src>" / apply traffic
// carries ?src= through the funnel.
const PRESETS = [
  { key: "wow-flyer", label: "WOW showcase flyer", path: "/apply", desc: "Recruiting flyer for the Aug 18-19 club showcase" },
  { key: "wow-booth", label: "WOW booth banner", path: "/apply", desc: "Large-format QR for the booth table" },
  { key: "client-onepager", label: "Client one-pager", path: "/intake", desc: "Print handout for client conversations" },
  { key: "eweek", label: "E-Week materials", path: "/apply", desc: "February CENG showcase" },
  { key: "custom", label: "Custom", path: "/", desc: "Any path + your own src tag" },
] as const;

export default function QrStudio() {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("wow-flyer");
  const [customPath, setCustomPath] = useState("/intake");
  const [customSrc, setCustomSrc] = useState("");
  const [svg, setSvg] = useState<string>("");
  const [png, setPng] = useState<string>("");

  const active = PRESETS.find((p) => p.key === preset)!;
  const path = preset === "custom" ? customPath : active.path;
  const src = preset === "custom" ? customSrc || "custom" : active.key;
  const url = useMemo(() => `${SITE}${path}${path.includes("?") ? "&" : "?"}src=${encodeURIComponent(src)}`, [path, src]);

  useEffect(() => {
    let alive = true;
    // High error-correction so print damage and low-light scans survive.
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 2 }).then((s) => alive && setSvg(s));
    QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 1024 }).then((d) => alive && setPng(d));
    return () => {
      alive = false;
    };
  }, [url]);

  const download = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <span className="label text-muted-foreground">marketing · qr studio</span>
        <h1 className="mt-2 font-display text-4xl leading-tight">Every flyer, attributable.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Pick the surface, print the code. Each QR carries a source tag, so when someone
          scans a WOW flyer and applies, the pipeline knows which piece of paper did the work.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            aria-pressed={preset === p.key}
            className={`title-block p-4 text-left transition-colors active:translate-y-px ${
              preset === p.key ? "bg-card ring-2 ring-accent" : "bg-background hover:bg-card"
            }`}
          >
            <div className="font-display text-xl">{p.label}</div>
            <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label text-muted-foreground">path</span>
            <input
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="/intake"
              className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="label text-muted-foreground">src tag</span>
            <input
              value={customSrc}
              onChange={(e) => setCustomSrc(e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase())}
              placeholder="career-fair-oct"
              className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
      )}

      <div className="title-block reg-marks bg-card p-6">
        <div className="grid items-center gap-6 sm:grid-cols-[200px_1fr]">
          <div className="mx-auto w-[200px] bg-white p-3 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="min-w-0">
            <div className="label text-muted-foreground">encodes</div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("Link copied");
              }}
              className="mt-1 flex max-w-full items-center gap-2 font-mono text-sm text-foreground hover:text-accent"
              title="Copy link"
            >
              <LinkIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{url}</span>
            </button>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => download(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, `pec-qr-${src}.svg`)}
                className="label inline-flex items-center gap-2 bg-accent px-4 py-2.5 text-accent-foreground hover:bg-primary hover:text-primary-foreground"
              >
                <Download className="h-3.5 w-3.5" /> svg (print)
              </button>
              <button
                type="button"
                onClick={() => download(png, `pec-qr-${src}.png`)}
                className="label inline-flex items-center gap-2 border border-foreground px-4 py-2.5 hover:border-accent hover:text-accent"
              >
                <Download className="h-3.5 w-3.5" /> png (1024px)
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Error correction H: survives print wear, stickers, and phone glare. SVG scales
              to any flyer or banner size without pixelation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
