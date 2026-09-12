#!/usr/bin/env python3
"""Inject visible DOC-13 version context and a fail-closed selector into built 420Docs HTML."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BANNER_STYLE = """
<style id="doc-version-selector-style">
.doc-version-context{box-sizing:border-box;width:100%;padding:.55rem .9rem;font-size:.72rem;line-height:1.35;border-bottom:1px solid var(--md-default-fg-color--lightest);background:var(--md-default-bg-color);color:var(--md-default-fg-color)}
.doc-version-context__inner{max-width:61rem;margin:0 auto;display:flex;gap:.7rem;align-items:center;flex-wrap:wrap}
.doc-version-context__label{font-weight:700}
.doc-version-context select{font:inherit;max-width:18rem;padding:.18rem .35rem}
.doc-version-context__note{opacity:.72}
</style>
""".strip()

SCRIPT = r"""
<script id="doc-version-selector-script">
(function(){
  const root=document.getElementById('doc-version-context');
  if(!root)return;
  const select=root.querySelector('select');
  const note=root.querySelector('.doc-version-context__note');
  const inventory=JSON.parse(root.dataset.inventory||'[]');
  const currentPath=(location.pathname.replace(/^\/+|\/+$/g,'')||'index.html').replace(/\/index\.html$/,'/').replace(/^index\.html$/,'');
  const logical=currentPath.replace(/^versions\/[^/]+\/[^/]+\//,'');
  for(const opt of select.options){
    if(!opt.value)continue;
    const template=opt.dataset.route;
    const available=inventory.includes(logical)||inventory.includes(logical.replace(/\/$/,'')+'.html')||inventory.includes(logical.replace(/\/$/,'')+'/');
    if(!template||!available){opt.disabled=true;opt.textContent += ' — page unavailable';}
  }
  select.addEventListener('change',function(){
    const opt=this.options[this.selectedIndex];
    if(!opt.value||opt.disabled)return;
    const target=opt.dataset.route.replace('{path}',logical);
    location.assign(target.startsWith('/')?target:'/'+target);
  });
  if(note && location.pathname.indexOf('/versions/')===-1){note.textContent='compatibility URL; immutable release is not implied';}
})();
</script>
""".strip()


def load_context(site_dir: Path) -> dict:
    path = site_dir / "version-context.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError("version-context.json must contain an object")
    return value


def option_rows(context: dict) -> str:
    rows = ['<option value="">Select documentation context</option>']
    for track_name, track in sorted(context.get("tracks", {}).items()):
        if not isinstance(track, dict):
            continue
        environment = str(track.get("environment", track_name))
        current_route = track.get("current_route")
        current = track.get("current")
        if isinstance(current_route, str) and isinstance(current, str):
            rows.append(
                '<option value="{value}" data-route="{route}">{label}</option>'.format(
                    value=html.escape(f"{environment}/current", quote=True),
                    route=html.escape(current_route, quote=True),
                    label=html.escape(f"{environment} / current → {current}"),
                )
            )
        for release in track.get("releases", []):
            if not isinstance(release, dict) or not release.get("immutable"):
                continue
            release_id = release.get("id")
            route = release.get("path_template")
            if isinstance(release_id, str) and isinstance(route, str):
                rows.append(
                    '<option value="{value}" data-route="{route}">{label}</option>'.format(
                        value=html.escape(f"{environment}/{release_id}", quote=True),
                        route=html.escape(route, quote=True),
                        label=html.escape(f"{environment} / {release_id}"),
                    )
                )
    return "\n".join(rows)


def inventory_for_client(context: dict) -> list[str]:
    inventory = context.get("page_inventory", [])
    return sorted({str(item) for item in inventory if isinstance(item, str)})


def banner(context: dict) -> str:
    inventory_json = html.escape(json.dumps(inventory_for_client(context), separators=(",", ":")), quote=True)
    return (
        BANNER_STYLE
        + '\n<div id="doc-version-context" class="doc-version-context" data-inventory="'
        + inventory_json
        + '"><div class="doc-version-context__inner">'
        + '<span class="doc-version-context__label">420Docs context</span>'
        + '<select aria-label="Documentation version and environment">'
        + option_rows(context)
        + '</select><span class="doc-version-context__note"></span></div></div>\n'
        + SCRIPT
    )


def inject(path: Path, markup: str) -> bool:
    text = path.read_text(encoding="utf-8")
    if 'id="doc-version-context"' in text:
        return False
    match = re.search(r"<body(?:\s[^>]*)?>", text, flags=re.IGNORECASE)
    if not match:
        raise RuntimeError(f"no <body> tag in {path}")
    updated = text[: match.end()] + "\n" + markup + "\n" + text[match.end() :]
    path.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-dir", default="site")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    site_dir = Path(args.site_dir)
    if not site_dir.is_absolute():
        site_dir = ROOT / site_dir
    try:
        context = load_context(site_dir)
        pages = sorted(site_dir.rglob("*.html"))
        if not pages:
            raise RuntimeError(f"no built HTML pages found under {site_dir}")
        markup = banner(context)
        if args.check:
            enabled = sum(1 for line in option_rows(context).splitlines() if 'data-route=' in line)
            print(f"420Docs version selector PASS: {len(pages)} built page(s); {enabled} registry-backed choice(s)")
            return 0
        changed = sum(1 for path in pages if inject(path, markup))
    except (OSError, RuntimeError) as exc:
        print(f"420Docs version selector ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"420Docs version selector PASS: injected {changed} page(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
