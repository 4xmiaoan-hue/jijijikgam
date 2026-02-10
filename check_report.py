
from playwright.sync_api import sync_playwright
import sys

def check_page(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err.message}"))

        print(f"Navigating to {url}...")
        try:
            page.goto(url, timeout=30000)
            page.wait_for_load_state('networkidle')
            
            print(f"Title: {page.title()}")
            print(f"URL: {page.url}")
            
            # Check for common error text
            content = page.content()
            if "Service is unavailable" in content:
                print("FOUND: 'Service is unavailable' in page content")
            elif "리포트 조회 실패" in content:
                print("FOUND: '리포트 조회 실패' in page content")
            
            # Take screenshot
            page.screenshot(path="debug_screenshot.png")
            print("Screenshot saved to debug_screenshot.png")
            
        except Exception as e:
            print(f"Error navigating: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    url = "http://localhost:5173/report/4594a95df15793cd58609aa698d81b7eec25dda4733320fce1ab86c06aeea2ab"
    check_page(url)
