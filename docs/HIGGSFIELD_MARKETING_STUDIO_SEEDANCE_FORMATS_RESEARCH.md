# Higgsfield Marketing Studio Seedance 2.0 Formats Research

Updated: April 26, 2026

## Source Notes

This research is based on Higgsfield's current public Marketing Studio and Seedance 2.0 pages, plus the format picker shown in the supplied screenshot. Higgsfield describes Marketing Studio as a one-prompt campaign workspace for UGC, product demos, CGI ads, virtual try-ons, TV spots, and Wild Card concepts. Higgsfield's Seedance 2.0 page positions the model around multi-shot video, native audio, consistent characters, cinematic camera control, reference inputs, and clips up to 15 seconds per shot.

Sources:
- https://higgsfield.ai/marketing-studio-intro
- https://higgsfield.ai/marketing-automation
- https://higgsfield.ai/ai-ad-generator
- https://higgsfield.ai/seedance/2.0

## General Prompting Rules for Seedance 2.0

- **Start with production specs:** Put shot count, total duration, aspect ratio, and format at the top. Example: `3 shots, 12 seconds total, 9:16 vertical, UGC Product Review.`
- **Name the format explicitly:** Use the Marketing Studio label verbatim: `UGC`, `Tutorial`, `Unboxing`, `Hyper Motion`, `Product Review`, `TV Spot`, `Wild Card`, `UGC Virtual Try-On`, or `Pro Virtual Try-On`.
- **Write in shot beats, not vibes:** Describe what the camera sees, what moves, what the product does, and what changes from shot to shot.
- **Use physical direction over adjectives:** Prefer `hands twist the cap, condensation beads slide down the can, camera pushes from 50mm medium to macro label detail` over `premium, exciting, cinematic`.
- **Keep one hero action per shot:** Each shot should have one main action: reveal, use, react, demonstrate, transform, compare, or hero-pack.
- **Give Seedance motion anchors:** Include camera movement, subject movement, object movement, and transition logic. Seedance performs best when each shot has a clear action path.
- **Use bracketed VFX notes inline:** Example: `[VFX: berry juice splashes orbit around the can, droplets collide and break into mist]`.
- **Specify audio when useful:** Seedance 2.0 supports generated audio, so include natural speech, voiceover, ambient sound, Foley, or music rhythm when the format benefits from it.
- **Use references deliberately:** For product fidelity, provide clean product images. For apparel, include front/back/detail garment references. For avatars, define face, hair, age range, styling, and attitude once, then ask to keep consistency across shots.
- **Avoid overloading a short clip:** For a 10-15 second generation, 3-5 shots usually works better than 8-10 micro-scenes unless the desired output is a high-speed montage.

## Descriptive Format Matrix

| Format | Best Use Case | What It Should Feel Like | Visual Language | Human / Avatar Role | Product Role | Camera & Motion | Audio / Dialogue Direction | Strong Inputs | Prompt Recipe | Avoid |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UGC** | TikTok/Reels-style creator testimonial, quick recommendation, problem-solution hook, creator ad that should feel native to the feed. | Real person, real recommendation, slightly imperfect and spontaneous. Should feel like someone filmed it on their phone because they genuinely use the product. | Selfie framing, bathroom/bedroom/kitchen/car/desk setting, natural light, imperfect handheld shake, face close to camera, product brought into frame by hand. | Primary storyteller. Avatar should look directly at camera, speak casually, smile/react, and handle the product naturally. | Proof object. Product appears early, is held near face or camera, and gets a believable use moment. | Handheld phone movement, small focus shifts, casual reframing, quick cut from face to product close-up and back to reaction. | Natural spoken line or voiceover: one hook, one benefit, one reaction. Room tone is acceptable. Avoid polished announcer voice. | Product image, avatar/person reference, target audience, one key claim, casual location. | `3 shots, 12 sec, 9:16, UGC. Shot 1: selfie medium close-up, avatar holds {product} near face and gives hook. Shot 2: handheld close-up showing {feature/use moment}. Shot 3: avatar reacts genuinely and gives short recommendation, product still visible.` | Overly cinematic lighting, perfect studio shots, corporate voiceover, complex VFX, too many product claims. |
| **Tutorial** | Step-by-step demo, app walkthrough, beauty routine, cooking prep, setup process, cleaning method, use instructions. | Helpful, clear, quick, friendly. The viewer should understand the process without pausing. | Top-down hands, over-shoulder views, split before/after framing, simple overlays if needed, stable surfaces, clean product visibility. | Instructor and demonstrator. Avatar speaks while performing actions or alternates between face and hands. | Tool used in sequence. Product should be touched, opened, applied, assembled, plugged in, scanned, poured, clicked, or otherwise demonstrated. | Stable phone/tripod shots, top-down table view, tight close-ups on hands, clean transitions between steps. | Conversational teaching voice. Include short step labels in dialogue: `First... next... then... done.` Foley can emphasize clicks, sprays, taps, pours. | Product image, exact process steps, final result, optional before-state image. | `4 shots, 15 sec, 9:16, Tutorial. Shot 1: instructor introduces {product} and final outcome. Shot 2: top-down hands perform step 1. Shot 3: close-up step 2 with clear hand motion. Shot 4: reveal final result with satisfied nod.` | Vague instructions, hidden product, fast cuts that skip the actual method, cinematic scenes that distract from learning. |
| **Unboxing** | New product launch, packaging reveal, premium first impression, influencer mailer, giftable item, tactile product story. | First-touch excitement with sensory detail. Feels like opening a package on camera for the first time. | Box on bed/table, hands ripping tape, tissue paper, dust bag, product emerging, macro detail, reaction shot. | Hands and reaction. Face can appear after reveal, but hands drive the story. | The hero reveal. Product should move from hidden package to full visibility, then to tactile close-up. | Close-up hand-held or tripod table framing, slow reveal pull, push-in to packaging texture, optional slow-motion product lift. | ASMR-inspired Foley: tape rip, cardboard fold, paper rustle, click, zipper, cap pop. Short gasp or delighted line works well. | Product image, packaging style, desired surface/background, mood such as luxury, cozy, techy, playful. | `3 shots, 12 sec, 9:16, Unboxing. Shot 1: sealed package on {surface}, hands enter frame. Shot 2: tape rips and box opens, packing material moves naturally. Shot 3: slow reveal of {product}, hands lift it toward camera, first delighted reaction.` | Showing the product too early, abstract packaging, no hand interaction, impossible packaging physics, overly long intro. |
| **Hyper Motion** | Premium CGI product hero, product launch teaser, beverage/beauty/tech/sneaker macro commercial, impossible motion, abstract product physics. | High-energy, polished, product as object of desire. No humans, no spoken pitch, all visual impact. | Pure CGI, macro surfaces, floating product, reflective studio floor, particles, liquid, smoke, fabric, glass, sparks, ingredients orbiting the product. | None. Human presence usually weakens this format unless used as a stylized silhouette. | Total hero. Product is centered, readable, and physically interacts with VFX elements. | Fast camera orbits, speed ramps, macro-to-wide reveals, product spins, collision effects, 240fps-feel slow motion, crisp hero pack shot. | Usually music, hits, whooshes, impacts, fizz, splash, bass drops. Avoid narration unless the brand needs it. | High-quality product image, label/packaging reference, material notes, desired VFX element, brand color accents. | `4 shots, 12 sec, 9:16, Hyper Motion, no people. Shot 1: macro detail of {product material}. Shot 2: product launches into mid-air as camera orbits. [VFX: {particles/liquid/ingredients} collide around it.] Shot 3: speed ramp into slow-motion impact/reveal. Shot 4: clean hero pack shot with readable label.` | People, handheld realism, cluttered rooms, unreadable labels, generic "cool CGI" without physical VFX instructions. |
| **Product Review** | Hands-on feature review, Amazon/TikTok shop proof, practical comparison, review-style conversion ad. | Authentic but product-led. Less about creator personality than usefulness and proof. | Phone-shot desk/counter setup, hands operating product, close-ups of features, visible before/after or feature result. | Secondary. Reviewer can appear at start/end or speak as voiceover while hands demonstrate. | Main subject. Product should be used on camera and shown from multiple practical angles. | Handheld or tabletop camera, close focus, small zooms on buttons/materials/results, less selfie than UGC. | Natural voiceover: `I tested this for...`, `What I like is...`, `Here is the result...`. Include realistic room tone. | Product image, feature list, proof point, environment, optional competitor/before-state. | `3 shots, 15 sec, 9:16, Product Review. Shot 1: handheld desk shot introducing {product}. Shot 2: close-up hands demonstrate {feature A}, show result. Shot 3: reviewer or hands show final verdict with product in frame.` | Glamour-only footage, no use case, scripted sales language, too much face time, claims without visual evidence. |
| **TV Spot** | Full brand ad, campaign concept, emotional story, lifestyle commercial, product narrative for website/paid social. | Broadcast-ready and memorable. Clear beginning, product moment, payoff, final brand image. | Cinematic real-world locations, controlled lighting, wardrobe, art direction, shallow depth of field, professional grading, 35mm/ARRI-style texture if desired. | Character in a short story. Avatar is actor, not influencer. They interact with the product inside a scene. | Story catalyst or solution. Product should appear at a narrative turning point and end in a clean hero shot. | Dollys, cranes, steadicam, tracking shots, motivated cuts, wide-to-medium-to-close coverage, cinematic transitions. | Music bed, sparse dialogue or VO, ambient sound. Copy should be concise and brand-like. | Product image, target audience, location, emotional premise, tagline, brand color/lighting notes. | `5 shots, 15 sec, 16:9 or 9:16, TV Spot. Shot 1: cinematic wide establishes {location/problem}. Shot 2: character notices/uses {product}. Shot 3: action payoff shows benefit. Shot 4: emotional reaction or lifestyle moment. Shot 5: hero pack shot with tagline.` | UGC selfie framing, too many spoken claims, unclear story arc, product disappearing after the first shot, excessive VFX unless concept-driven. |
| **Wild Card** | Experimental ad, surreal concept, AI-directed campaign variation, surprising social creative, product-as-fantasy scenario. | Unexpected, inventive, high-concept. The AI can invent characters, locations, action, VFX, and transitions around the product. | Anything from surreal domestic comedy to fantasy worlds, dream logic, impossible scale changes, abstract transitions, cinematic spectacle. | Flexible. Can be protagonist, comic foil, narrator, model, or absent entirely. | Anchor object. The product must remain recognizable even as the scenario becomes strange. | Bigger visual leaps, match cuts, transformations, scale jumps, expressive VFX, montage energy. | Can include dramatic music, surreal sound design, minimal dialogue, or a punchline line. | Product image, brand boundaries, desired level of weirdness, one non-negotiable product truth. | `4 shots, 15 sec, 9:16, Wild Card. Create a surprising scenario around {product}. Keep product recognizable in every shot. Invent the setting, camera, and VFX. End with a clean hero image and short tagline.` | Leaving product unrecognizable, random unrelated imagery, vague "surprise me" with no brand boundary, too many characters. |
| **UGC Virtual Try-On** | Apparel try-on haul, mirror outfit check, fit reaction, fashion/accessory social ad, "try before you buy" content. | Casual home try-on. Feels like a creator checking fit in a bedroom mirror and reacting honestly. | Bedroom, mirror, closet, phone held at chest/face height, simple poses, spin, fabric close-ups, natural home lighting. | Wearer and reviewer. Avatar shows fit from front/side/back and reacts to comfort/style. | Garment/accessory on body. Product must keep shape, drape, texture, and placement consistent. | Mirror selfie, small steps, spin, hand smoothing fabric, close-up detail, quick pose sequence. | Casual spoken reaction: fit, texture, sizing, comfort, styling note. Ambient home sound is fine. | Garment reference images, size/fit notes, model body/styling constraints, room vibe. | `4 shots, 12 sec, 9:16, UGC Virtual Try-On. Shot 1: mirror selfie wearing {garment}. Shot 2: slow spin showing front and back fit. Shot 3: close-up hand touches fabric/detail. Shot 4: face-to-camera reaction with styling comment.` | Runway/editorial energy, unrealistic fabric behavior, garment changing shape/color, hidden full-body view. |
| **Pro Virtual Try-On** | Premium fashion ad, streetwear launch, editorial apparel motion, accessories in lifestyle context, cinematic lookbook. | Street-style editorial with product in motion. More fashion campaign than bedroom haul. | Urban architecture, crosswalks, storefronts, concrete, glass, golden hour or flash fashion lighting, confident posing. | Model. Avatar carries attitude through walking, turning, leaning, posing. Less talking, more movement. | Fashion hero. Product must be visible during motion and in detail close-up. | Tracking shots, low-angle walk-by, whip pan, scale jump, slow-motion fabric movement, editorial close-up. | Music-forward. Minimal dialogue or no dialogue. Sound can include footsteps, city ambience, fabric movement. | Garment/accessory images, model styling, location, moodboard words, brand level. | `4 shots, 15 sec, 9:16, Pro Virtual Try-On. Shot 1: tracking shot of model walking through {urban location} wearing {product}. Shot 2: editorial pose against architecture. Shot 3: close-up of product moving with body. Shot 4: slow-motion turn into confident hero look.` | Bedroom mirror framing, spoken review format, unclear garment details, busy backgrounds that obscure fit. |

## Format Selection Guidance

| Goal | Best Format | Why |
| :--- | :--- | :--- |
| Make the ad feel native to TikTok or Reels | UGC | The selfie camera, natural speech, and informal setting mimic creator content. |
| Teach viewers how the product works | Tutorial | The format prioritizes ordered steps, hands, and a visible final result. |
| Sell packaging, gifting, or premium first impression | Unboxing | The reveal sequence creates anticipation and tactile appeal. |
| Make a product look expensive without people | Hyper Motion | CGI motion, macro detail, and VFX turn the product into the entire spectacle. |
| Prove practical value | Product Review | Hands-on shots and voiceover make features feel testable. |
| Build brand memory or campaign storytelling | TV Spot | Narrative structure and professional camera language make the output feel like an ad campaign. |
| Generate surprising creative variations | Wild Card | It lets the model invent scenarios while using the product as the anchor. |
| Sell apparel with creator-style authenticity | UGC Virtual Try-On | Home setting and mirror/selfie behavior feel like a try-on haul. |
| Sell apparel with fashion campaign polish | Pro Virtual Try-On | Street tracking, editorial posing, and no-talk styling make it feel premium. |

## Universal Seedance 2.0 Prompt Skeleton

```text
{shot_count} shots, {duration} seconds total, {aspect_ratio}, {Marketing Studio format}.
Product: {product_name}, {short product description}.
References: use the uploaded product image(s) for exact shape, color, label, logo, and material.
Audience: {target audience}.
Creative goal: {awareness / demo / conversion / launch / social proof}.
Visual style: {phone-shot / cinematic / pure CGI / editorial / surreal}.
Audio: {natural speech / voiceover / music / Foley / no dialogue}.

Shot 1 ({seconds}s): {camera framing + subject + product + action + audio}.
Shot 2 ({seconds}s): {camera framing + subject + product + action + audio}.
Shot 3 ({seconds}s): {camera framing + subject + product + action + audio}.
Final frame: {hero product / CTA / tagline / logo-safe composition}.
Constraints: keep product accurate and readable, maintain consistent avatar/garment, no extra logos, no distorted text.
```

## Format-Specific Prompt Templates

### UGC

```text
3 shots, 12 seconds total, 9:16 vertical, UGC.
Phone-shot selfie ad for {product}. Natural creator energy, casual indoor lighting, direct eye contact.
Audio: creator speaks casually with light room tone.

Shot 1 (4s): selfie medium close-up, creator holds {product} near face and says the hook: "{short hook}".
Shot 2 (4s): handheld close-up of hands using {product}; show {feature/result} clearly.
Shot 3 (4s): creator reacts genuinely, smiles, and gives one concise recommendation while product remains visible.
Constraints: believable iPhone footage, natural hand motion, no polished studio commercial look.
```

### Tutorial

```text
4 shots, 15 seconds total, 9:16 vertical, Tutorial.
Friendly step-by-step demo for {product}. Person talks and demonstrates at the same time.
Audio: clear instructional voice, subtle Foley for taps/clicks/pours.

Shot 1 (3s): instructor introduces {product} and shows the desired final result.
Shot 2 (4s): top-down hands perform step 1: {step_1}; product stays centered and readable.
Shot 3 (4s): close-up hands perform step 2: {step_2}; show the important detail.
Shot 4 (4s): final result reveal, instructor gives one finishing tip.
Constraints: each step must be visually understandable, no skipped hand actions.
```

### Unboxing

```text
3 shots, 12 seconds total, 9:16 vertical, Unboxing.
First-touch product reveal for {product}, filmed on {surface} in {room/location}.
Audio: tape rip, cardboard fold, paper rustle, small delighted reaction.

Shot 1 (3s): sealed package on table/bed, hands slide it into frame.
Shot 2 (5s): hands rip tape and open package; packing material moves naturally.
Shot 3 (4s): slow reveal of {product}; hands lift it toward camera, macro detail on {feature/material}.
Constraints: do not show the product before the reveal, keep packaging physics realistic.
```

### Hyper Motion

```text
4 shots, 12 seconds total, 9:16 vertical, Hyper Motion, pure CGI, no people.
Premium product hero ad for {product}. Exact product shape, color, label, and materials from reference image.
Audio: music hit, whooshes, impacts, product-specific Foley.

Shot 1 (2s): extreme macro of {product material/detail}, camera glides across surface.
Shot 2 (3s): product spins in mid-air under studio lighting. [VFX: {particles/liquid/ingredients} orbit and collide around product.]
Shot 3 (4s): speed ramp into slow-motion impact or transformation: {physical event}.
Shot 4 (3s): clean hero pack shot, product front-facing and readable, VFX settles around it.
Constraints: product is always the hero, no humans, no unreadable label, no extra branding.
```

### Product Review

```text
3 shots, 15 seconds total, 9:16 vertical, Product Review.
Authentic phone-shot review of {product} in a real {desk/kitchen/bathroom/living room} setting.
Audio: natural voiceover, practical and unscripted.

Shot 1 (4s): handheld shot of {product} on {surface}; reviewer introduces what they tested.
Shot 2 (7s): close-up hands use {feature A}; show visible result or before/after proof.
Shot 3 (4s): reviewer gives final verdict while holding product; end with product clearly framed.
Constraints: product-led, hands-on proof, no glossy TV commercial style.
```

### TV Spot

```text
5 shots, 15 seconds total, {9:16 vertical or 16:9 horizontal}, TV Spot.
Cinematic brand ad for {product}. Story premise: {one-sentence narrative}.
Audio: music bed, sparse voiceover, cinematic ambience.

Shot 1 (3s): cinematic wide shot establishes {location} and {problem/desire}.
Shot 2 (3s): character enters and notices/uses {product}; camera moves with purpose.
Shot 3 (3s): product creates the key transformation/benefit: {benefit}.
Shot 4 (3s): emotional payoff with character reaction or lifestyle result.
Shot 5 (3s): polished hero pack shot with tagline: "{tagline}".
Constraints: professional camera work, coherent story arc, product visible at turning point and final frame.
```

### Wild Card

```text
4 shots, 15 seconds total, 9:16 vertical, Wild Card.
Create a surprising AI-directed ad around {product}. Tone: {surreal/comedic/luxury/action/fantasy}.
Audio: imaginative sound design and music, minimal dialogue unless useful.

Shot 1: invent a hook scenario where {product} appears immediately.
Shot 2: escalate with an unexpected location, character, or physical transformation.
Shot 3: show {product benefit or brand idea} through a visually surprising action. [VFX: AI-directed, but product remains recognizable.]
Shot 4: end on a clean hero product image and short tagline.
Constraints: product must remain recognizable in every shot; stay within {brand boundaries}.
```

### UGC Virtual Try-On

```text
4 shots, 12 seconds total, 9:16 vertical, UGC Virtual Try-On.
Casual try-on haul for {garment/accessory}. Home bedroom mirror setting, natural lighting.
Audio: wearer gives casual fit reaction and styling comment.

Shot 1 (3s): mirror selfie full-body view wearing {product}; phone visible in hand.
Shot 2 (3s): wearer turns slowly to show front, side, and back fit; fabric moves naturally.
Shot 3 (3s): close-up hand touches {fabric/detail/zipper/stitching}; show texture.
Shot 4 (3s): face-to-camera or mirror reaction: comfort, fit, and styling note.
Constraints: keep garment color, cut, drape, and placement consistent.
```

### Pro Virtual Try-On

```text
4 shots, 15 seconds total, 9:16 vertical, Pro Virtual Try-On.
Street-style editorial fashion ad for {garment/accessory}. Location: {urban architecture/street/cafe/storefront}.
Audio: music-forward, city ambience, no dialogue.

Shot 1 (4s): tracking shot of model walking confidently wearing {product}; product visible in motion.
Shot 2 (4s): editorial pose against {background}; camera pushes in.
Shot 3 (3s): close-up detail of {product} moving with body; fabric/metal/leather reacts realistically.
Shot 4 (4s): slow-motion turn into final hero look, clean frame for brand/logo.
Constraints: fashion campaign polish, no bedroom mirror/selfie framing, garment remains accurate.
```

## Strong Product Variables To Capture Before Prompting

| Variable | Why It Matters | Example |
| :--- | :--- | :--- |
| Product category | Determines natural format fit and action logic. | Skincare favors UGC/Tutorial; soda favors Hyper Motion/TV Spot; apparel favors Try-On. |
| Physical interaction | Gives the model believable movement. | Pour, zip, twist, spray, tap, blend, open, wear, apply, fold. |
| Hero sensory cue | Makes shots specific and memorable. | Condensation, leather grain, fabric stretch, glass clink, powder puff, screen glow. |
| Key proof point | Keeps ad from becoming pure aesthetics. | Faster setup, smoother texture, better fit, brighter screen, compact size. |
| Environment | Makes the format legible. | Bathroom for skincare UGC, kitchen for appliance tutorial, city street for Pro Try-On. |
| Audio identity | Seedance can produce synced sound; use it. | ASMR unboxing, friendly tutorial voice, bass-drop CGI, cinematic music. |
| Final frame | Gives the model a useful ending target. | Front-facing pack shot, creator holding product, garment pose, logo-safe hero frame. |

## Quick Copy Hooks By Format

| Format | Hook Style | Example |
| :--- | :--- | :--- |
| UGC | Personal discovery | `I did not expect this to work this fast.` |
| Tutorial | Outcome-first | `Here is the easiest way to get {result} in under a minute.` |
| Unboxing | Anticipation | `Okay, this packaging is already better than I expected.` |
| Hyper Motion | Visual spectacle | No spoken hook; open with macro impact or impossible motion. |
| Product Review | Test-based proof | `I used this for {time/use case}, and here is what surprised me.` |
| TV Spot | Emotional premise | `For the days when {problem/desire}, meet {product}.` |
| Wild Card | Conceptual surprise | `What if {product} could turn {ordinary moment} into {impossible moment}?` |
| UGC Virtual Try-On | Fit reaction | `Wait, the fit is actually so good.` |
| Pro Virtual Try-On | Editorial confidence | No spoken hook; lead with motion, silhouette, and attitude. |
