import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), ".sandbox");
if (!fs.existsSync(root)) fs.mkdirSync(root);

function seed() {
  const files = fs.readdirSync(root);
  if (files.length === 0) {
    fs.writeFileSync(
      path.join(root, "hello.ts"),
      `export const hi = (name: string) => "Hello, " + name;\n`
    );
  }
}
seed();

export function base() { return root; }
export function list(): string[] { return fs.readdirSync(root); }
export function read(file: string): string {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) throw new Error("file not found");
  return fs.readFileSync(p, "utf8");
}
export function write(file: string, content: string) {
  const p = path.join(root, file);
  fs.writeFileSync(p, content, "utf8");
}
