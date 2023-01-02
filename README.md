## Speedybot-loco

Speedybot-loco: laboratory to try out far-out conversation design infra + deployment concepts. As of now, this is an experimental CLI tool-- use with goggles. It works but should be regarded as unstable and bloated with too many dependencies

## Step 1: Get a bot access token

- If you have an existing bot, get its token here: https://developer.webex.com/my-apps

- If you don't have a bot, create one and save the token from here: https://developer.webex.com/my-apps/new/bot

## Step 2: Use the CLI

You can use **[npx](https://www.npmjs.com/package/npx)** or if you're feeling adventurous see **[bunx](#bunx)** below

---

-t: bot access token

-f: filepath or URL (you can point to a Speedybot-mini bot on github and run locally with your token)

-s: Pass secrets (you can pass multiple (`-s secret_api_key=my_special_value` `-s secret_api_key2=my_special_value2`)

## Boot a basic agent

### Boot an agent from file path

```sh
npx -y speedybot-loco@1.0.0-beta.5 -f my-cli/samples/config.js -t aaa-bbb-ccc-ddd-eee-fff
```

### Boot an agent from public & "raw" github URLs

```sh
npx -y speedybot-loco@1.0.0-beta.5 -f https://github.com/valgaze/speedybot-loco/blob/deploy/samples/config.ts -t aaa-bbb-ccc-ddd-eee-fff
```

```sh
npx -y speedybot-loco@1.0.0-beta.5 -f https://raw.githubusercontent.com/valgaze/speedybot-loco/deploy/samples/config.ts -t aaa-bbb-ccc-ddd-eee-fff
```

### Boot an agent using OpenAI's language models

```sh
npx -y speedybot-loco@1.0.0-beta.5 -f https://github.com/valgaze/speedybot-loco/blob/deploy/samples/openai.ts -t aaa-bbb-ccc-ddd-eee-fff -s openai=sk-aaabbbcccdddeeefff
```

- GPT3 101: https://gpt3.valgaze.com

## bunx

**[Bun](https://bun.sh/)** is a clever and fast alternative javascript runtime being written in Zig that uses WebKit's JavaScriptCore and various other performance enhancement. Bun has many built-in convenience features, but one in particular is **[bunx](https://twitter.com/jarredsumner/status/1606163655527059458)** which is a drop-in replacement for npx and can run things quickly.

At time of writing Bun and Bunx should be regarded as **highly experimental**, however, worthy of examination due to performance benefits:

```
curl -fsSL https://bun.sh/install | bash
bun upgrade --canary
bunx -v
# Replace npx in commands above with bunx
```
