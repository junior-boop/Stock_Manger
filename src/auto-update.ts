import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";

export type UpdateStatus = {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  version: string | null;
  currentVersion: string;
  error: string | null;
  progress: number;
};

type StatusListener = (s: UpdateStatus) => void;

const CONFIG_FILE = "update-config.json";

type UpdateConfig = {
  feedURL: string;
};

function readConfig(userDataPath: string): UpdateConfig {
  try {
    const p = path.join(userDataPath, CONFIG_FILE);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as UpdateConfig;
    }
  } catch { /* use defaults */ }
  return { feedURL: "" };
}

function saveConfig(userDataPath: string, cfg: UpdateConfig) {
  try {
    const p = path.join(userDataPath, CONFIG_FILE);
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error("[auto-update] save config failed", e);
  }
}

export class AutoUpdateService {
  private status: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    version: null,
    currentVersion: app.getVersion(),
    error: null,
    progress: 0,
  };
  private listeners = new Set<StatusListener>();
  private userDataPath: string;
  private initialized = false;
  private downloadDir: string;

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
    this.downloadDir = path.join(userDataPath, "updates");
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  init(defaultFeedURL?: string): void {
    if (this.initialized) return;
    this.initialized = true;
    const cfg = readConfig(this.userDataPath);
    if (!cfg.feedURL && defaultFeedURL) {
      cfg.feedURL = defaultFeedURL;
      saveConfig(this.userDataPath, cfg);
    }
  }

  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  subscribe(fn: StatusListener): () => void {
    this.listeners.add(fn);
    fn(this.getStatus());
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const s = this.getStatus();
    this.listeners.forEach((fn) => fn(s));
  }

  setFeedURL(url: string): void {
    const cfg = readConfig(this.userDataPath);
    cfg.feedURL = url;
    saveConfig(this.userDataPath, cfg);
  }

  async checkForUpdates(): Promise<void> {
    const cfg = readConfig(this.userDataPath);
    if (!cfg.feedURL) return;

    this.status.checking = true;
    this.status.error = null;
    this.emit();

    try {
      const base = cfg.feedURL.replace(/\/$/, "");
      const res = await fetch(`${base}/latest.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const meta = (await res.json()) as {
        version: string;
        url: string;
        releaseDate?: string;
      };

      const current = app.getVersion();
      const hasUpdate = this.compareVersions(meta.version, current) > 0;

      if (hasUpdate) {
        this.status.available = true;
        this.status.version = meta.version;
      } else {
        this.status.available = false;
        this.status.version = null;
      }
      this.status.checking = false;
      this.emit();
    } catch (e) {
      this.status.checking = false;
      this.status.error = e instanceof Error ? e.message : String(e);
      this.emit();
    }
  }

  async downloadUpdate(): Promise<void> {
    const cfg = readConfig(this.userDataPath);
    if (!cfg.feedURL || !this.status.version) return;

    this.status.downloading = true;
    this.status.progress = 0;
    this.emit();

    try {
      const base = cfg.feedURL.replace(/\/$/, "");
      const metaRes = await fetch(`${base}/latest.json`);
      const meta = (await metaRes.json()) as { url: string; version: string };
      const downloadUrl = meta.url.startsWith("http") ? meta.url : `${base}/${meta.url}`;

      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);

      const contentLength = res.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const chunks: Buffer[] = [];
      let received = 0;

      const reader = res.body?.getReader();
      if (!reader) throw new Error("no response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        received += value.length;
        if (total) {
          this.status.progress = Math.round((received / total) * 100);
          this.emit();
        }
      }

      const ext = path.extname(new URL(downloadUrl).pathname) || ".exe";
      const filePath = path.join(this.downloadDir, `kataleya-update-${meta.version}${ext}`);
      fs.writeFileSync(filePath, Buffer.concat(chunks));

      this.status.downloading = false;
      this.status.downloaded = true;
      this.status.progress = 100;
      this.emit();

      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("update:downloaded", { filePath, version: meta.version });
      }
    } catch (e) {
      this.status.downloading = false;
      this.status.error = e instanceof Error ? e.message : String(e);
      this.emit();
    }
  }

  quitAndInstall(): void {
    const cfg = readConfig(this.userDataPath);
    if (!cfg.feedURL) return;

    const base = cfg.feedURL.replace(/\/$/, "");
    // Spawn the downloaded installer (Squirrel detects auto-update mode).
    // On Windows Squirrel, running the new .exe with --updated flag updates in place.
    const updates = fs.readdirSync(this.downloadDir)
      .filter((f) => f.startsWith("kataleya-update-"))
      .sort()
      .reverse();

    if (updates.length > 0) {
      const installer = path.join(this.downloadDir, updates[0]);
      execFile(installer, [], (err) => {
        if (err) console.error("[auto-update] install failed", err);
        app.quit();
      });
    } else {
      // Fallback : ouvrir le navigateur sur la page des releases du serveur
      execFile(base, [], (err) => {
        if (err) console.error("[auto-update] open failed", err);
      });
    }
  }

  private compareVersions(a: string, b: string): number {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }
}
