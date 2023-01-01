const path = require("path");
// Expects .env to get token on BOT_TOKEN
const { init } = require("webex");
// Trick to resolve "excessive device registrations" issue
const resetDevices = async (token) => {
  // Get devices
  const deviceList = await fetch("https://wdm-a.wbx2.com/wdm/api/v1/devices", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const { devices = [] } = await deviceList.json();
  for (const device of devices) {
    const { url } = device;
    if (url) {
      await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  }
};
module.exports.Websocket = class Websocket {
  constructor(token) {
    this.token = token;
    this.listeners = {};
  }
  on(eventName, handler) {
    this.listeners[eventName] = handler;
  }
  async getSelf() {
    const { id } = await this.webexRef.people.get("me");
    this.me = id;
  }
  async init() {
    const config = {
      credentials: {
        access_token: this.token,
      },
    };
    this.webexRef = await init(config);
  }
  async start() {
    await this.init();
    await Promise.all([
      this.getSelf(),
      this.webexRef.messages.listen(),
      this.webexRef.attachmentActions.listen(),
    ]);
    // messages
    this.webexRef.messages.on("created", (event) => {
      if (event.data.personId !== this.me) {
        this.onMessage(
          Object.assign(Object.assign({}, event), { targetUrl: "websocket" })
        );
      }
    });
    this.webexRef.attachmentActions.on("created", (event) => {
      this.onSubmit(
        Object.assign(Object.assign({}, event), { targetUrl: "websocket" })
      );
    });
  }
  onMessage(event) {
    if (this.listeners.message) {
      this.listeners.message(event);
    }
  }
  onSubmit(event) {
    if (this.listeners.submit) {
      this.listeners.submit(event);
    }
  }
  async stop() {
    await this.webexRef.internal.device.unregister();
    await this.webexRef.messages.stopListening();
  }
  async resetDevices() {
    return resetDevices(this.token);
  }
};
