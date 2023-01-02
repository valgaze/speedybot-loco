## Speedybot-loco

Speedybot-loco: laboratory to try out far-out conversation design infra concepts.

As of now, this is an experimental CLI tool-- use with goggles. Unstable and bloated with too many dependencies

---

-t: bot access token

-f: filepath or URL (you can point to a Speedybot-mini bot on github and run locally with your token)

```sh
npx -y speedybot-loco@1.0.0-beta.4 -f my-cli/samples/config.js -t aaa-bbb-ccc-ddd-eee-fff
```

```sh
npx -y speedybot-loco@1.0.0-beta.4 -f https://github.com/valgaze/speedybot-loco/blob/deploy/samples/config.ts -t aaa-bbb-ccc-ddd-eee-fff
```

```sh
npx -y speedybot-loco@1.0.0-beta.4 -f https://raw.githubusercontent.com/valgaze/speedybot-loco/deploy/samples/config.ts -t aaa-bbb-ccc-ddd-eee-fff
```
