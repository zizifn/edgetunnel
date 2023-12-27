这是一个基于 Cloudflare Worker 平台的脚本，在原版的基础上修改了显示 VLESS 配置信息转换为订阅内容。使用该脚本，你可以方便地将 VLESS 配置信息使用在线配置转换到 Clash 或 Singbox 等工具中。

## 使用方法
1. 部署 Cloudflare Worker：
   - 在 Cloudflare Worker 控制台中创建一个新的 Worker。
   - 将 [worker.js](https://github.com/cmliu/edgetunnel/blob/main/worker.js) 的内容粘贴到 Worker 编辑器中。

2. 配置订阅生成器地址：
   - 打开 [worker.js](https://github.com/cmliu/edgetunnel/blob/main/worker.js) 文件，在第 12 行找到 `sub` 变量，将其修改为你的订阅生成器地址。例如：`let sub = 'your-sub-generator.com';`

3. 默认访问订阅内容：
   - 访问 `https://[YOUR-WORKER-URL]/[YOUR-UUID]` 即可获取订阅内容。

4. 自定义订阅地址：
   - 如果你想使用搭建自己的订阅内容，可以参考 [WorkerVless2sub GitHub 仓库](https://github.com/cmliu/WorkerVless2sub) 中的部署说明自行搭建。

# 感谢
[zizifn](https://github.com/zizifn/edgetunnel)
