export const DATA_SOURCES = {
  sfStandard: "https://sfstandard.com/2026/01/22/san-francisco-ai-boom-office-footprint/",
  osm: "https://www.openstreetmap.org/copyright",
};

export const AREAS = [
  {
    id: "all",
    number: "01",
    label: "The Whole Board",
    shortLabel: "Whole Board",
    // Centred on the peninsula rather than on the companies: the projection
    // origin sits up in the north-east, so aiming at the company centroid
    // pushes two thirds of the city off frame.
    focus: { lat: 37.766, lng: -122.4235, distance: 96, height: 68, rotation: 0.62 },
    description:
      "46 AI companies across six clusters. Frontier labs, agent infrastructure, and applied AI, mapped block by block from the Financial District down to the Mission.",
  },
  {
    id: "soma",
    number: "02",
    label: "SoMa / Yerba Buena",
    shortLabel: "SoMa",
    focus: { lat: 37.7848, lng: -122.3968, distance: 32, height: 27, rotation: 0.5 },
    description:
      "The centre of gravity. Frontier labs, agent platforms, and dev tooling packed into the blocks between Market Street and the ballpark.",
  },
  {
    id: "mission-bay",
    number: "03",
    label: "Mission Bay / China Basin",
    shortLabel: "Mission Bay",
    focus: { lat: 37.7712, lng: -122.3908, distance: 34, height: 27, rotation: 0.72 },
    description:
      "New-build waterfront campuses around Chase Center and UCSF, where the largest labs took the biggest floorplates in the city.",
  },
  {
    id: "mission",
    number: "04",
    label: "Mission / Potrero",
    shortLabel: "Mission",
    focus: { lat: 37.7624, lng: -122.4128, distance: 32, height: 26, rotation: 0.55 },
    description:
      "Converted warehouses south of 16th Street: research labs, robotics, and the evaluation-and-tooling layer, at a lower rent than downtown.",
  },
  {
    id: "hayes-valley",
    number: "05",
    label: "Hayes Valley",
    shortLabel: "Hayes Valley",
    focus: { lat: 37.7768, lng: -122.4232, distance: 26, height: 22, rotation: 0.88 },
    description:
      "“Cerebral Valley”: the hacker-house pocket where a lot of this started. Small teams, shared flats, and more demo nights per block than anywhere else.",
  },
  {
    id: "fidi",
    number: "06",
    label: "Financial District",
    shortLabel: "FiDi",
    focus: { lat: 37.7928, lng: -122.4012, distance: 32, height: 28, rotation: 0.92 },
    description:
      "The towers. Late-stage data and design platforms taking full floors in the buildings the last tech cycle left behind.",
  },
  {
    id: "showplace",
    number: "07",
    label: "Showplace Square / Dogpatch",
    shortLabel: "Showplace",
    focus: { lat: 37.7672, lng: -122.4048, distance: 28, height: 24, rotation: 0.42 },
    description:
      "Design-district brick and timber along the 101, now leased by health AI and model-infrastructure teams that outgrew SoMa.",
  },
];

// Pins marked `source: "company"` carry a street address verified against
// commercial-real-estate reporting and forward-geocoded with Nominatim. Pins
// marked `source: "user"` are neighbourhood-accurate only and deliberately
// carry no `address` field — see CONTRIBUTING.md on approximate pins.
//
// Two traps hit while sourcing these:
//   - Aggregators repeat "1455 Third Street" for OpenAI. It geocodes to Uber's
//     HQ. Prefer real-estate reporting over company directories.
//   - "2261 Market Street" is a virtual mailbox, registered to Anysphere,
//     Chroma, Decagon and Linear among others. Never an office.
// Remote-first companies with only a registered address are left off.
export const STARTUPS = [
  { id: "abridge", name: "Abridge", lat: 37.766962, lng: -122.406814, area: "showplace", stage: "Late-Stage", sector: "Healthcare", office: "HQ", website: "https://www.abridge.com/", source: "company", address: "208 Utah Street, San Francisco, CA 94103" },
  { id: "anthropic", name: "Anthropic", lat: 37.788511, lng: -122.396738, area: "soma", stage: "Late-Stage", sector: "Frontier Models", office: "HQ", website: "https://www.anthropic.com/", source: "company", address: "500 Howard Street, San Francisco, CA 94105" },
  { id: "assemblyai", name: "AssemblyAI", lat: 37.784, lng: -122.4065, area: "soma", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://www.assemblyai.com/", source: "user" },
  { id: "baseten", name: "Baseten", lat: 37.7875, lng: -122.3985, area: "soma", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://www.baseten.co/", source: "user" },
  { id: "browserbase", name: "Browserbase", lat: 37.783, lng: -122.399, area: "soma", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://www.browserbase.com/", source: "user" },
  { id: "cartesia", name: "Cartesia", lat: 37.7808, lng: -122.4028, area: "soma", stage: "Early-Stage", sector: "Media/Creative", office: "HQ", website: "https://cartesia.ai/", source: "user" },
  { id: "chroma", name: "Chroma", lat: 37.7745, lng: -122.419, area: "hayes-valley", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://www.trychroma.com/", source: "user" },
  { id: "cognition", name: "Cognition", lat: 37.7815, lng: -122.3955, area: "soma", stage: "Late-Stage", sector: "Coding", office: "HQ", website: "https://cognition.ai/", source: "user" },
  { id: "cresta", name: "Cresta", lat: 37.788, lng: -122.402, area: "soma", stage: "Late-Stage", sector: "Enterprise Automation", office: "HQ", website: "https://cresta.com/", source: "user" },
  { id: "cursor", name: "Cursor", lat: 37.8001, lng: -122.4083, area: "fidi", stage: "Late-Stage", sector: "Coding", office: "HQ", website: "https://cursor.com/", source: "user" },
  { id: "databricks", name: "Databricks", lat: 37.790427, lng: -122.401168, area: "fidi", stage: "Late-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://www.databricks.com/", source: "company", address: "1 Sansome Street, San Francisco, CA 94104" },
  { id: "decagon", name: "Decagon", lat: 37.784608, lng: -122.398558, area: "soma", stage: "Early-Stage", sector: "Enterprise Automation", office: "HQ", website: "https://decagon.ai/", source: "company", address: "680 Folsom Street, San Francisco, CA 94107" },
  { id: "deepgram", name: "Deepgram", lat: 37.7815, lng: -122.4095, area: "mission", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://deepgram.com/", source: "user" },
  { id: "descript", name: "Descript", lat: 37.762, lng: -122.418, area: "mission", stage: "Early-Stage", sector: "Media/Creative", office: "HQ", website: "https://www.descript.com/", source: "user" },
  { id: "elevenlabs", name: "ElevenLabs", lat: 37.786, lng: -122.397, area: "soma", stage: "Late-Stage", sector: "Media/Creative", office: "Satellite Office", website: "https://elevenlabs.io/", source: "user" },
  { id: "exa", name: "Exa", lat: 37.78, lng: -122.4, area: "soma", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://exa.ai/", source: "user" },
  { id: "fal", name: "fal", lat: 37.7818, lng: -122.4012, area: "soma", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://fal.ai/", source: "user" },
  { id: "figma", name: "Figma", lat: 37.786667, lng: -122.40505, area: "fidi", stage: "Public", sector: "Media/Creative", office: "HQ", website: "https://www.figma.com/", source: "company", address: "760 Market Street, San Francisco, CA 94102" },
  { id: "gamma", name: "Gamma", lat: 37.7755, lng: -122.4205, area: "hayes-valley", stage: "Early-Stage", sector: "Media/Creative", office: "HQ", website: "https://gamma.app/", source: "user" },
  { id: "harvey", name: "Harvey", lat: 37.785075, lng: -122.399873, area: "soma", stage: "Late-Stage", sector: "Legal", office: "HQ", website: "https://www.harvey.ai/", source: "company", address: "201 Third Street, San Francisco, CA 94103" },
  { id: "hayden-ai", name: "Hayden AI", lat: 37.782002, lng: -122.395128, area: "soma", stage: "Early-Stage", sector: "Manufacturing & Industrials", office: "HQ", website: "https://www.hayden.ai/", source: "company", address: "460 Bryant Street, San Francisco, CA 94107" },
  { id: "hex", name: "Hex", lat: 37.783, lng: -122.401, area: "soma", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://hex.tech/", source: "user" },
  { id: "imbue", name: "Imbue", lat: 37.7605, lng: -122.429, area: "mission", stage: "Early-Stage", sector: "Frontier Models", office: "HQ", website: "https://imbue.com/", source: "user" },
  { id: "langchain", name: "LangChain", lat: 37.785237, lng: -122.395296, area: "soma", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://www.langchain.com/", source: "company", address: "303 Second Street, San Francisco, CA 94107" },
  { id: "llamaindex", name: "LlamaIndex", lat: 37.779, lng: -122.4085, area: "mission", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://www.llamaindex.ai/", source: "user" },
  { id: "luma-ai", name: "Luma AI", lat: 37.781994, lng: -122.394845, area: "soma", stage: "Early-Stage", sector: "Media/Creative", office: "HQ", website: "https://lumalabs.ai/", source: "company", address: "457 Bryant Street, San Francisco, CA 94107" },
  { id: "mistral-ai", name: "Mistral AI", lat: 37.7875, lng: -122.396, area: "soma", stage: "Late-Stage", sector: "Frontier Models", office: "Satellite Office", website: "https://mistral.ai/", source: "user" },
  { id: "notion", name: "Notion", lat: 37.783, lng: -122.405, area: "soma", stage: "Late-Stage", sector: "AI Application", office: "HQ", website: "https://www.notion.com/", source: "user" },
  { id: "ollama", name: "Ollama", lat: 37.776, lng: -122.4225, area: "hayes-valley", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://ollama.com/", source: "user" },
  { id: "openai", name: "OpenAI", lat: 37.7685, lng: -122.39, area: "mission-bay", stage: "Late-Stage", sector: "Frontier Models", office: "HQ", website: "https://openai.com/", source: "user" },
  { id: "perplexity", name: "Perplexity", lat: 37.78963, lng: -122.395546, area: "soma", stage: "Late-Stage", sector: "AI Application", office: "HQ", website: "https://www.perplexity.ai/", source: "company", address: "181 Fremont Street, San Francisco, CA 94105" },
  { id: "physical-intelligence", name: "Physical Intelligence", lat: 37.763988, lng: -122.413651, area: "mission", stage: "Early-Stage", sector: "Robotics", office: "HQ", website: "https://www.physicalintelligence.company/", source: "company", address: "396 Treat Avenue, San Francisco, CA 94110" },
  { id: "replicate", name: "Replicate", lat: 37.78, lng: -122.411, area: "mission", stage: "Early-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://replicate.com/", source: "user" },
  { id: "retool", name: "Retool", lat: 37.7815, lng: -122.404, area: "soma", stage: "Late-Stage", sector: "Enterprise Automation", office: "HQ", website: "https://retool.com/", source: "user" },
  { id: "scale-ai", name: "Scale AI", lat: 37.785378, lng: -122.395962, area: "soma", stage: "Late-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://scale.com/", source: "company", address: "303 2nd Street, San Francisco, CA 94107" },
  { id: "sierra", name: "Sierra", lat: 37.776243, lng: -122.391702, area: "mission-bay", stage: "Late-Stage", sector: "Enterprise Automation", office: "HQ", website: "https://sierra.ai/", source: "company", address: "185 Berry Street, San Francisco, CA 94107" },
  { id: "sourcegraph", name: "Sourcegraph", lat: 37.786, lng: -122.4005, area: "soma", stage: "Late-Stage", sector: "Coding", office: "HQ", website: "https://sourcegraph.com/", source: "user" },
  { id: "suno", name: "Suno", lat: 37.7845, lng: -122.3995, area: "soma", stage: "Late-Stage", sector: "Media/Creative", office: "Satellite Office", website: "https://suno.com/", source: "user" },
  { id: "thinking-machines-lab", name: "Thinking Machines Lab", lat: 37.760374, lng: -122.413262, area: "mission", stage: "Early-Stage", sector: "Frontier Models", office: "HQ", website: "https://thinkingmachines.ai/", source: "company", address: "2300 Harrison Street, San Francisco, CA 94110" },
  { id: "together-ai-sf", name: "Together AI", lat: 37.76906, lng: -122.404454, area: "showplace", stage: "Late-Stage", sector: "AI/Data Infrastructure", office: "HQ", website: "https://www.together.ai/", source: "company", address: "2 Henry Adams Street, San Francisco, CA 94103" },
  { id: "vanta", name: "Vanta", lat: 37.789, lng: -122.4015, area: "soma", stage: "Late-Stage", sector: "Security", office: "HQ", website: "https://www.vanta.com/", source: "user" },
  { id: "vapi", name: "Vapi", lat: 37.7838, lng: -122.4042, area: "soma", stage: "Early-Stage", sector: "AI Interface", office: "HQ", website: "https://vapi.ai/", source: "user" },
  { id: "vercel", name: "Vercel", lat: 37.791164, lng: -122.395041, area: "soma", stage: "Late-Stage", sector: "DevOps", office: "HQ", website: "https://vercel.com/", source: "company", address: "201 Mission Street, San Francisco, CA 94105" },
  { id: "weights-biases", name: "Weights & Biases", lat: 37.764064, lng: -122.412385, area: "mission", stage: "Late-Stage", sector: "DevOps", office: "HQ", website: "https://wandb.ai/", source: "company", address: "400 Alabama Street, San Francisco, CA 94110" },
  { id: "world-labs", name: "World Labs", lat: 37.781127, lng: -122.391651, area: "soma", stage: "Early-Stage", sector: "Frontier Models", office: "HQ", website: "https://www.worldlabs.ai/", source: "company", address: "640 2nd Street, San Francisco, CA 94107" },
  { id: "writer", name: "Writer", lat: 37.7885, lng: -122.3995, area: "soma", stage: "Late-Stage", sector: "Enterprise Automation", office: "HQ", website: "https://writer.com/", source: "user" },
];

// Short, human-written summaries + an approximate location (street · neighborhood,
// never the exact unit). Keyed by startup id.
export const COMPANY_INFO = {
  abridge: { blurb: "Turns clinician-patient conversations into structured medical notes.", loc: "Utah St · Showplace Square" },
  anthropic: { blurb: "Builds Claude, and the safety research behind it.", loc: "Howard St · SoMa" },
  assemblyai: { blurb: "Speech-to-text and audio understanding APIs for developers.", loc: "SoMa" },
  baseten: { blurb: "Deploys and scales machine-learning models in production.", loc: "SoMa" },
  browserbase: { blurb: "Headless browser infrastructure that AI agents drive.", loc: "SoMa" },
  cartesia: { blurb: "Real-time voice models built on state-space architectures.", loc: "SoMa" },
  chroma: { blurb: "Open-source embedding database for retrieval.", loc: "Hayes Valley" },
  cognition: { blurb: "Builder of Devin, the autonomous AI software engineer.", loc: "South Park · SoMa" },
  cresta: { blurb: "Live AI coaching and automation for contact centres.", loc: "SoMa" },
  cursor: { blurb: "The AI code editor, built by Anysphere.", loc: "North Beach" },
  databricks: { blurb: "Lakehouse platform for data engineering and AI at scale.", loc: "Sansome St · FiDi" },
  decagon: { blurb: "AI support agents that resolve customer conversations end to end.", loc: "Folsom St · SoMa" },
  deepgram: { blurb: "Speech recognition and voice agent APIs.", loc: "Mission" },
  descript: { blurb: "Edits video and podcasts by editing the transcript.", loc: "Mission" },
  elevenlabs: { blurb: "Lifelike AI voice synthesis and text-to-speech in any language.", loc: "SoMa" },
  exa: { blurb: "A search engine built for AI agents rather than people.", loc: "SoMa" },
  fal: { blurb: "Fast inference infrastructure for generative media models.", loc: "SoMa" },
  figma: { blurb: "Collaborative interface design, now with generative tooling.", loc: "Market St · Union Square" },
  gamma: { blurb: "Generates presentations, docs, and sites from a prompt.", loc: "Hayes Valley" },
  harvey: { blurb: "Domain-specific AI for law firms and legal teams.", loc: "Third St · SoMa" },
  "hayden-ai": { blurb: "Computer vision on transit fleets for traffic enforcement.", loc: "Bryant St · SoMa" },
  hex: { blurb: "Collaborative analytics notebooks with an AI copilot.", loc: "SoMa" },
  imbue: { blurb: "Research lab training agents that reason and code.", loc: "Mission" },
  langchain: { blurb: "The framework and observability stack for LLM applications.", loc: "Second St · SoMa" },
  llamaindex: { blurb: "Data framework for connecting LLMs to private data.", loc: "Mission" },
  "luma-ai": { blurb: "Generative video and 3D capture from ordinary footage.", loc: "Bryant St · SoMa" },
  "mistral-ai": { blurb: "Open-weight frontier models out of Paris.", loc: "SoMa" },
  notion: { blurb: "Connected workspace with AI search and writing built in.", loc: "SoMa" },
  ollama: { blurb: "Runs open-weight language models locally, in one command.", loc: "Hayes Valley" },
  openai: { blurb: "Builds ChatGPT and the GPT model family.", loc: "Mission Bay" },
  perplexity: { blurb: "An answer engine that cites its sources.", loc: "Fremont St · Transbay" },
  "physical-intelligence": { blurb: "Foundation models that give robots general-purpose control.", loc: "Treat Ave · Mission" },
  replicate: { blurb: "Run and fine-tune open-source models with one API call.", loc: "Mission" },
  retool: { blurb: "Builds internal tools and AI agents over company data.", loc: "SoMa" },
  "scale-ai": { blurb: "Data labelling and evaluation for frontier model training.", loc: "2nd St · SoMa" },
  sierra: { blurb: "Conversational AI agents for customer-facing teams.", loc: "Berry St · China Basin" },
  sourcegraph: { blurb: "Code search and the Amp coding agent.", loc: "SoMa" },
  suno: { blurb: "Generates full songs, vocals included, from a text prompt.", loc: "SoMa" },
  "thinking-machines-lab": { blurb: "Research lab building multimodal, collaborative AI.", loc: "Harrison St · Mission" },
  "together-ai-sf": { blurb: "Cloud platform to train, fine-tune, and run open-source AI models.", loc: "Henry Adams St · Showplace Square" },
  vanta: { blurb: "Automates security compliance and trust management.", loc: "SoMa" },
  vapi: { blurb: "Developer platform for building voice AI agents.", loc: "SoMa" },
  vercel: { blurb: "Frontend cloud, and the AI SDK a lot of apps are built on.", loc: "Mission St · SoMa" },
  "weights-biases": { blurb: "Experiment tracking and evaluation for ML teams.", loc: "Alabama St · Mission" },
  "world-labs": { blurb: "Large world models that generate navigable 3D scenes.", loc: "2nd St · South Beach" },
  writer: { blurb: "Full-stack generative AI platform for enterprises.", loc: "SoMa" },
};

export const CONTEXT_POINTS = [
  { id: "sf-github", name: "GitHub", category: "Big Tech", lat: 37.782177, lng: -122.391245 },
  { id: "sf-salesforce", name: "Salesforce Tower", category: "Big Tech", lat: 37.789774, lng: -122.396932 },
  { id: "sf-google", name: "Google SF", category: "Big Tech", lat: 37.7901, lng: -122.3894 },
  { id: "sf-ucsf", name: "UCSF Mission Bay", category: "Higher Education", lat: 37.767372, lng: -122.391297 },
  { id: "sf-founders-fund", name: "Founders Fund", category: "VCs / Events", lat: 37.799261, lng: -122.450515 },
  { id: "sf-battery", name: "The Battery", category: "VCs / Events", lat: 37.797934, lng: -122.401137 },
  { id: "sf-shack15", name: "Shack15", category: "VCs / Events", lat: 37.795549, lng: -122.393475 },
  { id: "sf-spc", name: "South Park Commons", category: "VCs / Events", lat: 37.7815, lng: -122.3956 },
];
