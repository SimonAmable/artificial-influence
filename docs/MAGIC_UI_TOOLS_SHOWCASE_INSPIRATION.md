# Magic UI inspiration: showcasing multiple tools (screenshots + videos)

Use these Magic UI components to show off your tools (character swap, image generator, canvas, etc.) with screenshots and videos in a clear, polished way.

---

## 1. **Bento Grid** (best for “product features” layout)

**What it is:** A grid layout for showcasing product features. Each card has a background (image/video), icon, title, description, and CTA.

**Why use it:** Lets you give each tool (Image Studio, Video Studio, Motion Copy, Lip Sync, Canvas, etc.) its own card. You control size with `col-span-3` (full width) or `col-span-1` (narrow). Mix big hero cards with smaller ones.

**How to use it for your tools:**
- One **BentoCard** per tool.
- Put a **screenshot or video** in the `background` slot (e.g. `<img>` or `<video>` from `/canvas_landing_page_assets/` or hero showcase).
- Use **Hero Video Dialog** inside a card for “thumbnail → click to play full video”.

**Install:**  
`npx shadcn@latest add "https://magicui.design/r/bento-grid.json"`

---

## 2. **Safari (browser mockup)** (screenshots in a “browser” frame)

**What it is:** A Safari-style browser chrome. You pass `imageSrc` or `videoSrc` and it shows your content inside the window.

**Why use it:** Makes screenshots look like a real product in a browser. Great for landing pages or when you want a “this is the app” feel.

**How to use it for your tools:**
- One **Safari** per tool: e.g. Canvas screenshot, Image Generator screenshot, Character Swap UI.
- Supports both **image** and **video** (`videoSrc` for autoplay loop in the frame).
- Optional `url` prop shows a fake URL in the address bar (e.g. `yourapp.com/canvas`).

**Install:**  
`npx shadcn@latest add "https://magicui.design/r/safari.json"`

---

## 3. **Hero Video Dialog** (thumbnail → full-screen video)

**What it is:** A thumbnail image with a play button. Click opens a modal with the full video (e.g. iframe or video element).

**Why use it:** Use for “Watch demo” per tool without autoplay. Good when you have short demo videos and want a clean, focused view.

**How to use it for your tools:**
- Use as the **background** of a Bento card, or as a standalone block per tool.
- Pass `thumbnailSrc` (screenshot or poster) and `videoSrc` (demo URL).

**Install:**  
`npx shadcn@latest add "https://magicui.design/r/hero-video-dialog.json"`

---

## 4. **Marquee** (infinite scroll of screenshots/videos)

**What it is:** Horizontal (or vertical) infinite scroll. You can put images, videos, or cards inside.

**Why use it:** Good for a “see all tools at a glance” strip: e.g. a row of tool screenshots or small preview cards that scroll. Pairs well with a single headline like “All our tools” or “See it in action.”

**How to use it for your tools:**
- Put 3–5 **tool cards** (image + label) inside **Marquee**; duplicate for seamless loop (`repeat={4}`).
- Or a row of **Safari** mockups with different tool screenshots.

**Install:**  
`npx shadcn@latest add "https://magicui.design/r/marquee.json"`

---

## 5. **Lens** (hover to zoom into screenshot)

**What it is:** Hover over an image/video to get a magnified circle under the cursor.

**Why use it:** Makes static screenshots feel interactive. Use on tool preview images so users can “zoom in” on details (e.g. canvas UI, image settings).

**How to use it for your tools:**
- Wrap each tool **screenshot** in `<Lens>` on the dashboard or in Bento cards.
- Keeps layout simple while adding a premium feel.

**Install:**  
`npx shadcn@latest add "https://magicui.design/r/lens.json"`

---

## 6. **Card effects** (make each tool card stand out)

Use one of these **around** each tool card (Bento or custom):

| Component           | Effect |
|--------------------|--------|
| **Magic Card**     | Spotlight that follows the mouse; border highlight on hover. |
| **Border Beam**    | Animated light traveling along the card border. |
| **Shine Border**   | Animated gradient border. |
| **Neon Gradient Card** | Neon-style animated border. |

**How to use it for your tools:**  
Wrap your card content (e.g. screenshot + title + CTA) in one of these. Use the same component for all tools for consistency, or use **Border Beam** for the “hero” tool and **Magic Card** for the rest.

**Install (examples):**  
- `npx shadcn@latest add "https://magicui.design/r/magic-card.json"`  
- `npx shadcn@latest add "https://magicui.design/r/border-beam.json"`

---

## 7. **Device mockups** (optional: “app” or “mobile” feel)

- **Safari** – desktop browser (see above).
- **iPhone** – phone frame; pass image or video for the screen.
- **Android** – same idea for Android.

Use when you want to show “this is how it looks in the app/browser on device.”

---

## Suggested combinations

1. **Landing “Features” section**  
   **Bento Grid** with one card per tool. Each card: **Safari** (or plain image/video) as background, **Hero Video Dialog** for tools that have a demo video, **Border Beam** or **Magic Card** for the container.

2. **“See all tools” strip**  
   **Marquee** of small cards: each card = tool screenshot (optionally in **Safari**) + tool name. Link each to the tool page.

3. **Dashboard tools grid (current page)**  
   Keep your grid/carousel; add **Lens** on each screenshot and optionally wrap each card in **Magic Card** or **Border Beam** for hover polish.

4. **Dedicated “Product” or “Tools” page**  
   One **Bento Grid** section (mixed sizes), then a **Marquee** of screenshots, then per-tool blocks with **Safari** + **Hero Video Dialog** for demos.

---

## Quick reference: what to use when

| Goal                         | Component(s) to use                    |
|-----------------------------|----------------------------------------|
| Show multiple tools in a grid | **Bento Grid**                        |
| Put screenshot in a browser frame | **Safari**                         |
| Thumbnail → play full video | **Hero Video Dialog**                  |
| Infinite scroll of previews | **Marquee**                            |
| Hover zoom on screenshots   | **Lens**                               |
| Fancy card borders/hover   | **Magic Card**, **Border Beam**, **Shine Border** |

All components are installed via the shadcn CLI with the Magic UI registry URLs above. After adding them, use your existing assets under `/public/canvas_landing_page_assets/` and `/hero_showcase_images/` for images and videos.
