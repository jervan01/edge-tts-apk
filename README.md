# EdgeTTS Android APK（Tauri 2 + GitHub Actions 云编译）

把 EDGE_TTS 网页前端打包成安卓 APK。首次打开输入后端地址（如 `http://192.168.1.10:8000`），之后所有 `/api/...` 请求和音频地址都会指向该后端。本地不需要安装任何安卓环境。

## 原理
- 前端就是你的 `src/index.html`，无 npm 构建。
- CI 会运行 `scripts/patch_index.py`，自动给它加上：「🔗 后端」按钮、地址弹层、安全区适配。**原文件不用手改**。
- `src/shim.js` 把相对路径 `/api/...` 改写为 `后端地址/api/...`，通过 Tauri http 插件（Rust 端发出）请求，绕开 WebView 跨域限制；`<audio>` 的相对地址同样补全。
- 工作流把 AndroidManifest 改为允许明文 http（局域网 IP 通常没有 https）。

## 云编译
1. **把你的网页文件覆盖 `src/index.html`**（仓库里的是占位文件）。
2. 新建 GitHub 仓库并上传全部文件。`.github` 是隐藏文件夹，网页上传常会漏：首页 Add file → Create new file，文件名填 `.github/workflows/build-apk.yml`，粘贴工作流正文。
3. Actions → Build APK → Run workflow（架构默认 aarch64）。
4. 约 10 分钟（首次更久）。成功后在运行页底部 Artifacts 下载 `EdgeTTS-apk`，解压得到 `EdgeTTS.apk`。
5. 想发 Release：`git tag v0.1.0 && git push --tags`，APK 会附到 Releases。

### 固定签名密钥（推荐长期使用）
不配置时会自动生成密钥并缓存（7 天无访问会被清理，之后需先卸载旧版）。固定密钥：
1. `keytool -genkeypair -keystore my.keystore -alias edgetts -keyalg RSA -keysize 2048 -validity 36500`（别名必须是 `edgetts`）
2. 转 base64：PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("my.keystore"))`，Linux/Mac `base64 -w0 my.keystore`
3. 仓库 Settings → Secrets and variables → Actions，新建 `ANDROID_KEYSTORE_B64` 与 `ANDROID_KEYSTORE_PASSWORD`。

## 安装与使用
1. 把 APK 发到手机，点开安装，允许“安装未知来源应用”；提示“风险应用”选继续安装（自签名的正常现象）。
2. 首次打开弹出「后端地址」：填写后点“测试连接”，成功后“保存并进入”。之后可点右上角 🔗 后端 修改。
3. 手机必须能访问后端：同一 Wi‑Fi 用电脑局域网 IP（后端要监听 `0.0.0.0`，防火墙放行端口），或使用公网/内网穿透地址。`127.0.0.1` 在手机上指向手机自己，填它不会通。

## Windows 本地编译（可选）
装 C++ Build Tools、Rust、JDK 17、Android SDK/NDK（`ndk;26.1.10909125`、`build-tools;34.0.0`、`platforms;android-34`），设置 `JAVA_HOME`、`ANDROID_HOME`、`NDK_HOME`，然后在 PowerShell：
```
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
cargo install tauri-cli --version "^2" --locked
python scripts\patch_index.py src\index.html
cargo tauri icon app-icon.png
cargo tauri android init --ci
# 手动：把 gen\android\app\src\main\AndroidManifest.xml 的 <application> 里 usesCleartextTraffic 改为 "true"
cargo tauri android build --apk --ci --target aarch64
```
产物是未签名 APK（在 `src-tauri\gen\android\app\build\outputs\apk\` 下），再用 zipalign + apksigner 签名，命令见云编译工作流“Sign APK”一步。报 os error 1314 时打开 Windows“开发人员模式”。

## 未验证项（诚实说明）
- 整个工程没有在真实 GitHub Actions / 真机上跑过；Rust、Gradle 编译与界面均未验证。
- `http:default` 的 URL 通配写法（含端口、任意 IP）是按 Tauri 2 文档写的，若真机报 “url not allowed”，把报错发我。
- 明文 http 的 Manifest 补丁依赖 Tauri 生成的 AndroidManifest 结构（脚本已兼容有/无该属性两种情况）。
- 已测试：补丁脚本（含重复执行）、shim.js 语法、YAML/JSON 格式。
- 页内“⬇ 音频”下载按钮在安卓 WebView 里可能无效（WebView 对 `download` 链接支持有限），在线播放不受影响。
- 安卓返回键目前会直接退出应用（未做弹层历史管理，本应用只有一个后端地址弹层）。
