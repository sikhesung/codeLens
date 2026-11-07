using System;
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
