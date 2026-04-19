import type { FeatureLandingConfig } from "@/lib/types/feature-landing"

/** Same asset as automations bento “Daily content ideas” — swap per section later if needed */
const WORKFLOW_LANDING_IMAGE = "/page_screenshots_or_screenrecordings/workflow.png"
const WORKFLOW_LANDING_IMAGE_ALT = "UniCan workflow canvas"

/**
 * Logged-out /canvases landing: node-based workflows, rerun, and creative pipelines.
 */
export const canvasesLanding: FeatureLandingConfig = {
  slug: "canvases",
  datePublished: "2026-04-18T12:00:00.000Z",
  lastUpdated: "2026-04-18T12:00:00.000Z",
  answerCapsulesSectionTitle: "How canvases work",
  hero: {
    eyebrow: "Visual AI workflows",
    title: "Chain models on a canvas. Rerun the whole graph.",
    tagline:
      "Drop nodes, connect them, and turn one prompt into a repeatable pipeline — image, video, or mixed steps you can open and tweak anytime.",
    tldr:
      "Canvases are a node-based workspace: each node is a step (generate an image, upscale, swap a face, send output to the next node). You wire them together instead of copy-pasting between chats. When something works, save the canvas and hit Run again with a new prompt or reference — the graph stays the same, the results stay on-brand. It is built for people who want structure without losing creative control.",
    primaryCta: { label: "Get started free", href: "/login?mode=signup" },
    secondaryCta: { label: "View pricing", href: "/pricing" },
    media: {
      kind: "image",
      src: WORKFLOW_LANDING_IMAGE,
      alt: WORKFLOW_LANDING_IMAGE_ALT,
      width: 1200,
      height: 700,
    },
  },
  answerCapsules: [
    {
      question: "What is a node-based AI canvas?",
      answer:
        "It is a visual board where each box is a step and arrows show the order. You might start with a text prompt, feed the result into an image node, then into an edit or video node. Instead of one long chat thread, you see the whole pipeline at once. That makes it obvious what depends on what, and easy to swap a single step without redoing everything upstream.",
    },
    {
      question: "How is a canvas different from chat?",
      answer:
        "Chat is great for exploration and back-and-forth. A canvas is for workflows you will run more than once: same structure, new inputs. You lay out the steps once, save them, and rerun with a different prompt, reference image, or model. Chat answers 'what if we try this?'; a canvas answers 'run my recipe again tomorrow with these assets.'",
    },
    {
      question: "Can I reuse a canvas as a template?",
      answer:
        "Yes. Think of the saved canvas as your template: node layout, model choices, and connections stay put. Next time you open it, change the prompt or drop in new reference images and run again. Teams use this for recurring content packs, product shots in one style, or weekly batches where only the subject line changes.",
    },
    {
      question: "What kinds of steps can I chain?",
      answer:
        "Anything the platform exposes as a node: image generation, edits, video from image, lip sync, motion-style transfers, and more depending on what is enabled in your workspace. Outputs from one node become inputs for the next, so you can build multi-stage creative pipelines without exporting files by hand between tools.",
    },
    {
      question: "Do I need to be technical to use it?",
      answer:
        "No. If you can drag boxes and connect lines, you can use a canvas. Power users go deep on model settings per node; beginners can start with presets and one connection at a time. The goal is clarity: you always see what ran, in what order, and where to click to change one step.",
    },
    {
      question: "How does this fit with Automations or Autopost?",
      answer:
        "Canvases are where you design and perfect a repeatable creative pipeline. Automations can run AI tasks on a schedule in chat; Autopost handles publishing to Instagram when you are ready. Many people iterate on a canvas until the output is right, then use other parts of UniCan for scheduling or posting. They solve different parts of the same creator workflow.",
    },
  ],
  bento: {
    heading: "What people build on canvases",
    items: [
      {
        name: "Batch product visuals",
        description:
          "One graph: prompt → image → brand-consistent edits → export. Rerun for every SKU without rebuilding the flow.",
        href: "/image",
        cta: "Image tools",
        className: "col-span-1 md:row-span-2",
        icon: "sparkle",
        media: {
          kind: "image",
          src: WORKFLOW_LANDING_IMAGE,
          alt: WORKFLOW_LANDING_IMAGE_ALT,
        },
      },
      {
        name: "Storyboard to clip",
        description:
          "Chain stills, motion, and lip sync in order so each shot feeds the next — review the graph before you render long video.",
        href: "/video",
        cta: "Video tools",
        className: "col-span-1 md:row-span-2",
        icon: "clock",
        media: {
          kind: "image",
          src: WORKFLOW_LANDING_IMAGE,
          alt: WORKFLOW_LANDING_IMAGE_ALT,
        },
      },
      {
        name: "Shareable recipes",
        description:
          "Save a canvas as your house style: same nodes, same models, new prompts when the campaign changes.",
        href: "/chat",
        cta: "Open chat",
        className: "col-span-1 md:row-span-2",
        icon: "chat-circle-dots",
        media: {
          kind: "image",
          src: WORKFLOW_LANDING_IMAGE,
          alt: WORKFLOW_LANDING_IMAGE_ALT,
        },
      },
      {
        name: "Iterate without losing context",
        description:
          "Open any node, adjust settings, and rerun downstream steps only — no hunting through chat history for the right message.",
        href: "/pricing",
        cta: "See plans",
        className: "col-span-1 md:row-span-2",
        icon: "users-three",
        media: {
          kind: "image",
          src: WORKFLOW_LANDING_IMAGE,
          alt: WORKFLOW_LANDING_IMAGE_ALT,
        },
      },
    ],
  },
  comparison: {
    heading: "Canvases vs chat vs one-off tools",
    columns: ["UniCan canvases", "Chat only", "Single-purpose apps"],
    rows: [
      {
        label: "See the full pipeline",
        cells: [
          "Graph view: every step and dependency visible",
          "Linear thread; hard to see structure",
          "One task per app; manual handoff between tools",
        ],
      },
      {
        label: "Rerun with new inputs",
        cells: [
          "Same graph, new prompt or refs in one place",
          "Rebuild the conversation or re-paste prompts",
          "Start from scratch or export/import manually",
        ],
      },
      {
        label: "Change one step",
        cells: [
          "Edit a node, rerun what depends on it",
          "Scroll back, hope you find the right message",
          "Often means redoing the whole chain elsewhere",
        ],
      },
      {
        label: "Best for",
        cells: [
          "Repeatable creative systems and batches",
          "Exploration and quick questions",
          "A single task in isolation",
        ],
      },
    ],
  },
  features: {
    heading: "From blank board to a saved workflow",
    items: [
      {
        title: "Start from the canvas or a preset",
        description:
          "Open a new canvas, add your first node, and pick what it should do — generate, edit, or route to another model. Add nodes as you go; you do not need the full graph on day one.",
        href: "/login?mode=signup",
        ctaLabel: "Create account",
        mediaType: "image",
        mediaSrc: WORKFLOW_LANDING_IMAGE,
        mediaAlt: WORKFLOW_LANDING_IMAGE_ALT,
      },
      {
        title: "Connect outputs to inputs",
        description:
          "Draw connections so the image from step one feeds step two. That is how you keep character, style, or framing consistent without pasting URLs between tabs.",
        href: "/image",
        ctaLabel: "Explore image",
        mediaType: "image",
        mediaSrc: WORKFLOW_LANDING_IMAGE,
        mediaAlt: WORKFLOW_LANDING_IMAGE_ALT,
      },
      {
        title: "Save, name, and reopen",
        description:
          "Name your canvas, save it to your list, and come back anytime. Your graph is the template; each run can use new text, images, or settings on the same structure.",
        href: "/canvas",
        ctaLabel: "Open canvas editor",
        mediaType: "image",
        mediaSrc: WORKFLOW_LANDING_IMAGE,
        mediaAlt: WORKFLOW_LANDING_IMAGE_ALT,
      },
    ],
  },
  faq: {
    heading: "Common questions",
    items: [
      {
        question: "Is there a limit on how many nodes I can add?",
        answer:
          "Practical limits depend on your plan and model costs — each node run uses credits like chat or standalone tools. Very deep graphs use more credits per full run. Check the pricing page for current limits and upgrade if you need heavier pipelines.",
      },
      {
        question: "Can I run only part of the graph?",
        answer:
          "You can iterate on a single node and rerun downstream steps when your UI supports it; exact behavior follows the canvas editor. The point of the graph is to avoid redoing unrelated steps when you change one piece.",
      },
      {
        question: "Can I collaborate with my team on the same canvas?",
        answer:
          "Sharing and collaboration depend on product settings in your workspace. Save canvases to your account and use the same account or workspace patterns your org already uses for other UniCan features.",
      },
      {
        question: "What happens if one node fails?",
        answer:
          "You will see which step failed in the run. Fix the prompt, model, or inputs on that node and try again without losing the rest of the graph layout.",
      },
      {
        question: "Is this the same as Figma or Blender nodes?",
        answer:
          "Same idea — visual programming — but tuned for AI generation steps inside UniCan. You are not keyframing 3D; you are wiring AI tasks that produce images, video, or audio.",
      },
    ],
  },
  cta: {
    heading: "Build a workflow you can run again and again.",
    body: "Create a free account, open the canvas, and wire your first pipeline in minutes.",
    buttons: [
      { label: "Get started free", href: "/login?mode=signup", variant: "default" },
      { label: "View pricing", href: "/pricing", variant: "outline" },
    ],
  },
  howTo: {
    name: "Create your first canvas",
    description: "Four steps to go from a blank board to a runnable workflow.",
    steps: [
      { name: "Sign in", text: "Create a free UniCan account or log in." },
      { name: "Open Canvas", text: "Go to Canvas from the app and start a new graph." },
      { name: "Add and connect nodes", text: "Pick each step, connect outputs to inputs, and set models or options per node." },
      { name: "Run and save", text: "Execute the graph, review results, then save the canvas so you can rerun with new inputs later." },
    ],
  },
  seo: {
    title: "AI canvas workflows — node-based pipelines for images and video",
    description:
      "Build visual AI workflows on a canvas: connect generation, edits, and video steps, save the graph, and rerun with new prompts or references.",
    ogImage: WORKFLOW_LANDING_IMAGE,
    keywords: [
      "AI canvas",
      "node-based AI workflow",
      "visual AI pipeline",
      "generative workflow",
      "UniCan",
    ],
    structuredData: {
      includeSoftwareApplication: true,
      includeHowTo: true,
      breadcrumb: [
        { name: "Home", url: "/" },
        { name: "Canvases", url: "/canvases" },
      ],
    },
  },
}
