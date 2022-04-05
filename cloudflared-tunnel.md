# Cloudflare Tunnel

## 申请 Cloudflare, 并且开通 https://dash.teams.cloudflare.com/

虽然免费，但是申请 zero trust 需要绑定信用卡。

需要一个**域名**，并且绑定到 Cloudflare。

## Cloudflare tunnels

![tunnels](./readme-data/tunnels.png)

## 保存 Token

在创建时候，可以在 Tunnels 的页面中找到 Token。
![tunnels-token](./readme-data/tunnel-tokens.png)

## 添加域名

![tunnel-host-name](./readme-data/tunnel-host-name.png)

注意事项，

1. Service 配成自己 heroku 的名字， ***.herokuapp.com

2. HTTP Host Header
把自己 heroku 的名字， ***.herokuapp.com，添加进入，很重要。

然后把 Token 配置到 Github Action `HEROKU_TUNNEL_TOKEN` 就可以。剩下的配置，运行在 herokuapp 的 Cloudflared 会获取。
