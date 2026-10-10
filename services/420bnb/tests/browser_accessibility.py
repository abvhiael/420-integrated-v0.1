"""Browser accessibility smoke for BnB host preview (no live Identity authority)."""
from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright, expect

PAGE = Path(__file__).resolve().parents[3] / "web" / "bnb" / "index.html"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(PAGE.as_uri())
    assert page.get_by_role("heading", name="Stay a little longer.").count() == 1
    assert page.get_by_role("navigation", name="Main").count() == 1
    assert page.locator("form").count() >= 2
    assert page.get_by_role("button", name="Save unpublished draft").is_disabled()
    assert page.get_by_role("button", name="Refresh drafts").is_disabled()
    assert page.get_by_label("Property title").count() == 1
    assert page.get_by_label("Public region (not street address)").count() == 1
    assert page.get_by_label("420Identity signed session token (held only in memory; never saved)").count() == 1
    page.get_by_role("button", name="Clear session").click()
    assert "Not signed in." in page.locator("#host-status").inner_text()
    assert not errors, errors
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement !== document.body")
    axe = subprocess.check_output(["node","-p","require.resolve('axe-core/axe.min.js')"],text=True).strip()
    for width,height in ((390,844),(1366,768)):
        page.set_viewport_size({"width":width,"height":height})
        page.add_script_tag(content=Path(axe).read_text())
        report=page.evaluate("async () => axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})")
        assert not report["violations"],[(v["id"],v["nodes"][0]["target"]) for v in report["violations"]]
    # Browser journeys with deterministic API stubs; no external Identity
    # authority or manual screen-reader acceptance is simulated as genuine.
    session=browser.new_page(viewport={"width":390,"height":844})
    listing_id="00000000-0000-0000-0000-000000000123"
    def stub(route):
        url=route.request.url
        if url.endswith("/"):
            route.fulfill(status=200,content_type="text/html",body=PAGE.read_text())
        elif url.endswith("/v1/bnb/listings"):
            route.fulfill(json=[{"id":listing_id,"title":"Accessible cabin","public_region":"Prairies",
                                 "capacity":2,"nightly_minor":1000,"currency":"CAD"}])
        elif "/v1/bnb/availability/local?" in url:
            route.fulfill(json={"units":[{"label":"Suite A","available":2}],"nonbinding":True})
        elif url.endswith("/v1/bnb/account/session"):
            route.fulfill(status=201,json={"session_id":"test-session-id","subject":"fixture-host"})
        elif url.endswith("/v1/bnb/account/properties"):
            if route.request.method=="GET":
                route.fulfill(json=[{"id":listing_id,"title":"Draft cabin",
                                     "public_region":"Prairies","status":"draft","version":1}])
            else:route.fulfill(status=201,json={"id":listing_id,"status":"draft","version":1})
        elif url.endswith("/v1/bnb/account/properties/"+listing_id+"/units"):
            route.fulfill(json=[] if route.request.method=="GET" else {"id":"fixture-unit","version":2})
        elif url.endswith("/v1/bnb/account/properties/"+listing_id+"/reviews"):
            route.fulfill(json=[])
        else:route.fulfill(status=404,json={"detail":"NOT_FOUND"})
    session.route("http://bnb.test/**",stub)
    session.goto("http://bnb.test/")
    session.get_by_role("button",name="Refresh public listings").click()
    expect(session.get_by_role("heading",name="Accessible cabin")).to_have_count(1)
    section=session.locator("#explore")
    section.get_by_label("Check-in date").fill("2027-02-10")
    section.get_by_label("Check-out date").fill("2027-02-12")
    section.get_by_role("button",name="Check availability").click()
    expect(section).to_contain_text("2 available")
    session.get_by_label("420Identity signed session token (held only in memory; never saved)").fill("test-fixture-only")
    session.get_by_role("button",name="Verify session").click()
    expect(session.get_by_role("button",name="Save unpublished draft")).to_be_enabled()
    session.get_by_role("button",name="Refresh drafts").click()
    expect(session.get_by_role("heading",name="Draft cabin")).to_have_count(1)
    assert session.get_by_label("Minimum stay in nights").count()==1
    session.get_by_role("button",name="Clear session").click()
    expect(session.get_by_role("button",name="Save unpublished draft")).to_be_disabled()
    session.close()
    browser.close()
