"""Browser accessibility smoke for BnB host preview (no live Identity authority)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGE = Path(__file__).resolve().parents[3] / "web" / "bnb" / "index.html"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(PAGE.as_uri())
    assert page.get_by_role("heading", name="Stay a little longer.").count() == 1
    assert page.get_by_role("navigation", name="Main").count() == 1
    assert page.get_by_role("form").count() >= 1
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
    browser.close()
