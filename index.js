#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { Websocket } = require("./websockets");
const { logoRoll } = require("speedybot-mini");
// Get the file path from the command line argument
const filePath = process.argv[2];
const token = process.argv[3];
// Make sure a file path was specified
if (!filePath) {
  console.error("No file path specified");
  console.log(`usage: mycli file.ts aaa-bbb-ccc-ddd`);
  process.exit(1);
}
if (!token) {
  console.error("No token specified");
  process.exit(1);
}

// Read the file contents
const fileContents = fs.readFileSync(filePath, "utf8");

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

// Load the speedybot library
const speedybot = require("speedybot-mini");

// Execute the code
const MyBot = eval(`(function() {
    ${code}
    return exports.__esModule ? exports.default : exports;
  })()`);

// launch websockets
main(token);
async function main(token) {
  MyBot.setToken(token);
  const inst = new Websocket(token);
  await inst.start();
  console.log(logoRoll());
  console.log("Websockets Registered. Listening...");

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
