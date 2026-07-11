import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

/**
 * Native (Capacitor) backup storage backed by @capacitor/filesystem.
 * Files are written to / read from the shared Documents directory
 * (Directory.Documents) so the user can find, share and restore them
 * with any file manager.
 */

export interface DocumentBackup {
  name: string;
  uri: string;
  mtime: number;
}

/** Write a JSON backup to Documents and return its native file URI. */
export async function saveBackupToDocuments(
  json: string,
  filename: string,
): Promise<{ name: string; uri: string }> {
  await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({
    path: filename,
    directory: Directory.Documents,
  });
  return { name: filename, uri };
}

/** List closet backup files currently stored in Documents, newest first. */
export async function listDocumentBackups(): Promise<DocumentBackup[]> {
  try {
    const { files } = await Filesystem.readdir({
      path: "",
      directory: Directory.Documents,
    });
    return files
      .filter((f) => f.type === "file" && /^closet-backup-.*\.json$/i.test(f.name))
      .map((f) => ({ name: f.name, uri: f.uri, mtime: f.mtime ?? 0 }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

/** Read a backup file's JSON contents from Documents by filename. */
export async function readDocumentBackup(filename: string): Promise<string> {
  const { data } = await Filesystem.readFile({
    path: filename,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return typeof data === "string" ? data : await data.text();
}
