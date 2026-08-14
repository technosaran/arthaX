;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="9a31857f-880c-21b2-0715-4cad29db733f")}catch(e){}}();
module.exports=[18622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},20635,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},24725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},56704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},59043,(e,t,a)=>{t.exports=e.x("next/dist/server/runtime-reacts.external.js",()=>require("next/dist/server/runtime-reacts.external.js"))},93695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},81111,(e,t,a)=>{t.exports=e.x("node:stream",()=>require("node:stream"))},29319,e=>{"use strict";async function t(e,t,a,n){let r=e.trim();if(!r)throw Error("Gemini API key is empty");let i=[];n&&n.data&&i.push({inline_data:{mime_type:n.mimeType,data:n.data}}),i.push({text:t});let o={contents:[{parts:i}]};a&&(o.systemInstruction={parts:[{text:a}]});let s="";for(let e of["gemini-2.5-flash","gemini-2.5-pro","gemini-2.0-flash","gemini-1.5-flash"])try{let t=`https://generativelanguage.googleapis.com/v1beta/models/${e}:generateContent?key=${encodeURIComponent(r)}`,a=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)});if(a.ok){let e=await a.json(),t=e.candidates?.[0]?.content?.parts?.[0]?.text;if(t)return t}else s=await a.text()}catch(e){s=e.message||String(e)}throw Error(`Gemini API call failed across models: ${s}`)}async function a(e,a){try{let n=`You are an expert financial AI parser for FinanceOS. Analyze user text (which may contain typos, slang, hinglish, stock purchases, or mutual fund investments) and extract structured JSON matching this EXACT TypeScript schema:
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
Only output raw JSON without markdown code blocks.`,r=await t(a,`Parse this financial text: "${e}"`,n),i=r.match(/\{[\s\S]*\}/),o=JSON.parse(i?i[0]:r.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,intentType:o.intentType||"unknown",amount:"number"==typeof o.amount&&o.amount>0?o.amount:o.quantity&&o.price?o.quantity*o.price:null,category:o.category||("stock"===o.intentType||"mutual_fund"===o.intentType?"Investments":"Other"),description:o.description||e,accountName:o.accountName||null,symbol:o.symbol||null,quantity:"number"==typeof o.quantity?o.quantity:null,price:"number"==typeof o.price?o.price:null,fundName:o.fundName||null}}catch(t){return{success:!1,intentType:"unknown",amount:null,category:"Other",description:e,accountName:null,error:t.message||"Failed to parse with Gemini"}}}async function n(e,a,n,r){try{let i=r?`
Recent Conversation History:
${r}
`:"",o=`You are the Autonomous Financial AI Engine for FinanceOS & Telegram.
Analyze user natural language messages and autonomously decide what financial action to execute.

User's Live Financial Context (Accounts, Balances, Category Spending, Investments, Budgets, Family):
${a}
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

Output raw JSON with no markdown tags.`,s=await t(n,`User message: "${e}"`,o),l=s.match(/\{[\s\S]*\}/),u=JSON.parse(l?l[0]:s.replace(/```json/g,"").replace(/```/g,"").trim());return{action:u.action||"UNKNOWN",accountName:u.accountName||null,accountType:u.accountType||"checking",initialBalance:"number"==typeof u.initialBalance?u.initialBalance:null,amount:"number"==typeof u.amount?u.amount:null,category:u.category||null,description:u.description||null,targetAccountName:u.targetAccountName||null,fromAccountName:u.fromAccountName||null,toAccountName:u.toAccountName||null,familyMemberName:u.familyMemberName||null,symbol:u.symbol||null,quantity:"number"==typeof u.quantity?u.quantity:null,price:"number"==typeof u.price?u.price:null,fundName:u.fundName||null,replyMessage:u.replyMessage||null,familyRelationship:u.familyRelationship||null,newAccountName:u.newAccountName||null,reasoning:u.reasoning||null}}catch(e){return{action:"UNKNOWN",reasoning:e.message||"Failed to process autonomous intent"}}}async function r(e,a,n,r,i){try{let o=i?`
Recent Conversation History:
${i}
`:"",s=`You are the Multimodal Voice & Audio Financial AI Engine for FinanceOS & Telegram.
Listen to the user's recorded voice note audio message.
1. Transcribe the audio accurately into text.
2. Determine the user's financial intent and decide what action to execute.

User's Live Financial Context:
${n}
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

Output raw JSON with no markdown tags.`,l=await t(r,"Transcribe audio and analyze financial intent from this voice note.",s,{mimeType:a||"audio/ogg",data:e}),u=l.match(/\{[\s\S]*\}/),c=JSON.parse(u?u[0]:l.replace(/```json/g,"").replace(/```/g,"").trim());return{transcription:c.transcription||"Voice audio processed",action:c.action||"UNKNOWN",accountName:c.accountName||null,accountType:c.accountType||"checking",initialBalance:"number"==typeof c.initialBalance?c.initialBalance:null,amount:"number"==typeof c.amount?c.amount:null,category:c.category||null,description:c.description||c.transcription||null,targetAccountName:c.targetAccountName||null,fromAccountName:c.fromAccountName||null,toAccountName:c.toAccountName||null,familyMemberName:c.familyMemberName||null,symbol:c.symbol||null,quantity:"number"==typeof c.quantity?c.quantity:null,price:"number"==typeof c.price?c.price:null,fundName:c.fundName||null,replyMessage:c.replyMessage||null,reasoning:c.reasoning||null}}catch(e){return{action:"UNKNOWN",reasoning:e.message||"Failed to process voice note with Gemini"}}}async function i(e,a,n,r){try{let n=`You are an expert Vision Financial Receipt Scanner for FinanceOS.
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
Output raw JSON with no markdown tags.`,i=await t(r,"Analyze this receipt image and extract total amount, merchant, and items.",n,{mimeType:a||"image/jpeg",data:e}),o=i.match(/\{[\s\S]*\}/),s=JSON.parse(o?o[0]:i.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,merchantName:s.merchantName||"Store Purchase",amount:"number"==typeof s.amount&&s.amount>0?s.amount:null,date:s.date||null,category:s.category||"Shopping",items:Array.isArray(s.items)?s.items:[],description:s.description||`${s.merchantName||"Receipt"} Purchase`,accountName:s.accountName||null}}catch(e){return{success:!1,merchantName:"Receipt",amount:null,date:null,category:"Other",items:[],description:"Receipt Scan Failed",error:e.message||"Failed to analyze receipt"}}}async function o(e,a,n,r){let i=r?`
Recent Conversation History:
${r}
`:"",o=`You are the Lead Financial Advisor & AI Assistant for FinanceOS.
Your goal is to provide insightful, actionable, and beautifully formatted financial responses for Telegram and the Web Dashboard.

Formatting Guidelines for Telegram:
- Use clean Telegram Markdown (*bold* for key numbers, titles, metrics, and categories).
- Use relevant financial emojis (🟢 Income/Profit, 🔴 Expense/Loss, 💳 Bank/Account, 📊 Metrics, 🎯 Goals, 💡 Tips).
- Keep answers structured with bullet points or numbered steps.
- Highlight concrete figures from user context (e.g. *Net Worth*: ₹X, *Food Budget*: ₹Y).
- Conclude with a helpful, encouraging financial tip or actionable next step.

User's Live Financial Context:
${a}
${i}`;return await t(n,e,o)}async function s(e,a){try{let n=`You are an expert Income Tax Law & Union Budget AI Parser for FinanceOS.
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

Output raw JSON only with no markdown formatting.`,r=await t(a,`Parse this tax notification / budget text: "${e}"`,n),i=r.match(/\{[\s\S]*\}/),o=JSON.parse(i?i[0]:r.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,fyStartYear:"number"==typeof o.fyStartYear?o.fyStartYear:new Date().getFullYear(),version:o.version||`FY${o.fyStartYear||new Date().getFullYear()}-v1`,standardDeductionOld:"number"==typeof o.standardDeductionOld?o.standardDeductionOld:5e4,standardDeductionNew:"number"==typeof o.standardDeductionNew?o.standardDeductionNew:75e3,cessRate:"number"==typeof o.cessRate?o.cessRate:.04,stcgRate:"number"==typeof o.stcgRate?o.stcgRate:.2,ltcgRate:"number"==typeof o.ltcgRate?o.ltcgRate:.125,ltcgExemption:"number"==typeof o.ltcgExemption?o.ltcgExemption:125e3,oldRegimeSlabs:Array.isArray(o.oldRegimeSlabs)?o.oldRegimeSlabs:[],newRegimeSlabs:Array.isArray(o.newRegimeSlabs)?o.newRegimeSlabs:[],deductionLimits:o.deductionLimits||{"80C":15e4,"80D":25e3},summary:o.summary||"Tax rules successfully updated"}}catch(e){return{success:!1,fyStartYear:new Date().getFullYear(),version:"Error",standardDeductionOld:5e4,standardDeductionNew:75e3,cessRate:.04,stcgRate:.2,ltcgRate:.125,ltcgExemption:125e3,oldRegimeSlabs:[],newRegimeSlabs:[],deductionLimits:{},summary:"Parsing failed",error:e.message||"Failed to parse tax announcement with Gemini AI"}}}e.s(["askGeminiFinanceAssistant",0,o,"callGeminiApi",0,t,"getGeminiApiKeyForProfile",0,function(e){if(!e||!1===e.gemini_enabled)return null;let t=e.gemini_api_key||process.env.GEMINI_API_KEY;return t?.trim()||null},"isGeminiActiveForProfile",0,function(e){if(!e||!1===e.gemini_enabled)return!1;let t=e.gemini_api_key||process.env.GEMINI_API_KEY;return!!t&&t.trim().length>0},"parseAutonomousTelegramIntent",0,n,"parseBudgetOrTaxAnnouncementWithGemini",0,s,"parseReceiptWithGemini",0,i,"parseTransactionWithGemini",0,a,"parseVoiceNoteWithGemini",0,r])},18688,e=>{"use strict";var t=e.i(87022),a=e.i(93458);let n=(0,e.i(47540).cache)(async()=>{let e=process.env.NEXT_PUBLIC_SUPABASE_URL,n=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!e)throw Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL is required to initialize Supabase Server Client.");if(!n)throw Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required to initialize Supabase Server Client.");let r=await (0,a.cookies)();return(0,t.createServerClient)(e,n,{cookies:{getAll:()=>r.getAll(),setAll(e){try{e.forEach(({name:e,value:t,options:a})=>{let n=""===t||a?.maxAge===0;r.set(e,t,{...a,maxAge:n?0:a?.maxAge??2592e3,sameSite:a?.sameSite??"lax",path:a?.path??"/"})})}catch{}}}})});e.s(["createClient",0,n])},14560,e=>{"use strict";let t=[{version:"FY2024-25-v1",fyStartYear:2024,standardDeductionOld:5e4,standardDeductionNew:75e3,cessRate:.04,sec87aThresholdNew:7e5,sec87aMaxRebateNew:25e3,sec87aThresholdOld:5e5,sec87aMaxRebateOld:12500,oldRegimeSlabs:[{upto:25e4,rate:0},{upto:5e5,rate:.05},{upto:1e6,rate:.2},{upto:null,rate:.3}],newRegimeSlabs:[{upto:3e5,rate:0},{upto:6e5,rate:.05},{upto:9e5,rate:.1},{upto:12e5,rate:.15},{upto:15e5,rate:.2},{upto:null,rate:.3}],deductionLimits:{"80C":15e4,"80D":25e3,"80CCD(1B)":5e4}},{version:"FY2025-26-v1",fyStartYear:2025,standardDeductionOld:5e4,standardDeductionNew:75e3,cessRate:.04,sec87aThresholdNew:12e5,sec87aMaxRebateNew:6e4,sec87aThresholdOld:5e5,sec87aMaxRebateOld:12500,oldRegimeSlabs:[{upto:25e4,rate:0},{upto:5e5,rate:.05},{upto:1e6,rate:.2},{upto:null,rate:.3}],newRegimeSlabs:[{upto:4e5,rate:0},{upto:8e5,rate:.05},{upto:12e5,rate:.1},{upto:16e5,rate:.15},{upto:2e6,rate:.2},{upto:24e5,rate:.25},{upto:null,rate:.3}],deductionLimits:{"80C":15e4,"80D":25e3,"80CCD(1B)":5e4}}],a=["salary","payroll","bonus","stipend"],n=["rent","house","property"],r=["interest","dividend","gift","misc","freelance"],i={"80C":["epf","ppf","elss","lic","life insurance","tuition","principal","home loan principal","ssy","sukanya","nsc","tax saver fd","80c"],"80D":["health insurance","medical insurance","mediclaim","80d"],"80CCD(1B)":["nps","pension","80ccd"],"10(13A)":["hra","house rent","rent paid"]},o=["tds","tax deducted"],s=["tcs","tax collected"],l=["advance tax","self assessment tax"],u=["cgst"],c=["sgst"],m=["igst"],d=["gst","cgst","sgst","igst"];function p(e){if(null==e)return 0;let t="string"==typeof e?Number(e):e;return Number.isFinite(t)?t:0}function g(e){return(e||"").toLowerCase()}function y(e,t){let a=g(e);return t.some(e=>a.includes(e))}function f(e,t){if(!e)return!1;let a=new Date(e);if(Number.isNaN(a.getTime()))return!1;let n=new Date(a.getTime()+198e5),r=n.getUTCFullYear();return n.getUTCMonth()>=3?r===t:r===t+1}function h(e,t){if(e<=0)return 0;let a=e,n=0,r=0;for(let e of t){let t=e.upto,i=null===t?a:Math.max(0,Math.min(a,t-n));if(r+=i*e.rate,(a-=i)<=0)break;null!==t&&(n=t)}return r}function N(e){if(!e)return 0;let t=new Date(e);return Number.isNaN(t.getTime())?0:Math.floor((Date.now()-t.getTime())/864e5)}function b(e){let t=String(e+1).slice(2);return`FY ${e}-${t}`}function x(e){let x,{fyStartYear:A,regime:T}=e,S=(x=t.find(e=>e.fyStartYear===A))||t[t.length-1],E=e.incomes.filter(e=>f(e.date??null,A)),v=e.expenses.filter(e=>f(e.date??null,A)),_=e.transactions.filter(e=>f(e.date??null,A)),C=E.filter(e=>y(e.category,a)).reduce((e,t)=>e+p(t.amount),0),w=E.filter(e=>y(e.category,n)).reduce((e,t)=>e+p(t.amount),0),R=v.filter(e=>y(e.category,["home loan interest","house maintenance","property tax"])).reduce((e,t)=>e+p(t.amount),0),O=E.filter(e=>y(e.category,r)).reduce((e,t)=>e+p(t.amount),0),I=E.filter(e=>!y(e.category,a)&&!y(e.category,n)&&!y(e.category,r)).reduce((e,t)=>e+p(t.amount),0),M=[];for(let t of e.investments){let e=p(t.quantity),a=p(t.buy_price),n=e*(p(t.current_price||t.buy_price)-a),r=N(t.bought_at||null);M.push({assetClass:g(t.type).includes("crypto")?"Crypto":"Equity",name:t.symbol||t.name||"Investment",type:r>365?"LTCG":"STCG",gain:n,sourceId:t.id})}for(let t of e.mutualFunds){let e=p(t.units),a=p(t.avg_nav),n=e*(p(t.current_nav||t.avg_nav)-a),r=N(t.created_at||null);M.push({assetClass:"Mutual Funds",name:t.fund_name||"Mutual Fund",type:r>365?"LTCG":"STCG",gain:n,sourceId:t.id})}for(let t of e.bonds){let e=p(t.quantity),a=p(t.purchase_price),n=p(t.current_value||e*p(t.current_price))-e*a,r=N(t.created_at||null);M.push({assetClass:"Bonds",name:t.bond_name||"Bond",type:r>365?"LTCG":"STCG",gain:n,sourceId:t.id})}for(let t of e.alternativeAssets){let e=p(t.current_value)-p(t.purchase_price),a=N(t.created_at||null);M.push({assetClass:t.category||"Alt Assets",name:t.name||"Asset",type:a>365?"LTCG":"STCG",gain:e,sourceId:t.id})}let F=M.filter(e=>"STCG"===e.type).reduce((e,t)=>e+t.gain,0),U=M.filter(e=>"LTCG"===e.type).reduce((e,t)=>e+t.gain,0),L=Object.entries(S.deductionLimits).map(([e,t])=>{let a=v.filter(t=>y(t.category,i[e]||[])).reduce((e,t)=>e+p(t.amount),0);return{code:e,limit:t,used:a,eligible:Math.min(a,t)}}),B=L.reduce((e,t)=>e+t.eligible,0),D=_.filter(e=>"expense"===e.type&&y(e.category,o)).reduce((e,t)=>e+p(t.amount),0),k=_.filter(e=>"expense"===e.type&&y(e.category,s)).reduce((e,t)=>e+p(t.amount),0),Y=_.filter(e=>"expense"===e.type&&y(e.category,l)).reduce((e,t)=>e+p(t.amount),0),G=_.filter(e=>"expense"===e.type&&y(e.category,d)).reduce((e,t)=>e+p(t.amount),0),P=_.filter(e=>"expense"===e.type&&y(e.category,u)).reduce((e,t)=>e+p(t.amount),0),q=_.filter(e=>"expense"===e.type&&y(e.category,c)).reduce((e,t)=>e+p(t.amount),0),H=_.filter(e=>"expense"===e.type&&y(e.category,m)).reduce((e,t)=>e+p(t.amount),0),$=C+(w-R)+O+I+F+U,j=Math.max(0,$-S.standardDeductionOld-B),W=Math.max(0,$-S.standardDeductionNew),J=h(j,S.oldRegimeSlabs),K=h(W,S.newRegimeSlabs),z=(e,t,a,n)=>{if(e<=0||t<=0)return 0;if(e<=a)return Math.min(t,n);let r=e-a;return t>r?Math.max(0,Math.min(t-r,n)):0},X=S.sec87aThresholdNew??(A>=2025?12e5:7e5),V=S.sec87aMaxRebateNew??(A>=2025?6e4:25e3),Q=z(j,J,S.sec87aThresholdOld??5e5,S.sec87aMaxRebateOld??12500),Z=z(W,K,X,V),ee=Math.max(0,K-Z),et=Math.max(0,J-Q)*(1+S.cessRate),ea=ee*(1+S.cessRate),en="old"===T?et:ea,er=D+k+Y,ei=e.liabilities.reduce((e,t)=>e+p(t.remaining_amount),0),eo=e.liabilities.reduce((e,t)=>e+p(t.monthly_payment),0),es=_.filter(e=>"income"===e.type).reduce((e,t)=>e+p(t.amount),0)-_.filter(e=>"expense"===e.type).reduce((e,t)=>e+p(t.amount),0),el=e.investments.reduce((e,t)=>e+p(t.quantity)*p(t.current_price||t.buy_price),0),eu=e.mutualFunds.reduce((e,t)=>e+p(t.units)*p(t.current_nav||t.avg_nav),0),ec=e.bonds.reduce((e,t)=>e+p(t.current_value||p(t.quantity)*p(t.current_price)),0),em=e.alternativeAssets.reduce((e,t)=>e+p(t.current_value),0),ed=Math.max(0,es)+el+eu+ec+em,ep=Object.entries(_.filter(e=>"expense"===e.type).reduce((e,t)=>{let a=t.category||"Others";return e[a]=(e[a]||0)+p(t.amount),e},{})).map(([e,t])=>({category:e,amount:t})).sort((e,t)=>t.amount-e.amount).slice(0,7),eg=_.filter(e=>"income"===e.type).reduce((e,t)=>e+p(t.amount),0),ey=_.filter(e=>"expense"===e.type).reduce((e,t)=>e+p(t.amount),0),ef=new Date,eh=ef.getFullYear(),eN=ef.getMonth(),eb=_.filter(e=>{if(!e.date)return!1;let t=new Date(e.date);return t.getFullYear()===eh&&t.getMonth()===eN}),ex=eb.filter(e=>"income"===e.type).reduce((e,t)=>e+p(t.amount),0),eA=eb.filter(e=>"expense"===e.type).reduce((e,t)=>e+p(t.amount),0),eT=3*Math.floor(eN/3),eS=_.filter(e=>{if(!e.date)return!1;let t=new Date(e.date);return t.getFullYear()===eh&&t.getMonth()>=eT&&t.getMonth()<eT+3}),eE=eS.filter(e=>"income"===e.type).reduce((e,t)=>e+p(t.amount),0),ev=eS.filter(e=>"expense"===e.type).reduce((e,t)=>e+p(t.amount),0);return{fiscal:{fyStartYear:A,label:b(A),ruleVersion:S.version,taxRegime:T,taxCalendar:[{dueDate:`15 Jun ${A}`,label:"Advance Tax Q1 (15%)"},{dueDate:`15 Sep ${A}`,label:"Advance Tax Q2 (45% cumulative)"},{dueDate:`15 Dec ${A}`,label:"Advance Tax Q3 (75% cumulative)"},{dueDate:`15 Mar ${A+1}`,label:"Advance Tax Q4 (100% cumulative)"},{dueDate:`31 Jul ${A+1}`,label:"ITR filing (non-audit taxpayers)"}]},taxHeads:{salaryIncome:C,housePropertyIncome:w-R,capitalGains:{stcg:F,ltcg:U},otherSourcesIncome:O+I,grossIncome:$},deductions:{items:L,totalEligible:B},taxPayment:{tds:D,tcs:k,advanceTax:Y,gst:G,gstBreakdown:{cgst:P,sgst:q,igst:H},totalTaxPaid:er,taxPayable:Math.max(0,en-er),taxRefundEstimate:Math.max(0,er-en)},regimeComparison:{old:et,new:ea,recommended:et<=ea?"old":"new",savingsVsOther:Math.abs(et-ea)},capitalGainsRows:M,reports:{monthly:{income:ex,expense:eA,pnl:ex-eA},quarterly:{income:eE,expense:ev,pnl:eE-ev},annual:{income:eg,expense:ey,pnl:eg-ey},balanceSheet:{totalAssets:ed,totalLiabilities:ei,netWorth:ed-ei},spendingCategories:ep,assetAllocation:[{label:"Equity & Crypto",value:el},{label:"Mutual Funds",value:eu},{label:"Bonds",value:ec},{label:"Alt Assets",value:em}],liabilities:{totalOutstanding:ei,monthlyEmi:eo},familyConsolidated:{supported:!0,note:"Family-level rollups are based on available shared transactions in this account context."}},audit:{incomeRows:E.map(e=>e.id).filter(Boolean),expenseRows:v.map(e=>e.id).filter(Boolean),transactionRows:_.map(e=>e.id).filter(Boolean),capitalGainSourceRows:M.map(e=>e.sourceId).filter(Boolean),assumptions:["Capital gains are mark-to-market approximations from holdings.","Deduction eligibility is inferred from category labels.","Use this report as a high-level planning aid, not as a statutory filing output."]}}}e.s(["INDIA_TAX_RULES",0,t,"computeIndiaTaxReport",0,x,"computeTaxLossHarvesting",0,function(e){let t=x(e),a=t.taxHeads.capitalGains.stcg,n=t.taxHeads.capitalGains.ltcg,r=.2*Math.max(0,a),i=.125*Math.max(0,n-125e3),o=Math.max(0,125e3-Math.max(0,n)),s=[];for(let t of e.investments){let e=p(t.quantity),a=p(t.buy_price),n=p(t.current_price||t.buy_price),r=e*a,i=e*n,l=i-r,u=N(t.bought_at||null),c=u>365,m=g(t.type).includes("crypto")?"Crypto":"Equity",d="Neutral",y=0;l<0&&"Crypto"!==m?(d="Loss Harvest",y=Math.abs(l)*(c?.125:.2)):l>0&&c&&o>0&&(d="Gain Harvest (LTCG Exemption)",y=.125*Math.min(l,o)),s.push({id:t.id||`stock-${t.symbol||t.name}`,name:t.symbol||t.name||"Stock Holding",assetClass:m,isLtcg:c,holdingDays:u,investedValue:r,currentValue:i,unrealizedPnl:l,harvestType:d,potentialTaxSavings:y})}for(let t of e.mutualFunds){let e=p(t.units),a=p(t.avg_nav),n=p(t.current_nav||t.avg_nav),r=e*a,i=e*n,l=i-r,u=N(t.created_at||null),c=u>365,m="Neutral",d=0;l<0?(m="Loss Harvest",d=Math.abs(l)*(c?.125:.2)):l>0&&c&&o>0&&(m="Gain Harvest (LTCG Exemption)",d=.125*Math.min(l,o)),s.push({id:t.id||`mf-${t.fund_name}`,name:t.fund_name||"Mutual Fund",assetClass:"Mutual Funds",isLtcg:c,holdingDays:u,investedValue:r,currentValue:i,unrealizedPnl:l,harvestType:m,potentialTaxSavings:d})}for(let t of e.bonds){let e=p(t.quantity),a=p(t.purchase_price),n=p(t.current_value||e*p(t.current_price)),r=e*a,i=n-r,o=N(t.created_at||null),l=o>365,u="Neutral",c=0;i<0&&(u="Loss Harvest",c=Math.abs(i)*(l?.125:.2)),s.push({id:t.id||`bond-${t.bond_name}`,name:t.bond_name||"Bond Holding",assetClass:"Bonds",isLtcg:l,holdingDays:o,investedValue:r,currentValue:n,unrealizedPnl:i,harvestType:u,potentialTaxSavings:c})}for(let t of e.alternativeAssets){let e=p(t.purchase_price),a=p(t.current_value),n=a-e,r=N(t.created_at||null),i=r>365,o="Neutral",l=0;n<0&&(o="Loss Harvest",l=Math.abs(n)*(i?.125:.2)),s.push({id:t.id||`alt-${t.name}`,name:t.name||"Alternative Asset",assetClass:t.category||"Alt Assets",isLtcg:i,holdingDays:r,investedValue:e,currentValue:a,unrealizedPnl:n,harvestType:o,potentialTaxSavings:l})}let l=s.filter(e=>"Loss Harvest"===e.harvestType).reduce((e,t)=>e+Math.abs(t.unrealizedPnl),0),u=s.filter(e=>"Gain Harvest (LTCG Exemption)"===e.harvestType).reduce((e,t)=>e+t.unrealizedPnl,0),c=s.reduce((e,t)=>e+t.potentialTaxSavings,0);return{stcgRealized:a,ltcgRealized:n,initialTaxPayable:r+i,unusedLtcgExemption:o,items:s,totalLossHarvestable:l,totalGainHarvestableTaxFree:u,maxPotentialTaxSavings:c}},"formatFYLabel",0,b,"getCurrentFYStartYear",0,function(e=new Date){let t=e.getFullYear();return e.getMonth()>=3?t:t-1}])}];

//# debugId=9a31857f-880c-21b2-0715-4cad29db733f
//# sourceMappingURL=%5Broot-of-the-server%5D__03ovvwg._.js.map