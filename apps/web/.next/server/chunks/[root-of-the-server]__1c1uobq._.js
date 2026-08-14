;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="140d8c2e-9194-fcff-7d37-77ba8ed7803e")}catch(e){}}();
module.exports=[18622,(e,t,n)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},20635,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},24725,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},56704,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},59043,(e,t,n)=>{t.exports=e.x("next/dist/server/runtime-reacts.external.js",()=>require("next/dist/server/runtime-reacts.external.js"))},93695,(e,t,n)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},81111,(e,t,n)=>{t.exports=e.x("node:stream",()=>require("node:stream"))},59103,e=>{"use strict";var t=e.i(89171),n=e.i(18688),a=e.i(29319);async function r(e){try{let r,i=await (0,n.createClient)(),{data:{user:o},error:s}=await i.auth.getUser();if(s||!o)return t.NextResponse.json({error:"Unauthorized"},{status:401});let{data:l}=await i.from("profiles").select("*").eq("id",o.id).maybeSingle();if(l?.gemini_enabled===!1)return t.NextResponse.json({error:"Gemini AI is disabled in your settings. Enable it to use the AI assistant."},{status:403});let u=l?.gemini_api_key||process.env.GEMINI_API_KEY;if(!u)return t.NextResponse.json({error:"Gemini API key is not configured. Please set GEMINI_API_KEY in environment or Settings."},{status:400});try{r=await e.json()}catch{return t.NextResponse.json({error:"Invalid JSON request body"},{status:400})}let{mode:c,prompt:m,contextSummary:d,text:p}=r;if("parse"===c){if(!p&&!m)return t.NextResponse.json({error:"Text is required for parse mode"},{status:400});let e=await (0,a.parseTransactionWithGemini)(p||m||"",u);return t.NextResponse.json({success:!0,data:e})}if("insights"===c){let{data:e}=await i.rpc("get_finance_overview_v2"),n=e||{},r=`Net Worth: ₹${n.net_worth??"N/A"}
Total Income: ₹${n.total_income??"N/A"}
Total Expenses: ₹${n.total_expenses??"N/A"}
Savings Rate: ${n.savings_rate??"N/A"}%
Top Expense Category: ${n.top_expense_category??"N/A"}
Investment Value: ₹${n.investment_value??"N/A"}`,o=`Provide a 3-bullet-point financial summary for this user:
- Bullet 1: Top spending category observation & advice
- Bullet 2: Net worth & savings progress encouragement
- Bullet 3: Actionable financial tip for this week
Keep it concise, friendly, and empowering.`,s=await (0,a.callGeminiApi)(u,o,`User Financial Summary Data:
${r}`);return t.NextResponse.json({success:!0,answer:s})}if(!m)return t.NextResponse.json({error:"Prompt is required"},{status:400});let g=await (0,a.askGeminiFinanceAssistant)(m,d||"User Dashboard Context",u);return t.NextResponse.json({success:!0,answer:g})}catch(e){return console.error("AI Assistant API Error:",e),t.NextResponse.json({error:e.message||"Failed to process AI request"},{status:500})}}e.s(["POST",0,r])},45020,e=>{"use strict";var t=e.i(47909),n=e.i(74017),a=e.i(96250),r=e.i(59756),i=e.i(61916),o=e.i(74677),s=e.i(69741),l=e.i(16795),u=e.i(87718),c=e.i(95169),m=e.i(47587),d=e.i(66012),p=e.i(70101),g=e.i(26937),h=e.i(10372),f=e.i(93695);e.i(52474);var y=e.i(5232);let N=new t.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/ai/assistant/route",pathname:"/api/ai/assistant",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/apps/web/src/app/api/ai/assistant/route.ts",nextConfigOutput:"",userland:()=>e.r(59103),...{}}),{workAsyncStorage:A,workUnitAsyncStorage:E,serverHooks:x}=N;async function R(e,t,a){a.requestMeta&&(0,r.setRequestMeta)(e,a.requestMeta),N.isDev&&(0,r.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let A="/api/ai/assistant/route";A=A.replace(/\/index$/,"")||"/";let E=await N.prepare(e,t,{srcPage:A,multiZoneDraftMode:!1});if(!E)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:x,deploymentId:R,params:b,nextConfig:S,parsedUrl:v,isDraftMode:T,prerenderManifest:w,routerServerContext:C,isOnDemandRevalidate:_,revalidateOnlyGenerated:I,resolvedPathname:O,clientReferenceManifest:U,serverActionsManifest:k}=E,F=(0,s.normalizeAppPath)(A),P=!!(w.dynamicRoutes[F]||w.routes[O]),B=async()=>((null==C?void 0:C.render404)?await C.render404(e,t,v,!1):t.end("This page could not be found"),null);if(P&&!T){let e=!!w.routes[O],t=w.dynamicRoutes[F];if(t&&!1===t.fallback&&!e){if(S.adapterPath)return await B();throw new f.NoFallbackError}}let M=null;!P||N.isDev||T||(M="/index"===(M=O)?"/":M);let L=!0===N.isDev||!P,D=P&&!L;k&&U&&(0,o.setManifestsSingleton)({page:A,clientReferenceManifest:U,serverActionsManifest:k});let q=e.method||"GET",G=(0,i.getTracer)(),Y=G.getActiveScopeSpan(),j=!!(null==C?void 0:C.isWrappedByNextServer),H=!!(0,r.getRequestMeta)(e,"minimalMode"),$=(0,r.getRequestMeta)(e,"incrementalCache")||await N.getIncrementalCache(e,S,w,H);null==$||$.resetRequestCache(),globalThis.__incrementalCache=$;let K={params:b,previewProps:w.preview,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts,useCacheTimeout:S.experimental.useCacheTimeout},cacheComponents:!!S.cacheComponents,validationLevel:S.experimental.instantInsights.validationLevel,supportsDynamicResponse:L,incrementalCache:$,hmrRefreshHash:(0,r.getRequestMeta)(e,"hmrRefreshHash"),cacheLifeProfiles:S.cacheLife,staticPageGenerationTimeout:S.staticPageGenerationTimeout,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,n,a,r)=>N.onRequestError(e,t,a,r,C)},sharedContext:{buildId:x,deploymentId:R}},W=new l.NodeNextRequest(e),J=new l.NodeNextResponse(t),X=u.NextRequestAdapter.fromNodeNextRequest(W,(0,u.signalFromNodeResponse)(t)),z=async({previousCacheEntry:n})=>{try{if(!H&&_&&I&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await N.handle(X,K);e.fetchMetrics=K.renderOpts.fetchMetrics;let i=K.renderOpts.pendingWaitUntil;i&&a.waitUntil&&(a.waitUntil(i),i=void 0);let o=K.renderOpts.collectedTags;if(!P)return await (0,d.sendResponse)(W,J,r,i),null;{let e=await r.blob(),t=(0,p.toNodeOutgoingHttpHeaders)(r.headers);o&&(t[h.NEXT_CACHE_TAGS_HEADER]=o),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let n=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,a=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=h.INFINITE_CACHE?!1!==n&&n>0?S.expireTime:void 0:K.renderOpts.collectedExpire;return{value:{kind:y.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:n,expire:a}}}}catch(t){throw(null==n?void 0:n.isStale)&&await N.onRequestError(e,t,{routerKind:"App Router",routePath:A,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:_})},!1,C),t}},V=async(r,o)=>{try{var s,l;let r=await N.handleResponse({req:e,nextConfig:S,cacheKey:M,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:w,isRoutePPREnabled:!1,isOnDemandRevalidate:_,revalidateOnlyGenerated:I,responseGenerator:z,waitUntil:a.waitUntil,isMinimalMode:H});if(!P)return;if((null==r||null==(s=r.value)?void 0:s.kind)!==y.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==r||null==(l=r.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});H||t.setHeader("x-nextjs-cache",_?"REVALIDATED":r.isMiss?"MISS":r.isStale?"STALE":"HIT"),T&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let i=(0,p.fromNodeOutgoingHttpHeaders)(r.value.headers);H&&P||i.delete(h.NEXT_CACHE_TAGS_HEADER),!r.cacheControl||t.getHeader("Cache-Control")||i.get("Cache-Control")||i.set("Cache-Control",(0,g.getCacheControlHeader)(r.cacheControl)),await (0,d.sendResponse)(W,J,new Response(r.value.body,{headers:i,status:r.value.status||200}));return}catch(t){if(t instanceof f.NoFallbackError||await N.onRequestError(e,t,{routerKind:"App Router",routePath:F,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:_})},!1,C),P)throw t;await (0,d.sendResponse)(W,J,new Response(null,{status:500}));return}finally{(()=>{if(!r)return;let e=t.statusCode;r.setAttributes({"http.status_code":e,"next.rsc":!1}),e&&e>=500&&(r.setStatus({code:i.SpanStatusCode.ERROR}),r.setAttribute("error.type",e.toString()));let n=G.getRootSpanAttributes();if(!n)return;if(n.get("next.span_type")!==c.BaseServerSpan.handleRequest)return console.warn(`Unexpected root span type '${n.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=n.get("next.route")||F,s=`${q} ${a}`;r.setAttributes({"next.route":a,"http.route":a,"next.span_name":s}),r.updateName(s),o&&o!==r&&(o.setAttribute("http.route",a),o.updateName(s))})()}};if(j&&Y)await V(Y,void 0);else{let t=G.getActiveScopeSpan();await G.withPropagatedContext(e.headers,()=>G.trace(c.BaseServerSpan.handleRequest,{spanName:`${q} ${A}`,kind:i.SpanKind.SERVER,attributes:{"http.method":q,"http.target":e.url}},e=>V(e,t)),void 0,!j)}}e.s(["handler",0,R,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:E})},"routeModule",0,N,"serverHooks",0,x,"workAsyncStorage",0,A,"workUnitAsyncStorage",0,E])},29319,e=>{"use strict";async function t(e,t,n,a){let r=e.trim();if(!r)throw Error("Gemini API key is empty");let i=[];a&&a.data&&i.push({inline_data:{mime_type:a.mimeType,data:a.data}}),i.push({text:t});let o={contents:[{parts:i}]};n&&(o.systemInstruction={parts:[{text:n}]});let s="";for(let e of["gemini-2.5-flash","gemini-2.5-pro","gemini-2.0-flash","gemini-1.5-flash"])try{let t=`https://generativelanguage.googleapis.com/v1beta/models/${e}:generateContent?key=${encodeURIComponent(r)}`,n=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)});if(n.ok){let e=await n.json(),t=e.candidates?.[0]?.content?.parts?.[0]?.text;if(t)return t}else s=await n.text()}catch(e){s=e.message||String(e)}throw Error(`Gemini API call failed across models: ${s}`)}async function n(e,n){try{let a=`You are an expert financial AI parser for FinanceOS. Analyze user text (which may contain typos, slang, hinglish, stock purchases, or mutual fund investments) and extract structured JSON matching this EXACT TypeScript schema:
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
Only output raw JSON without markdown code blocks.`,r=await t(n,`Parse this financial text: "${e}"`,a),i=r.match(/\{[\s\S]*\}/),o=JSON.parse(i?i[0]:r.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,intentType:o.intentType||"unknown",amount:"number"==typeof o.amount&&o.amount>0?o.amount:o.quantity&&o.price?o.quantity*o.price:null,category:o.category||("stock"===o.intentType||"mutual_fund"===o.intentType?"Investments":"Other"),description:o.description||e,accountName:o.accountName||null,symbol:o.symbol||null,quantity:"number"==typeof o.quantity?o.quantity:null,price:"number"==typeof o.price?o.price:null,fundName:o.fundName||null}}catch(t){return{success:!1,intentType:"unknown",amount:null,category:"Other",description:e,accountName:null,error:t.message||"Failed to parse with Gemini"}}}async function a(e,n,a,r){try{let i=r?`
Recent Conversation History:
${r}
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

Output raw JSON with no markdown tags.`,s=await t(a,`User message: "${e}"`,o),l=s.match(/\{[\s\S]*\}/),u=JSON.parse(l?l[0]:s.replace(/```json/g,"").replace(/```/g,"").trim());return{action:u.action||"UNKNOWN",accountName:u.accountName||null,accountType:u.accountType||"checking",initialBalance:"number"==typeof u.initialBalance?u.initialBalance:null,amount:"number"==typeof u.amount?u.amount:null,category:u.category||null,description:u.description||null,targetAccountName:u.targetAccountName||null,fromAccountName:u.fromAccountName||null,toAccountName:u.toAccountName||null,familyMemberName:u.familyMemberName||null,symbol:u.symbol||null,quantity:"number"==typeof u.quantity?u.quantity:null,price:"number"==typeof u.price?u.price:null,fundName:u.fundName||null,replyMessage:u.replyMessage||null,familyRelationship:u.familyRelationship||null,newAccountName:u.newAccountName||null,reasoning:u.reasoning||null}}catch(e){return{action:"UNKNOWN",reasoning:e.message||"Failed to process autonomous intent"}}}async function r(e,n,a,r,i){try{let o=i?`
Recent Conversation History:
${i}
`:"",s=`You are the Multimodal Voice & Audio Financial AI Engine for FinanceOS & Telegram.
Listen to the user's recorded voice note audio message.
1. Transcribe the audio accurately into text.
2. Determine the user's financial intent and decide what action to execute.

User's Live Financial Context:
${a}
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

Output raw JSON with no markdown tags.`,l=await t(r,"Transcribe audio and analyze financial intent from this voice note.",s,{mimeType:n||"audio/ogg",data:e}),u=l.match(/\{[\s\S]*\}/),c=JSON.parse(u?u[0]:l.replace(/```json/g,"").replace(/```/g,"").trim());return{transcription:c.transcription||"Voice audio processed",action:c.action||"UNKNOWN",accountName:c.accountName||null,accountType:c.accountType||"checking",initialBalance:"number"==typeof c.initialBalance?c.initialBalance:null,amount:"number"==typeof c.amount?c.amount:null,category:c.category||null,description:c.description||c.transcription||null,targetAccountName:c.targetAccountName||null,fromAccountName:c.fromAccountName||null,toAccountName:c.toAccountName||null,familyMemberName:c.familyMemberName||null,symbol:c.symbol||null,quantity:"number"==typeof c.quantity?c.quantity:null,price:"number"==typeof c.price?c.price:null,fundName:c.fundName||null,replyMessage:c.replyMessage||null,reasoning:c.reasoning||null}}catch(e){return{action:"UNKNOWN",reasoning:e.message||"Failed to process voice note with Gemini"}}}async function i(e,n,a,r){try{let a=`You are an expert Vision Financial Receipt Scanner for FinanceOS.
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
Output raw JSON with no markdown tags.`,i=await t(r,"Analyze this receipt image and extract total amount, merchant, and items.",a,{mimeType:n||"image/jpeg",data:e}),o=i.match(/\{[\s\S]*\}/),s=JSON.parse(o?o[0]:i.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,merchantName:s.merchantName||"Store Purchase",amount:"number"==typeof s.amount&&s.amount>0?s.amount:null,date:s.date||null,category:s.category||"Shopping",items:Array.isArray(s.items)?s.items:[],description:s.description||`${s.merchantName||"Receipt"} Purchase`,accountName:s.accountName||null}}catch(e){return{success:!1,merchantName:"Receipt",amount:null,date:null,category:"Other",items:[],description:"Receipt Scan Failed",error:e.message||"Failed to analyze receipt"}}}async function o(e,n,a,r){let i=r?`
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
${n}
${i}`;return await t(a,e,o)}async function s(e,n){try{let a=`You are an expert Income Tax Law & Union Budget AI Parser for FinanceOS.
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

Output raw JSON only with no markdown formatting.`,r=await t(n,`Parse this tax notification / budget text: "${e}"`,a),i=r.match(/\{[\s\S]*\}/),o=JSON.parse(i?i[0]:r.replace(/```json/g,"").replace(/```/g,"").trim());return{success:!0,fyStartYear:"number"==typeof o.fyStartYear?o.fyStartYear:new Date().getFullYear(),version:o.version||`FY${o.fyStartYear||new Date().getFullYear()}-v1`,standardDeductionOld:"number"==typeof o.standardDeductionOld?o.standardDeductionOld:5e4,standardDeductionNew:"number"==typeof o.standardDeductionNew?o.standardDeductionNew:75e3,cessRate:"number"==typeof o.cessRate?o.cessRate:.04,stcgRate:"number"==typeof o.stcgRate?o.stcgRate:.2,ltcgRate:"number"==typeof o.ltcgRate?o.ltcgRate:.125,ltcgExemption:"number"==typeof o.ltcgExemption?o.ltcgExemption:125e3,oldRegimeSlabs:Array.isArray(o.oldRegimeSlabs)?o.oldRegimeSlabs:[],newRegimeSlabs:Array.isArray(o.newRegimeSlabs)?o.newRegimeSlabs:[],deductionLimits:o.deductionLimits||{"80C":15e4,"80D":25e3},summary:o.summary||"Tax rules successfully updated"}}catch(e){return{success:!1,fyStartYear:new Date().getFullYear(),version:"Error",standardDeductionOld:5e4,standardDeductionNew:75e3,cessRate:.04,stcgRate:.2,ltcgRate:.125,ltcgExemption:125e3,oldRegimeSlabs:[],newRegimeSlabs:[],deductionLimits:{},summary:"Parsing failed",error:e.message||"Failed to parse tax announcement with Gemini AI"}}}e.s(["askGeminiFinanceAssistant",0,o,"callGeminiApi",0,t,"getGeminiApiKeyForProfile",0,function(e){if(!e||!1===e.gemini_enabled)return null;let t=e.gemini_api_key||process.env.GEMINI_API_KEY;return t?.trim()||null},"isGeminiActiveForProfile",0,function(e){if(!e||!1===e.gemini_enabled)return!1;let t=e.gemini_api_key||process.env.GEMINI_API_KEY;return!!t&&t.trim().length>0},"parseAutonomousTelegramIntent",0,a,"parseBudgetOrTaxAnnouncementWithGemini",0,s,"parseReceiptWithGemini",0,i,"parseTransactionWithGemini",0,n,"parseVoiceNoteWithGemini",0,r])},18688,e=>{"use strict";var t=e.i(87022),n=e.i(93458);let a=(0,e.i(47540).cache)(async()=>{let e=process.env.NEXT_PUBLIC_SUPABASE_URL,a=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!e)throw Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL is required to initialize Supabase Server Client.");if(!a)throw Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required to initialize Supabase Server Client.");let r=await (0,n.cookies)();return(0,t.createServerClient)(e,a,{cookies:{getAll:()=>r.getAll(),setAll(e){try{e.forEach(({name:e,value:t,options:n})=>{let a=""===t||n?.maxAge===0;r.set(e,t,{...n,maxAge:a?0:n?.maxAge??2592e3,sameSite:n?.sameSite??"lax",path:n?.path??"/"})})}catch{}}}})});e.s(["createClient",0,a])}];

//# debugId=140d8c2e-9194-fcff-7d37-77ba8ed7803e
//# sourceMappingURL=%5Broot-of-the-server%5D__1c1uobq._.js.map