/**
 * Behavioural checks for the pieces that need JavaScript: mobile navigation,
 * dropdowns, product tabs, FAQ accordions, the skip link and form validation.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4401';
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push([name, !!ok]);

// ---- mobile navigation -------------------------------------------------
let page = await browser.newPage({ viewport: { width: 375, height: 800 } });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

check('mobile nav is closed on load', !(await page.locator('#primary-nav').isVisible()));
check('quote CTA stays in the mobile bar', await page.locator('.header__cta').isVisible());

await page.click('[data-menu-toggle]');
check('menu opens on tap', await page.locator('#primary-nav').isVisible());
check('toggle reports aria-expanded=true',
  (await page.getAttribute('[data-menu-toggle]', 'aria-expanded')) === 'true');

const sub = page.locator('[data-submenu-toggle]').first();
await sub.click();
check('submenu opens', await page.locator('.submenu').first().isVisible());
await page.keyboard.press('Escape');
check('Escape closes the submenu', !(await page.locator('.submenu').first().isVisible()));
await page.keyboard.press('Escape');
check('Escape then closes the menu', !(await page.locator('#primary-nav').isVisible()));
await page.close();

// ---- desktop dropdown, tabs, accordion ---------------------------------
page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/product/cardboard-coffee-cups/`, { waitUntil: 'networkidle' });

check('description panel is shown first', await page.locator('#panel-description').isVisible());
check('faq panel starts hidden', !(await page.locator('#panel-faqs').isVisible()));
await page.click('#tab-faqs');
check('Faqs tab reveals its panel', await page.locator('#panel-faqs').isVisible());
check('description panel hides when another tab opens',
  !(await page.locator('#panel-description').isVisible()));

await page.focus('#tab-faqs');
await page.keyboard.press('ArrowRight');
check('ArrowRight wraps round to the first tab',
  (await page.getAttribute('#tab-description', 'aria-selected')) === 'true');
await page.keyboard.press('ArrowLeft');
check('ArrowLeft wraps back to the last tab',
  (await page.getAttribute('#tab-faqs', 'aria-selected')) === 'true');

const item = page.locator('#panel-faqs details').first();
check('accordion starts collapsed', !(await item.locator('.faq__a').isVisible()));
await item.locator('summary').click();
check('accordion expands on click', await item.locator('.faq__a').isVisible());

check('product form is pre-filled with the product name',
  (await page.inputValue('#product-product')) === 'Cardboard Coffee Cups');

// ---- keyboard entry point ----------------------------------------------
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.keyboard.press('Tab');
check('skip link is the first tab stop',
  await page.evaluate(() => document.activeElement?.classList.contains('skip-link')));

// ---- client-side form validation ---------------------------------------
await page.goto(`${BASE}/get-free-quote/`, { waitUntil: 'networkidle' });
await page.locator('form[data-quote-form] button[type="submit"]').first().click();
check('invalid submit marks the name field',
  (await page.getAttribute('#quote-name', 'aria-invalid')) === 'true');
check('an error message is associated with the field',
  await page.locator('#quote-name-error').isVisible());

// product carried through the query string
await page.goto(`${BASE}/get-free-quote/?product=Cardboard%20Mugs`, { waitUntil: 'networkidle' });
check('?product= pre-fills the quote form',
  (await page.inputValue('#quote-product')) === 'Cardboard Mugs');

// ---- thank-you page ----------------------------------------------------
await page.goto(`${BASE}/thank-you/`, { waitUntil: 'networkidle' });
check('thank-you page returns content', await page.locator('h1').isVisible());
check('thank-you is noindex',
  (await page.getAttribute('meta[name="robots"]', 'content'))?.includes('noindex'));

await page.goto(`${BASE}/thank-you/?product=Cardboard%20Tea%20Cups`, { waitUntil: 'networkidle' });
check('thank-you names the product enquired about',
  (await page.textContent('[data-ty-product]'))?.includes('Cardboard Tea Cups'));

// the product name must be inserted as text, never parsed as markup
await page.goto(`${BASE}/thank-you/?product=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E`,
  { waitUntil: 'networkidle' });
check('thank-you does not render markup from the query string',
  (await page.locator('[data-ty-product] img').count()) === 0);

// ---- a real submission lands on the thank-you page ---------------------
await page.goto(`${BASE}/product/cardboard-mugs/`, { waitUntil: 'networkidle' });
await page.fill('#product-name', 'QA Tester');
await page.fill('#product-email', 'qa@example.com');
await page.fill('#product-message', 'Please quote 5000 printed cups for a launch.');
await Promise.all([
  page.waitForURL(/\/thank-you\//, { timeout: 20000 }),
  page.locator('form[data-quote-form] button[type="submit"]').first().click(),
]);
check('submitting a product form lands on /thank-you/',
  page.url().includes('/thank-you/'));
check('the product name is carried across',
  decodeURIComponent(page.url()).includes('Cardboard Mugs'));

await page.close();
await browser.close();

let failed = 0;
for (const [name, ok] of results) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log(`\n  ${results.length - failed}/${results.length} interaction checks passed\n`);
process.exit(failed ? 1 : 0);
