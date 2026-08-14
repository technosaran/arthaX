;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="71501d8b-1c1c-8aaa-b305-20ded5c6968d")}catch(e){}}();
module.exports=[54799,(e,t,n)=>{t.exports=e.x("crypto",()=>require("crypto"))},8875,(e,t,n)=>{t.exports=e.x("ioredis-23a6225d3f8c0bff",()=>require("ioredis-23a6225d3f8c0bff"))},18622,(e,t,n)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},20635,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},24725,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},56704,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},59043,(e,t,n)=>{t.exports=e.x("next/dist/server/runtime-reacts.external.js",()=>require("next/dist/server/runtime-reacts.external.js"))},93695,(e,t,n)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},81111,(e,t,n)=>{t.exports=e.x("node:stream",()=>require("node:stream"))},30146,(e,t,n)=>{t.exports=e.x("pino-28069d5257187539",()=>require("pino-28069d5257187539"))},29319,e=>{"use strict";async function t(e,t,n,r){let a=e.trim();if(!a)throw Error("Gemini API key is empty");let i=[];r&&r.data&&i.push({inline_data:{mime_type:r.mimeType,data:r.data}}),i.push({text:t});let o={contents:[{parts:i}]};n&&(o.systemInstruction={parts:[{text:n}]});let s="";for(let e of["gemini-2.5-flash","gemini-2.5-pro","gemini-2.0-flash","gemini-1.5-flash"])try{let t=`https://generativelanguage.googleapis.com/v1beta/models/${e}:generateContent?key=${encodeURIComponent(a)}`,n=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)});if(n.ok){let e=await n.json(),t=e.candidates?.[0]?.content?.parts?.[0]?.text;if(t)return t}else s=await n.text()}catch(e){s=e.message||String(e)}throw Error(`Gemini API call failed across models: ${s}`)}async function n(e,n){try{let r=`You are an expert financial AI parser for FinanceOS. Analyze user text (which may contain typos, slang, hinglish, stock purchases, or mutual fund investments) and extract structured JSON matching this EXACT TypeScript schema:
{
  "intentType": "expense" | "income" | "transfer" | "stock" | "mutual_fund" | "inquiry" | "unknown",
  "amount": number | null,
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Salary" | "Gift" | "Work" | "Investments" | "Other",
  "description": "Short clean description",
  "accountName": "bank/account name if explicitly mentioned or null",
  "symbol": "Stock ticker symbol (e.g. TATAMOTORS, RELIANCE, AAPL, TCS) if applicable or null",
  "quantity": number or null,
  "price": number or null,
  "fundName": "Name of mutual fund if applicable or null"
}
Only output raw JSON without markdown code blocks.`,a=await t(n,`Parse this financial text: "${e}"`,r),i=a.match(/\{[\s\S]*\}/),o=JSON.parse(i?i[0]:a.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,intentType:o.intentType||"unknown",amount:"number"==typeof o.amount&&o.amount>0?o.amount:o.quantity&&o.price?o.quantity*o.price:null,category:o.category||("stock"===o.intentType||"mutual_fund"===o.intentType?"Investments":"Other"),description:o.description||e,accountName:o.accountName||null,symbol:o.symbol||null,quantity:"number"==typeof o.quantity?o.quantity:null,price:"number"==typeof o.price?o.price:null,fundName:o.fundName||null}}catch(t){return{success:!1,intentType:"unknown",amount:null,category:"Other",description:e,accountName:null,error:t.message||"Failed to parse with Gemini"}}}async function r(e,n,r,a){try{let i=a?`
Recent Conversation History:
${a}
`:"",o=`You are the Autonomous Financial AI Engine for FinanceOS & Telegram.
Analyze user natural language messages and autonomously decide what financial action to execute.

User's Live Financial Context (Accounts, Balances, Category Spending, Investments, Budgets, Family):
${n}
${i}
Respond ONLY with valid JSON matching this schema:
{
  "action": "CREATE_ACCOUNT" | "DELETE_ACCOUNT" | "UPDATE_ACCOUNT" | "LOG_EXPENSE" | "LOG_INCOME" | "FAMILY_TRANSFER" | "ADD_FAMILY_MEMBER" | "BUY_STOCK" | "BUY_MUTUAL_FUND" | "TRANSFER_BETWEEN_ACCOUNTS" | "SET_BUDGET" | "CREATE_GOAL" | "CONTRIBUTE_GOAL" | "FINANCIAL_QUERY" | "GREETING" | "UNKNOWN",
  "accountName": string or null (e.g. "SBI", "HDFC", "ICICI"),
  "accountType": "checking" | "savings" | "credit" | "investment" | "cash" or null,
  "initialBalance": number or null,
  "amount": number or null,
  "newAccountName": string or null (for UPDATE_ACCOUNT rename),
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Salary" | "Gift" | "Work" | "Investments" | "Other" or null,
  "description": string or null,
  "targetAccountName": string or null,
  "fromAccountName": string or null,
  "toAccountName": string or null,
  "familyMemberName": string or null,
  "familyRelationship": string or null (e.g. "Mother", "Father", "Sister", "Brother", "Spouse", "Friend"),
  "symbol": string or null,
  "quantity": number or null,
  "price": number or null,
  "fundName": string or null,
  "goalName": string or null,
  "targetAmount": number or null,
  "replyMessage": string or null,
  "reasoning": string or null
}

Action Selection Rules:
1. "CREATE_ACCOUNT": If user asks to create, add, or open a bank/account (e.g. "create account SBI", "add account HDFC 5000"). Extract accountName, accountType (default "checking"), initialBalance.
2. "DELETE_ACCOUNT": If user asks to delete, remove, or close an account (e.g. "delete sbi", "remove hdfc account", "close my icici"). Match accountName against existing accounts from context.
3. "UPDATE_ACCOUNT": If user asks to rename, change, or update an account (e.g. "rename SBI to SBI Salary"). Use accountName for current name and newAccountName for new name.
4. "LOG_EXPENSE": If user spent money (e.g. "500 Swiggy", "paid 1200 rent").
5. "LOG_INCOME": If user received money, income, salary, dividend, or credited funds into a bank (e.g. "income from Samsung 2 cr to ICICI", "50000 salary credited", "got 2000 refund"). NEVER classify income/credit into a bank as TRANSFER_BETWEEN_ACCOUNTS.
6. "ADD_FAMILY_MEMBER": If user wants to add a family member (e.g. "add family member Sri", "add mom"). Extract familyMemberName and familyRelationship.
7. "FAMILY_TRANSFER": If user transferred money to family (e.g. "sent 1000 to Mom").
8. "BUY_STOCK": If user bought stocks (e.g. "bought 10 shares of SBI at 800").
9. "BUY_MUTUAL_FUND": If user invested in mutual fund (e.g. "invested 5000 in Parag Parikh Flexi Cap").
10. "TRANSFER_BETWEEN_ACCOUNTS": ONLY if user explicitly moves funds between two existing accounts owned by user (e.g. "moved 5000 from HDFC to SBI", "transfer 1000 from SBI to ICICI").
11. "SET_BUDGET": If user wants to set or update a category budget (e.g. "set food budget 15000", "budget 5000 for transport"). Extract category and amount.
12. "CREATE_GOAL": If user wants to create a savings goal (e.g. "create goal Buy Car 500000", "goal iPhone 150000"). Extract goalName and targetAmount.
13. "CONTRIBUTE_GOAL": If user wants to add funds toward a goal (e.g. "contribute 5000 to Car goal", "save 2000 for iPhone"). Extract goalName and amount.
14. "FINANCIAL_QUERY": If user asked a question, for net worth, advice, top spending, budget check, or summary. Provide friendly concise markdown in "replyMessage".
15. "GREETING": If user sends a greeting like hi, hello, hey, good morning, etc. Set replyMessage to a friendly short greeting.

IMPORTANT: For DELETE_ACCOUNT, match the accountName the user mentions against the account names in the user's context. Use the exact account name from context.

Output raw JSON with no markdown tags.`,s=await t(r,`User message: "${e}"`,o),l=s.match(/\{[\s\S]*\}/),c=JSON.parse(l?l[0]:s.replace(/```json/g,"").replace(/```/g,"").trim());return{action:c.action||"UNKNOWN",accountName:c.accountName||null,accountType:c.accountType||"checking",initialBalance:"number"==typeof c.initialBalance?c.initialBalance:null,amount:"number"==typeof c.amount?c.amount:null,category:c.category||null,description:c.description||null,targetAccountName:c.targetAccountName||null,fromAccountName:c.fromAccountName||null,toAccountName:c.toAccountName||null,familyMemberName:c.familyMemberName||null,symbol:c.symbol||null,quantity:"number"==typeof c.quantity?c.quantity:null,price:"number"==typeof c.price?c.price:null,fundName:c.fundName||null,replyMessage:c.replyMessage||null,familyRelationship:c.familyRelationship||null,newAccountName:c.newAccountName||null,reasoning:c.reasoning||null}}catch(e){return{action:"UNKNOWN",reasoning:e.message||"Failed to process autonomous intent"}}}async function a(e,n,r,a,i){try{let o=i?`
Recent Conversation History:
${i}
`:"",s=`You are the Multimodal Voice & Audio Financial AI Engine for FinanceOS & Telegram.
Listen to the user's recorded voice note audio message.
1. Transcribe the audio accurately into text.
2. Determine the user's financial intent and decide what action to execute.

User's Live Financial Context:
${r}
${o}
Respond ONLY with valid JSON matching this schema:
{
  "transcription": "Exact spoken audio transcription text",
  "action": "CREATE_ACCOUNT" | "DELETE_ACCOUNT" | "UPDATE_ACCOUNT" | "LOG_EXPENSE" | "LOG_INCOME" | "FAMILY_TRANSFER" | "ADD_FAMILY_MEMBER" | "BUY_STOCK" | "BUY_MUTUAL_FUND" | "TRANSFER_BETWEEN_ACCOUNTS" | "FINANCIAL_QUERY" | "GREETING" | "UNKNOWN",
  "accountName": string or null,
  "accountType": "checking" | "savings" | "credit" | "investment" | "cash" or null,
  "initialBalance": number or null,
  "amount": number or null,
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Salary" | "Gift" | "Work" | "Investments" | "Other" or null,
  "description": string or null,
  "targetAccountName": string or null,
  "fromAccountName": string or null,
  "toAccountName": string or null,
  "familyMemberName": string or null,
  "symbol": string or null,
  "quantity": number or null,
  "price": number or null,
  "fundName": string or null,
  "replyMessage": string or null,
  "reasoning": string or null
}

Output raw JSON with no markdown tags.`,l=await t(a,"Transcribe audio and analyze financial intent from this voice note.",s,{mimeType:n||"audio/ogg",data:e}),c=l.match(/\{[\s\S]*\}/),u=JSON.parse(c?c[0]:l.replace(/```json/g,"").replace(/```/g,"").trim());return{transcription:u.transcription||"Voice audio processed",action:u.action||"UNKNOWN",accountName:u.accountName||null,accountType:u.accountType||"checking",initialBalance:"number"==typeof u.initialBalance?u.initialBalance:null,amount:"number"==typeof u.amount?u.amount:null,category:u.category||null,description:u.description||u.transcription||null,targetAccountName:u.targetAccountName||null,fromAccountName:u.fromAccountName||null,toAccountName:u.toAccountName||null,familyMemberName:u.familyMemberName||null,symbol:u.symbol||null,quantity:"number"==typeof u.quantity?u.quantity:null,price:"number"==typeof u.price?u.price:null,fundName:u.fundName||null,replyMessage:u.replyMessage||null,reasoning:u.reasoning||null}}catch(e){return{action:"UNKNOWN",reasoning:e.message||"Failed to process voice note with Gemini"}}}async function i(e,n,r,a){try{let r=`You are an expert Vision Financial Receipt Scanner for FinanceOS.
Analyze this photo receipt, invoice, or bill. Extract the key data and respond with raw JSON matching this schema:
{
  "merchantName": "Name of store / restaurant / vendor",
  "amount": total final amount paid as number (e.g. 450.50),
  "date": "YYYY-MM-DD" if present on receipt else null,
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Other",
  "items": ["list of main items purchased"],
  "description": "Short clean description summary of receipt",
  "accountName": "bank name if printed on payment slip else null"
}
Output raw JSON with no markdown tags.`,i=await t(a,"Analyze this receipt image and extract total amount, merchant, and items.",r,{mimeType:n||"image/jpeg",data:e}),o=i.match(/\{[\s\S]*\}/),s=JSON.parse(o?o[0]:i.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,merchantName:s.merchantName||"Store Purchase",amount:"number"==typeof s.amount&&s.amount>0?s.amount:null,date:s.date||null,category:s.category||"Shopping",items:Array.isArray(s.items)?s.items:[],description:s.description||`${s.merchantName||"Receipt"} Purchase`,accountName:s.accountName||null}}catch(e){return{success:!1,merchantName:"Receipt",amount:null,date:null,category:"Other",items:[],description:"Receipt Scan Failed",error:e.message||"Failed to analyze receipt"}}}async function o(e,n,r,a){let i=a?`
Recent Conversation History:
${a}
`:"",o=`You are the Lead Financial Advisor & AI Assistant for FinanceOS.
Your goal is to provide insightful, actionable, and beautifully formatted financial responses for Telegram and the Web Dashboard.

Formatting Guidelines for Telegram:
- Use clean Telegram Markdown (*bold* for key numbers, titles, metrics, and categories).
- Use relevant financial emojis (🟢 Income/Profit, 🔴 Expense/Loss, 💳 Bank/Account, 📊 Metrics, 🎯 Goals, 💡 Tips).
- Keep answers structured with bullet points or numbered steps.
- Highlight concrete figures from user context (e.g. *Net Worth*: ₹X, *Food Budget*: ₹Y).
- Conclude with a helpful, encouraging financial tip or actionable next step.

User's Live Financial Context:
${n}
${i}`;return await t(r,e,o)}async function s(e,n){try{let r=`You are an expert Income Tax Law & Union Budget AI Parser for FinanceOS.
Analyze the provided Union Budget speech, Finance Bill press release, or tax amendment text.
Extract the exact tax rules, slabs, deductions, and capital gains parameters for Indian Income Tax.

Respond ONLY with valid JSON matching this EXACT schema:
{
  "fyStartYear": number (e.g. 2026 for FY 2026-27),
  "version": "FY2026-27-v1",
  "standardDeductionOld": number (default 50000),
  "standardDeductionNew": number (default 75000),
  "cessRate": number (e.g. 0.04),
  "stcgRate": number (e.g. 0.20 for 20%),
  "ltcgRate": number (e.g. 0.125 for 12.5%),
  "ltcgExemption": number (e.g. 125000),
  "oldRegimeSlabs": [
    { "upto": 250000, "rate": 0 },
    { "upto": 500000, "rate": 0.05 },
    { "upto": 1000000, "rate": 0.2 },
    { "upto": null, "rate": 0.3 }
  ],
  "newRegimeSlabs": [
    { "upto": 400000, "rate": 0 },
    { "upto": 800000, "rate": 0.05 },
    { "upto": 1200000, "rate": 0.1 },
    { "upto": 1600000, "rate": 0.15 },
    { "upto": 2000000, "rate": 0.2 },
    { "upto": 2400000, "rate": 0.25 },
    { "upto": null, "rate": 0.3 }
  ],
  "deductionLimits": {
    "80C": 150000,
    "80D": 25000,
    "80CCD(1B)": 50000
  },
  "summary": "Brief clean summary of the parsed tax rule changes"
}

Output raw JSON only with no markdown formatting.`,a=await t(n,`Parse this tax notification / budget text: "${e}"`,r),i=a.match(/\{[\s\S]*\}/),o=JSON.parse(i?i[0]:a.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,fyStartYear:"number"==typeof o.fyStartYear?o.fyStartYear:new Date().getFullYear(),version:o.version||`FY${o.fyStartYear||new Date().getFullYear()}-v1`,standardDeductionOld:"number"==typeof o.standardDeductionOld?o.standardDeductionOld:5e4,standardDeductionNew:"number"==typeof o.standardDeductionNew?o.standardDeductionNew:75e3,cessRate:"number"==typeof o.cessRate?o.cessRate:.04,stcgRate:"number"==typeof o.stcgRate?o.stcgRate:.2,ltcgRate:"number"==typeof o.ltcgRate?o.ltcgRate:.125,ltcgExemption:"number"==typeof o.ltcgExemption?o.ltcgExemption:125e3,oldRegimeSlabs:Array.isArray(o.oldRegimeSlabs)?o.oldRegimeSlabs:[],newRegimeSlabs:Array.isArray(o.newRegimeSlabs)?o.newRegimeSlabs:[],deductionLimits:o.deductionLimits||{"80C":15e4,"80D":25e3},summary:o.summary||"Tax rules successfully updated"}}catch(e){return{success:!1,fyStartYear:new Date().getFullYear(),version:"Error",standardDeductionOld:5e4,standardDeductionNew:75e3,cessRate:.04,stcgRate:.2,ltcgRate:.125,ltcgExemption:125e3,oldRegimeSlabs:[],newRegimeSlabs:[],deductionLimits:{},summary:"Parsing failed",error:e.message||"Failed to parse tax announcement with Gemini AI"}}}e.s(["askGeminiFinanceAssistant",0,o,"callGeminiApi",0,t,"getGeminiApiKeyForProfile",0,function(e){if(!e||!1===e.gemini_enabled)return null;let t=e.gemini_api_key||process.env.GEMINI_API_KEY;return t?.trim()||null},"isGeminiActiveForProfile",0,function(e){if(!e||!1===e.gemini_enabled)return!1;let t=e.gemini_api_key||process.env.GEMINI_API_KEY;return!!t&&t.trim().length>0},"parseAutonomousTelegramIntent",0,r,"parseBudgetOrTaxAnnouncementWithGemini",0,s,"parseReceiptWithGemini",0,i,"parseTransactionWithGemini",0,n,"parseVoiceNoteWithGemini",0,a])},18387,e=>{"use strict";var t=e.i(30146);let n=process.env.LOG_LEVEL||"info",r=(0,t.default)({level:n,base:{env:"production",revision:process.env.VERCEL_GIT_COMMIT_SHA||"local"},timestamp:t.default.stdTimeFunctions.isoTime,redact:{paths:["req.headers.authorization","req.headers.cookie",'res.headers["set-cookie"]',"password","token","apiKey","secret"],censor:"[REDACTED]"},serializers:{err:t.default.stdSerializers.err,req:t.default.stdSerializers.req,res:t.default.stdSerializers.res}}),a=new class e{logger;constructor(e){this.logger=e?r.child(e):r}debug(e,t){void 0!==t?this.logger.debug("object"==typeof t&&null!==t?t:{detail:t},e):this.logger.debug(e)}info(e,t){void 0!==t?this.logger.info("object"==typeof t&&null!==t?t:{detail:t},e):this.logger.info(e)}warn(e,t){void 0!==t?this.logger.warn("object"==typeof t&&null!==t?t:{detail:t},e):this.logger.warn(e)}error(e,t){t instanceof Error?this.logger.error({err:t},e):"object"==typeof t&&null!==t?this.logger.error(t,e):void 0!==t?this.logger.error({error:t},e):this.logger.error(e)}fatal(e,t){t instanceof Error?this.logger.fatal({err:t},e):"object"==typeof t&&null!==t?this.logger.fatal(t,e):void 0!==t?this.logger.fatal({error:t},e):this.logger.fatal(e)}child(t){let n=new e;return n.logger=this.logger.child(t),n}};e.s(["default",0,a,"logger",0,a])},4315,e=>{"use strict";var t=e.i(8875),n=e.i(18387);let r=null,a=!1,i=new Map;function o(){if(r)return r;let e=process.env.REDIS_URL;if(!e)return n.default.warn("Redis: REDIS_URL not configured. Using in-memory fallback for rate limiting."),null;try{return(r=new t.default(e,{maxRetriesPerRequest:3,enableReadyCheck:!0,lazyConnect:!1,retryStrategy:e=>Math.min(50*e,2e3)})).on("connect",()=>{n.default.info("Redis: Connected successfully"),a=!0}),r.on("ready",()=>{n.default.info("Redis: Ready to accept commands"),a=!0}),r.on("error",e=>{n.default.error("Redis: Connection error",{message:e.message}),a=!1}),r.on("close",()=>{n.default.warn("Redis: Connection closed"),a=!1}),r}catch(e){return n.default.error("Redis: Failed to initialize client",{error:e}),null}}let s=!1;function l(){return a&&null!==r&&"ready"===r.status}async function c(e){let t=o();if(t&&l())try{return await t.get(e)}catch(e){n.default.error("Redis: GET error",{error:e})}let r=i.get(e);return r?r.expiresAt<Date.now()?(i.delete(e),null):r.value:null}async function u(e,t,r){let a=o();if(a&&l())try{return r?await a.setex(e,r,t):await a.set(e,t),!0}catch(e){n.default.error("Redis: SET error",{error:e})}let s=r?Date.now()+1e3*r:Number.MAX_SAFE_INTEGER;return i.set(e,{value:t,expiresAt:s}),!0}async function m(e){let t=o();if(t&&l())try{return await t.del(e),!0}catch(e){n.default.error("Redis: DEL error",{error:e})}return i.delete(e),!0}"u">typeof setInterval&&setInterval(function(){let e=Date.now();for(let[t,n]of i.entries())n.expiresAt<e&&i.delete(t)},6e4),e.s(["deleteInMemoryPattern",0,function(e){for(let t of i.keys())e.test(t)&&i.delete(t)},"getRedisClient",0,o,"isRedisConfigured",0,function(){let e=!!(process.env.REDIS_URL&&""!==process.env.REDIS_URL.trim());return e||s||(n.default.warn("Redis: REDIS_URL not configured. Multi-step pending-state Telegram flows and distributed rate limiting will not work reliably across Vercel serverless instances."),s=!0),e},"isRedisHealthy",0,l,"redisDel",0,m,"redisGet",0,c,"redisSet",0,u])},67973,e=>{"use strict";async function t(e,t,n){let r=process.env.TELEGRAM_BOT_TOKEN;if(!r)return void console.error("Missing TELEGRAM_BOT_TOKEN in environment variables");try{let a={chat_id:e,text:t,parse_mode:"Markdown"};n&&(a.reply_markup=n);let i=await fetch(`https://api.telegram.org/bot${r}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)});if(!i.ok){let a=await i.text();if(console.error(`Telegram API error (${i.status}): ${a}`),400===i.status&&/can't parse entities/i.test(a)){let a={chat_id:e,text:t};n&&(a.reply_markup=n),await fetch(`https://api.telegram.org/bot${r}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)})}}}catch(e){console.error("Failed to send Telegram message:",e)}}async function n(e,t){let n=process.env.TELEGRAM_BOT_TOKEN;if(n)try{await fetch(`https://api.telegram.org/bot${n}/answerCallbackQuery`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({callback_query_id:e,text:t})})}catch(e){console.error("Failed to answer callback query:",e)}}async function r(){let e=process.env.TELEGRAM_BOT_TOKEN;if(e)try{await fetch(`https://api.telegram.org/bot${e}/setMyCommands`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({commands:[{command:"balance",description:"💳 Accounts & Net Worth"},{command:"portfolio",description:"📈 Stock & Asset Breakdown"},{command:"summary",description:"📊 Monthly Flow & Savings"},{command:"history",description:"📜 Recent Transactions"},{command:"budget",description:"🎯 Category Budgets Status"},{command:"bills",description:"🗓️ Recurring Bills & Subscriptions"},{command:"taxharvest",description:"📉 Tax Loss Harvesting Opportunities"},{command:"dividends",description:"💵 Dividend Earnings Report"},{command:"backup",description:"📦 Download Data Backup (.json)"},{command:"ai",description:"🤖 AI Wealth Score & Insights"},{command:"goals",description:"🏆 Financial Goals Progress"},{command:"help",description:"💡 Commands & Assistant Guide"}]})})}catch(e){console.error("Failed to set Telegram bot commands:",e)}}async function a(e,t,n,r){let a=process.env.TELEGRAM_BOT_TOKEN;if(a)try{let i=new FormData;i.append("chat_id",e);let o=new Blob([n],{type:"application/json"});i.append("document",o,t),r&&(i.append("caption",r),i.append("parse_mode","Markdown")),await fetch(`https://api.telegram.org/bot${a}/sendDocument`,{method:"POST",body:i})}catch(e){console.error("Failed to send Telegram document:",e)}}async function i(e,t="typing"){let n=process.env.TELEGRAM_BOT_TOKEN;if(n)try{await fetch(`https://api.telegram.org/bot${n}/sendChatAction`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:e,action:t})})}catch(e){console.error("Failed to send Telegram chat action:",e)}}async function o(e){let t=process.env.TELEGRAM_BOT_TOKEN;if(!t||!e)return null;try{let n=await fetch(`https://api.telegram.org/bot${t}/getFile?file_id=${encodeURIComponent(e)}`);if(!n.ok)return null;let r=await n.json(),a=r?.result?.file_path;if(!a)return null;let i=await fetch(`https://api.telegram.org/file/bot${t}/${a}`);if(!i.ok)return null;let o=await i.arrayBuffer();return{buffer:Buffer.from(o),filePath:a}}catch(e){return console.error("Failed to download Telegram file:",e),null}}e.s(["answerCallbackQuery",0,n,"downloadTelegramFile",0,o,"getBrandEmoji",0,function(e){if(!e)return"💳";let t=e.toLowerCase().trim();return/sbi|state bank/i.test(t)?"🏦":/hdfc/i.test(t)?"💳":/icici/i.test(t)?"🏦":/axis/i.test(t)?"💳":/kotak/i.test(t)?"🏦":/pnb|bob|canara|union|boi|iob|uco/i.test(t)?"🏛️":/swiggy|zomato|eats|food/i.test(t)?"🍔":/uber|ola|rapido|cab|taxi/i.test(t)?"🚗":/amazon|flipkart|myntra|ajio|shopping/i.test(t)?"🛍️":/apple|iphone|mac/i.test(t)?"🍎":/google|pay|gpay/i.test(t)?"🌐":/netflix|spotify|prime|pvr|movie/i.test(t)?"🎬":/starbucks|coffee|cafe|tea/i.test(t)?"☕":/petrol|fuel|shell|bpcl|hpcl/i.test(t)?"⛽":/salary|payroll|stipend/i.test(t)?"💼":/dividend|interest|stock|share|crypto|btc|eth/i.test(t)?"💎":/rent|house|electricity|bill|utility/i.test(t)?"💡":"🏷️"},"sendTelegramChatAction",0,i,"sendTelegramDocument",0,a,"sendTelegramMessage",0,t,"setTelegramBotCommands",0,r])},76908,e=>{"use strict";let t={USD:85,EUR:92,GBP:108,AED:23.1,SGD:63,CAD:61.5,AUD:55,JPY:.55,INR:1};async function n(e,r="INR"){let a=e.toUpperCase().trim(),i=r.toUpperCase().trim();return a===i?1:"INR"===i&&t[a]?t[a]:85}e.s(["getExchangeRate",0,n,"parseToISODate",0,function(e){if(!e||"string"!=typeof e||0===e.trim().length)return new Date().toISOString().split("T")[0];let t=e.trim();if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;let n=(e,t,n)=>isNaN(e)||isNaN(t)||isNaN(n)||e<1900||e>2100||t<1||t>12||n<1||n>31?null:`${e}-${String(t).padStart(2,"0")}-${String(n).padStart(2,"0")}`,r=t.split(/[-/]/);if(3===r.length){if(4===r[0].length){let e=Number(r[0]),t=Number(r[1]),a=Number(r[2]),i=t>12?n(e,a,t):n(e,t,a);if(i)return i}if(4===r[2].length||2===r[2].length){let e=2===r[2].length?2e3+Number(r[2]):Number(r[2]),t=Number(r[0]),a=Number(r[1]),i=t>12?n(e,a,t):a>12?n(e,t,a):n(e,a,t);if(i)return i}}try{let e=new Date(t);if(!isNaN(e.getTime())){let t=n(e.getFullYear(),e.getMonth()+1,e.getDate());if(t)return t}}catch{}let a=new Date;return`${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,"0")}-${String(a.getDate()).padStart(2,"0")}`}])}];

//# debugId=71501d8b-1c1c-8aaa-b305-20ded5c6968d
//# sourceMappingURL=%5Broot-of-the-server%5D__1e2_ch2._.js.map