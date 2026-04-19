import type { FeatureLandingConfig } from "@/lib/types/feature-landing"

/**
 * Logged-out /automations landing: user-friendly, use-case driven copy.
 */
export const automationsLanding: FeatureLandingConfig = {
  slug: "automations",
  datePublished: "2026-01-15T12:00:00.000Z",
  lastUpdated: "2026-04-18T12:00:00.000Z",
  answerCapsulesSectionTitle: "How automations work",
  hero: {
    eyebrow: "For creators and teams",
    title: "Set it once. Let your AI do the rest.",
    tagline: "Save a task, pick when it should run, and wake up to fresh work done for you.",
    tldr:
      "Automations turn any AI task you do manually (drafting captions, pulling trend reports, generating product photos, writing your weekly newsletter) into something that just happens on its own. Pick a time (every morning, every Monday, every hour), and UniCan kicks off a new chat and finishes the work for you. Open any run to review, tweak, or take it further.",
    primaryCta: { label: "Get started free", href: "/login?mode=signup" },
    secondaryCta: { label: "View pricing", href: "/pricing" },
    media: {
      kind: "image",
      src: "/page_screenshots_or_screenrecordings/agent.png",
      alt: "UniCan agent interface used for automation runs",
      width: 1200,
      height: 700,
    },
  },
  answerCapsules: [
    {
      question: "What can I actually automate?",
      answer:
        "Anything you'd normally ask an AI to do. Popular ones: daily Instagram caption batches, Monday morning trend reports on your niche, weekly newsletter drafts, product photos in your brand style every week, daily competitor recaps, hourly news scans, or end-of-week performance summaries. If you've typed the same prompt twice, it belongs in an automation.",
    },
    {
      question: "How do I schedule a recurring AI task?",
      answer:
        "Write your instructions once, the same way you'd chat with the AI. Then pick a cadence: every hour, every day at 9am, every Monday morning, or your own custom time. Set your timezone so mornings mean your mornings. Save it, and the work starts happening on its own. Pause it any time with a toggle.",
    },
    {
      question: "Can I include my brand, style, or reference files?",
      answer:
        "Yes. Automations use the same prompt tools as regular chat. Drop in your brand kit so everything stays on-voice, attach reference images so visuals stay consistent, and upload any files the task needs. You only set it up once, and every run uses the same creative context automatically.",
    },
    {
      question: "Can I share my automations with other people?",
      answer:
        "If you build something useful, you can make it public in the Community tab so others can see it and copy it to their own account. You pick which example run shows up as the preview. Keep it private and nobody sees it. Flip the switch and others can learn from your setup without getting access to your workspace.",
    },
    {
      question: "How is this different from Instagram autopost?",
      answer:
        "Automations create the content. Autopost publishes it. Most people use automations to generate captions, ideas, or imagery on a schedule, then use Autopost (or manual export) to actually push things live on Instagram. Use both together, or just the one you need.",
    },
    {
      question: "Is it free to try?",
      answer:
        "Yes. You can set up automations on a free account, subject to the limits on the pricing page. Scheduled runs use the same credits as regular chat, so your monthly allowance covers both. Upgrade when you want more runs or access to bigger models.",
    },
  ],
  bento: {
    heading: "What people put on autopilot",
    items: [
      {
        name: "Daily content ideas",
        description: "Wake up to fresh caption ideas, hooks, or post concepts for your niche, every morning at 8am.",
        href: "/automations",
        cta: "Try it",
        className: "col-span-1 md:row-span-2",
        icon: "clock",
        media: {
          kind: "image",
          src: "/page_screenshots_or_screenrecordings/workflow.png",
          alt: "Daily content ideas scheduled automation",
        },
      },
      {
        name: "On-brand every time",
        description: "Drop in your brand kit, reference photos, or style guide once. Every run stays on-voice and on-look.",
        href: "/chat",
        cta: "See how",
        className: "col-span-1 md:row-span-2",
        icon: "chat-circle-dots",
        media: {
          kind: "image",
          src: "/page_screenshots_or_screenrecordings/agent.png",
          alt: "Brand kit attached to an automation prompt",
        },
      },
      {
        name: "Borrow what works",
        description: "Browse automations other creators have shared and save the good ones to your account in one click.",
        href: "/automations",
        cta: "Browse community",
        className: "col-span-1 md:row-span-2",
        icon: "users-three",
        media: {
          kind: "image",
          src: "/canvas_landing_page_assets/icon_workflow.png",
          alt: "Community automations you can clone",
        },
      },
      {
        name: "Review and tweak in chat",
        description: "Every run opens as a chat thread. Love it? Use it. Not quite? Keep chatting and improve it live.",
        href: "/pricing",
        cta: "See plans",
        className: "col-span-1 md:row-span-2",
        icon: "sparkle",
        media: {
          kind: "image",
          src: "/hero_showcase_images/image_generation_wide.png",
          alt: "Review an automation run inside chat",
        },
      },
    ],
  },
  comparison: {
    heading: "Automations vs doing it yourself vs generic schedulers",
    columns: ["UniCan Automations", "Manually every day", "Zapier / generic tools"],
    rows: [
      {
        label: "Setup",
        cells: [
          "Write the task once, pick a time, done",
          "Open chat, retype prompt, reattach files every time",
          "Build a multi-step workflow, connect APIs, test",
        ],
      },
      {
        label: "Stays on-brand",
        cells: [
          "Brand kit and references baked into every run",
          "Only if you remember to paste them in",
          "Usually text-only, no creative context",
        ],
      },
      {
        label: "Review the output",
        cells: [
          "Every run is a real chat you can open and iterate",
          "Same, if you didn't forget to run it",
          "Logs and raw data, no creative workspace",
        ],
      },
      {
        label: "When you want to change it",
        cells: [
          "Edit the prompt, save, done",
          "Try to remember what you changed last time",
          "Rebuild the workflow",
        ],
      },
    ],
  },
  features: {
    heading: "Where automations fit",
    items: [
      {
        title: "Step 1: Nail the prompt in chat",
        description:
          "Play with it in regular chat until the output feels right. Once you love what you're getting, promote it to an automation and stop repeating yourself.",
        href: "/chat",
        ctaLabel: "Open chat",
        mediaType: "image",
        mediaSrc: "/landing_images/automations/step_1_iterate_in_chat.png",
        mediaAlt: "Iterate on your prompt inside UniCan chat",
      },
      {
        title: "Step 2: Connect your Instagram account",
        description:
          "Hook up the account you want to work with. Automations can reference it for drafts, recaps, and on-brand content that actually sounds like you.",
        href: "/autopost",
        ctaLabel: "Connect account",
        mediaType: "image",
        mediaSrc: "/landing_images/automations/step2-connect_instagram_accounts.png",
        mediaAlt: "Connect your Instagram account to UniCan",
      },
      {
        title: "Step 3: Hand off to Autopost to publish",
        description:
          "Automations create the content on a schedule. When you're ready to put things live, Autopost handles the Instagram publishing side.",
        href: "/autopost",
        ctaLabel: "Open Autopost",
        mediaType: "image",
        mediaSrc: "/landing_images/automations/step_3_post_to_instgram.png",
        mediaAlt: "Autopost publishes your content to Instagram",
      },
    ],
  },
  faq: {
    heading: "Common questions",
    items: [
      {
        question: "Does this post to Instagram for me?",
        answer:
          "No. Automations create the content (captions, ideas, images, reports). For actually publishing to Instagram, use Autopost or export the assets yourself. Keeping them separate lets you review everything before it goes live.",
      },
      {
        question: "Can I pause an automation?",
        answer:
          "Yes. Flip the Active toggle and scheduled runs stop. Your prompt and schedule stay saved so you can turn it back on whenever.",
      },
      {
        question: "What if a run fails?",
        answer:
          "You'll see an error in the run history. Open the thread, see what went wrong, tweak your prompt, and try again. Usually it's a model limit or something ambiguous in the instructions.",
      },
      {
        question: "How specific can the schedule get?",
        answer:
          "Start with presets (hourly, daily at a specific time, weekly on a specific day). If you need something more specific, like every weekday at 9:15am, there's an advanced option too. A preview shows you exactly when the next run will happen.",
      },
      {
        question: "Can I change the AI model later?",
        answer:
          "Yes. Open the automation, pick a different model, save. Future runs use the new one.",
      },
      {
        question: "Who can see my automations?",
        answer:
          "Only you, by default. If you want to share one with the community, there's an opt-in toggle. Your own workspace and the chats from each run stay private either way.",
      },
      {
        question: "How do I not get my Instagram account flagged?",
        answer:
          "Warm the account up like a real person first: browse, engage, and post lightly for a couple of weeks before scaling up. If reach drops, back off the posting schedule and engage normally for a few days before ramping again.",
      },
      {
        question: "Where do I see billing and limits?",
        answer:
          "Check the pricing page or your account settings. Automations use the same credits as regular chat, so one plan covers both.",
      },
    ],
  },
  cta: {
    heading: "Stop doing the same task every morning.",
    body: "Create a free account, set up one automation, and see how it feels to wake up to work that's already done.",
    buttons: [
      { label: "Get started free", href: "/login?mode=signup", variant: "default" },
      { label: "View pricing", href: "/pricing", variant: "outline" },
    ],
  },
  howTo: {
    name: "Set up your first automation",
    description: "Four steps to hand off a recurring task to UniCan.",
    steps: [
      { name: "Sign in", text: "Create a free UniCan account or log in." },
      { name: "Open Automations", text: "Head to Automations and hit New." },
      { name: "Describe the task", text: "Write what you want it to do. Add your brand kit or reference files if needed." },
      { name: "Pick when it runs", text: "Every morning? Monday at 9? Every hour? Choose a preset or set your own time." },
      { name: "Review and relax", text: "Each run shows up in your history as a chat. Open it to see the work, tweak anytime." },
    ],
  },
  seo: {
    title: "AI Automations: put recurring tasks on autopilot",
    description:
      "Schedule any AI task (daily captions, weekly reports, recurring product photos) and wake up to the work already done. Review every run in chat.",
    keywords: [
      "AI automations",
      "scheduled AI tasks",
      "recurring AI content",
      "content automation",
      "UniCan",
    ],
    structuredData: {
      includeSoftwareApplication: true,
      includeHowTo: true,
      breadcrumb: [
        { name: "Home", url: "/" },
        { name: "Automations", url: "/automations" },
      ],
    },
  },
}
