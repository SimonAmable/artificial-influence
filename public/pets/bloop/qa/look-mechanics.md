# Bloop look mechanics

Bloop is a soft, glossy jelly blob. Its lower body stays planted on a stable baseline while the upper crown and face area gently stretch toward the direction of attention. The black button eyes act as small physical beads embedded in the jelly: their spacing, highlights, and visible placement move together with the face surface rather than sliding independently. The mouth and side lobes follow with a smaller delayed deformation. The whole sprite never rotates or tilts as a rigid object.

## Cardinal pose families

- **000 up:** eyes and smile lift toward the crown; the crown lengthens slightly upward while the base remains broad and anchored.
- **090 screen-right:** the face surface and upper crown lean and stretch toward the viewer's right; the right side lobe is slightly more visible and the left side compresses.
- **180 down:** eyes and smile settle lower on the face; the upper crown compresses gently and the lower body broadens, while preserving the anchored base.
- **270 screen-left:** mirror of the screen-right family: face surface and upper crown lean toward the viewer's left; the left lobe becomes slightly more visible and the right side compresses.

## Interpolation and motion budget

Each 22.5-degree step advances eye placement, crown stretch, face-surface lean, and side-lobe visibility by a similarly small amount. Diagonals combine both relevant cardinal cues. The body height, apparent width, and baseline remain stable enough to prevent popping. The final 337.5 pose must read as one step before the approved 000 up pose.
