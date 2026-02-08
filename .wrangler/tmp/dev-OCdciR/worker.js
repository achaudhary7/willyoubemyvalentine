var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var ALLOWED_ORIGINS = [
  "https://willyoubemyvalentine.fun",
  "https://www.willyoubemyvalentine.fun",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080"
];
function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  if (!origin) {
    return "https://willyoubemyvalentine.fun";
  }
  return null;
}
__name(getAllowedOrigin, "getAllowedOrigin");
function corsHeaders(request) {
  const origin = getAllowedOrigin(request);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(data, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, request, status = 400) {
  return jsonResponse({ error: message }, request, status);
}
__name(errorResponse, "errorResponse");
function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>"'&]/g, "").trim().substring(0, 100);
}
__name(sanitize, "sanitize");
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      const origin2 = getAllowedOrigin(request);
      if (!origin2) {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (method === "POST" && path === "/api/valentine") {
        const body = await request.json();
        const trackingId = sanitize(body.trackingId);
        const senderName = sanitize(body.senderName);
        if (!trackingId || !senderName) {
          return errorResponse("trackingId and senderName are required", request);
        }
        await env.DB.prepare(
          "INSERT OR IGNORE INTO valentines (tracking_id, sender_name, created_at, views, yes_clicked, yes_clicked_at) VALUES (?, ?, ?, 0, 0, NULL)"
        ).bind(trackingId, senderName, Date.now()).run();
        return jsonResponse({ success: true, trackingId }, request);
      }
      if (method === "POST" && path.match(/^\/api\/valentine\/[^/]+\/view$/)) {
        const id = sanitize(path.split("/")[3]);
        await env.DB.prepare(
          "UPDATE valentines SET views = views + 1 WHERE tracking_id = ?"
        ).bind(id).run();
        return jsonResponse({ success: true }, request);
      }
      if (method === "POST" && path.match(/^\/api\/valentine\/[^/]+\/yes$/)) {
        const id = sanitize(path.split("/")[3]);
        await env.DB.prepare(
          "UPDATE valentines SET yes_clicked = 1, yes_clicked_at = ? WHERE tracking_id = ?"
        ).bind(Date.now(), id).run();
        return jsonResponse({ success: true }, request);
      }
      if (method === "GET" && path.match(/^\/api\/valentine\/[^/]+$/)) {
        const id = sanitize(path.split("/")[3]);
        const result = await env.DB.prepare(
          "SELECT * FROM valentines WHERE tracking_id = ?"
        ).bind(id).first();
        if (!result) {
          return errorResponse("Valentine not found", request, 404);
        }
        return jsonResponse({
          senderName: result.sender_name,
          createdAt: result.created_at,
          views: result.views,
          yesClicked: result.yes_clicked === 1,
          yesClickedAt: result.yes_clicked_at
        }, request);
      }
      if (method === "POST" && path === "/api/ecard") {
        const body = await request.json();
        const ecardId = sanitize(body.ecardId);
        const from = sanitize(body.from);
        const to = sanitize(body.to);
        const theme = sanitize(body.theme) || "classic";
        const message = (body.message || "").replace(/[<>"']/g, "").trim().substring(0, 500);
        if (!ecardId || !from || !to) {
          return errorResponse("ecardId, from, and to are required", request);
        }
        await env.DB.prepare(
          "INSERT OR IGNORE INTO ecards (ecard_id, from_name, to_name, theme, message, created_at, viewed, responded, responded_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL)"
        ).bind(ecardId, from, to, theme, message, Date.now()).run();
        return jsonResponse({ success: true, ecardId }, request);
      }
      if (method === "GET" && path.match(/^\/api\/ecard\/[^/]+$/)) {
        const id = sanitize(path.split("/")[3]);
        const result = await env.DB.prepare(
          "SELECT * FROM ecards WHERE ecard_id = ?"
        ).bind(id).first();
        if (!result) {
          return errorResponse("E-card not found", request, 404);
        }
        return jsonResponse({
          from: result.from_name,
          to: result.to_name,
          theme: result.theme,
          message: result.message,
          createdAt: result.created_at,
          viewed: result.viewed === 1,
          responded: result.responded === 1,
          respondedAt: result.responded_at
        }, request);
      }
      if (method === "POST" && path.match(/^\/api\/ecard\/[^/]+\/view$/)) {
        const id = sanitize(path.split("/")[3]);
        await env.DB.prepare(
          "UPDATE ecards SET viewed = 1 WHERE ecard_id = ?"
        ).bind(id).run();
        return jsonResponse({ success: true }, request);
      }
      if (method === "POST" && path.match(/^\/api\/ecard\/[^/]+\/respond$/)) {
        const id = sanitize(path.split("/")[3]);
        await env.DB.prepare(
          "UPDATE ecards SET responded = 1, responded_at = ? WHERE ecard_id = ?"
        ).bind(Date.now(), id).run();
        return jsonResponse({ success: true }, request);
      }
      return errorResponse("Not found", request, 404);
    } catch (err) {
      console.error("Worker error:", err);
      return errorResponse("Internal server error", request, 500);
    }
  }
};

// ../../Users/DELL/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../Users/DELL/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-ircs2t/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../Users/DELL/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-ircs2t/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
