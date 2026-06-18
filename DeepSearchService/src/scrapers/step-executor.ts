/**
 * Step executor for executing login/search steps
 * Used by handlers that need to execute step-based flows
 */

import { Page } from 'puppeteer';

interface Step {
  type: 'goto' | 'fill' | 'click' | 'wait' | 'select' | 'press' | 'navigate' | 'log-html' | 'evaluate';
  selector?: string;
  value?: string;
  url?: string;
  script?: string;
  options?: {
    delay?: number;
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    key?: string;
    filename?: string;
  };
}

/**
 * Replace placeholders in step values
 */
function replacePlaceholders(value: string, placeholders: Record<string, string>): string {
  let result = value;
  for (const [key, val] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }
  return result;
}

/**
 * Parse iframe selector (Playwright-style: iframe[name="x"] >>> #selector)
 * Returns { iframeSelector, innerSelector, isIframe } or null if not an iframe selector
 */
function parseIframeSelector(selector: string): { iframeSelector: string; innerSelector: string; isIframe: boolean } | null {
  const iframeMatch = selector.match(/^(iframe\[[^\]]+\])\s*>>>\s*(.+)$/);
  if (iframeMatch) {
    return {
      iframeSelector: iframeMatch[1],
      innerSelector: iframeMatch[2],
      isIframe: true
    };
  }
  return null;
}

/**
 * Get iframe frame from page
 */
async function getIframeFrame(page: Page, iframeSelector: string): Promise<any> {
  // Extract iframe name or other attributes
  const nameMatch = iframeSelector.match(/name=["']([^"']+)["']/);
  if (nameMatch) {
    // Wait a bit for iframe to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    const frame = page.frames().find(f => f.name() === nameMatch[1]);
    if (frame) {
      // Wait for iframe content to be ready
      try {
        await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
      } catch (e) {
        // If readyState check fails, just continue
      }
      return frame;
    }
  }
  
  // Try to get iframe element and then its content frame
  const iframeElement = await page.$(iframeSelector);
  if (iframeElement) {
    const frame = await iframeElement.contentFrame();
    if (frame) {
      // Wait for iframe content to be ready
      try {
        await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
      } catch (e) {
        // If readyState check fails, just continue
      }
      return frame;
    }
  }
  
  


  
  // Fallback: wait for iframe and try again
  await page.waitForSelector(iframeSelector, { timeout: 10000 });
  await new Promise(resolve => setTimeout(resolve, 1000));
  const iframeEl = await page.$(iframeSelector);
  if (iframeEl) {
    const frame = await iframeEl.contentFrame();
    if (frame) {
      // Wait for iframe content to be ready
      try {
        await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
      } catch (e) {
        // If readyState check fails, just continue
      }
      return frame;
    }
  }
  
  throw new Error(`Could not access iframe: ${iframeSelector}`);
}

/**
 * Find boundary between login and search steps
 */
export function findLoginSearchBoundary(steps: Step[], placeholders: Record<string, string>): number {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    if ((step.value && step.value.includes('{{reference}}')) ||
        (step.url && step.url.includes('{{reference}}'))) {
      return i;
    }
    
    if (step.selector && 
        step.selector.includes('referencia') && 
        !step.selector.includes('radio')) {
      return i;
    }
    
    if (step.type === 'evaluate' && step.script) {
      const script = step.script.toLowerCase();
      if (script.includes('cat-search-form') || script.includes('cat-header-search-bar')) {
        return i;
      }
    }
    
    if (step.type === 'wait' && step.selector) {
      const selector = step.selector.toLowerCase();
      if (selector.includes('cat-search-form') || 
          selector.includes('s2id_autogen1') ||
          selector.includes('select2-input')) {
        return i;
      }
    }
  }
  
  return steps.length;
}

/**
 * Execute steps on a page
 * Used by handlers that need step-based flows
 */
export async function executeSteps(
  page: Page,
  steps: Step[],
  placeholders: Record<string, string>,
  skipLogin: boolean = false,
  originCode?: string
): Promise<void> {
  let dynamicSkipLogin = skipLogin;
  let searchStartIndex = skipLogin ? findLoginSearchBoundary(steps, placeholders) : 0;
  const prefix = originCode ? `[${originCode}]` : '';

  if (skipLogin) {
    console.log(`[StepExecutor] ${prefix} Skipping login: boundary at step ${searchStartIndex}`);
  }
  
  let stepsToExecute = steps;

  for (let i = 0; i < stepsToExecute.length; i++) {
    const step = stepsToExecute[i];
    const stepIndex = i + 1;
    
    // Skip login steps if we're dynamically skipping login
    if (dynamicSkipLogin && i < searchStartIndex) {
      const isLoginStep = (
        (step.type === 'fill' && (step.value === '{{username}}' || step.value === '{{password}}')) ||
        (step.type === 'click' && step.selector && (
          step.selector.includes('submit') || 
          step.selector.includes('login') || 
          step.selector.includes('Iniciar') ||
          step.selector.includes('Ingresar') ||
          step.selector.includes('entrar') ||
          step.selector.includes('/web/login') ||
          step.selector.includes('/login')
        )) ||
        (step.type === 'wait' && step.selector && (
          step.selector.includes('password') || 
          step.selector.includes('usuario') || 
          step.selector.includes('email') ||
          step.selector.includes('Correo') ||
          step.selector.includes('Contraseña') ||
          step.selector === '#email' ||
          step.selector === '#password'
        )) ||
        (step.type === 'goto' && step.url && step.url.includes('/login'))
      );
      
      if (isLoginStep) {
        console.log(`[StepExecutor] ${prefix} Step ${stepIndex}: ⏭️  Skipping login step (${step.type})`);
        continue;
      }
    }

    try {
      switch (step.type) {
        case 'goto':
        case 'navigate':
          if (step.url) {
            const url = replacePlaceholders(step.url, placeholders);
            const currentUrl = page.url();
            
            if (currentUrl.includes(url) || url.includes(currentUrl.split('?')[0])) {
              console.log(`[StepExecutor] ${prefix} Step ${stepIndex}: Already on target URL, skipping`);
              break;
            }
            
            console.log(`[StepExecutor] ${prefix} Step ${stepIndex}: Navigating to: ${url}`);
            const waitUntil = (step.options?.waitUntil || 'domcontentloaded') as any;
            await page.goto(url, {
              waitUntil,
              timeout: step.options?.timeout || 60000,
            });
          }
          break;

        case 'wait':
          if (step.selector) {
            try {
              const iframeInfo = parseIframeSelector(step.selector);
              if (iframeInfo && iframeInfo.isIframe) {
                // Wait for iframe first
                await page.waitForSelector(iframeInfo.iframeSelector, {
                  timeout: step.options?.timeout || 30000,
                });
                // Get iframe frame
                const frame = await getIframeFrame(page, iframeInfo.iframeSelector);
                // Wait for element inside iframe
                await frame.waitForSelector(iframeInfo.innerSelector, {
                  timeout: step.options?.timeout || 30000,
                  visible: true,
                });
                console.log(`[StepExecutor] ${prefix} Step ${stepIndex}: Waited for ${iframeInfo.innerSelector} inside iframe`);
              } else {
                await page.waitForSelector(step.selector, {
                  timeout: step.options?.timeout || 30000,
                  visible: true,
                });
              }
            } catch (error: any) {
              console.warn(`[StepExecutor] ${prefix} Step ${stepIndex}: Wait for selector failed: ${error.message}`);
            }
          } else if (step.options?.timeout) {
            const timeout = step.options.timeout;
            await new Promise(resolve => setTimeout(resolve, timeout));
          }
          break;

        case 'fill':
          if (step.selector && step.value) {
            const value = replacePlaceholders(step.value, placeholders);
            const iframeInfo = parseIframeSelector(step.selector);
            
            if (iframeInfo && iframeInfo.isIframe) {
              // Wait for iframe first
              await page.waitForSelector(iframeInfo.iframeSelector, {
                timeout: step.options?.timeout || 30000,
              });
              // Get iframe frame
              const frame = await getIframeFrame(page, iframeInfo.iframeSelector);
              // Wait for element inside iframe
              await frame.waitForSelector(iframeInfo.innerSelector, {
                timeout: step.options?.timeout || 30000,
                visible: true,
              });
              
              // Clear and type in iframe
              const element = await frame.$(iframeInfo.innerSelector);
              if (element) {
                await element.click({ clickCount: 3 });
                await element.type(value, { delay: 50 });
                console.log(`[StepExecutor] ${prefix} Step ${stepIndex}: Filled ${iframeInfo.innerSelector} in iframe`);
              }
            } else {
              await page.waitForSelector(step.selector, {
                timeout: step.options?.timeout || 30000,
                visible: true,
              });
              
              // Clear and type
              await page.click(step.selector, { clickCount: 3 });
              await page.type(step.selector, value, { delay: 50 });
            }
          }
          break;

        case 'click':
          if (step.selector) {
            // Check if selector is an iframe selector (e.g., iframe[name="x"] >>> #selector)
            const iframeInfo = parseIframeSelector(step.selector);
            
            if (iframeInfo && iframeInfo.isIframe) {
              // Wait for iframe first
              await page.waitForSelector(iframeInfo.iframeSelector, {
                timeout: step.options?.timeout || 30000,
              });
              // Get iframe frame
              const frame = await getIframeFrame(page, iframeInfo.iframeSelector);
              // Wait for element inside iframe
              await frame.waitForSelector(iframeInfo.innerSelector, {
                timeout: step.options?.timeout || 30000,
                visible: true,
              });
              
              // Click element in iframe
              const element = await frame.$(iframeInfo.innerSelector);
              if (element) {
                await element.click();
                console.log(`[StepExecutor] ${prefix} Step ${stepIndex}: Clicked ${iframeInfo.innerSelector} in iframe`);
              } else {
                throw new Error(`Element ${iframeInfo.innerSelector} not found in iframe`);
              }
            } else {
              // Check if selector is a Playwright-style text selector (e.g., button:has-text("Ingresar"))
              const hasTextMatch = step.selector.match(/:has-text\(["'](.+?)["']\)/);
              
              if (hasTextMatch) {
                // Convert Playwright text selector to Puppeteer-compatible JavaScript
                const textToFind = hasTextMatch[1];
                const elementType = step.selector.split(':')[0] || 'button';
              
                console.log(`[StepExecutor] ${prefix} Step ${stepIndex}: Converting text selector "${step.selector}" to JavaScript search for "${textToFind}"`);
                
                // Wait for element with matching text to appear
                await page.waitForFunction(
                (text, type) => {
                  const elements = Array.from(document.querySelectorAll(type || 'button'));
                  return elements.some(el => {
                    const htmlEl = el as HTMLElement;
                    const textContent = (el.textContent || htmlEl.innerText || '').trim();
                    return textContent.toLowerCase().includes(text.toLowerCase());
                  });
                  },
                  { timeout: step.options?.timeout || 30000 },
                  textToFind,
                  elementType
                );
                
                // Click the element using JavaScript
                await page.evaluate((text, type) => {
                const elements = Array.from(document.querySelectorAll(type || 'button'));
                const element = elements.find(el => {
                  const htmlEl = el as HTMLElement;
                  const textContent = (el.textContent || htmlEl.innerText || '').trim();
                  return textContent.toLowerCase().includes(text.toLowerCase());
                });
                
                if (element) {
                  (element as HTMLElement).click();
                  return true;
                }
                return false;
              }, textToFind, elementType);
                  
                  // Wait for navigation if it's a submit/login button
                  if (textToFind.toLowerCase().includes('ingresar') || 
                      textToFind.toLowerCase().includes('login') || 
                      textToFind.toLowerCase().includes('entrar') ||
                      textToFind.toLowerCase().includes('submit')) {
                    try {
                      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
                    } catch (e) {
                      // Navigation might not happen, continue
                    }
                  }
                } else {
                  // Standard CSS selector - handle comma-separated selectors
                  const selectors = step.selector.split(',').map(s => s.trim());
                  let foundSelector: string | null = null;

                  // Try to find which selector exists
                  for (const sel of selectors) {
                    try {
                      await page.waitForSelector(sel, {
                        timeout: 5000, // Short timeout for each try
                        visible: true,
                      });
                      foundSelector = sel;
                      break;
                    } catch (e) {
                      // Continue to next selector
                      continue;
                    }
                  }

                  if (foundSelector) {
                    await page.click(foundSelector);
                  } else {
                    // Fallback: try the full selector string (Puppeteer supports comma-separated)
                    try {
                      await page.waitForSelector(step.selector, {
                        timeout: step.options?.timeout || 30000,
                        visible: true,
                      });
                      await page.click(step.selector);
                    } catch (error: any) {
                      console.warn(`[StepExecutor] ${prefix} Step ${stepIndex}: Failed to click selector: ${error.message}`);
                      throw error;
                    }
                  }
                  
                  // Wait for navigation if it's a submit/login button
                  if (step.selector.includes('submit') || step.selector.includes('login')) {
                    try {
                      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
                    } catch (e) {
                      // Navigation might not happen, continue
                    }
                  }
                }
              }
          }
          break;

        case 'press':
          if (step.options?.key) {
            // If selector is provided, focus on the element first before pressing key
            if (step.selector) {
              try {
                // Wait for selector to be available
                await page.waitForSelector(step.selector, {
                  timeout: step.options?.timeout || 30000,
                  visible: true,
                });
                
                // Focus on the element
                await page.focus(step.selector);
                
                // Small delay to ensure focus is set
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (error: any) {
                console.warn(`[StepExecutor] ${prefix} Step ${stepIndex}: Failed to focus on selector "${step.selector}": ${error.message}. Pressing key globally.`);
              }
            }
            
            // Press the key
            await page.keyboard.press(step.options.key as any);
          }
          break;

        case 'evaluate':
          if (step.script) {
            await page.evaluate(step.script);
          }
          break;

        case 'log-html':
          try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const html = await page.content();
            const debugDir = require('path').join(process.cwd(), 'debug-html');
            if (!require('fs').existsSync(debugDir)) {
              require('fs').mkdirSync(debugDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Replace placeholders in filename (e.g., {{reference}})
            const rawFilename = step.options?.filename || `page-${timestamp}.html`;
            const filename = replacePlaceholders(rawFilename, placeholders);
            const filepath = require('path').join(debugDir, filename);
            require('fs').writeFileSync(filepath, html, 'utf-8');
            console.log(`[StepExecutor] ${prefix} Step ${stepIndex}: Logged HTML to ${filepath}`);
          } catch (error: any) {
            console.warn(`[StepExecutor] ${prefix} Step ${stepIndex}: Failed to log HTML: ${error.message}`);
          }
          break;
      }

      if (step.options?.delay) {
        const delay = step.options.delay;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      console.error(`[StepExecutor] ${prefix} Error in step ${stepIndex} (${step.type}):`, error.message);
      throw error;
    }
  }
}

