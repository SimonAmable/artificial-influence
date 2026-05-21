from pathlib import Path

path = Path(__file__).with_name("tiktok-trend-search-tool.tsx")
text = path.read_text(encoding="utf-8")

card_tail_lines = [
    "          <div>",
    '            <p className="text-4xl font-semibold">{formatCount(video.stats.views)} views</p>',
    '            <div className="mt-6 space-y-3 text-muted-foreground">',
    '              <p className="flex items-center gap-2">',
    '                <ChatCircleDots className="size-4" />',
    "                {formatCount(video.stats.comments)}",
    "              </p>",
    '              <p className="flex items-center gap-2">',
    '                <Heart className="size-4 text-rose-200" />',
    "                {formatCount(video.stats.likes)}",
    "              </p>",
    '              <p className="flex items-center gap-2">',
    '                <BookmarkSimple className="size-4" />',
    "                {formatCount(video.stats.saves)}",
    "              </p>",
    '              <p className="flex items-center gap-2">',
    '                <ShareFat className="size-4" />',
    "                {formatCount(video.stats.shares)}",
    "              </p>",
    "            </div>",
    "          </motionTarget.startsWith(\"http\") ? (",
]

# Fix the erroneous line above - use closing div not motionTarget
card_tail_lines[-1] = "          </div>"
card_tail_lines.extend(
    [
        "",
        '          <div className="space-y-1 text-[11px] text-muted-foreground">',
        '            <p className="text-base font-semibold text-white">{video.authorDisplayName}</p>',
        '            <p>{video.authorUsername ? `@${video.authorUsername}` : "creator"}</p>',
        '            <p className="line-clamp-3 text-muted-foreground/70">{video.caption ?? "Untitled TikTok clip"}</p>',
        '            <div className="flex flex-wrap gap-2 pt-2 text-[10px] uppercase tracking-wide">',
        '              <Badge variant="secondary" className="border border-white/20 bg-white/10 text-white">',
        "                {video.createTimeISO ?? \"recent\"}",
        "              </Badge>",
        "              {video.webVideoUrl ? (",
        '                <Badge variant="outline" className="border border-white/20 text-[10px] text-white">',
        "                  TikTok",
        "                </Badge>",
        "              ) : null}",
        "            </div>",
        "          </div>",
        "",
        '          <div className="mt-auto flex flex-wrap gap-2">',
        "            <Button",
        '              variant="outline"',
        '              size="sm"',
        "              disabled={!video.webVideoUrl}",
        '              type="button"',
        '              onClick={() => void clipboard("Clip URL", video.webVideoUrl ?? "")}',
        '              className="border-white/20 text-white hover:bg-white/10"',
        "            >",
        '              <Copy className="mr-2 size-3.5" />',
        "              Copy TikTok URL",
        "            </Button>",
        '            {motionTarget.startsWith("http") ? (',
        '              <Button variant="outline" size="sm" type="button" asChild className="text-white hover:bg-white/10">',
        "                <Link href={buildMotionHref(motionTarget)} prefetch={false}>",
        '                  <FilmStrip className="mr-2 size-3.5" />',
        "                  Use in Motion Control",
        "                </Link>",
        "              </Button>",
        "            ) : null}",
        "            {canOpenViewer ? (",
        "              <Button",
        '                variant="outline"',
        '                size="sm"',
        '                type="button"',
        '                className="border-white/20 text-white hover:bg-white/10"',
        "                onClick={(event) => {",
        "                  event.stopPropagation()",
        "                  openViewer()",
        "                }}",
        "              >",
        '                <ArrowsOut className="mr-2 size-3.5" />',
        "                Full screen",
        "              </Button>",
        "            ) : null}",
        "            {video.webVideoUrl ? (",
        '              <Button size="sm" variant="ghost" type="button" asChild className="text-white">',
        '                <a href={video.webVideoUrl} target="_blank" rel="noreferrer">',
        "                  Watch on TikTok",
        "                </a>",
        "              </Button>",
        "            ) : null}",
        "          </div>",
    ]
)

card_tail = "\n".join(card_tail_lines)

start_marker = '        <div className="flex flex-col gap-6 p-6 text-sm">\n'
end_marker = "\n        </motionTarget.startsWith"

# Actually end before closing card - find corrupted block
start = text.find(start_marker)
end = text.find("\n        </motionTarget.startsWith", start)
if start == -1:
    # try current corruption
    start = text.find('        <div className="flex flex-col gap-6 p-6 text-sm">\n')
end = text.find("\n          </motionTarget.startsWith", start)
if start == -1:
    raise SystemExit("start not found")
# find end at actions closing - line before `          </motionTarget.startsWith` or `          </div>\n        </motionTarget.startsWith`
end_candidates = [
    text.find("\n          </motionTarget.startsWith", start),
    text.find("\n          </div>\n        </motionTarget.startsWith", start),
]
end = next((e for e in end_candidates if e != -1), -1)
if end == -1:
    end = text.find("\n          </div>\n        </motionTarget.startsWith", start)
if end == -1:
    end = text.find("\n          </div>\n        </motionTarget.startsWith", start)
if end == -1:
    # fallback: find duplicate actions end before CardContent close
    end = text.find("\n          </div>\n        </motionTarget.startsWith", start)
if end == -1:
    end = text.find("\n          </div>\n        </motionTarget.startsWith", start)
if end == -1:
    end = text.find("\n          </div>\n        </motionTarget.startsWith", start)

# Simpler: replace from `          <motionTarget.startsWith` after flex-col to `          </div>\n        </motionTarget.startsWith` before outer close
bad_start = text.find("        <div className=\"flex flex-col gap-6 p-6 text-sm\">\n          <motionTarget.startsWith")
if bad_start == -1:
    bad_start = text.find('        <motionTarget.startsWith("http") ? (')
if bad_start == -1:
    bad_start = text.find('        <motionTarget.startsWith("http") ? (')
if bad_start == -1:
    bad_start = text.find('        <motionTarget.startsWith("http") ? (')
if bad_start == -1:
    bad_start = text.find('        <motionTarget.startsWith("http") ? (')
if bad_start == -1:
    bad_start = text.find('        <motionTarget.startsWith("http") ? (')

print("bad_start", bad_start)
print("snippet", repr(text[bad_start:bad_start+80] if bad_start != -1 else "missing"))
