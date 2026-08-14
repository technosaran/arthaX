self.__SERVER_FILES_MANIFEST={
  "version": 1,
  "config": {
    "env": {
      "_sentryRewriteFramesDistDir": ".next",
      "_sentryRewriteFramesAssetPrefixPath": "",
      "_sentryRelease": "d50e0116849c086687e23216f20bb96931d489b8"
    },
    "webpack": null,
    "typescript": {
      "ignoreBuildErrors": false
    },
    "typedRoutes": false,
    "distDir": ".next",
    "cleanDistDir": true,
    "assetPrefix": "",
    "cacheMaxMemorySize": 52428800,
    "configOrigin": "next.config.ts",
    "useFileSystemPublicRoutes": true,
    "generateEtags": true,
    "pageExtensions": [
      "tsx",
      "ts",
      "jsx",
      "js"
    ],
    "instrumentationClientInject": [],
    "poweredByHeader": true,
    "compress": true,
    "images": {
      "deviceSizes": [
        640,
        750,
        828,
        1080,
        1200,
        1920,
        2048,
        3840
      ],
      "imageSizes": [
        32,
        48,
        64,
        96,
        128,
        256,
        384
      ],
      "path": "/_next/image",
      "loader": "default",
      "loaderFile": "",
      "domains": [],
      "disableStaticImages": false,
      "minimumCacheTTL": 14400,
      "formats": [
        "image/webp"
      ],
      "maximumRedirects": 3,
      "maximumResponseBody": 50000000,
      "dangerouslyAllowLocalIP": false,
      "dangerouslyAllowSVG": false,
      "contentSecurityPolicy": "script-src 'none'; frame-src 'none'; sandbox;",
      "contentDispositionType": "attachment",
      "localPatterns": [
        {
          "pathname": "**",
          "search": ""
        }
      ],
      "remotePatterns": [
        {
          "protocol": "https",
          "hostname": "assets.groww.in"
        },
        {
          "protocol": "https",
          "hostname": "cdn.jsdelivr.net"
        },
        {
          "protocol": "https",
          "hostname": "raw.githubusercontent.com"
        },
        {
          "protocol": "https",
          "hostname": "www.google.com"
        },
        {
          "protocol": "https",
          "hostname": "img.logo.dev"
        }
      ],
      "qualities": [
        75
      ],
      "unoptimized": false,
      "customCacheHandler": false
    },
    "devIndicators": {
      "position": "bottom-left"
    },
    "onDemandEntries": {
      "maxInactiveAge": 60000,
      "pagesBufferLength": 5
    },
    "basePath": "",
    "sassOptions": {},
    "trailingSlash": false,
    "i18n": null,
    "productionBrowserSourceMaps": false,
    "excludeDefaultMomentLocales": true,
    "reactProductionProfiling": false,
    "reactStrictMode": null,
    "reactMaxHeadersLength": 6000,
    "httpAgentOptions": {
      "keepAlive": true
    },
    "logging": {
      "serverFunctions": true,
      "browserToTerminal": "warn"
    },
    "compiler": {},
    "expireTime": 31536000,
    "staticPageGenerationTimeout": 60,
    "modularizeImports": {
      "@mui/icons-material": {
        "transform": "@mui/icons-material/{{member}}"
      },
      "lodash": {
        "transform": "lodash/{{member}}"
      }
    },
    "outputFileTracingRoot": "C:\\Users\\saran\\Desktop\\dashboard",
    "enablePrerenderSourceMaps": true,
    "cacheComponents": false,
    "cacheLife": {
      "default": {
        "stale": 180,
        "revalidate": 900,
        "expire": 4294967294
      },
      "seconds": {
        "stale": 30,
        "revalidate": 1,
        "expire": 60
      },
      "minutes": {
        "stale": 300,
        "revalidate": 60,
        "expire": 3600
      },
      "hours": {
        "stale": 300,
        "revalidate": 3600,
        "expire": 86400
      },
      "days": {
        "stale": 300,
        "revalidate": 86400,
        "expire": 604800
      },
      "weeks": {
        "stale": 300,
        "revalidate": 604800,
        "expire": 2592000
      },
      "max": {
        "stale": 300,
        "revalidate": 2592000,
        "expire": 31536000
      }
    },
    "cacheHandlers": {},
    "experimental": {
      "appNewScrollHandler": true,
      "coldCacheBadge": false,
      "devValidationWorker": true,
      "useSkewCookie": false,
      "cssChunking": true,
      "multiZoneDraftMode": false,
      "appNavFailHandling": false,
      "prerenderEarlyExit": true,
      "serverMinification": true,
      "linkNoTouchStart": false,
      "caseSensitiveRoutes": false,
      "cachedNavigations": false,
      "dynamicOnHover": false,
      "useOffline": false,
      "varyParams": true,
      "optimisticRouting": true,
      "instrumentationClientRouterTransitionEvents": false,
      "prefetchInlining": {
        "maxSize": 2048,
        "maxBundleSize": 10240
      },
      "preloadEntriesOnStart": true,
      "clientRouterFilter": true,
      "clientRouterFilterRedirects": false,
      "fetchCacheKeyPrefix": "",
      "proxyPrefetch": "flexible",
      "optimisticClientCache": true,
      "manualClientBasePath": false,
      "cpus": 11,
      "memoryBasedWorkersCount": false,
      "imgOptConcurrency": null,
      "imgOptOperationCache": null,
      "imgOptTimeoutInSeconds": 7,
      "imgOptMaxInputPixels": 268402689,
      "imgOptSequentialRead": null,
      "isrFlushToDisk": true,
      "workerThreads": false,
      "optimizeCss": false,
      "nextScriptWorkers": false,
      "scrollRestoration": false,
      "externalDir": false,
      "devMemoryThresholdRestart": true,
      "disableOptimizedLoading": false,
      "gzipSize": true,
      "craCompat": false,
      "esmExternals": true,
      "fullySpecified": false,
      "swcTraceProfiling": false,
      "forceSwcTransforms": false,
      "requestInsights": false,
      "largePageDataBytes": 128000,
      "typedEnv": false,
      "clientTraceMetadata": [
        "baggage",
        "sentry-trace"
      ],
      "parallelServerCompiles": false,
      "parallelServerBuildTraces": false,
      "ppr": false,
      "authInterrupts": false,
      "webpackMemoryOptimizations": false,
      "optimizeServerReact": true,
      "strictRouteTypes": false,
      "useTypeScriptCli": true,
      "removeUncaughtErrorAndRejectionListeners": false,
      "validateRSCRequestHeaders": true,
      "staleTimes": {
        "dynamic": 0,
        "static": 180
      },
      "reactDebugChannel": true,
      "serverComponentsHmrCache": true,
      "serverComponentsHmrCancellation": false,
      "staticGenerationMaxConcurrency": 8,
      "staticGenerationMinPagesPerWorker": 25,
      "transitionIndicator": false,
      "gestureTransition": false,
      "inlineCss": false,
      "useCache": false,
      "globalNotFound": false,
      "browserDebugInfoInTerminal": "warn",
      "lockDistDir": true,
      "proxyClientMaxBodySize": 10485760,
      "hideLogsAfterAbort": false,
      "mcpServer": true,
      "turbopackFileSystemCacheForDev": true,
      "turbopackFileSystemCacheForBuild": true,
      "turbopackInferModuleSideEffects": true,
      "turbopackPluginRuntimeStrategy": "childProcesses",
      "turbopackMemoryEvictionMode": "auto",
      "optimizePackageImports": [
        "lucide-react",
        "date-fns",
        "lodash-es",
        "ramda",
        "antd",
        "react-bootstrap",
        "ahooks",
        "@ant-design/icons",
        "@headlessui/react",
        "@headlessui-float/react",
        "@heroicons/react/20/solid",
        "@heroicons/react/24/solid",
        "@heroicons/react/24/outline",
        "@visx/visx",
        "@tremor/react",
        "rxjs",
        "@mui/material",
        "@mui/icons-material",
        "recharts",
        "react-use",
        "effect",
        "@effect/schema",
        "@effect/platform",
        "@effect/platform-node",
        "@effect/platform-browser",
        "@effect/platform-bun",
        "@effect/sql",
        "@effect/sql-mssql",
        "@effect/sql-mysql2",
        "@effect/sql-pg",
        "@effect/sql-sqlite-node",
        "@effect/sql-sqlite-bun",
        "@effect/sql-sqlite-wasm",
        "@effect/sql-sqlite-react-native",
        "@effect/rpc",
        "@effect/rpc-http",
        "@effect/typeclass",
        "@effect/experimental",
        "@effect/opentelemetry",
        "@material-ui/core",
        "@material-ui/icons",
        "@tabler/icons-react",
        "mui-core",
        "react-icons/ai",
        "react-icons/bi",
        "react-icons/bs",
        "react-icons/cg",
        "react-icons/ci",
        "react-icons/di",
        "react-icons/fa",
        "react-icons/fa6",
        "react-icons/fc",
        "react-icons/fi",
        "react-icons/gi",
        "react-icons/go",
        "react-icons/gr",
        "react-icons/hi",
        "react-icons/hi2",
        "react-icons/im",
        "react-icons/io",
        "react-icons/io5",
        "react-icons/lia",
        "react-icons/lib",
        "react-icons/lu",
        "react-icons/md",
        "react-icons/pi",
        "react-icons/ri",
        "react-icons/rx",
        "react-icons/si",
        "react-icons/sl",
        "react-icons/tb",
        "react-icons/tfi",
        "react-icons/ti",
        "react-icons/vsc",
        "react-icons/wi"
      ],
      "useCacheTimeout": 54,
      "instantInsights": {
        "validationLevel": "warning"
      },
      "trustHostHeader": false,
      "isExperimentalCompile": false
    },
    "htmlLimitedBots": "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight",
    "bundlePagesRouterDependencies": false,
    "configFileName": "next.config.ts",
    "serverExternalPackages": [
      "@react-pdf/renderer",
      "amqplib",
      "connect",
      "dataloader",
      "express",
      "generic-pool",
      "graphql",
      "@hapi/hapi",
      "ioredis",
      "kafkajs",
      "koa",
      "lru-memoizer",
      "mongodb",
      "mongoose",
      "mysql",
      "mysql2",
      "knex",
      "pg",
      "pg-pool",
      "@node-redis/client",
      "@redis/client",
      "redis",
      "tedious"
    ],
    "turbopack": {
      "debugIds": true,
      "rules": {
        "**/instrumentation-client.*": {
          "condition": {
            "not": "foreign"
          },
          "loaders": [
            {
              "loader": "C:\\Users\\saran\\Desktop\\dashboard\\node_modules\\@sentry\\nextjs\\build\\cjs\\config\\loaders\\valueInjectionLoader.js",
              "options": {
                "values": {
                  "_sentryRouteManifest": "{\"dynamicRoutes\":[],\"staticRoutes\":[{\"path\":\"/\"},{\"path\":\"/dashboard\"},{\"path\":\"/dashboard/accounts\"},{\"path\":\"/dashboard/admin\"},{\"path\":\"/dashboard/alternative-assets\"},{\"path\":\"/dashboard/bonds\"},{\"path\":\"/dashboard/budget\"},{\"path\":\"/dashboard/expenses\"},{\"path\":\"/dashboard/family\"},{\"path\":\"/dashboard/fno\"},{\"path\":\"/dashboard/forex\"},{\"path\":\"/dashboard/goals\"},{\"path\":\"/dashboard/income\"},{\"path\":\"/dashboard/investments\"},{\"path\":\"/dashboard/ledger\"},{\"path\":\"/dashboard/liabilities\"},{\"path\":\"/dashboard/mutual-funds\"},{\"path\":\"/dashboard/settings\"},{\"path\":\"/dashboard/stocks\"},{\"path\":\"/dashboard/tax-reports\"},{\"path\":\"/dashboard/transactions\"},{\"path\":\"/login\"},{\"path\":\"/privacy\"},{\"path\":\"/reset-password\"},{\"path\":\"/reset-password/update\"},{\"path\":\"/terms\"}],\"isrRoutes\":[]}",
                  "_sentryNextJsVersion": "16.3.0"
                }
              }
            }
          ]
        },
        "**/instrumentation.*": {
          "condition": {
            "not": "foreign"
          },
          "loaders": [
            {
              "loader": "C:\\Users\\saran\\Desktop\\dashboard\\node_modules\\@sentry\\nextjs\\build\\cjs\\config\\loaders\\valueInjectionLoader.js",
              "options": {
                "values": {
                  "__SENTRY_SERVER_MODULES__": {
                    "@react-pdf/renderer": "^4.5.1",
                    "@sentry/nextjs": "^10.63.0",
                    "@supabase/ssr": "^0.12.3",
                    "@supabase/supabase-js": "^2.112.2",
                    "@tanstack/react-table": "^8.21.3",
                    "@vercel/analytics": "^2.0.1",
                    "clsx": "^2.1.1",
                    "date-fns": "^4.1.0",
                    "framer-motion": "^12.39.0",
                    "lucide-react": "^1.29.0",
                    "next": "^16.2.3",
                    "react": "^19.2.8",
                    "react-dom": "^19.2.8",
                    "react-hot-toast": "^2.6.0",
                    "react-qr-code": "^2.2.0",
                    "recharts": "^3.8.1",
                    "swr": "^2.4.1",
                    "tailwind-merge": "^3.6.0",
                    "zod": "^4.4.3",
                    "zxcvbn": "^4.4.2",
                    "@finance-os/db": "*",
                    "@finance-os/shared-types": "*",
                    "@tailwindcss/postcss": "^4",
                    "@types/react": "^19",
                    "@types/react-dom": "^19",
                    "@types/zxcvbn": "^4.4.5",
                    "eslint": "^9",
                    "eslint-config-next": "^16.2.3",
                    "tailwindcss": "^4"
                  },
                  "_sentryNextJsVersion": "16.3.0"
                }
              }
            }
          ]
        }
      },
      "root": "C:\\Users\\saran\\Desktop\\dashboard"
    },
    "repoRoot": "C:\\Users\\saran\\Desktop\\dashboard",
    "distDirRoot": ".next"
  },
  "appDir": "C:\\Users\\saran\\Desktop\\dashboard\\apps\\web",
  "relativeAppDir": "apps\\web",
  "files": [
    ".next\\package.json",
    ".next\\routes-manifest.json",
    ".next\\server\\pages-manifest.json",
    ".next\\build-manifest.json",
    ".next\\prerender-manifest.json",
    ".next\\server\\functions-config-manifest.json",
    ".next\\server\\middleware-manifest.json",
    ".next\\server\\middleware-build-manifest.js",
    ".next\\server\\app-paths-manifest.json",
    ".next\\app-path-routes-manifest.json",
    ".next\\server\\server-reference-manifest.js",
    ".next\\server\\server-reference-manifest.json",
    ".next\\server\\prefetch-hints.json",
    ".next\\BUILD_ID",
    ".next\\server\\next-font-manifest.js",
    ".next\\server\\next-font-manifest.json",
    ".next\\required-server-files.json"
  ],
  "ignore": []
}