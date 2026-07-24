/**
 * Shared Phosphor icon registry for product navigation surfaces
 * (mega menu, mobile sheet, dashboard tools, search rows).
 */
import {
  ArrowsOut,
  Broom,
  CalendarDots,
  ChatCircleDots,
  ClockCounterClockwise,
  CornersIn,
  CurrencyDollar,
  DownloadSimple,
  FileArrowDown,
  FilmStrip,
  Folder,
  Image as ImageIcon,
  Images,
  MagnifyingGlass,
  Microphone as MicrophoneIcon,
  Newspaper,
  PaintBrush as PaintBrushIcon,
  Palette,
  PaperPlaneTilt,
  PersonSimpleRun,
  Robot as RobotIcon,
  SquaresFour,
  Stack,
  Toolbox,
  TreeStructure,
  User as UserIcon,
  UserFocus,
  UserSwitch,
  Video as VideoIcon,
  Wrench,
  type Icon,
} from "@phosphor-icons/react"

export type NavIconKey =
  | "chat-circle-dots"
  | "robot"
  | "stack"
  | "squares-four"
  | "image"
  | "images"
  | "user-switch"
  | "user-focus"
  | "user"
  | "paint-brush"
  | "arrows-out"
  | "broom"
  | "corners-in"
  | "video"
  | "film-strip"
  | "person-simple-run"
  | "microphone"
  | "download-simple"
  | "magnifying-glass"
  | "wrench"
  | "file-arrow-down"
  | "folder"
  | "clock-counter-clockwise"
  | "newspaper"
  | "tree-structure"
  | "toolbox"
  | "paper-plane-tilt"
  | "calendar-dots"
  | "currency-dollar"
  | "palette"

export type NavIconComponent = Icon

export const NAV_ICON_MAP: Record<NavIconKey, NavIconComponent> = {
  "chat-circle-dots": ChatCircleDots,
  robot: RobotIcon,
  stack: Stack,
  "squares-four": SquaresFour,
  image: ImageIcon,
  images: Images,
  "user-switch": UserSwitch,
  "user-focus": UserFocus,
  user: UserIcon,
  "paint-brush": PaintBrushIcon,
  "arrows-out": ArrowsOut,
  broom: Broom,
  "corners-in": CornersIn,
  video: VideoIcon,
  "film-strip": FilmStrip,
  "person-simple-run": PersonSimpleRun,
  microphone: MicrophoneIcon,
  "download-simple": DownloadSimple,
  "magnifying-glass": MagnifyingGlass,
  wrench: Wrench,
  "file-arrow-down": FileArrowDown,
  folder: Folder,
  "clock-counter-clockwise": ClockCounterClockwise,
  newspaper: Newspaper,
  "tree-structure": TreeStructure,
  toolbox: Toolbox,
  "paper-plane-tilt": PaperPlaneTilt,
  "calendar-dots": CalendarDots,
  "currency-dollar": CurrencyDollar,
  palette: Palette,
}

export function getNavIcon(key: NavIconKey): NavIconComponent {
  return NAV_ICON_MAP[key]
}
