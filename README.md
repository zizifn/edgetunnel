# Cloudflare Worker 2 Vless & Sub
这是一个基于 Cloudflare Worker 平台的脚本，在原版的基础上修改了显示 VLESS 配置信息转换为订阅内容。使用该脚本，你可以方便地将 VLESS 配置信息使用在线配置转换到 Clash 或 Singbox 等工具中。

Telegram：[@CMLiussss](https://t.me/CMLiussss)

## 使用方法
1. 部署 Cloudflare Worker：
   - 在 Cloudflare Worker 控制台中创建一个新的 Worker。
   - 将 [worker.js](https://github.com/cmliu/edgetunnel/blob/main/_worker.js) 的内容粘贴到 Worker 编辑器中。
   - 将第 7 行 `userID` 修改成你自己的 **UUID** 。

2. 访问订阅内容：
   - 访问 `https://[YOUR-WORKER-URL]/[YOUR-UUID]` 即可获取订阅内容。
   - 例如 `https://vless.google.workers.dev/90cd4a77-141a-43c9-991b-08263cfe9c10` 就是你的订阅地址。
   - **如果你是小白，那么你的 workers 绑定`自定义域`之后即可直接起飞，不用再往下看了！！！**

<details>
<summary><code><strong>「 我不是小白！我真的真的不是小白！我要玩花活！我要开启高端玩法！ 」</strong></code></summary>

3. 使用自己的`优选域名`/`优选IP`的订阅内容：
   - 如果你想使用自己的优选域名或者是自己的优选IP，可以参考 [WorkerVless2sub GitHub 仓库](https://github.com/cmliu/WorkerVless2sub) 中的部署说明自行搭建。
   - 打开 [worker.js](https://github.com/cmliu/edgetunnel/blob/main/_worker.js) 文件，在第 12 行找到 `sub` 变量，将其修改为你部署的订阅生成器地址。例如 `let sub = 'sub.cmliucdn.tk';`，注意不要带https等协议信息和符号。
   - 注意，如果您使用了自己的订阅地址，要求订阅生成器的 `sub`域名 和 `[YOUR-WORKER-URL]`的域名 不同属一个顶级域名，否则会出现异常。您可以在 `sub` 变量赋值为 workers.dev 分配到的域名。

4. 解决转换订阅的隐私问题：
   - 搭建反代订阅转换工具，通过随机化服务器地址和节点账号密码，解决用户转换订阅的隐私问题。
   - 可以参考[不良林psub项目](https://github.com/bulianglin/psub)自行搭建，视频原理以及教程 https://youtu.be/X7CC5jrgazo
   - 注意，如果您使用了反代订阅转换工具，要求订阅转换工具的 `subconverter`域名 和 `[YOUR-WORKER-URL]`的域名 不同属一个顶级域名，否则会出现异常。您可以在 `subconverter` 变量赋值为 workers.dev 分配到的域名，注意不要带https等协议信息和符号。

</details>

## 已适配自适应订阅内容
   - [v2rayN](https://github.com/2dust/v2rayN)
   - clash.meta（[Clash Nyanpasu](https://github.com/keiko233/clash-nyanpasu)，[clash-verge](https://github.com/zzzgydi/clash-verge/tree/main)，ClashX Meta）
   - sing-box（SFI）

![image](https://github.com/cmliu/edgetunnel/assets/24787744/6e07c034-f0ef-4ae2-9fef-be13ef993f77)
![image](https://github.com/cmliu/edgetunnel/assets/24787744/7c932cfa-3908-412a-ba47-c2be081486ed)
![6f373c39a75ed704a83f8936a81a44e9](https://github.com/cmliu/edgetunnel/assets/24787744/82ca7357-5c85-4618-8fc3-931d1e60ea5a)


# 感谢
[zizifn](https://github.com/zizifn/edgetunnel)，[3Kmfi6HP](https://github.com/3Kmfi6HP/EDtunnel)，[Stanley-baby](https://github.com/Stanley-baby)、[ACL4SSR](https://github.com/ACL4SSR)
