#!/usr/bin/env tsx
/**
 * Playwright Code Generator Helper
 * 
 * This script helps you record login steps using Playwright's codegen feature.
 * It generates step-by-step instructions that can be saved to the database.
 * 
 * Usage:
 *   npm run codegen:record <originCode> <loginUrl>
 * 
 * Example:
 *   npm run codegen:record PARTEQUIPOS https://partequipos.com/login
 * 
 * After recording, the steps will be saved to a JSON file that you can
 * copy into the database's loginSteps field.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface LoginStep {
  type: 'goto' | 'fill' | 'click' | 'wait' | 'select' | 'press' | 'navigate';
  selector?: string;
  value?: string;
  url?: string;
  options?: {
    delay?: number;
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    button?: 'left' | 'right' | 'middle';
    key?: string;
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: npm run codegen:record <originCode> <loginUrl>

Example:
  npm run codegen:record PARTEQUIPOS https://partequipos.com/login
  npm run codegen:record SERVITRACTOR https://empresaservitractor.zohocreatorportal.com/login

This will:
1. Open Playwright's codegen tool
2. Record your actions
3. Generate step-by-step instructions
4. Save to scripts/recorded-steps/<originCode>.json

Instructions:
- Perform the login steps manually in the browser window
- Press Ctrl+C when done
- The steps will be converted to the format needed for the database
    `);
    process.exit(1);
  }

  const originCode = args[0].toUpperCase();
  const loginUrl = args[1];

  console.log(`\n🚀 Starting Playwright Codegen for ${originCode}`);
  console.log(`📍 Login URL: ${loginUrl}\n`);
  console.log('📋 Instructions:');
  console.log('1. A browser window will open');
  console.log('2. Perform the login steps manually');
  console.log('3. Press Ctrl+C when done');
  console.log('4. The steps will be saved automatically\n');

  // Create output directory
  const outputDir = path.join(process.cwd(), 'scripts', 'recorded-steps');
  await fs.mkdir(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, `${originCode.toLowerCase()}.json`);

  try {
    // Run Playwright codegen
    const command = `npx playwright codegen "${loginUrl}" --target typescript`;
    
    console.log('⏳ Opening browser... Press Ctrl+C when done with login steps.\n');
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000, // 10 minutes
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    // Parse the generated code and convert to steps
    const steps = parseCodegenOutput(stdout || stderr);
    
    // Save to file
    await fs.writeFile(
      outputFile,
      JSON.stringify(steps, null, 2)
    );

    console.log(`\n✅ Steps recorded successfully!`);
    console.log(`📁 Saved to: ${outputFile}\n`);
    console.log('📋 Next steps:');
    console.log('1. Review the generated steps in the file');
    console.log('2. Update placeholders ({{username}}, {{password}}) if needed');
    console.log('3. Copy the JSON array to the database loginSteps field\n');
    
    console.log('📄 Generated steps:');
    console.log(JSON.stringify(steps, null, 2));

  } catch (error: any) {
    // If user pressed Ctrl+C, try to parse what was generated
    if (error.signal === 'SIGINT' || error.code === 'SIGINT') {
      console.log('\n\n⏹️  Recording stopped by user');
      console.log('💡 Tip: You can also manually create the steps file');
      console.log(`   File location: ${outputFile}\n`);
      
      // Show example format
      const exampleSteps: LoginStep[] = [
        {
          type: 'goto',
          url: loginUrl,
          options: {
            waitUntil: 'domcontentloaded',
            timeout: 40000,
          },
        },
        {
          type: 'wait',
          selector: 'input[name="username"]',
          options: { timeout: 10000 },
        },
        {
          type: 'fill',
          selector: 'input[name="username"]',
          value: '{{username}}',
        },
        {
          type: 'fill',
          selector: 'input[name="password"]',
          value: '{{password}}',
        },
        {
          type: 'click',
          selector: 'button[type="submit"]',
          options: {
            waitUntil: 'networkidle',
          },
        },
      ];

      await fs.writeFile(
        outputFile,
        JSON.stringify(exampleSteps, null, 2)
      );

      console.log('📝 Example steps file created. Edit it with your actual steps.\n');
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

function parseCodegenOutput(code: string): LoginStep[] {
  const steps: LoginStep[] = [];
  
  // Simple regex-based parsing (can be enhanced)
  const lines = code.split('\n');
  
  for (const line of lines) {
    // Match page.goto
    const gotoMatch = line.match(/page\.goto\(['"]([^'"]+)['"]/);
    if (gotoMatch) {
      steps.push({
        type: 'goto',
        url: gotoMatch[1],
        options: {
          waitUntil: 'domcontentloaded',
          timeout: 40000,
        },
      });
      continue;
    }

    // Match page.fill
    const fillMatch = line.match(/page\.fill\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/);
    if (fillMatch) {
      steps.push({
        type: 'fill',
        selector: fillMatch[1],
        value: fillMatch[2],
      });
      continue;
    }

    // Match page.click
    const clickMatch = line.match(/page\.click\(['"]([^'"]+)['"]/);
    if (clickMatch) {
      steps.push({
        type: 'click',
        selector: clickMatch[1],
      });
      continue;
    }

    // Match page.waitForSelector
    const waitMatch = line.match(/page\.waitForSelector\(['"]([^'"]+)['"]/);
    if (waitMatch) {
      steps.push({
        type: 'wait',
        selector: waitMatch[1],
        options: { timeout: 10000 },
      });
      continue;
    }
  }

  // If no steps found, return empty (user will need to create manually)
  if (steps.length === 0) {
    console.warn('⚠️  Could not parse steps from codegen output');
    console.warn('💡 You can create the steps manually in the JSON format');
  }

  return steps;
}

if (require.main === module) {
  main().catch(console.error);
}


