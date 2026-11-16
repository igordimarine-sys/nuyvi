import "server-only";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

/** Vídeos versionados em `public/video/` (valor gravado: `video/<caminho>`), para o seletor do painel. Lista vazia se a pasta não existir. */
export async function videosDoSite(): Promise<string[]> {
  try {
    const arquivos = await readdir(join(process.cwd(), "public", "video"), { recursive: true, withFileTypes: true });
    return arquivos
      .filter((a) => a.isFile() && /\.(mp4|webm)$/i.test(a.name))
      .map((a) => `video/${join(a.parentPath, a.name).slice(join(process.cwd(), "public", "video").length + 1).split("\\").join("/")}`)
      .sort();
  } catch {
    return [];
  }
}
