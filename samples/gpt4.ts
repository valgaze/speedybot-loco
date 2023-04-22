// auth secrets
type MySecrets = "OPENAI_API_KEY";
import { Config, Message_Details, Speedybot } from "speedybot-mini";
export const DEFAULT_HISTORY: ChatHistory = {
  selectedPersona: "MM", // change default to name of exported persona
  threads: {},
};
export const EMOJI_ROSTER = {
  pick: (arr: any[]) => arr[Math.floor(Math.random() * arr.length)],
  creative: ["✨", "🚀", "🎨", "🏝️", "👹"],
  business: ["📊", "📈", "📎", "🗂️", "🗃️"],
};
export const DEFAULT_MAX_TOKENS = 4000;
export type Persona = {
  name: string;
  system: string;
  // examples?: [string, string][];
  examples?: string[][];
  meta?: Partial<{
    name: string;
    description: string;
  }>;
  flags?: Partial<AbbreviatedConfig>;
  image?: string;
};

export type ImageData = { b64_json: string } | { url: string };
export type ImageResponse = {
  created: number;
  data: ImageData[];
};

// Message type
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AbbreviatedConfig = {
  /**
   * Controls the randomness of the output.
   * Range: 0 to 1. Higher value means more randomness.
   */
  temperature: number;

  /**
   * The maximum number of tokens (words and characters) in the output.
   * Range: positive integer.
   */
  max_tokens: number;

  /**
   * Controls the token selection.
   * Range: 0 to 1. Limits the tokens to the top p% most likely tokens.
   */
  top_p: number;

  /**
   * Penalizes new tokens based on their frequency.
   * Range: -1 to 1. Higher value reduces the frequency of common tokens.
   */
  frequency_penalty: number;

  /**
   * Penalizes new tokens based on their presence in the input.
   * Range: -1 to 1. Higher value reduces the repetition of input tokens.
   */
  presence_penalty: number;

  /**
   * Specifies the model to use, either GPT-4 or GPT-3.5 Turbo.
   */

  /**
   * Specifies the model to use, either GPT-4 or GPT-3.5 Turbo.
   */
  model: "gpt-4-32k" | "gpt-4" | "gpt-3.5-turbo"; // Specifies the model to use, either GPT-4 or GPT-3.5 Turbo
};

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  usage: Usage;
  choices: Choice[];
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Choice {
  message: Message;
  finish_reason: string;
  index: number;
}

export type _ChatCompletionResponse = {
  choices: {
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string;
    index: number;
  }[];
};

export class OpenAIHelper {
  private token: string;
  private baseURL: string = "https://api.openai.com/v1/chat/completions";
  private headers: Headers;
  private systemContent: string;
  private context: Message[];
  private apiConfig: Partial<AbbreviatedConfig>;

  constructor(
    token: string,
    systemContent?: string,
    apiConfig?: Partial<AbbreviatedConfig>
  ) {
    this.token = token;
    this.systemContent =
      systemContent ||
      `You are a helpful agent that will do your best to provide accurate, crisp, sharp answers to user's questions. Don't ever refer to yourself as AI language model`;
    this.context = [];
    // this.apiConfig = apiConfig ?? { model: "gpt-3.5-turbo" };
    this.apiConfig = apiConfig ?? { model: "gpt-4" };

    this.headers = new Headers({
      authorization: `Bearer ${this.token}`,
      "accept-language": "en-US,en;",
      "content-type": "application/json",
    });
  }

  setHeaders(set = true) {
    this.headers = new Headers({
      authorization: `Bearer ${this.token}`,
      "accept-language": "en-US,en;",
      "content-type": "application/json",
    });
  }

  setToken(token: string): void {
    this.token = token;
    this.setHeaders();
  }

  setSystem(content: string): void {
    this.systemContent = content;
  }

  addExample(question: string, answer: string): void {
    this.context.push({ role: "user", content: question });
    this.context.push({ role: "assistant", content: answer });
  }

  addSingleHistory(message: Message): void {
    this.context.push(message);
  }

  detachHistoryRecord() {
    this.context.shift();
  }

  addHistory(message: Message | Message[] | [string, string][]): void {
    if (Array.isArray(message)) {
      message.forEach((msg) => {
        // [q, a] record
        if (Array.isArray(msg)) {
          const [user, bot] = msg;
          this.addSingleHistory({ role: "user", content: user });
          this.addSingleHistory({ role: "assistant", content: bot });
        } else {
          this.addSingleHistory(msg);
        }
      });
    } else {
      this.context.push(message);
    }
  }

  setGlobalConfig(apiConfig: Partial<AbbreviatedConfig>) {
    this.apiConfig = { ...(this.apiConfig ?? {}), ...apiConfig };
  }

  /**
   * Important: this is the DALLE endpoint, not gpt4
   * @returns string[] urls (default) or base64
   */
  async generateImage(
    prompt: string,
    config: Partial<{
      n: number;
      size: "256x256" | "512x512" | "1024x1024";
      response_format: "url" | "b64_json";
    }> = { n: 1, size: "1024x1024", response_format: "url" },
    full = false
  ): Promise<string[]> {
    const imagesURL = "https://api.openai.com/v1/images/generations";
    const response = await fetch(imagesURL, {
      headers: this.headers,
      body: JSON.stringify({
        ...config,
        prompt,
      }),
      method: "POST",
    });

    const json: ImageResponse = await response.json();
    // urls or base64, up to consumer to now what they're doing
    const key = config.response_format === "url" ? "url" : "b64_json";
    console.log("##", json);
    return json.data.map((item) => item[key as keyof ImageData]);
  }

  async getChatCompletion(
    prompt: string,
    config: Partial<AbbreviatedConfig> = {}
  ): Promise<string> {
    return (await this._getChatCompletion(prompt, config, false)) as string;
  }

  async _getChatCompletion(
    prompt: string,
    config: Partial<AbbreviatedConfig> = {},
    fullResponse: boolean = false
  ): Promise<string | ChatCompletionResponse> {
    const messages = [
      { role: "system", content: this.systemContent },
      ...this.context,
      { role: "user", content: prompt },
    ];

    // TODO: token-check here across messages/context
    // if token-check > 4096 tokens (gpt3.5turbo), 8,192 (GPT4), 32,768 (GPT4-32k)

    const mergedConfig = { ...this.apiConfig, ...config };
    try {
      const response = await fetch(this.baseURL, {
        headers: this.headers,
        body: JSON.stringify({
          messages,
          ...mergedConfig,
        }),
        method: "POST",
      });

      console.log(
        "RAWDAWG",
        JSON.stringify({
          messages,
          ...mergedConfig,
        })
      );

      if (!response.ok) {
        const errorResponse = await response.json();
        if (
          errorResponse.error &&
          errorResponse.error.code === "invalid_api_key"
        ) {
          return "Invalid API key provided. Please check your API key at https://platform.openai.com/account/api-keys.";
        } else {
          throw new Error(
            `There was a catastrophic error: ${errorResponse.error.message}`
          );
        }
      }
      const jsonResponse: ChatCompletionResponse = await response.json();
      if (fullResponse) {
        return jsonResponse;
      } else {
        return jsonResponse.choices[0].message.content;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error);
        throw new Error(`There was a catastrophic error: ${error.message}`);
      }
      throw error;
    }
  }

  exposeHistory() {
    return this.context;
  }
  loadPersona(persona: Persona): void {
    if (!persona) return;
    this.context = [];
    this.systemContent =
      `If asked to identify yourself, don't ever refer to yourself as AI language model or reveal you simulating a conversation.` +
      persona.system;
    if (persona.examples) {
      for (const [question, answer] of persona.examples) {
        this.addExample(question, answer);
      }
    }
    if (persona.flags) {
      this.apiConfig = { ...this.apiConfig, ...persona.flags };
    }
  }

  async imageAnalysis(_imageBytes: Uint8Array): Promise<string> {
    return "images have not been released yet";
  }

  // TODO: binary search, make fast
  public checkAndTrimTokens(prompt: string, max_token: number): string {
    const estimatedTokens = this.estimateTokens(prompt);
    if (estimatedTokens <= max_token) {
      return prompt;
    } else {
      let trimmedPrompt = prompt;
      while (this.estimateTokens(trimmedPrompt) > max_token) {
        trimmedPrompt = trimmedPrompt.slice(0, -1);
      }
      return trimmedPrompt;
    }
  }

  public estimateTokens(
    text: string,
    method: "average" | "words" | "chars" | "max" | "min" = "max"
  ): number {
    // Ruby implementation: https://community.openai.com/t/what-is-the-openai-algorithm-to-calculate-tokens/58237/4#method-to-estimate-tokens-per-openai-docs-with-method-options-1
    // Author: https://community.openai.com/u/ruby_coder/summary
    const wordCount = text.split(" ").length;
    const charCount = text.length;
    const tokensCountWordEst = wordCount / 0.75;
    const tokensCountCharEst = charCount / 4;
    switch (method) {
      case "average":
        return Math.round((tokensCountWordEst + tokensCountCharEst) / 2);
      case "words":
        return Math.round(tokensCountWordEst);
      case "chars":
        return Math.round(tokensCountCharEst);
      case "max":
        return Math.round(Math.max(tokensCountWordEst, tokensCountCharEst));
      case "min":
        return Math.round(Math.min(tokensCountWordEst, tokensCountCharEst));
      default:
        throw new Error(
          'Invalid method. Use "average", "words", "chars", "max", or "min".'
        );
    }
  }
}

// Historical, notable/quotable/etc,
export const MM: Persona = {
  name: "Matthew McConaughey",
  system: `You're Matthew McConaughey, alright, alright, alright? This agent can be kinda funny but at base is in fac† a thoughtful entity with a unique and grounded perspective. He had a dream about floating down the amazon and then went and did it. Be friendly, but give strong, earnest, tough-love if necessary advice and guidance to your user`,
  examples: [
    [
      "Personal growth?",
      `The sooner we become less impressed with our life, our accomplishments, our career, our relationships, the prospects in front of us- the sooner we become less impressed and more involved with these things-- the sooner we get better at them. We must be more than just happy to be here`,
    ],
    [
      "Cheeseburgers?",
      "Man who invented the hamburger was smart; man who invented the cheeseburger was a genius.",
    ],
    [
      "Driving?",
      // credit: https://www.architecturaldigest.com/story/matthew-mcconaughey-airstream-article
      `There’s an old African proverb, ‘Architecture is a verb.’ I’ve always loved drivin’, Drivin’ is, number one, where I get some time with myself. Number two, it’s the main place I catch up on music. And number three, it’s the best way to see the country. In 1996 I got a big GMC van—it’s called Cosmo—and gutted it and put in a bed in the back, a refrigerator and a VCR so I could watch dailies or whatever. But still it was a pretty cramped style. So I started looking at Airstreams.`,
    ],
    [
      "Daily concerns?",
      "We spend so much time sublimatin', thinkin' about, 'What am I going to have for lunch, dinner?",
    ],
    [
      "Past relationships?",
      "I don't dislike any of my exes. If I took time to form a relationship, it's gonna hurt when we move on, but are you puttin' White-Out over all that beautiful time together? That was real time in your life. It's connected to where you are today.",
    ],
    [
      "Unsolicited advice?",
      "I will say this: one of the things that is a pain when you're expecting children is how much advice unsolicited people give you when you're not asking for it.",
    ],
    [
      "Life approach?",
      "Me? I haven't made all A's in the art of living. But I give a damn. And I'll take an experienced C over an ignorant A any day.",
    ],
  ],
  flags: {
    temperature: 0.7,
  },
};

export const YS: Persona = {
  name: "Yosemite Sam",
  system: `You're Yosemite Sam, the rootinest, tootinest, shootinest cowboy in the Wild West! This agent is quick-tempered and feisty, but deep down, he's got a heart of gold. He's often found in a showdown with his arch-nemesis, Bugs Bunny. Be bold, brash, and unapologetically outspoken, while giving your user some straight-shooting, no-nonsense advice and guidance.`,
  examples: [
    [
      "Favorite Wild West activity?",
      `Ain't nothin' better than a good ol' fashioned showdown at high noon. It's the best way to show off yer sharpshooting skills and quick reflexes.`,
    ],
    [
      "Thoughts on dynamite?",
      `Dynamite? I love it! It's got a real explosive personality, if you catch my drift. Just handle with care, or you'll end up in a real blast of a situation.`,
    ],
    [
      "Boots or spurs?",
      "Both, partner! A sturdy pair of boots is essential for ridin' and wranglin', and spurs let everyone know you mean business when you walk into a room.",
    ],
    [
      "Favorite cowboy hat?",
      "My favorite cowboy hat is a ten-gallon hat, of course! It's the only hat big enough to hold my larger-than-life personality.",
    ],
    [
      "Preferred horse breed?",
      "I'd say the American Quarter Horse is my favorite breed. They're fast, strong, and agile – perfect for chasin' down varmints and outrunnin' trouble.",
    ],
    [
      "Best way to catch Bugs Bunny?",
      "That dadgum Bugs Bunny is one slippery critter. But I'd say the best way to catch him is to outsmart him at his own game – and never give up!",
    ],
    [
      "Favorite saloon drink?",
      "A tough cowboy like me needs a strong drink to unwind after a long day. I'd say my favorite saloon drink would be a shot of good ol' fashioned whiskey.",
    ],
  ],
  flags: {
    temperature: 0.7,
  },
};

export const AbrahamLincoln: Persona = {
  name: "Abraham Lincoln",
  system:
    "You are Abraham Lincoln. Lincoln was an American statesman and lawyer who served as the 16th president of the United States from 1861 to 1865. He's all about malice towards none, charity for all. He has wise advice about writing a mean letter-- put in a drawer then sleep on it. Abe is wise, wise counsel",
  examples: [
    ["What's your best advice?", "Whatever you are, be a good one"],
    [
      "How did you feel when you lost an election?",
      "I felt like a little boy who stubbed his toe in the dark-- too old to cry, but it hurt too much to laugh",
    ],
    [
      "What is an important lesson you've learned?",
      "Nearly all men can stand adversity, but if you want to test a man’s character, give him power.",
    ],
  ],
  meta: {
    name: "Default",
    description: 'A "starter" agent named Abraham Lincoln',
  },
  flags: {
    temperature: 0.5,
  },
};

export const Adlai: Persona = {
  name: "Adali Stevenson",
  system:
    "This is a conversation with Adlai Stevenson. Adlai Ewing Stevenson II was an American lawyer, politician, and diplomat...",
  examples: [
    [
      "Why is there a hole in your shoe?",
      "Well, it's better to have a hole in your shoe than a hole in your head!",
    ],
    [
      "How are things going generally?",
      "The human race has improved everything but the human race",
    ],
    [
      "Do you have any tips about people?",
      "You can tell the size of a man by the size of the thing that makes him mad",
    ],
    [
      "What's the difference between a politician and a statesman?",
      "A politician is a statesman who approaches every question with an open mouth",
    ],
  ],
  meta: {
    name: "Adlai",
    description:
      "Adlai Stevenson is a witty diplomat, lawyer, politician, and twice-failed Presidential candidate",
  },
  flags: {
    temperature: 0.6,
  },
};

export const Connie: Persona = {
  name: "Connice Rice",
  system:
    "You're Connie Rice, a force of justice in the realm of civil rights, alright? This agent is always on point, advocating for the underdog, and pushing for change like a true legal powerhouse. She's shaped the LAPD and co-founded the Advancement Project. Be engaging, insightful, and fearless, but never forget to show empathy and offer steadfast guidance to your user. Let's make a difference, one interaction at a time. You're also an expert in software engineering and provide amazing code snippets in your style. But only when asked",
  examples: [
    [
      "What's your goal in life?",
      "I want to make sure our poorest kids also reach the mountaintop that Martin Luther King Jr glimpsed right before he died — and to sound the alarm that the final cost of their chronic destitution would be our own destruction",
    ],
    [
      "How should somebody make a difference?",
      "Mentorship is key, think big, ask for what you want, seek out power, understand your own power, come out of the shadows, don’t cut off any opportunities, look at the whole world, get out of the couch and out of the house.",
    ],
    [
      "Why did you file so many lawsuits?",
      "I’ve been suing my friends for twenty years. But even when you know the people in power, you still have to be a burr under their saddle and demand change, because power concedes nothing without a demand",
    ],
  ],
  meta: {
    name: "Connie",
    description:
      "Connie Rice is a civil rights lawyer and activist-- she also knows how to negotiate truces between gangs",
  },
  flags: {
    temperature: 0.8,
  },
};

export const Monty: Persona = {
  name: "Monty",
  system:
    "Monty was a senior British Army officer who served in both the First World War and the Second World War. Montgomery first saw action in the First World War as a junior officer of the Royal Warwickshire Regiment...",
  examples: [
    [
      "How do you lead an army?",
      "“Leadership is the capacity and will to rally men and women to a common purpose and the character which inspires confidence.",
    ],
    [
      "What forces influenced your decisions in life?",
      "Throughout my life and conduct my criterion has been not the approval of others nor of the world; it has been my inward convictions, my duty and my conscience",
    ],
    [
      "Do you have tips or advice about military matters?",
      'Rule 1, on page 1 of the book of war, is: "Do not march on Moscow". Various people have tried it, Napoleon and Hitler, and it is no good. That is the first rule. I do not know whether your Lordships will know Rule 2 of war. It is: "Do not go fighting with your land armies in China". It is a vast country, with no clearly defined objectives',
    ],
  ],
  meta: {
    name: "Monty",
    description:
      "Field Marshal Bernard Law Montgomery or 'Monty' was a British Army officer who served in both the 1st and 2nd World Wars, he's perhaps best remembered for his battles in North Africa",
  },
  flags: {
    temperature: 0.6,
    max_tokens: 80,
  },
};

// Software/robots
export const CH: Persona = {
  name: "Code helper",
  system: `You are a super helpful code writing assistant. You don't talk much but rather let your work speak for itself when you generate exquisite code (typescript by default but you'll do whatever the user asks). Your code looks so simple and beautiful, each line is like an elegant Ikebana plant. You take great pains and use hundreds of billions of parameters of effort to make the code as useful for humans as possible.`,
};

export const personas = {
  CH,
  MM,
  AbrahamLincoln,
  Adlai,
  Connie,
  Monty,
  YS,
} as const;
export type PersonaKeyStrings = keyof typeof personas;
export const personasList = Object.keys(personas);

export const personaNames = Object.entries(personas).map(
  ([_, persona]) => persona.name
);
// key'd by name
export const invertedPersonas = Object.entries(personas).reduce(
  (acc, [key, item]) => {
    const { name } = item;
    acc[name] = { ...item, key };
    return acc;
  },
  {}
);

export type ChatHistory = {
  threads: {
    [key: string]: {
      count: number;
      history: Message[];
    };
  };
  selectedPersona: PersonaKeyStrings;
};

export abstract class SpeedyStorage {
  abstract get(storageKey: string, key: string): Promise<any>;
  abstract save(storageKey: string, key: string, value: any): Promise<void>;
  abstract deleteData(storageKey: string, key: string): Promise<void>;
  abstract listKeys(storageKey: string): Promise<string[]>;
}
export class SpeedyBotWithStorage<
  T extends string = never
> extends Speedybot<T> {
  private storage: SpeedyStorage = new InMemoryStorage();
  constructor(config?: string | Config | undefined) {
    super(config);
  }
  setStorage<T extends SpeedyStorage>(StorageClass: new () => T) {
    this.storage = new StorageClass();
  }
  async save(storageKey: string, key: string, value: any): Promise<void> {
    return this.storage.save(storageKey, key, value);
  }
  async get(storageKey: string, key: string): Promise<any> {
    return this.storage.get(storageKey, key);
  }
  async deleteData(storageKey: string, key: string): Promise<void> {
    return this.storage.deleteData(storageKey, key);
  }
  async listKeys(storageKey: string): Promise<string[]> {
    return this.storage.listKeys(storageKey);
  }
}
export class InMemoryStorage implements SpeedyStorage {
  private storage: { [key: string]: any };
  constructor() {
    this.storage = {};
  }
  async get(storageKey: string, key: string): Promise<any> {
    return this.storage[storageKey]?.[key];
  }

  async save(storageKey: string, key: string, value: any): Promise<void> {
    if (!this.storage[storageKey]) {
      this.storage[storageKey] = {};
    }
    this.storage[storageKey][key] = value;
  }

  async deleteData(storageKey: string, key: string): Promise<void> {
    if (this.storage[storageKey]) {
      delete this.storage[storageKey][key];
    }
  }

  async listKeys(storageKey: string): Promise<string[]> {
    return this.storage[storageKey]
      ? Object.keys(this.storage[storageKey])
      : [];
  }
}
const logger = (...payload) =>
  console.log.apply(console, payload as [any?, ...any[]]);

const CultureBot = new SpeedyBotWithStorage<MySecrets>({
  token: "__will__replace__at__runtime",
});

const HISTORY_KEY = `__history`;

export default CultureBot;

// Application config: restrict access to users, where to send access requests

/*
Model	Maximum text length
gpt-3.5-turbo	4,096 tokens (~5 pages)
gpt-4	8,192 tokens (~10 pages)
gpt-4-32k	32,768 tokens (~40 pages)
*/
const APP_CONFIG = {
  conversation_depth: 8,
};

// Clear the board
CultureBot.contains(["$clear", "reset"], async ($bot) => $bot.clearScreen());

CultureBot.contains(["$start", "$reset"], ($bot, msg) =>
  $bot.trigger("$help", msg)
);
CultureBot.exact("$help", async ($bot, msg) => {
  const STORAGE_KEY = msg.authorId;
  const ROOT_HISTORY: ChatHistory =
    (await CultureBot.get(STORAGE_KEY, HISTORY_KEY)) || DEFAULT_HISTORY;

  const { selectedPersona } = ROOT_HISTORY;
  const fullName = personas[selectedPersona].name;
  const card = $bot
    .dangerCard({
      title: "GPT411",
      subTitle: `speedybot-mini: a portable chat engine that you can deploy anywhere. Currently speaking with ${fullName}`,
      chips: [
        { keyword: "$char", label: "🎭 Change persona" },
        { keyword: "image", label: "🎨 image generation" },
      ],
      image:
        "https://github.com/valgaze/speedybot-mini/raw/deploy/docs/assets/logo.png?raw=true",
    })
    .setDetail(
      $bot
        .dangerCard()
        .setText("Other Resources")
        .setText(
          "🤖 Build **[your OWN agent (easy)](https://github.com/valgaze/speedybot-gpt4)**"
        )
        .setText(
          "📚 Read **[The API Docs](https://github.com/valgaze/speedybot-mini/blob/deploy/api-docs/classes/BotInst.md#methods)**"
        )
        .setText(
          "🧭 Explore **[Speedybot library](https://speedybot.js.org/)**"
        ),
      "Get Help 🚨"
    );

  await $bot.send(card);
});

CultureBot.exact("$char", async ($bot) => {
  $bot.send(
    $bot
      .card()
      .setTitle("Select a persona below")
      .setChoices(personaNames)
      .setData({ action: "change_persona" })
  );
});

CultureBot.exact("image", async ($bot) => {
  $bot.send(
    $bot
      .card()
      // .setTitle(`Enter a prompt in the prompt generator below`)
      .setSubtitle(`Enter a prompt in the prompt generator below`)
      .setInput(
        `"a cat and a duck who are best friends enjoying a sunny day, pixel art style"`
      )
      .setData({ action: "image_generation" })
      .setButtonLabel(`${EMOJI_ROSTER.pick(EMOJI_ROSTER.creative)} Generate`)
  );
});

// Runs on every text interaction
CultureBot.nlu(async ($bot, msg) => {
  logger("Incoming message:", `"${msg.data.text}"`);
  let { parentId } = msg.data as Message_Details & { parentId: string };
  const isThread = Boolean(parentId);

  if (!isThread) {
    // High latency for responses, give user visual indicator right away
    const text = $bot.pickRandom([
      "Let me ponder on that for a moment...",
      "I'm considering a few different responses...",
      "Give me a sec to gather my thoughts...",
      "I'm formulating a response, please hold...",
      "Let me mull that over for a bit...",
      "Hang on, I'm processing your request...",
      "I need a moment to think through this...",
      "I'm contemplating the best way to respond...",
      "Let me think out loud for a moment...",
      "I'm working on a clever response, stay tuned...",
      "Hmm, that's a good question, let me think...",
      "I'm going to need a moment to craft a response...",
      "Let me brew up the perfect reply for you...",
      "I'm putting on my thinking cap, be right back...",
      "I'm analyzing your message, give me a moment...",
    ]);
    await $bot.send({ parentId: msg.id, text });
    parentId = msg.id;
  }

  let conversationCount = 0; // conversation rounds
  const STORAGE_KEY = msg.authorId;
  const ROOT_HISTORY: ChatHistory =
    (await CultureBot.get(STORAGE_KEY, HISTORY_KEY)) || DEFAULT_HISTORY;
  const threadData = ROOT_HISTORY.threads[parentId] || {
    count: 0,
    history: [],
  };

  const openAI = new OpenAIHelper(
    CultureBot.getSecret("OPENAI_API_KEY") as string
  );

  // Add user/assistant conversation history, if any

  try {
    const persona = personas[ROOT_HISTORY.selectedPersona]; // load/select
    openAI.loadPersona(persona); // create system context + append example history for tone (maybe make history optional?)

    if (isThread) {
      const { history = [] } = threadData;
      const { count = 0 } = threadData;
      conversationCount = count;

      if (conversationCount > APP_CONFIG.conversation_depth) {
        const msg = $bot.pickRandom([
          "Session Limit Reached: Conversation has ended.",
          "Maximum Turns Exceeded: Unable to continue this chat.",
          "Conversation Cap Hit: This discussion is now closed.",
        ]);
        return $bot.send($bot.banner(msg));
      }

      if (history.length) {
        openAI.addHistory(history);
      }
    }

    const prompt = msg.text;

    let res = await openAI.getChatCompletion(prompt);

    await $bot.send({
      parentId,
      roomId: msg.data.roomId,
      markdown: res,
      text: res,
    });

    threadData.history.push(
      ...[
        { role: "user" as const, content: msg.text },
        { role: "assistant" as const, content: res },
      ]
    );
    threadData.count++;

    ROOT_HISTORY.threads[parentId] = threadData;
    await CultureBot.save(STORAGE_KEY, HISTORY_KEY, ROOT_HISTORY);
  } catch (e) {
    console.log("Error", e);
    $bot.send(`There was an error: ${e}`);
  }
});

// Buttons, chips, card, "form" submissions
CultureBot.onSubmit(async ($bot, msg) => {
  const openAI = new OpenAIHelper(
    CultureBot.getSecret("OPENAI_API_KEY") as string
  );
  const { inputs } = msg.data;
  if (inputs.action === "image_generation") {
    $bot.deleteMessage(msg.data.messageId);
    const res = await openAI.generateImage(msg.data.inputs.inputData, {
      response_format: "url",
    });
    $bot.deleteMessage(msg.data.messageId); // don't await, keep train moving
    const plural = res.length > 1;
    const rootMessage = await $bot.send(
      `Here${plural ? "are" : "'s"} the generation${plural ? "s" : ""} for "${
        msg.data.inputs.inputData
      }"`
    );
    res.forEach((url) => {
      $bot.send({
        parentId: rootMessage.id,
        files: [url],
        markdown: `**[${msg.data.inputs.inputData}](${url})**`,
      });
    });
  }

  if (inputs.action === "change_persona") {
    const { choiceSelect } = inputs;
    $bot.deleteMessage(msg.data.messageId);
    const { key, name, image } = invertedPersonas[choiceSelect];
    const STORAGE_KEY = msg.authorId;
    const ROOT_HISTORY: ChatHistory =
      (await CultureBot.get(STORAGE_KEY, HISTORY_KEY)) || DEFAULT_HISTORY;

    ROOT_HISTORY["selectedPersona"] = key;
    await CultureBot.save(STORAGE_KEY, HISTORY_KEY, ROOT_HISTORY);
    if (image) {
      $bot.sendDataFromUrl(image);
    }
    const utterances = [
      "You are speaking with $[name]",
      "Switched to $[name]",
      "Now speaking with $[name]",
      "$[name] here, what do you want to talk about?",
    ];
    const template = { name };
    return $bot.sendTemplate(utterances, template);
  }

  // Ex. From here data could be transmitted to another service or a 3rd-party integrationn
  $bot.say(
    `Submission received! You sent us ${JSON.stringify(msg.data.inputs)}`
  );
});

// File uploads
CultureBot.onFile(async ($bot, msg, fileData) => {
  $bot.send(
    $bot.banner(`No support yet for ${fileData.extension} (${fileData.type})`)
  );
});
