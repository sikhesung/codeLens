"""
CodeLens.exe 빌드 스크립트
- HTML/CSS/JS 리소스와 아이콘을 모두 내장한 독립 실행형 Windows 실행 파일(CodeLens.exe)을 생성합니다.
- 창모드(Windowed Mode: 1160x820) 기준점으로 깔끔하게 실행됩니다.
"""
import os
import shutil
import struct
import subprocess
import sys
import zlib

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def create_codelens_ico(ico_path: str):
    width, height = 32, 32
    raw_rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            dx = min(x, width - 1 - x)
            dy = min(y, height - 1 - y)
            if dx < 3 and dy < 3 and (3 - dx) ** 2 + (3 - dy) ** 2 > 9:
                row.extend((0, 0, 0, 0))
                continue

            if x in (0, width - 1) or y in (0, height - 1):
                r, g, b, a = 59, 130, 246, 255
            else:
                r, g, b, a = 18, 25, 38, 255

            if 10 <= y <= 21:
                dist = abs(y - 15.5)
                lx = int(6 + dist * 0.8)
                if x in (lx, lx + 1):
                    r, g, b, a = 96, 165, 250, 255

            if 10 <= y <= 21:
                dist = abs(y - 15.5)
                rx = int(25 - dist * 0.8)
                if x in (rx, rx - 1):
                    r, g, b, a = 52, 211, 153, 255

            if 9 <= y <= 22:
                sx = int(18 - (y - 9) * 0.45)
                if x in (sx, sx + 1):
                    r, g, b, a = 167, 139, 250, 255

            row.extend((r, g, b, a))
        raw_rows.append(bytes(row))

    raw_data = b"".join(raw_rows)

    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw_data, 9))
        + png_chunk(b"IEND", b"")
    )

    ico_header = struct.pack("<HHH", 0, 1, 1)
    ico_entry = struct.pack(
        "<BBBBHHII",
        width,
        height,
        0,
        0,
        1,
        32,
        len(png_bytes),
        6 + 16,
    )
    with open(ico_path, "wb") as f:
        f.write(ico_header + ico_entry + png_bytes)


CSHARP_SOURCE = r"""using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("CodeLens")]
[assembly: AssemblyDescription("CodeLens - 한 줄 주석 · 블록 해부 · 주석 채점 도우미")]
[assembly: AssemblyProduct("CodeLens")]
[assembly: AssemblyVersion("1.2.0.0")]

namespace CodeLensApp
{
    static class Program
    {
        private static readonly string[] AssetFiles = new string[]
        {
            "index.html",
            "styles.css",
            "sample_data.js",
            "gemini_service.js",
            "app.js"
        };

        [STAThread]
        static void Main()
        {
            try
            {
                string exeDir = AppDomain.CurrentDomain.BaseDirectory;
                string localIndex = Path.Combine(exeDir, "index.html");
                string targetIndex = localIndex;

                if (!File.Exists(localIndex))
                {
                    string appDataDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "CodeLens",
                        "app"
                    );
                    Directory.CreateDirectory(appDataDir);
                    ExtractEmbeddedAssets(appDataDir);
                    targetIndex = Path.Combine(appDataDir, "index.html");
                }

                string fileUri = new Uri(targetIndex).AbsoluteUri;
                string browserPath = FindChromiumBrowser();

                if (!string.IsNullOrEmpty(browserPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = browserPath,
                        Arguments = string.Format("--app=\"{0}\" --window-size=1160,820", fileUri),
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                }
                else
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = targetIndex,
                        UseShellExecute = true
                    });
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "CodeLens 실행 중 오류가 발생했습니다:\n" + ex.Message,
                    "CodeLens 오류",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private static void ExtractEmbeddedAssets(string targetDir)
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            foreach (string fileName in AssetFiles)
            {
                using (Stream s = asm.GetManifestResourceStream(fileName))
                {
                    if (s == null) continue;
                    string outPath = Path.Combine(targetDir, fileName);
                    using (FileStream fs = new FileStream(outPath, FileMode.Create, FileAccess.Write))
                    {
                        s.CopyTo(fs);
                    }
                }
            }
        }

        private static string FindChromiumBrowser()
        {
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            string[] candidates = new string[]
            {
                Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(localApp, @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string path in candidates)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path))
                {
                    return path;
                }
            }
            return null;
        }
    }
}
"""


def build():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ico_path = os.path.join(base_dir, "CodeLens.ico")
    cs_path = os.path.join(base_dir, "CodeLensLauncher.cs")
    out_exe = os.path.join(base_dir, "CodeLens.exe")

    print("1. 아이콘(CodeLens.ico) 생성 중...")
    create_codelens_ico(ico_path)

    print("2. 런처 소스(CodeLensLauncher.cs) 생성 중...")
    with open(cs_path, "w", encoding="utf-8-sig") as f:
        f.write(CSHARP_SOURCE)

    csc_path = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if not os.path.exists(csc_path):
        raise FileNotFoundError(f"C# 컴파일러를 찾을 수 없습니다: {csc_path}")

    resources = ["index.html", "styles.css", "sample_data.js", "gemini_service.js", "app.js"]
    cmd = [
        csc_path,
        "/nologo",
        "/target:winexe",
        "/optimize+",
        f"/out:{out_exe}",
        f"/win32icon:{ico_path}",
    ]
    for res in resources:
        res_full = os.path.join(base_dir, res)
        cmd.append(f"/resource:{res_full},{res}")
    cmd.append(cs_path)

    print("3. CodeLens.exe 컴파일 중...")
    subprocess.run(cmd, check=True)

    parent_exe = os.path.join(os.path.dirname(base_dir), "CodeLens.exe")
    shutil.copy2(out_exe, parent_exe)

    print(f"✅ 빌드 완료!\n - {out_exe}\n - {parent_exe}")


if __name__ == "__main__":
    build()
