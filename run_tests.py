import http.server
import socketserver
import threading
import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.edge.options import Options as EdgeOptions

# 1. Start HTTP Server on port 8765
PORT = 8765
Handler = http.server.SimpleHTTPRequestHandler

class QuietHandler(Handler):
    def log_message(self, format, *args):
        pass

server = socketserver.TCPServer(('127.0.0.1', PORT), QuietHandler)
server_thread = threading.Thread(target=server.serve_forever)
server_thread.daemon = True
server_thread.start()
print(f'Server running at http://127.0.0.1:{PORT}')

# 2. Configure headless Edge
options = EdgeOptions()
options.add_argument('--headless')
options.add_argument('--disable-gpu')
options.add_argument('--window-size=1920,1080')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

driver = webdriver.Edge(options=options)
driver.get(f'http://127.0.0.1:{PORT}/index.html')
time.sleep(2)

print('Page title:', driver.title)

# Check total slides count (11 core + 5 viva + 1 takeaway = 17)
slides = driver.find_elements(By.CSS_SELECTOR, '.slide')
print('Total slides found:', len(slides))
assert len(slides) == 17, f'Expected 17 slides, found {len(slides)}'

# Helper to get current presenter state
def get_state():
    return driver.execute_script('''
        return {
            slideIndex: window.presentation.currentSlideIndex,
            step: window.presentation.currentStep,
            maxSteps: window.presentation.slideStepCounts[window.presentation.currentSlideIndex]
        };
    ''')

state = get_state()
print('Initial state:', state)
assert state['slideIndex'] == 0 and state['step'] == 0

body = driver.find_element(By.TAG_NAME, 'body')

# Test Spacebar advance
body.send_keys(Keys.SPACE)
time.sleep(0.4)
state = get_state()
print('After 1 Spacebar:', state)
assert state['slideIndex'] == 0 and state['step'] == 1

body.send_keys(Keys.SPACE)
time.sleep(0.4)
state = get_state()
print('After 2 Spacebars:', state)
assert state['slideIndex'] == 0 and state['step'] == 2

# Advance to slide 1 (Slide 2), step 0
body.send_keys(Keys.SPACE)
time.sleep(0.5)
state = get_state()
print('After 3 Spacebars (next slide):', state)
assert state['slideIndex'] == 1 and state['step'] == 0

# Test reverse with Left Arrow
body.send_keys(Keys.ARROW_LEFT)
time.sleep(0.4)
state = get_state()
print('After Left Arrow (returned to slide 0, step 2):', state)
assert state['slideIndex'] == 0 and state['step'] == 2

# Test reverse step on slide 0
body.send_keys(Keys.ARROW_LEFT)
time.sleep(0.4)
state = get_state()
print('After Left Arrow (step backward to step 1):', state)
assert state['slideIndex'] == 0 and state['step'] == 1

os.makedirs('test_screenshots', exist_ok=True)
os.makedirs('assets/thumbnails', exist_ok=True)

# Test all 5 viva roll-number slides (Indices 11, 12, 13, 14, 15)
viva_tests = [
    (11, '05', 'slide_12_roll05.png', 'slide_12.png'),
    (12, '33', 'slide_13_roll33.png', 'slide_13.png'),
    (13, '57', 'slide_14_roll57.png', 'slide_14.png'),
    (14, 'C0', 'slide_15_rollC0.png', 'slide_15.png'),
    (15, '06', 'slide_16_roll06.png', 'slide_16.png'),
]

for slide_idx, expected_roll, test_scr, thumb_name in viva_tests:
    driver.execute_script(f'window.presentation.goToSlide({slide_idx}, 0);')
    
    # Verify roll pill is NOT revealed immediately upon slide entry
    initial_pill_revealed = driver.execute_script(f'''
        const s = document.querySelectorAll(".slide")[{slide_idx}];
        const pill = s.querySelector(".roll-selected-pill");
        return pill ? pill.classList.contains("revealed") : false;
    ''')
    assert not initial_pill_revealed, f'Slide {slide_idx+1} should NOT reveal roll pill before shuffling!'

    # Wait for the slot-machine shuffler animation to complete and lock
    time.sleep(2.0)
    
    # Check status text
    status_text = driver.execute_script(f'''
        const s = document.querySelectorAll(".slide")[{slide_idx}];
        return s.querySelector(".shuffler-status-text").textContent;
    ''')
    print(f'Slide {slide_idx+1} (Roll {expected_roll}) status after shuffle:', status_text)
    assert f'LOCKED: ROLL {expected_roll}' in status_text, f'Expected roll {expected_roll} in {status_text}'
    
    # Verify pill is NOW revealed with candidate roll number on the left
    pill_text = driver.execute_script(f'''
        const s = document.querySelectorAll(".slide")[{slide_idx}];
        const pill = s.querySelector(".roll-selected-pill");
        return pill ? pill.textContent : "";
    ''')
    print(f'Slide {slide_idx+1} title pill text after shuffle:', pill_text)
    assert f'CANDIDATE: ROLL {expected_roll}' in pill_text, f'Expected {expected_roll} in pill text {pill_text}'

    # Check wheel locked glow
    wheel_locked = driver.execute_script(f'''
        const s = document.querySelectorAll(".slide")[{slide_idx}];
        return s.querySelector(".shuffler-wheel-box").classList.contains("locked-glow");
    ''')
    assert wheel_locked, f'Slide {slide_idx+1} wheel should have locked-glow'
    
    # Step through Answer cards 1 and 2
    body.send_keys(Keys.SPACE)
    time.sleep(0.3)
    body.send_keys(Keys.SPACE)
    time.sleep(0.3)
    
    # Save full screenshot and thumbnail
    driver.save_screenshot(f'test_screenshots/{test_scr}')
    driver.save_screenshot(f'assets/thumbnails/{thumb_name}')
    print(f'Verified and captured Slide {slide_idx+1} (Roll {expected_roll})')

# Test Slide 17: Fullscreen Video & Conclusion (Index 16)
driver.execute_script('window.presentation.goToSlide(16, 0);')
time.sleep(0.6)

# Verify video element presence and source
video_src = driver.execute_script('return document.getElementById("thank-video-player")?.getAttribute("src");')
print('Slide 17 video player source:', video_src)
assert video_src == 'thankvideo.mp4', f'Expected thankvideo.mp4, got {video_src}'

# Verify video container is full screen
is_fullscreen_video = driver.execute_script('''
    const s = document.querySelectorAll(".slide")[16];
    return s.classList.contains("slide-fullscreen-video");
''')
assert is_fullscreen_video, 'Slide 17 should have slide-fullscreen-video class'

body.send_keys(Keys.SPACE)
time.sleep(0.4)
driver.save_screenshot('test_screenshots/slide_17_takeaway.png')
driver.save_screenshot('assets/thumbnails/slide_17.png')
print('Verified and captured Slide 17 (Fullscreen Video & Thank You)')

# Test Overview Modal with 17 thumbnails
body.send_keys('o')
time.sleep(0.5)
overview_open = driver.execute_script('return document.getElementById("overview-modal").classList.contains("open");')
print('Overview drawer opened:', overview_open)
assert overview_open == True

thumb_cards = driver.find_elements(By.CSS_SELECTOR, '.thumbnail-card')
print('Total thumbnails in overview grid:', len(thumb_cards))
assert len(thumb_cards) == 17, f'Expected 17 thumbnails, found {len(thumb_cards)}'

driver.save_screenshot('test_screenshots/overview_modal_17.png')
print('Saved test_screenshots/overview_modal_17.png')

body.send_keys(Keys.ESCAPE)
time.sleep(0.3)
overview_open = driver.execute_script('return document.getElementById("overview-modal").classList.contains("open");')
assert overview_open == False
print('Overview closed with ESC.')

driver.quit()
server.shutdown()
print('*** ALL 17 SLIDES & SHUFFLER REEL CHECKS COMPLETED WITH 100% SUCCESS! ***')
