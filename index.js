#!/usr/bin/env node
const yargs = require("yargs");
const fs = require("fs");
const https = require("https");
const path = require("path");
const ts = require("typescript");
const { Websocket } = require("./websockets");
const { logoRoll } = require("speedybot-mini");
require("cross-fetch/polyfill");

// Parse command line arguments
const argv = yargs
  .option("file", {
    alias: "f",
    type: "string",
    description: "Path or URL of the file to be executed",
  })
  .option("secrets", {
    alias: "s",
    type: "array",
    description: "List of key=value pairs that will be exposed to the agent",
  })
  .option("token", {
    alias: "t",
    type: "string",
    description: "Token to be used for the CLI",
    demandOption: true,
  }).argv;

async function main(filePathOrUrl, token, secrets = {}) {
  // Check if the filePathOrUrl is a URL
  const isUrl =
    filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://");

  let filePath;
  let fileContents;
  if (isUrl) {
    if (filePathOrUrl.includes("github.com")) {
      // Convert public GitHub URLs to raw URL
      filePath = filePathOrUrl
        .replace("github.com", "raw.githubusercontent.com")
        .replace("/blob/", "/");
    } else {
      filePath = filePathOrUrl;
    }
    fileContents = await new Promise((resolve, reject) => {
      https.get(filePath, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to download file at ${filePath} (status code: ${response.statusCode})`
            )
          );
        }
        const data = [];
        response.on("data", (chunk) => data.push(chunk));
        response.on("end", () => {
          resolve(Buffer.concat(data).toString("utf8"));
        });
      });
    });
  } else {
    filePath = filePathOrUrl;
    // Read the file contents
    fileContents = fs.readFileSync(filePath, "utf8");
  }

  // Make sure a file path or URL was specified
  if (!filePathOrUrl) {
    console.error("No file path or URL specified");
    console.log(`usage: mycli --token=<token> --file=<filepath|url>`);
    process.exit(1);
  }

  // Check if the file is a TypeScript file
  const isTypeScript = path.extname(filePath) === ".ts";

  let code;

  if (isTypeScript) {
    // Transpile the TypeScript file to JavaScript in memory
    const { outputText } = ts.transpileModule(fileContents, {
      lib: ["esnext", "dom"],
      target: ts.ScriptTarget.ES6,
      module: ts.ModuleKind.CommonJS,
    });
    code = outputText;
  } else {
    // The file is already JavaScript, so just use the contents as-is
    code = fileContents;
  }

  // Execute the code
  const MyBot = eval(`(function() {
  ${code}
  return exports.__esModule ? exports.default : exports;
})()`);

  launchSockets(token, MyBot);

  async function launchSockets(token, bot) {
    // Load the speedybot library
    // const speedybot = require("speedybot-mini");

    MyBot.setToken(token);
    MyBot.addSecret(secrets);
    const inst = new Websocket(token);
    await inst.start();
    console.log(logoRoll());
    console.log("Websockets Registered. Listening...");
    const selfData = await inst.getSelf(true);
    const { displayName, emails } = selfData;
    const [email] = emails;
    console.log(
      `🤖 You can contact your agent '${displayName}' here: ${email}`
    );

    inst.on("message", (websocketEvent) => {
      // send to processing incoming websocket
      console.log("[msg]", websocketEvent);
      MyBot.processIncoming(websocketEvent);
    });

    inst.on("submit", (websocketSubmitEvent) => {
      console.log("[msg]", websocketSubmitEvent);
      MyBot.processIncoming(websocketSubmitEvent);
    });
  }
}

// Get the file path or URL from the command line argument
const filePathOrUrl = argv.file;
const token = argv.token;
let secrets = argv.secrets || [];

const stash = {};
secrets.forEach((secret) => {
  const [k, v] = secret.split("=");
  if (k && v) {
    stash[k] = v;
  }
});

// launch websockets
main(filePathOrUrl, token, stash);
