import {test,expect} from '@playwright/test';
let violations:string[]=[];
test.beforeEach(async({page})=>{violations=[];page.on('console',message=>{if(/Content Security Policy|Refused to (?:load|execute|apply)/i.test(message.text()))violations.push(message.text());});});
test.afterEach(()=>{expect(violations).toEqual([]);});

test('released study flow works offline, persists, backs up and restores progress',async({page},testInfo)=>{
 const external:string[]=[];const errors:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(!['127.0.0.1','localhost'].includes(url.hostname))external.push(request.url());});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('dashboard.png'),fullPage:true});
 await page.getByRole('link',{name:'Study',exact:true}).click();
 await page.getByRole('button',{name:/Software Development/}).click();
 await page.getByRole('button',{name:'Mark complete: 1.1',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:/Software Development/}).click();
 await expect(page.getByRole('button',{name:'Mark incomplete: 1.1',exact:true})).toBeVisible();
 await page.getByRole('link',{name:/1.1/}).first().click();
 await expect(page.getByRole('heading',{name:/Software Development/})).toBeVisible();
 await page.goto('/dashboard/settings/');
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export progress'}).click();
 const backup=await downloadEvent;const backupPath=await backup.path();expect(backupPath).not.toBeNull();
 await page.getByRole('button',{name:'Reset progress'}).click();await page.getByRole('button',{name:'Delete local progress'}).click();
 await page.getByLabel('Import progress backup').setInputFiles(backupPath!);
 await page.getByRole('button',{name:'Replace progress with backup'}).click();await expect(page.getByRole('status')).toHaveText('Backup restored.');
 await page.goto('/dashboard/study/');await page.getByRole('button',{name:/Software Development/}).click();
 await expect(page.getByRole('button',{name:'Mark incomplete: 1.1',exact:true})).toBeVisible();
 expect(external).toEqual([]);expect(errors).toEqual([]);
});

test('released flashcards and exam grading save real progress',async({page})=>{
 await page.goto('/dashboard/flashcards/');await page.getByRole('button',{name:/Start Review/}).click();
 await page.keyboard.press('Space');await page.getByRole('button',{name:/Good/}).click();
 await page.goto('/dashboard/practice/exam/?examId=sample-exam-1');
 await page.getByRole('radio').first().click();await page.getByRole('button',{name:'Submit Exam'}).click();
 await expect(page.getByText('Question Review')).toBeVisible();
 await page.getByRole('button',{name:'Back to Practice'}).click();
 await expect(page.getByText('Past Attempts')).toBeVisible();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('devnet-study-progress-v1')!));
 expect(Object.keys(state.flashcards)).toHaveLength(1);expect(state.examAttempts).toHaveLength(1);
});

test('released browser Python runs, cancels and keeps editable drafts',async({page},testInfo)=>{
 await page.goto('/dashboard/labs/python-data-parsing/');
 const editor=page.getByRole('textbox',{name:'Python code'});await expect(editor).toBeVisible();
 await editor.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('print("sandbox works")');
 await page.getByRole('button',{name:'Run Code',exact:true}).click();
 await expect(page.getByText('sandbox works',{exact:true})).toBeVisible({timeout:45_000});
 await page.screenshot({path:testInfo.outputPath('python-lab.png'),fullPage:true});
 await editor.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('value = 1');await page.getByRole('button',{name:'Run Code',exact:true}).click();
 await expect(page.getByText('(No output)',{exact:true})).toBeVisible();
 await editor.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('print("sandbox works")');
 await page.reload();await expect(editor).toHaveValue('print("sandbox works")');
 await editor.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('while True: pass');await page.getByRole('button',{name:'Run Code',exact:true}).click();
 await page.getByRole('button',{name:'Cancel run'}).click();await expect(page.getByText('Execution cancelled.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Show Solution'}).click();await expect(page.getByText('Solution',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Mark complete'}).click();await expect(page.getByRole('button',{name:'Mark incomplete'})).toBeVisible();
 await page.goto('/dashboard/labs/rest-api-client/');await expect(page.getByRole('button',{name:'Download-only lab'})).toBeDisabled();
 await expect(page.getByText(/Download-only exercise:/)).toBeVisible();
});

test('released AI tutor is optional and explains missing configuration',async({page})=>{
 await page.goto('/dashboard/tutor/');await expect(page.getByText(/Messages are sent to Anthropic/)).toBeVisible();
 await page.getByRole('textbox',{name:'Message to AI tutor'}).fill('Explain a REST API');await page.getByRole('button',{name:'Send message'}).click();
 await expect(page.getByText(/not configured|not enabled|unavailable|TUTOR_ANTHROPIC_KEY/i)).toBeVisible();
 await page.goto('/dashboard/settings/');await expect(page.getByText(/TUTOR_ANTHROPIC_KEY and TUTOR_MODEL/)).toBeVisible();
});
